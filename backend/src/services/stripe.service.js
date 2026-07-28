const feeService = require("./fee.service");

let _stripe = null;

async function _getStripe() {
  if (_stripe) return _stripe;
  const key = await feeService.getSetting("us_stripe_secret_key");
  if (!key) throw new Error("Stripe not configured — set us_stripe_secret_key in admin settings");
  _stripe = require("stripe")(key);
  return _stripe;
}

async function createPaymentIntent(orderId, amountUSD, currency = "usd") {
  const stripe = await _getStripe();
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(amountUSD * 100), // cents
    currency,
    metadata: { orderId: orderId.toString() },
  });
  return { clientSecret: intent.client_secret, intentId: intent.id };
}

// Hosted Stripe Checkout — redirect the customer to Stripe's secure page.
async function createCheckoutSession(order, successUrl, cancelUrl, currency = "usd") {
  const stripe = await _getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency,
          product_data: { name: `DamnDeal Order ${order.orderNumber}` },
          unit_amount: Math.round(order.grandTotal * 100), // cents
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { orderId: order._id.toString() },
    payment_intent_data: { metadata: { orderId: order._id.toString() } },
  });
  return { url: session.url, sessionId: session.id };
}

async function retrieveSession(sessionId) {
  const stripe = await _getStripe();
  return stripe.checkout.sessions.retrieve(sessionId);
}

async function verifyWebhookSignature(rawBody, signature) {
  const stripe = await _getStripe();
  const secret = await feeService.getSetting("us_stripe_webhook_secret");
  if (!secret) throw new Error("Stripe webhook secret not configured");
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

// Refund a Stripe payment. amountUSD omitted => full refund.
async function refundPayment(paymentIntentId, amountUSD) {
  if (!paymentIntentId) throw new Error("No Stripe payment intent on this order");
  const stripe = await _getStripe();
  const params = { payment_intent: paymentIntentId };
  if (amountUSD != null) params.amount = Math.round(amountUSD * 100); // cents
  const refund = await stripe.refunds.create(params);
  return { refundId: refund.id, status: refund.status };
}

module.exports = { createPaymentIntent, createCheckoutSession, retrieveSession, verifyWebhookSignature, refundPayment };
