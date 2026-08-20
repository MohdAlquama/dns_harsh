import express from "express";
import { refundOrder, showOrders, showSettings, updateSettings } from "../controllers/paymentAdminController.js";
import requireSameOrigin from "../middleware/requireSameOrigin.js";

const router = express.Router();
router.get("/payment-settings", showSettings);
router.post("/payment-settings", requireSameOrigin, updateSettings);
router.get("/orders", showOrders);
router.post("/orders/:id/refund", requireSameOrigin, refundOrder);

export default router;
