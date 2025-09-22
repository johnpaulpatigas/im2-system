// backend/routes/userRoutes.js
const express = require("express");
const userController = require("../controllers/userController");
const livenessController = require("../controllers/livenessController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router
  .route("/profile")
  .get(userController.getProfile)
  .put(userController.updateProfile);

router.put("/change-password", userController.changePassword);

router.put("/liveness-data", livenessController.saveLivenessData);

router.post("/verify-face-match", livenessController.verifyFaceMatch);

module.exports = router;
