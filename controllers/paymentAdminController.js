import crypto from "crypto";
import {
    createRefundRecord, getOrderById, getPaymentConfig, listAdminOrders,
    listRefundsByOrders, savePaymentConfig, updateRefundFromGateway
} from "../models/paymentModel.js";
import { createCashfreeRefund } from "../services/cashfreeService.js";
import { encryptSecret } from "../services/paymentConfigCrypto.js";

const renderSettings = (res, data = {}) => res.status(data.status || 200).render("layouts/layout", {
    title: "Cashfree Configuration | DNS Admin",
    page: "../payments/settings",
    config: data.config,
    saved: data.saved || false,
    error: data.error || null
});

const showSettings = async (req, res) => {
    try {
        const config = await getPaymentConfig();
        return renderSettings(res, { config: { ...config, hasSecret: Boolean(config?.client_secret_encrypted) }, saved: req.query.saved === "1" });
    } catch (error) {
        console.error("Payment config error:", error);
        return renderSettings(res, { status: 500, config: {}, error: "Unable to load payment configuration" });
    }
};

const updateSettings = async (req, res) => {
    try {
        const environment = String(req.body.environment || "").toUpperCase();
        const apiVersion = String(req.body.api_version || "").trim();
        if (!["SANDBOX", "PRODUCTION"].includes(environment)) throw new Error("Choose a valid environment");
        if (!/^20\d{2}-\d{2}-\d{2}$/.test(apiVersion)) throw new Error("API version must use YYYY-MM-DD format");
        for (const [label, value] of [["Return URL", req.body.return_url], ["Notify URL", req.body.notify_url]]) {
            if (value) {
                const url = new URL(value);
                if (environment === "PRODUCTION" && url.protocol !== "https:") throw new Error(`${label} must use HTTPS in production`);
            }
        }
        const secret = String(req.body.client_secret || "").trim();
        const clientId = String(req.body.client_id || "").trim();
        const existing = await getPaymentConfig();
        const missingCredentials = !(process.env.CASHFREE_CLIENT_ID || clientId) ||
            !(process.env.CASHFREE_CLIENT_SECRET || secret || existing?.client_secret_encrypted);
        if (req.body.is_enabled === "on" && missingCredentials) {
            throw new Error("Client ID and client secret are required before enabling payments");
        }
        await savePaymentConfig({
            environment,
            clientId,
            encryptedSecret: secret ? encryptSecret(secret) : null,
            apiVersion,
            returnUrl: String(req.body.return_url || "").trim(),
            notifyUrl: String(req.body.notify_url || "").trim(),
            isEnabled: req.body.is_enabled === "on"
        });
        return res.redirect("/payment-settings?saved=1");
    } catch (error) {
        console.error("Save payment config error:", error);
        return renderSettings(res, { status: 400, config: { ...req.body }, error: error.message });
    }
};

const showOrders = async (req, res) => {
    try {
        const orders = await listAdminOrders();
        const refunds = await listRefundsByOrders(orders.map((order) => order.id));
        const refundMap = refunds.reduce((map, refund) => {
            (map[refund.order_id] ||= []).push(refund);
            return map;
        }, {});
        return res.render("layouts/layout", {
            title: "Orders & Refunds | DNS Admin", page: "../payments/orders", orders, refundMap,
            refunded: req.query.refunded === "1", error: req.query.error || null
        });
    } catch (error) {
        console.error("Admin orders error:", error);
        return res.status(500).send("Unable to load orders");
    }
};

const refundOrder = async (req, res) => {
    let refundId;
    try {
        const order = await getOrderById(req.params.id);
        if (!order || !["PAID", "PARTIALLY_REFUNDED"].includes(order.status)) throw new Error("Only paid orders can be refunded");
        const remaining = Number(order.order_amount) - Number(order.refunded_amount);
        const amount = Number(req.body.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) throw new Error(`Refund must be between ₹0.01 and ₹${remaining.toFixed(2)}`);
        const note = String(req.body.note || "Admin order refund").trim().slice(0, 100);
        if (note.length < 3) throw new Error("Refund note must be at least 3 characters");
        const speed = req.body.speed === "INSTANT" ? "INSTANT" : "STANDARD";
        refundId = `ref_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        await createRefundRecord({ orderId: order.id, refundId, amount: amount.toFixed(2), note, speed });
        const response = await createCashfreeRefund({ merchantOrderId: order.merchant_order_id, refundId, amount, note, speed });
        await updateRefundFromGateway(refundId, {
            cashfreeRefundId: response.cf_refund_id,
            status: response.refund_status || "PENDING",
            description: response.status_description
        });
        return res.redirect("/orders?refunded=1");
    } catch (error) {
        if (refundId) await updateRefundFromGateway(refundId, { status: "FAILED", description: error.message });
        console.error("Admin refund error:", error);
        return res.redirect(`/orders?error=${encodeURIComponent(error.message || "Refund failed")}`);
    }
};

export { refundOrder, showOrders, showSettings, updateSettings };
