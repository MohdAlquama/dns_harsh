import crypto from "crypto";
import { decryptSecret } from "./paymentConfigCrypto.js";
import { getPaymentConfig } from "../models/paymentModel.js";

class CashfreeError extends Error {
    constructor(message, status = 502, details = null) {
        super(message);
        this.name = "CashfreeError";
        this.status = status;
        this.details = details;
    }
}

const loadCashfreeConfig = async ({ requireEnabled = true } = {}) => {
    const stored = await getPaymentConfig();
    const clientId = process.env.CASHFREE_CLIENT_ID || stored?.client_id;
    const clientSecret = process.env.CASHFREE_CLIENT_SECRET ||
        (stored?.client_secret_encrypted ? decryptSecret(stored.client_secret_encrypted) : null);
    const config = {
        environment: process.env.CASHFREE_ENVIRONMENT || stored?.environment || "SANDBOX",
        clientId,
        clientSecret,
        apiVersion: process.env.CASHFREE_API_VERSION || stored?.api_version || "2025-01-01",
        returnUrl: process.env.CASHFREE_RETURN_URL || stored?.return_url,
        notifyUrl: process.env.CASHFREE_NOTIFY_URL || stored?.notify_url,
        enabled: Boolean(stored?.is_enabled) || process.env.CASHFREE_ENABLED === "true"
    };
    if (requireEnabled && !config.enabled) throw new CashfreeError("Cashfree payments are disabled", 503);
    if (!config.clientId || !config.clientSecret) throw new CashfreeError("Cashfree credentials are not configured", 503);
    return config;
};

const baseUrl = (environment) => environment === "PRODUCTION"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

const cashfreeRequest = async (path, { method = "GET", body, idempotencyKey } = {}) => {
    const config = await loadCashfreeConfig();
    const headers = {
        "content-type": "application/json",
        "x-api-version": config.apiVersion,
        "x-client-id": config.clientId,
        "x-client-secret": config.clientSecret,
        "x-request-id": crypto.randomUUID()
    };
    if (idempotencyKey) headers["x-idempotency-key"] = idempotencyKey;

    let response;
    try {
        response = await fetch(`${baseUrl(config.environment)}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(15000)
        });
    } catch (error) {
        throw new CashfreeError(`Cashfree is unavailable: ${error.message}`);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new CashfreeError(payload.message || "Cashfree request failed", response.status, payload);
    }
    return payload;
};

const createCashfreeOrder = async ({ merchantOrderId, amount, customer, itemName, origin }) => {
    const config = await loadCashfreeConfig();
    const returnUrl = config.returnUrl || `${origin}/payment/return?order_id={order_id}`;
    const notifyUrl = config.notifyUrl || `${origin}/api/v1/payments/webhook`;
    const order = await cashfreeRequest("/orders", {
        method: "POST",
        idempotencyKey: crypto.randomUUID(),
        body: {
            order_id: merchantOrderId,
            order_amount: amount,
            order_currency: "INR",
            customer_details: {
                customer_id: `dns_user_${customer.id}`,
                customer_name: customer.name,
                customer_phone: String(customer.phone_number).replace(/\D/g, "").slice(-10)
            },
            order_meta: { return_url: returnUrl, notify_url: notifyUrl },
            order_note: `Purchase: ${itemName}`,
            order_tags: { item_name: String(itemName).slice(0, 100) }
        }
    });
    return { ...order, dns_environment: config.environment };
};

const getCashfreeOrder = (merchantOrderId) => cashfreeRequest(`/orders/${encodeURIComponent(merchantOrderId)}`);

const createCashfreeRefund = ({ merchantOrderId, refundId, amount, note, speed }) => cashfreeRequest(
    `/orders/${encodeURIComponent(merchantOrderId)}/refunds`,
    {
        method: "POST",
        idempotencyKey: crypto.randomUUID(),
        body: { refund_id: refundId, refund_amount: amount, refund_note: note, refund_speed: speed }
    }
);

const verifyCashfreeWebhook = async ({ rawBody, timestamp, signature }) => {
    if (!rawBody || !timestamp || !signature) return false;
    const timestampNumber = Number(timestamp);
    if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() - timestampNumber) > 5 * 60 * 1000) return false;
    const config = await loadCashfreeConfig({ requireEnabled: false });
    const generated = crypto.createHmac("sha256", config.clientSecret)
        .update(`${timestamp}${rawBody}`)
        .digest("base64");
    const receivedBuffer = Buffer.from(signature);
    const generatedBuffer = Buffer.from(generated);
    return receivedBuffer.length === generatedBuffer.length && crypto.timingSafeEqual(receivedBuffer, generatedBuffer);
};

export {
    CashfreeError, createCashfreeOrder, createCashfreeRefund, getCashfreeOrder,
    loadCashfreeConfig, verifyCashfreeWebhook
};
