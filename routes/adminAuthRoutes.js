import express from "express";
import { login, logout, setupOtp, showLogin, showOtpSetup, showVerifyOtp, verifyAdminOtp } from "../controllers/adminAuthController.js";
import { requireAdmin, requireSetupSession } from "../middleware/adminAuth.js";
import requireSameOrigin from "../middleware/requireSameOrigin.js";

const router = express.Router();
router.get("/login", showLogin);
router.post("/login", requireSameOrigin, login);
router.get("/otp-setup", requireSetupSession, showOtpSetup);
router.post("/otp-setup", requireSameOrigin, requireSetupSession, setupOtp);
router.get("/verify-otp", showVerifyOtp);
router.post("/verify-otp", requireSameOrigin, verifyAdminOtp);
router.post("/logout", requireAdmin, requireSameOrigin, logout);

export default router;
