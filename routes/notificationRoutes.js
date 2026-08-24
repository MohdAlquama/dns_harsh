import express from "express";
import { registerFcmToken, sendFcmNotification } from "../controllers/notificationController.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import requireAuth from "../middleware/requireAuth.js";
import requireSameOrigin from "../middleware/requireSameOrigin.js";

const router = express.Router();

router.post("/register-token", requireAuth, registerFcmToken);
router.post("/send-to-user", requireAdmin, requireSameOrigin, sendFcmNotification);

export default router;
