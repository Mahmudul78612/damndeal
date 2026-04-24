/**
 * Admin Shipping Controller
 * Ship orders, track, cancel via Delhivery / FShip
 */
const shipping = require("../../../services/shipping.service");
const Order = require("../../../models/Order");

// POST /admin/orders/:id/ship
async function shipOrder(req, res) {
  try {
    const { provider, weight, length, width, height } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Set package dimensions before shipping
    const w = parseInt(weight) || 500;
    const l = parseInt(length) || 10;
    const wd = parseInt(width) || 10;
    const h = parseInt(height) || 10;

    await Order.updateOne({ _id: order._id }, {
      $set: {
        'shipping.weight': w,
        'shipping.dimensions.length': l,
        'shipping.dimensions.width': wd,
        'shipping.dimensions.height': h,
      }
    });

    const result = await shipping.shipOrder(req.params.id, provider || undefined);

    return res.json({
      success: true,
      message: `Order shipped via ${result.shipping.provider}`,
      order: result,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// GET /admin/orders/:id/track
async function trackOrder(req, res) {
  try {
    const result = await shipping.trackOrder(req.params.id);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// POST /admin/orders/:id/cancel-shipment
async function cancelShipment(req, res) {
  try {
    const result = await shipping.cancelShipment(req.params.id);
    return res.json({ success: true, message: "Shipment cancelled", ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// GET /admin/shipping/check-pincode?pincode=&provider=
async function checkPincode(req, res) {
  try {
    const { pincode, provider } = req.query;
    if (!pincode) return res.status(400).json({ success: false, message: "pincode required" });
    const result = await shipping.checkPincode(pincode, provider || undefined);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = { shipOrder, trackOrder, cancelShipment, checkPincode, getExpectedTAT, fetchWaybill, updateShipment, calculateShippingCost, createPickupRequest, createWarehouse, updateWarehouse, updateEwaybill };

// GET /admin/shipping/expected-tat?o_pin=&d_pin=&payment_mode=
async function getExpectedTAT(req, res) {
  try {
    const { o_pin, d_pin, payment_mode } = req.query;
    if (!o_pin || !d_pin) return res.status(400).json({ success: false, message: "o_pin and d_pin required" });
    const result = await shipping.getExpectedTAT(o_pin, d_pin, payment_mode);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// GET /admin/shipping/fetch-waybill?count=
async function fetchWaybill(req, res) {
  try {
    const count = parseInt(req.query.count) || 1;
    const waybills = await shipping.fetchWaybill(count);
    return res.json({ success: true, waybills });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// PUT /admin/orders/:id/update-shipment
async function updateShipment(req, res) {
  try {
    const result = await shipping.updateShipment(req.params.id, req.body);
    return res.json({ success: true, message: "Shipment updated", ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// POST /admin/shipping/calculate-cost
async function calculateShippingCost(req, res) {
  try {
    const { originPin, destinationPin, weight, codAmount, paymentMode } = req.body;
    if (!destinationPin) return res.status(400).json({ success: false, message: "destinationPin required" });
    const result = await shipping.calculateShippingCost({ originPin, destinationPin, weight, codAmount, paymentMode });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// POST /admin/shipping/pickup-request
async function createPickupRequest(req, res) {
  try {
    const { pickupTime, pickupDate, pickupLocation, expectedPackages } = req.body;
    const result = await shipping.createPickupRequest({ pickupTime, pickupDate, pickupLocation, expectedPackages });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// POST /admin/shipping/warehouse
async function createWarehouse(req, res) {
  try {
    const result = await shipping.createWarehouse(req.body);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// PUT /admin/shipping/warehouse
async function updateWarehouse(req, res) {
  try {
    const result = await shipping.updateWarehouse(req.body);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// PUT /admin/orders/:id/ewaybill
async function updateEwaybill(req, res) {
  try {
    const { ewaybillNumber } = req.body;
    if (!ewaybillNumber) return res.status(400).json({ success: false, message: "ewaybillNumber required" });
    const result = await shipping.updateEwaybill(req.params.id, ewaybillNumber);
    return res.json({ success: true, message: "E-waybill updated", ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}
