require("dotenv").config();

const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { connectDB } = require("./config/db");
const routes = require("./routes");
const { errorHandler } = require("./middleware/error.middleware");
const { regionMiddleware } = require("./middleware/region.middleware");
const { initSocket } = require("./services/socket.service");
const { initCronJobs } = require("./services/cron.service");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Trust reverse proxy (Nginx)
app.set("trust proxy", 1);

// Socket.io
initSocket(server);

// Security
app.use(helmet());
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc)
      if (!origin) return callback(null, true);
      if (process.env.CORS_ORIGINS) {
        const allowed = process.env.CORS_ORIGINS.split(",").map(s => s.trim());
        if (allowed.includes(origin)) return callback(null, true);
        return callback(new Error("CORS not allowed"), false);
      }
      // Allow all origins in dev/default
      return callback(null, true);
    },
    credentials: true,
  })
);

// Rate limiting
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 100 : 10,
  message: { success: false, message: "Too many requests, try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/send-otp", otpLimiter);
app.use("/api/auth/verify-otp", otpLimiter);

const ipcheck = require("./services/ipcheck.service");
const realClientIp = (req) =>
  req.headers["x-real-ip"] ||
  (req.headers["x-forwarded-for"] || "").split(",").pop().trim() ||
  req.ip;

// Aggressive cap for datacenter/VPS/proxy IPs — scrapers rent servers,
// real users on ISP networks never enter this bucket.
const datacenterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: realClientIp,
  validate: false,
  message: { success: false, message: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const ip = realClientIp(req);
    return !ip || ipcheck.isPrivateIp(ip) || !ipcheck.isDatacenterIp(ip);
  },
});
app.use("/api", datacenterLimiter);

// General API rate limiter (per real client IP; internal SSR calls from
// localhost are skipped so the website itself is never throttled)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 1000 : 500,
  message: { success: false, message: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: realClientIp,
  validate: false,
  skip: (req) => ipcheck.isPrivateIp(realClientIp(req)),
});
app.use("/api", apiLimiter);

// Stripe webhook — needs the RAW body for signature verification, so it must
// be registered before express.json() parses the body.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  require("./modules/user/controllers/webhook.controller").stripeWebhook
);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Region detection (X-Region header / hostname → req.region; defaults to 'IN')
app.use(regionMiddleware);

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api", routes);

// Error handler
app.use(errorHandler);

// Start
async function start() {
  await connectDB();
  initCronJobs();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`DamnDeal API running on port ${PORT}`);
  });
}

start();
