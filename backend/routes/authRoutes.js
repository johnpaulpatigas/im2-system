// backend/routes/authRoutes.js
const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/signin", authController.signin);
router.get("/logout", authController.logout);
router.post("/verify-recovery-key", authController.verifyRecoveryKey);
router.post("/reset-password", authController.resetPassword);

module.exports = router;
