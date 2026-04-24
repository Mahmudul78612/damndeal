/**
 * FShip API Integration Service
 * Docs: https://docs.fship.in/
 */
const AppSettings = require("../models/AppSettings");
const secrets = require("../utils/secrets");

const SANDBOX_URL = "https://sandbox.fship.in/api/v1";
const PROD_URL = "https://app.fship.in/api/v1";

async function getConfig() {
  const keys = [
    "fship_api_key",
    "fship_api_secret",
    "fship_api_mode",
    "shipping_pickup_name",
    "shipping_pickup_phone",
    "shipping_pickup_address",
    "shipping_pickup_city",
    "shipping_pickup_state",
    "shipping_pickup_pincode",
  ];
  const docs = await AppSettings.find({ key: { $in: keys } });
  const cfg = {};
  docs.forEach((d) => (cfg[d.key] = secrets.decryptSetting(d.key, d.value)));

  const mode = cfg.fship_api_mode || "sandbox";
  return {
    apiKey: cfg.fship_api_key || "",
    apiSecret: cfg.fship_api_secret || "",
    baseUrl: mode === "production" ? PROD_URL : SANDBOX_URL,
    pickup: {
      name: cfg.shipping_pickup_name || "",
      phone: cfg.shipping_pickup_phone || "",
      address: cfg.shipping_pickup_address || "",
      city: cfg.shipping_pickup_city || "",
      state: cfg.shipping_pickup_state || "",
      pincode: cfg.shipping_pickup_pincode || "",
    },
  };
}

async function authHeaders() {
  const cfg = await getConfig();
  if (!cfg.apiKey) throw new Error("FShip API key not configured");
  return {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "x-api-secret": cfg.apiSecret,
    },
    cfg,
  };
}

/**
 * Create a shipment in FShip
 */
async function createShipment(order) {
  const { headers, cfg } = await authHeaders();
  const addr = order.deliveryAddress || {};
  const pickup = cfg.pickup;

  const payload = {
    order_number: order.orderNumber,
    payment_type: order.paymentMethod === "cod" ? "COD" : "Prepaid",
    package_weight: order.shipping?.weight || 500,
    package_length: order.shipping?.dimensions?.length || 10,
    package_breadth: order.shipping?.dimensions?.width || 10,
    package_height: order.shipping?.dimensions?.height || 10,
    order_amount: order.grandTotal,
    cod_amount: order.paymentMethod === "cod" ? order.grandTotal : 0,
    consignee: {
      name: order.user?.name || "Customer",
      phone: order.user?.phone || "",
      address_line1: addr.address || "",
      address_line2: addr.landmark || "",
      city: addr.city || "",
      state: addr.state || "",
      pincode: addr.pincode || "",
    },
    pickup: {
      name: pickup.name,
      phone: pickup.phone,
      address_line1: pickup.address,
      city: pickup.city,
      state: pickup.state,
      pincode: pickup.pincode,
    },
    items: order.items.map((i) => ({
      name: i.name,
      sku: i.product?.sku || "",
      quantity: i.quantity,
      price: i.price,
    })),
  };

  const res = await fetch(`${cfg.baseUrl}/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!data.success && !data.data?.awb_number) {
    throw new Error(data.message || data.error || "FShip create shipment failed");
  }

  const d = data.data || data;
  return {
    awb: d.awb_number || d.awb || "",
    shipmentId: d.shipment_id || d.id || order.orderNumber,
    status: d.status || "Booked",
    trackingUrl: d.tracking_url || "",
    courierName: d.courier_name || "FShip",
    label: d.label_url || "",
    raw: data,
  };
}

/**
 * Track a shipment by AWB or shipment ID
 */
async function trackShipment(awb) {
  const { headers, cfg } = await authHeaders();

  const res = await fetch(`${cfg.baseUrl}/track/${awb}`, { headers });
  const data = await res.json();

  const tracking = data.data || data;
  const activities = tracking.activities || tracking.scans || [];

  const events = activities.map((a) => ({
    status: a.status || a.activity || "",
    location: a.location || "",
    timestamp: a.timestamp ? new Date(a.timestamp) : new Date(),
    description: a.description || a.remark || "",
  }));

  return {
    awb,
    status: tracking.current_status || tracking.status || "",
    statusDetail: tracking.status_description || "",
    estimatedDelivery: tracking.estimated_delivery ? new Date(tracking.estimated_delivery) : null,
    events,
    delivered: (tracking.current_status || "").toLowerCase().includes("delivered"),
  };
}

/**
 * Get shipping label URL
 */
async function getLabel(shipmentId) {
  const { headers, cfg } = await authHeaders();
  const res = await fetch(`${cfg.baseUrl}/labels/${shipmentId}`, { headers });
  const data = await res.json();
  return data.data?.label_url || data.label_url || "";
}

/**
 * Cancel a shipment
 */
async function cancelShipment(awb) {
  const { headers, cfg } = await authHeaders();

  const res = await fetch(`${cfg.baseUrl}/orders/cancel`, {
    method: "POST",
    headers,
    body: JSON.stringify({ awb_number: awb }),
  });

  const data = await res.json();
  return data;
}

/**
 * Check serviceability
 */
async function checkPincode(pincode) {
  const { headers, cfg } = await authHeaders();
  const res = await fetch(`${cfg.baseUrl}/serviceability?pincode=${pincode}`, { headers });
  const data = await res.json();

  const info = data.data || data;
  return {
    serviceable: info.serviceable === true || info.is_serviceable === true,
    cod: info.cod === true || info.cod_available === true,
    prepaid: info.prepaid === true || info.prepaid_available === true,
    couriers: info.couriers || [],
  };
}

module.exports = {
  createShipment,
  trackShipment,
  getLabel,
  cancelShipment,
  checkPincode,
};
