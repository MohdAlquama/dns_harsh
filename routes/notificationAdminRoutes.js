import express from "express";
import {
    searchNotificationRecipients,
    showNotificationSettings
} from "../controllers/notificationController.js";
import { requireAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

router.get("/notification-settings", requireAdmin, showNotificationSettings);
router.get("/api/v1/admin/notifications/recipients", requireAdmin, searchNotificationRecipients);

export default router;
