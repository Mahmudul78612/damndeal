/**
 * Unified Shipping Service
 * Wraps Delhivery and FShip behind a single interface
 */
const delhivery = require("./delhivery.service");
const fship = require("./fship.service");
const AppSettings = require("../models/AppSettings");
const Order = require("../models/Order");
const User = require("../models/User");
const { notifyUser, notifyOrderShipped, notifyOrderCancelled } = require("./notification.service");

function getProvider(name) {
  if (name === "delhivery") return delhivery;
  if (name === "fship") return fship;
  throw new Error(`Unknown shipping provider: ${name}`);
}

async function getDefaultProvider() {
  const doc = await AppSettings.findOne({ key: "shipping_default_provider" });
  return doc?.value || "none";
}

/**
 * Ship an order via the chosen (or default) provider
 */
async function shipOrder(orderId, providerName) {
  const order = await Order.findById(orderId)
    .populate("user", "name phone")
    .populate("items.product", "sku");

  if (!order) throw new Error("Order not found");
  if (order.shipping?.awb) throw new Error("Order already shipped via courier");

  const provider = providerName || (await getDefaultProvider());
  if (!provider || provider === "none") throw new Error("No shipping provider configured");

  const svc = getProvider(provider);
  const result = await svc.createShipment(order);

  // Update order with shipping details
  order.shipping = {
    provider,
    awb: result.awb,
    shipmentId: result.shipmentId,
    label: result.label,
    trackingUrl: result.trackingUrl,
    courierName: result.courierName,
    status: result.status,
    statusDetail: "",
    shippedAt: new Date(),
    weight: order.shipping?.weight || 0,
    dimensions: order.shipping?.dimensions || {},
    events: [
      {
        status: result.status,
        location: "",
        timestamp: new Date(),
        description: `Shipment created via ${provider}`,
      },
    ],
  };
  order.status = "shipped";
  order.deliveryStatus = "picked_up";
  await order.save();

  // WhatsApp 'on the way' notification (fire-and-forget)
  setImmediate(async () => {
    try {
      const u = await User.findById(order.user).select("name phone").lean();
      if (u) notifyOrderShipped(order, u);
    } catch (e) { console.error("notifyOrderShipped (provider) err:", e.message); }
  });

  // Try to get label URL if not returned in create
  if (!order.shipping.label && result.awb) {
    try {
      const label = await svc.getLabel(result.awb);
      if (label) {
        order.shipping.label = typeof label === "string" ? label : label;
        await order.save();
      }
    } catch (_) { /* label fetch is optional */ }
  }

  // Notify user about shipment
  if (order.user) {
    try {
      const user = await User.findById(order.user);
      if (user) await notifyUser(user, "orderShipped", order);
    } catch (_) { /* notification is best-effort */ }
  }

  return order;
}

/**
 * Track an order's shipment and update DB
 */
async function trackOrder(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (!order.shipping?.awb || !order.shipping?.provider) {
    throw new Error("Order has no shipment to track");
  }

  const svc = getProvider(order.shipping.provider);
  const result = await svc.trackShipment(order.shipping.awb);

  // Update order shipping details
  order.shipping.status = result.status;
  order.shipping.statusDetail = result.statusDetail;
  if (result.estimatedDelivery) {
    order.shipping.estimatedDelivery = result.estimatedDelivery;
  }
  if (result.events?.length) {
    order.shipping.events = result.events;
  }

  // Map courier status to order status
  if (result.delivered && order.status !== "delivered") {
    order.status = "delivered";
    order.deliveryStatus = "delivered";
    order.deliveredAt = new Date();
  }

  await order.save();
  return { order, tracking: result };
}

/**
 * Cancel shipment
 */
async function cancelShipment(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (!order.shipping?.awb || !order.shipping?.provider) {
    throw new Error("Order has no shipment to cancel");
  }

  const svc = getProvider(order.shipping.provider);
  const result = await svc.cancelShipment(order.shipping.awb);

  order.shipping.status = "Cancelled";
  order.shipping.events = order.shipping.events || [];
  order.shipping.events.push({
    status: "Cancelled",
    location: "",
    timestamp: new Date(),
    description: "Shipment cancelled",
  });
  await order.save();

  return { order, result };
}

/**
 * Check pincode serviceability
 */
async function checkPincode(pincode, providerName) {
  const provider = providerName || (await getDefaultProvider());
  if (!provider || provider === "none") {
    throw new Error("No shipping provider configured");
  }
  const svc = getProvider(provider);
  return svc.checkPincode(pincode);
}

/**
 * Process webhook from shipping providers
 */
async function processWebhook(provider, payload) {
  let awb, status, statusDetail, location, timestamp, description, delivered;

  if (provider === "delhivery") {
    // Delhivery sends: { Awb, ShipmentId, Status: {Status, StatusType, ...}, ... }
    awb = payload.Awb || payload.waybill;
    const st = payload.Status || {};
    status = st.Status || payload.status || "";
    statusDetail = st.StatusType || st.Instructions || "";
    location = st.StatusLocation || payload.location || "";
    timestamp = payload.ScanDateTime ? new Date(payload.ScanDateTime) : new Date();
    description = st.Instructions || "";
    delivered = status.toLowerCase() === "delivered";
  } else if (provider === "fship") {
    // FShip sends: { awb_number, status, description, location, timestamp, ... }
    awb = payload.awb_number || payload.awb;
    status = payload.current_status || payload.status || "";
    statusDetail = payload.status_description || payload.description || "";
    location = payload.location || "";
    timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();
    description = payload.description || payload.remark || "";
    delivered = status.toLowerCase().includes("delivered");
  } else {
    throw new Error(`Unknown webhook provider: ${provider}`);
  }

  if (!awb) throw new Error("No AWB in webhook payload");

  const order = await Order.findOne({ "shipping.awb": awb });
  if (!order) throw new Error(`No order found with AWB: ${awb}`);

  // Update shipping status
  order.shipping.status = status;
  order.shipping.statusDetail = statusDetail;

  // Add event
  order.shipping.events.push({ status, location, timestamp, description });

  // Map to order status
  const statusLower = status.toLowerCase();
  if (delivered && order.status !== "delivered") {
    order.status = "delivered";
    order.deliveryStatus = "delivered";
    order.deliveredAt = new Date();
  } else if (statusLower.includes("in transit") || statusLower.includes("on the way") || statusLower.includes("out for delivery")) {
    if (order.deliveryStatus !== "delivered") {
      order.deliveryStatus = "on_the_way";
    }
  } else if (statusLower.includes("rto") || statusLower.includes("returned")) {
    order.status = "returned";
  }

  await order.save();

  // Send push notification for shipping updates
  if (order.user) {
    try {
      const user = await User.findById(order.user);
      if (user) {
        const statusLower = status.toLowerCase();
        if (delivered) {
          await notifyUser(user, "shipmentDelivered", order);
        } else if (statusLower.includes("out for delivery")) {
          await notifyUser(user, "shipmentOutForDelivery", order);
        } else {
          await notifyUser(user, "shipmentUpdate", order, status);
        }
      }
    } catch (_) { /* notification is best-effort */ }
  }

  return { orderId: order._id, orderNumber: order.orderNumber, status, delivered };
}

// ─── New Delhivery-specific pass-through functions ───

/**
 * Get Expected TAT between two pincodes
 */
async function getExpectedTAT(originPin, destinationPin, paymentMode) {
  return delhivery.getExpectedTAT(originPin, destinationPin, paymentMode);
}

/**
 * Fetch pre-assigned waybill numbers
 */
async function fetchWaybill(count) {
  return delhivery.fetchWaybill(count);
}

/**
 * Update shipment details (address, phone, etc.)
 */
async function updateShipment(orderId, updates) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (!order.shipping?.awb) throw new Error("Order has no shipment");

  const result = await delhivery.updateShipment(order.shipping.awb, updates);

  order.shipping.events.push({
    status: "Updated",
    location: "",
    timestamp: new Date(),
    description: `Shipment details updated: ${Object.keys(updates).join(", ")}`,
  });
  await order.save();

  return { order, result };
}

/**
 * Calculate shipping cost
 */
async function calculateShippingCost(params) {
  return delhivery.calculateShippingCost(params);
}

/**
 * Create pickup request
 */
async function createPickupRequest(params) {
  return delhivery.createPickupRequest(params);
}

/**
 * Create client warehouse
 */
async function createWarehouse(params) {
  return delhivery.createWarehouse(params);
}

/**
 * Update client warehouse
 */
async function updateWarehouse(params) {
  return delhivery.updateWarehouse(params);
}

/**
 * Update e-waybill number for shipment
 */
async function updateEwaybill(orderId, ewaybillNumber) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (!order.shipping?.awb) throw new Error("Order has no shipment");

  const result = await delhivery.updateEwaybill(order.shipping.awb, ewaybillNumber);

  order.shipping.events.push({
    status: "E-Waybill Updated",
    location: "",
    timestamp: new Date(),
    description: `E-waybill: ${ewaybillNumber}`,
  });
  await order.save();

  return { order, result };
}

module.exports = {
  shipOrder,
  trackOrder,
  cancelShipment,
  checkPincode,
  processWebhook,
  getDefaultProvider,
  getExpectedTAT,
  fetchWaybill,
  updateShipment,
  calculateShippingCost,
  createPickupRequest,
  createWarehouse,
  updateWarehouse,
  updateEwaybill,
};
