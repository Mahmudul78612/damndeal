const ReturnRequest = require("../../../models/ReturnRequest");
const Order = require("../../../models/Order");
const Product = require("../../../models/Product");
const InventoryLog = require("../../../models/InventoryLog");
const walletService = require("../../../services/wallet.service");
const magicClub = require("../../../services/magicclub.service");
const stripeService = require("../../../services/stripe.service");

// GET /admin/returns
async function listReturns(req, res) {
  const { page = 1, limit = 20, status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [returns, total] = await Promise.all([
    ReturnRequest.find(filter)
      .populate("user", "name phone")
      .populate("partner", "name phone")
      .populate("order", "orderNumber grandTotal")
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    ReturnRequest.countDocuments(filter),
  ]);

  return res.json({
    success: true, returns,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// PUT /admin/returns/:id/review — approve or reject
async function reviewReturn(req, res) {
  const { action, note } = req.body; // action: "approve" | "reject"
  const ret = await ReturnRequest.findById(req.params.id);
  if (!ret) return res.status(404).json({ success: false, message: "Return request not found" });

  if (ret.status !== "requested") {
    return res.status(400).json({ success: false, message: "Already reviewed" });
  }

  ret.reviewedBy = req.user.userId;
  ret.reviewNote = note || null;
  ret.reviewedAt = new Date();

  if (action === "approve") {
    ret.status = "approved";

    // Restore stock
    for (const item of ret.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
        await InventoryLog.create({
          partner: ret.partner, product: product._id, type: "return",
          quantity: item.quantity, stockAfter: product.stock, reference: `RETURN-${ret._id}`,
        });
      }
    }

    const ord = await Order.findById(ret.order);

    // Refund — US (damndeal.com) → Stripe to original card; India → wallet credit
    if (ord && ord.region === "US") {
      try {
        if (ord.stripePaymentIntentId && ord.paymentStatus === "paid") {
          const r = await stripeService.refundPayment(ord.stripePaymentIntentId, ret.totalRefundAmount);
          ord.refundId = r.refundId;
        }
      } catch (e) {
        console.error("[RETURN] Stripe refund failed:", e.message);
        return res.status(502).json({ success: false, message: `Stripe refund failed: ${e.message}` });
      }
    } else {
      await walletService.credit(
        ret.user, ret.totalRefundAmount, "refund",
        `Refund for return #${ret._id}`, ret.order.toString()
      );
    }

    ret.status = "refunded";

    // Update order status + payment status
    if (ord) {
      ord.status = "returned";
      ord.paymentStatus = "refunded";
      await ord.save();

      // Magic Club (India only): cancel clubs + reverse redemption (best-effort)
      if (ord.region !== "US") {
        try {
          if (ord.magicClub?.debit?.transactionId && !ord.magicClub.debit.reversedAt) {
            const rev = await magicClub.reverseDebit(ord.magicClub.debit.transactionId);
            if (rev.ok) { ord.magicClub.debit.reversedAt = new Date(); await ord.save(); }
          }
          magicClub.onOrderCancelled(ord).catch(() => {});
        } catch (e) { console.error("[MAGICCLUB] return-refund hook err:", e.message); }
      }
    }
  } else {
    ret.status = "rejected";
  }

  await ret.save();
  return res.json({ success: true, returnRequest: ret });
}

module.exports = { listReturns, reviewReturn };
