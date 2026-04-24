const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

// Map userId → Set<socketId>
const userSockets = new Map();

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("Authentication required"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const { userId, userRole } = socket;

    // Register socket
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    // Join role-based room
    socket.join(`role:${userRole}`);
    socket.join(`user:${userId}`);

    // Delivery boy location update
    socket.on("delivery:location", (data) => {
      if (userRole === "delivery" && data.orderId) {
        // Broadcast to the order's user & partner
        io.to(`order:${data.orderId}`).emit("delivery:location:update", {
          deliveryBoyId: userId,
          orderId: data.orderId,
          lat: data.lat,
          lng: data.lng,
          timestamp: Date.now(),
        });
      }
    });

    // Join order room (user/partner/delivery join to track a specific order)
    socket.on("order:join", (orderId) => {
      socket.join(`order:${orderId}`);
    });

    socket.on("order:leave", (orderId) => {
      socket.leave(`order:${orderId}`);
    });

    socket.on("disconnect", () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userSockets.delete(userId);
      }
    });
  });

  return io;
}

function getIO() {
  return io;
}

// Emit to a specific user
function emitToUser(userId, event, data) {
  if (io) io.to(`user:${userId}`).emit(event, data);
}

// Emit to all users with a specific role
function emitToRole(role, event, data) {
  if (io) io.to(`role:${role}`).emit(event, data);
}

// Emit order status update
function emitOrderUpdate(orderId, data) {
  if (io) io.to(`order:${orderId}`).emit("order:update", data);
}

// New order notification to partner
function notifyNewOrder(partnerId, order) {
  emitToUser(partnerId, "order:new", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    grandTotal: order.grandTotal,
    itemCount: order.items?.length || 0,
    createdAt: order.createdAt,
  });
}

// Notify delivery assignment
function notifyDeliveryAssignment(deliveryBoyId, order) {
  emitToUser(deliveryBoyId, "delivery:assigned", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    deliveryAddress: order.deliveryAddress,
  });
}

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToRole,
  emitOrderUpdate,
  notifyNewOrder,
  notifyDeliveryAssignment,
};
