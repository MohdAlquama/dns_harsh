import {
    getFcmAdminSummary,
    listFcmRecipients,
    saveFcmToken
} from "../models/fcmTokenModel.js";
import { sendNotificationToUser } from "../services/fcmNotificationService.js";

const registerFcmToken = async (req, res) => {
    const userId = Number(req.body.userId);
    const fcmToken = typeof req.body.fcmToken === "string" ? req.body.fcmToken.trim() : "";

    // Never allow a logged-in browser to register a token for another user.
    if (!Number.isInteger(userId) || userId < 1 || userId !== req.user.id) {
        return res.status(403).json({ success: false, message: "Cannot register a token for another user" });
    }
    if (!fcmToken || fcmToken.length > 512) {
        return res.status(400).json({ success: false, message: "A valid FCM token is required" });
    }

    try {
        await saveFcmToken(userId, fcmToken);
        return res.status(200).json({ success: true, message: "Notification token registered" });
    } catch (error) {
        console.error("FCM token registration failed:", error);
        return res.status(500).json({ success: false, message: "Unable to register notification token" });
    }
};

const sendFcmNotification = async (req, res) => {
    const userId = Number(req.body.userId);
    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
    const data = req.body.data ?? {};

    if (!Number.isInteger(userId) || userId < 1) {
        return res.status(400).json({ success: false, message: "A valid userId is required" });
    }
    if (!title || !body) {
        return res.status(400).json({ success: false, message: "Notification title and body are required" });
    }
    if (typeof data !== "object" || Array.isArray(data)) {
        return res.status(400).json({ success: false, message: "Notification data must be a JSON object" });
    }

    try {
        const result = await sendNotificationToUser({ userId, title, body, data });
        return res.status(200).json({
            success: true,
            message: result.successCount
                ? "Notification sent"
                : "No registered devices found for this user",
            ...result
        });
    } catch (error) {
        console.error("Admin FCM send failed:", error);
        return res.status(500).json({ success: false, message: "Unable to send notification" });
    }
};

const showNotificationSettings = async (req, res) => {
    try {
        const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
        const [summary, recipients] = await Promise.all([
            getFcmAdminSummary(),
            listFcmRecipients({ search, limit: 50 })
        ]);

        return res.render("layouts/layout", {
            title: "Notifications | DNS Admin",
            page: "../notifications/index",
            summary,
            recipients,
            search
        });
    } catch (error) {
        console.error("Notification settings page error:", error);
        return res.status(500).send("Unable to load notification settings");
    }
};

const searchNotificationRecipients = async (req, res) => {
    try {
        const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
        const recipients = await listFcmRecipients({ search, limit: 50 });
        return res.json({ success: true, recipients });
    } catch (error) {
        console.error("Notification recipient search failed:", error);
        return res.status(500).json({ success: false, message: "Unable to load recipients" });
    }
};

export {
    registerFcmToken,
    searchNotificationRecipients,
    sendFcmNotification,
    showNotificationSettings
};
