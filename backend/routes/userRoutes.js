// backend/routes/userRoutes.js
const express = require("express");
const userController = require("../controllers/userController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router
  .route("/profile")
  .get(userController.getProfile)
  .put(userController.updateProfile);

router.put("/change-password", userController.changePassword);

module.exports = router;
