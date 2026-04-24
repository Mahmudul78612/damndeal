/**
 * Delhivery API Integration Service
 * Docs: https://developers.delhivery.com/
 */
const AppSettings = require("../models/AppSettings");
const secrets = require("../utils/secrets");

const STAGING_URL = "https://staging-express.delhivery.com";
const PROD_URL = "https://track.delhivery.com";

async function getConfig() {
  const keys = [
    "delhivery_api_token",
    "delhivery_api_mode",
    "delhivery_client_name",
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

  const mode = cfg.delhivery_api_mode || "staging";
  return {
    token: cfg.delhivery_api_token || "",
    baseUrl: mode === "production" ? PROD_URL : STAGING_URL,
    clientName: cfg.delhivery_client_name || "",
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

/**
 * Create a shipment in Delhivery
 */
async function createShipment(order) {
  const cfg = await getConfig();
  if (!cfg.token) throw new Error("Delhivery API token not configured");

  const addr = order.deliveryAddress || {};
  const pickup = cfg.pickup;

  const shipmentData = {
    shipments: [
      {
        name: order.user?.name || "Customer",
        add: addr.address || "",
        pin: addr.pincode || "",
        city: addr.city || "",
        state: addr.state || "",
        country: "India",
        phone: order.user?.phone || "",
        order: order.orderNumber,
        payment_mode: order.paymentMethod === "cod" ? "COD" : "Prepaid",
        return_pin: pickup.pincode,
        return_city: pickup.city,
        return_phone: pickup.phone,
        return_add: pickup.address,
        return_state: pickup.state,
        return_name: pickup.name,
        return_country: "India",
        products_desc: order.items.map((i) => i.name).join(", "),
        hsn_code: "",
        cod_amount: order.paymentMethod === "cod" ? order.grandTotal.toString() : "0",
        order_date: new Date().toISOString(),
        total_amount: order.grandTotal.toString(),
        seller_name: pickup.name,
        seller_add: pickup.address,
        seller_cst: "",
        seller_tin: "",
        quantity: order.items.reduce((s, i) => s + i.quantity, 0),
        waybill: "", // Delhivery auto-assigns
        shipment_width: (order.shipping?.dimensions?.width || 10).toString(),
        shipment_height: (order.shipping?.dimensions?.height || 10).toString(),
        weight: (order.shipping?.weight || 500).toString(),
        shipment_length: (order.shipping?.dimensions?.length || 10).toString(),
        client: cfg.clientName,
      },
    ],
    pickup_location: {
      name: cfg.clientName,
      add: pickup.address,
      city: pickup.city,
      pin_code: pickup.pincode,
      country: "India",
      phone: pickup.phone,
    },
  };

  const format = `format=json&data=${encodeURIComponent(JSON.stringify(shipmentData))}`;

  const res = await fetch(`${cfg.baseUrl}/api/cmu/create.json`, {
    method: "POST",
    headers: {
      Authorization: `Token ${cfg.token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: format,
  });

  const data = await res.json();

  if (!data.success && !data.packages) {
    throw new Error(data.rmk || data.error || "Delhivery create shipment failed");
  }

  const pkg = data.packages?.[0] || {};
  return {
    awb: pkg.waybill || "",
    shipmentId: pkg.refnum || order.orderNumber,
    status: pkg.status || "Manifested",
    trackingUrl: pkg.waybill ? `https://www.delhivery.com/track/package/${pkg.waybill}` : "",
    courierName: "Delhivery",
    label: "", // Fetched separately
    raw: data,
  };
}

/**
 * Track a shipment by AWB
 */
async function trackShipment(awb) {
  const cfg = await getConfig();
  if (!cfg.token) throw new Error("Delhivery API token not configured");

  const res = await fetch(`${cfg.baseUrl}/api/v1/packages/json/?waybill=${awb}&token=${cfg.token}`, {
    headers: { Authorization: `Token ${cfg.token}` },
  });
  const data = await res.json();

  const shipment = data.ShipmentData?.[0]?.Shipment || {};
  const scans = shipment.Scans || [];

  const events = scans.map((s) => ({
    status: s.ScanDetail?.Scan || "",
    location: s.ScanDetail?.ScannedLocation || "",
    timestamp: s.ScanDetail?.ScanDateTime ? new Date(s.ScanDetail.ScanDateTime) : new Date(),
    description: s.ScanDetail?.Instructions || "",
  }));

  return {
    awb,
    status: shipment.Status?.Status || "",
    statusDetail: shipment.Status?.StatusType || "",
    estimatedDelivery: shipment.ExpectedDeliveryDate ? new Date(shipment.ExpectedDeliveryDate) : null,
    events,
    delivered: (shipment.Status?.Status || "").toLowerCase() === "delivered",
  };
}

/**
 * Get shipping label PDF URL
 */
async function getLabel(awb) {
  const cfg = await getConfig();
  return `${cfg.baseUrl}/api/p/packing_slip?wbns=${awb}&token=${cfg.token}`;
}

/**
 * Cancel a shipment
 */
async function cancelShipment(awb) {
  const cfg = await getConfig();
  if (!cfg.token) throw new Error("Delhivery API token not configured");

  const res = await fetch(`${cfg.baseUrl}/api/p/edit`, {
    method: "POST",
    headers: {
      Authorization: `Token ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ waybill: awb, cancellation: true }),
  });

  const data = await res.json();
  return data;
}

/**
 * Check serviceability (pincode check)
 */
async function checkPincode(pincode) {
  const cfg = await getConfig();
  const res = await fetch(`${cfg.baseUrl}/c/api/pin-codes/json/?filter_codes=${pincode}`, {
    headers: { Authorization: `Token ${cfg.token}` },
  });
  const data = await res.json();
  const info = data.delivery_codes?.[0]?.postal_code || {};
  return {
    serviceable: !!info.pin,
    cod: info.cod === "Y",
    prepaid: info.pre_paid === "Y",
    city: info.city || "",
    state: info.state_code || "",
  };
}

/**
 * Expected TAT (Transit Time) API
 * Returns estimated delivery days between origin and destination pincodes
 */
async function getExpectedTAT(originPin, destinationPin, paymentMode = "Pre-paid") {
  const cfg = await getConfig();
  if (!cfg.token) throw new Error("Delhivery API token not configured");

  const params = new URLSearchParams({
    md: "S", // Surface
    ss: "Delivered",
    d_pin: destinationPin,
    o_pin: originPin,
    cgm: "500", // weight in grams
    pt: paymentMode, // "Pre-paid" or "COD"
  });

  const res = await fetch(`${cfg.baseUrl}/api/kinko/v1/invoice/charges/_/st/charges/?${params}`, {
    headers: { Authorization: `Token ${cfg.token}` },
  });
  const data = await res.json();

  return {
    expectedDays: data[0]?.estimated_delivery_days || null,
    estimatedDate: data[0]?.etd || null,
    originCity: data[0]?.pickup_city || "",
    destinationCity: data[0]?.destination_city || "",
    raw: data,
  };
}

/**
 * Fetch Waybill Numbers (pre-fetch AWBs)
 * Returns a list of waybill numbers for pre-assignment
 */
async function fetchWaybill(count = 1) {
  const cfg = await getConfig();
  if (!cfg.token) throw new Error("Delhivery API token not configured");

  const res = await fetch(`${cfg.baseUrl}/waybill/api/bulk/json/?count=${count}&cl=${encodeURIComponent(cfg.clientName)}`, {
    headers: { Authorization: `Token ${cfg.token}` },
  });
  const text = await res.text();

  // Can return a single waybill as text or JSON array
  let waybills;
  try {
    const data = JSON.parse(text);
    waybills = Array.isArray(data) ? data : [data];
  } catch {
    waybills = text.trim().split("\n").filter(Boolean);
  }

  return waybills;
}

/**
 * Update Shipment Details
 * Update address, phone, or other details for an existing shipment
 */
async function updateShipment(awb, updates) {
  const cfg = await getConfig();
  if (!cfg.token) throw new Error("Delhivery API token not configured");

  const body = { waybill: awb };
  if (updates.name) body.name = updates.name;
  if (updates.phone) body.phone = updates.phone;
  if (updates.address) body.add = updates.address;
  if (updates.pincode) body.pin = updates.pincode;
  if (updates.city) body.city = updates.city;
  if (updates.state) body.state = updates.state;

  const res = await fetch(`${cfg.baseUrl}/api/p/edit`, {
    method: "POST",
    headers: {
      Authorization: `Token ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return data;
}

/**
 * Calculate Shipping Cost
 * Estimate shipping charges for a shipment
 */
async function calculateShippingCost({ originPin, destinationPin, weight = 500, codAmount = 0, paymentMode = "Pre-paid" }) {
  const cfg = await getConfig();
  if (!cfg.token) throw new Error("Delhivery API token not configured");

  const params = new URLSearchParams({
    md: "S",
    ss: "Delivered",
    d_pin: destinationPin,
    o_pin: originPin || cfg.pickup.pincode,
    cgm: weight.toString(),
    pt: paymentMode,
    cod: codAmount.toString(),
  });

  const res = await fetch(`${cfg.baseUrl}/api/kinko/v1/invoice/charges/.json?${params}`, {
    headers: { Authorization: `Token ${cfg.token}` },
  });
  const data = await res.json();

  const charges = data[0] || {};
  const taxData = charges.tax_data || {};
  const gst = (taxData.SGST || 0) + (taxData.CGST || 0) + (taxData.IGST || 0);
  return {
    totalCharge: charges.total_amount || 0,
    freightCharge: charges.gross_amount || 0,
    codCharge: charges.charge_COD || charges.charge_CCOD || 0,
    gstCharge: Math.round(gst * 100) / 100,
    zone: charges.zone || '',
    chargeableWeight: charges.charged_weight || weight,
    raw: charges,
  };
}

/**
 * Pickup Request Creation
 * Request courier to pick up shipments from warehouse
 */
async function createPickupRequest({ pickupTime, pickupDate, pickupLocation, expectedPackages = 1 }) {
  const cfg = await getConfig();
  if (!cfg.token) throw new Error("Delhivery API token not configured");

  const body = {
    pickup_time: pickupTime || "12:00:00",
    pickup_date: pickupDate || new Date().toISOString().split("T")[0],
    pickup_location: pickupLocation || cfg.clientName,
    expected_package_count: expectedPackages,
  };

  const res = await fetch(`${cfg.baseUrl}/fm/request/new/`, {
    method: "POST",
    headers: {
      Authorization: `Token ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return {
    pickupId: data.pickup_id || data.pk_id || null,
    message: data.message || data.incoming_center_name || "Pickup request created",
    raw: data,
  };
}

/**
 * Client Warehouse Creation
 * Register a new pickup location / warehouse
 */
async function createWarehouse({ name, phone, address, city, state, pincode, country = "India", registeredName }) {
  const cfg = await getConfig();
  if (!cfg.token) throw new Error("Delhivery API token not configured");

  const body = {
    name: name,
    phone: phone,
    address: address,
    city: city,
    state: state,
    pin: pincode,
    country: country,
    registered_name: registeredName || cfg.clientName,
    return_address: address,
    return_pin: pincode,
    return_city: city,
    return_state: state,
    return_country: country,
  };

  const res = await fetch(`${cfg.baseUrl}/api/backend/clientwarehouse/create/`, {
    method: "POST",
    headers: {
      Authorization: `Token ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!data.success && data.error) {
    throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
  }

  return {
    success: data.success !== false,
    warehouseName: data.data?.name || name,
    message: data.data ? "Warehouse created" : data.error || "Unknown response",
    raw: data,
  };
}

/**
 * Client Warehouse Updation
 * Update an existing warehouse / pickup location
 */
async function updateWarehouse({ name, phone, address, city, state, pincode, country = "India", registeredName }) {
  const cfg = await getConfig();
  if (!cfg.token) throw new Error("Delhivery API token not configured");

  const body = {
    name: name,
    phone: phone,
    address: address,
    city: city,
    state: state,
    pin: pincode,
    country: country,
    registered_name: registeredName || cfg.clientName,
    return_address: address,
    return_pin: pincode,
    return_city: city,
    return_state: state,
    return_country: country,
  };

  const res = await fetch(`${cfg.baseUrl}/api/backend/clientwarehouse/edit/`, {
    method: "POST",
    headers: {
      Authorization: `Token ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!data.success && data.error) {
    throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
  }

  return {
    success: data.success !== false,
    warehouseName: name,
    message: "Warehouse updated",
    raw: data,
  };
}

/**
 * E-Waybill Update API
 * Attach e-waybill number to a shipment
 */
async function updateEwaybill(awb, ewaybillNumber) {
  const cfg = await getConfig();
  if (!cfg.token) throw new Error("Delhivery API token not configured");

  const body = {
    waybill: awb,
    ewaybill_number: ewaybillNumber,
  };

  const res = await fetch(`${cfg.baseUrl}/api/p/edit`, {
    method: "POST",
    headers: {
      Authorization: `Token ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return data;
}

module.exports = {
  createShipment,
  trackShipment,
  getLabel,
  cancelShipment,
  checkPincode,
  getExpectedTAT,
  fetchWaybill,
  updateShipment,
  calculateShippingCost,
  createPickupRequest,
  createWarehouse,
  updateWarehouse,
  updateEwaybill,
};
