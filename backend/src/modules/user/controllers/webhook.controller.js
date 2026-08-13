/**
 * Stripe webhook — reliable payment confirmation for US (damndeal.com).
 * Mounted with express.raw() BEFORE express.json() so the signature can be
 * verified against the raw body. Catches payments even if the customer never
 * returns to the success page.
 */
const stripeService = require("../../../services/stripe.service");
const couponBilling = require("../../../services/couponBilling.service");
const Order = require("../../../models/Order");
const Payment = require("../../../models/Payment");
const User = require("../../../models/User");
const { notifyOrderPlaced } = require("../../../services/notification.service");

async function stripeWebhook(req, res) {
  let event;
  try {
    event = await stripeService.verifyWebhookSignature(req.body, req.headers["stripe-signature"]);
  } catch (e) {
    console.error("[STRIPE WEBHOOK] signature verify failed:", e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        // Coupon credit packs and storefront orders share this endpoint;
        // the metadata says which one this payment belongs to.
        if (session.metadata?.packOrderId) {
          await couponBilling.grantCredits(session.metadata.packOrderId, {
            gatewayPaymentId: session.payment_intent, gateway: "stripe",
          });
        } else {
          await _markPaid(session.metadata?.orderId, session.payment_intent, session.id);
        }
      }
    } else if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      if (intent.metadata?.packOrderId) {
        await couponBilling.grantCredits(intent.metadata.packOrderId, {
          gatewayPaymentId: intent.id, gateway: "stripe",
        });
      } else {
        await _markPaid(intent.metadata?.orderId, intent.id, null);
      }
    }
  } catch (e) {
    console.error("[STRIPE WEBHOOK] handler error:", e.message);
    // Still 200 so Stripe doesn't retry forever on our internal errors.
  }

  return res.json({ received: true });
}

async function _markPaid(orderId, paymentIntentId, sessionId) {
  if (!orderId) return;
  const order = await Order.findById(orderId);
  if (!order || order.paymentStatus === "paid") return; // idempotent

  // Order was already auto-cancelled (abandoned) but the payment arrived late →
  // refund it instead of resurrecting a cancelled order.
  if (order.status === "cancelled") {
    try {
      if (paymentIntentId) await stripeService.refundPayment(paymentIntentId);
      order.paymentStatus = "refunded";
      await order.save();
      console.warn(`[STRIPE WEBHOOK] Late payment on cancelled order ${order.orderNumber} → auto-refunded`);
    } catch (e) { console.error("[STRIPE WEBHOOK] late-refund err:", e.message); }
    return;
  }

  order.paymentStatus = "paid";
  order.paymentMethod = "stripe";
  if (paymentIntentId) order.stripePaymentIntentId = String(paymentIntentId);
  await order.save();

  if (sessionId) {
    await Payment.findOneAndUpdate({ order: order._id, stripeIntentId: sessionId }, { status: "paid" });
  }

  try {
    const u = await User.findById(order.user).select("name phone email").lean();
    if (u) notifyOrderPlaced(order, u);
  } catch (e) { console.error("[STRIPE WEBHOOK] notify err:", e.message); }

  try { await require("./order.controller").forwardCJForOrder(order._id); }
  catch (e) { console.error("[STRIPE WEBHOOK] CJ forward err:", e.message); }
}

module.exports = { stripeWebhook };
