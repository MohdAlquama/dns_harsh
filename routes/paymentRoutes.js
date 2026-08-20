import express from "express";
import requireAuth from "../middleware/requireAuth.js";
import { createOrder, downloadDocument, getOrder, getPurchases, webhook } from "../controllers/paymentController.js";

const router = express.Router();
router.post("/webhook", webhook);
router.post("/orders", requireAuth, createOrder);
router.get("/orders/:orderId", requireAuth, getOrder);
router.get("/purchases", requireAuth, getPurchases);
router.get("/documents/:id/download", requireAuth, downloadDocument);

export default router;
