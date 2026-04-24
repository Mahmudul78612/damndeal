const express = require("express");
const { authenticate, authorize } = require("../../middleware/auth.middleware");
const { uploadDeliveryPhoto } = require("../../middleware/upload.middleware");

const profile = require("./controllers/profile.controller");
const assignment = require("./controllers/assignment.controller");
const earnings = require("./controllers/earnings.controller");

const router = express.Router();
router.use(authenticate, authorize("delivery"));

// Profile
router.post("/profile", uploadDeliveryPhoto, profile.upsertProfile);
router.get("/profile", profile.getProfile);
router.put("/location", profile.updateLocation);
router.put("/toggle-online", profile.toggleOnline);

// Assignments
router.get("/assignments", assignment.getAssignments);
router.get("/assignments/:id", assignment.getAssignment);
router.put("/assignments/:id/pickup", assignment.markPickedUp);
router.put("/assignments/:id/on-the-way", assignment.markOnTheWay);
router.put("/assignments/:id/deliver", assignment.markDelivered);
router.put("/assignments/:id/fail", assignment.markFailed);

// Earnings
router.get("/earnings", earnings.getEarnings);

module.exports = router;
