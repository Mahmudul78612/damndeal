require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const connectDB = require("./config/db");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/error.middleware");

const app = express();
app.set("trust proxy", true); // real client IP behind nginx (for geo)

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } })); // allow ad creatives to load cross-origin
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve API is public to all apps; admin/advertiser portals are CORS-restricted but
// since auth is via Bearer token, we allow all origins (no cookies used).
app.use(cors({ origin: true, credentials: false }));

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 7000;
connectDB()
  .then(() => app.listen(PORT, () => console.log(`Ads Services API running on port ${PORT}`)))
  .catch((err) => { console.error("Failed to start:", err.message); process.exit(1); });
