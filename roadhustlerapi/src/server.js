require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const connectDB = require("./config/db");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/error.middleware");

const app = express();

app.use(helmet({ contentSecurityPolicy: false })); // CSP off — /erp UI uses inline handlers
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

const origins = (process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || origins.length === 0 || origins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Static uploads (invoice PDFs, work-order photos)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Staff ERP web app (classic desktop UI) — served same-origin at /erp
app.use("/erp", express.static(path.join(__dirname, "../erp-ui")));

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 6000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Road Hustlers API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to start:", err.message);
    process.exit(1);
  });
