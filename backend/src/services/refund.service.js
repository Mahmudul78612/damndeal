/**
 * Refund a PAID order to its original payment method when it is cancelled.
 *  - US (damndeal.com): Stripe refund to the card.
 *  - India: credit back to the customer's wallet (same as the returns flow).
 * Mutates order.paymentStatus/refundId but does NOT save — the caller saves.
 * Throws on a failed Stripe refund so the caller can surface it.
 */
const stripeService = require("./stripe.service");
const walletService = require("./wallet.service");
const cjService = require("./cj.service");

async function refundPaidOrder(order, reason = "Order cancelled") {
  // Cancel the CJ order first so we aren't charged for it (best-effort, never throws).
  if (order && order.cjOrderId) {
    const c = await cjService.cancelCJOrder(order.cjOrderId);
    if (c.ok) {
      order.cjOrderStatus = "CANCELLED";
      console.log(`[CANCEL] CJ order ${order.cjOrderId} cancelled for ${order.orderNumber}`);
    } else {
      console.warn(`[CANCEL] CJ cancel failed for ${order.orderNumber}: ${c.message}`);
    }
  }

  if (!order || order.paymentStatus !== "paid") return { refunded: false, reason: "not paid" };

  if (order.region === "US") {
    if (!order.stripePaymentIntentId) {
      // Paid but no intent id recorded — mark refunded so it isn't double-handled.
      order.paymentStatus = "refunded";
      return { refunded: false, reason: "no stripe intent on order" };
    }
    try {
      const r = await stripeService.refundPayment(order.stripePaymentIntentId, order.grandTotal);
      order.refundId = r.refundId;
      order.paymentStatus = "refunded";
      return { refunded: true, method: "stripe", refundId: r.refundId };
    } catch (e) {
      // Already refunded on Stripe's side → the money is back; don't block the cancel.
      if (/already.*been refunded|already.*refunded/i.test(e.message || "")) {
        order.paymentStatus = "refunded";
        return { refunded: true, method: "stripe", note: "already refunded on Stripe" };
      }
      throw e;
    }
  }

  // India: refund to wallet
  await walletService.credit(
    order.user, order.grandTotal, "refund",
    `${reason} — ${order.orderNumber}`, order._id.toString()
  );
  order.paymentStatus = "refunded";
  return { refunded: true, method: "wallet" };
}

module.exports = { refundPaidOrder };
