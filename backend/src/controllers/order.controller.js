const Order = require("../models/Order");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const InventoryLog = require("../models/InventoryLog");
const {
  createOrderSchema,
  updateOrderStatusSchema,
} = require("../validators/order.validator");

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DD-${ts}-${rand}`;
}

// POST /partner/orders
async function createOrder(req, res) {
  const { error } = createOrderSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const partnerId = req.user.userId;
  const { items: rawItems, discount = 0, paymentMethod, note, customer: custInput } = req.body;

  // Resolve products
  const productIds = rawItems.map((i) => i.product);
  const products = await Product.find({
    _id: { $in: productIds },
    partner: partnerId,
    isActive: true,
  });

  if (products.length !== rawItems.length) {
    return res.status(400).json({ success: false, message: "One or more products not found" });
  }

  const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

  let subtotal = 0;
  let totalGst = 0;
  let costTotal = 0;
  const orderItems = [];

  for (const item of rawItems) {
    const p = productMap[item.product];
    if (p.stock < item.quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for "${p.name}" (available: ${p.stock})`,
      });
    }

    let priceExGst, gstAmount;
    if (p.gstInclusive) {
      priceExGst = p.sellingPrice / (1 + p.gstPercent / 100);
      gstAmount = (p.sellingPrice - priceExGst) * item.quantity;
    } else {
      priceExGst = p.sellingPrice;
      gstAmount = (priceExGst * p.gstPercent / 100) * item.quantity;
    }

    const lineTotal = p.sellingPrice * item.quantity;
    subtotal += lineTotal;
    totalGst += gstAmount;
    costTotal += p.costPrice * item.quantity;

    orderItems.push({
      product: p._id,
      name: p.name,
      quantity: item.quantity,
      unit: p.unit,
      price: p.sellingPrice,
      gstPercent: p.gstPercent,
      gstAmount: Math.round(gstAmount * 100) / 100,
      total: Math.round(lineTotal * 100) / 100,
    });
  }

  const grandTotal = Math.round((subtotal - discount) * 100) / 100;
  const profit = Math.round((grandTotal - costTotal) * 100) / 100;

  // Handle customer
  let customerId = null;
  if (custInput && custInput.phone) {
    let customer = await Customer.findOne({ partner: partnerId, phone: custInput.phone });
    if (!customer) {
      customer = await Customer.create({ partner: partnerId, ...custInput });
    }
    customerId = customer._id;
  }

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    partner: partnerId,
    customer: customerId,
    items: orderItems,
    subtotal: Math.round(subtotal * 100) / 100,
    totalGst: Math.round(totalGst * 100) / 100,
    discount,
    grandTotal,
    costTotal: Math.round(costTotal * 100) / 100,
    profit,
    paymentMethod,
    note,
    status: "confirmed",
    paymentStatus: "paid",
  });

  // Deduct stock
  for (const item of rawItems) {
    const p = productMap[item.product];
    p.stock -= item.quantity;
    await p.save();

    await InventoryLog.create({
      partner: partnerId,
      product: p._id,
      type: "sale",
      quantity: -item.quantity,
      stockAfter: p.stock,
      reference: order.orderNumber,
    });
  }

  // Update customer stats
  if (customerId) {
    await Customer.findByIdAndUpdate(customerId, {
      $inc: { totalOrders: 1, totalSpent: grandTotal },
      lastOrderAt: new Date(),
    });
  }

  return res.status(201).json({ success: true, order });
}

// GET /partner/orders
async function getOrders(req, res) {
  const { page = 1, limit = 20, status, from, to } = req.query;
  const filter = { partner: req.user.userId };

  if (status) filter.status = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("customer", "name phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10)),
    Order.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    orders,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / parseInt(limit, 10)),
    },
  });
}

// GET /partner/orders/:id
async function getOrder(req, res) {
  const order = await Order.findOne({
    _id: req.params.id,
    partner: req.user.userId,
  })
    .populate("customer", "name phone email")
    .populate("items.product", "images sku");

  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  return res.json({ success: true, order });
}

// PUT /partner/orders/:id/status
async function updateOrderStatus(req, res) {
  const { error } = updateOrderStatusSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const order = await Order.findOne({
    _id: req.params.id,
    partner: req.user.userId,
  });

  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  // Handle cancellation — restore stock
  if (req.body.status === "cancelled" && order.status !== "cancelled") {
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();

        await InventoryLog.create({
          partner: req.user.userId,
          product: product._id,
          type: "return",
          quantity: item.quantity,
          stockAfter: product.stock,
          reference: order.orderNumber,
        });
      }
    }
  }

  order.status = req.body.status;
  await order.save();

  return res.json({ success: true, order });
}

module.exports = { createOrder, getOrders, getOrder, updateOrderStatus };
