import express from "express";
import { refundOrder, showOrders, showSettings, updateSettings } from "../controllers/paymentAdminController.js";
import requireSameOrigin from "../middleware/requireSameOrigin.js";
import { addOfferCode, showOfferCodes, updateOfferCodeStatus } from "../controllers/offerCodeAdminController.js";

const router = express.Router();
router.get("/payment-settings", showSettings);
router.post("/payment-settings", requireSameOrigin, updateSettings);
router.get("/orders", showOrders);
router.post("/orders/:id/refund", requireSameOrigin, refundOrder);
router.get("/offer-codes", showOfferCodes);
router.post("/offer-codes", requireSameOrigin, addOfferCode);
router.post("/offer-codes/:id/status", requireSameOrigin, updateOfferCodeStatus);

export default router;
