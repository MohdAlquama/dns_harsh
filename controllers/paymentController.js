import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { getCurrentAffairsCourseById } from "../models/currentAffairsModel.js";
import {
    activateLocalOrder, createLocalOrder, createRefundRecord, deleteWebhook, failLocalOrder, findOwnedPaidItem,
    getOrderByMerchantId, getPurchasedDocument, listUserOrders, listUserPurchases, markOrderFromGateway, recordWebhook,
    updateRefundFromGateway
} from "../models/paymentModel.js";
import {
    CashfreeError, createCashfreeOrder, getCashfreeOrder, verifyCashfreeWebhook
} from "../services/cashfreeService.js";

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const documentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "uploads", "current-affairs");

const calculateCoursePrice = (course) => {
    const base = roundMoney(course.base_price);
    let discount = 0;
    if (course.offer?.is_active) {
        discount = course.offer.discount_type === "PERCENT"
            ? roundMoney(base * Number(course.offer.discount_value) / 100)
            : roundMoney(course.offer.discount_value);
    }
    discount = Math.min(base, discount);
    const taxable = roundMoney(base - discount);
    const gst = course.gst_enabled ? roundMoney(taxable * Number(course.gst_percent || 0) / 100) : 0;
    const platform = course.platform_charge_enabled ? roundMoney(course.platform_charge || 0) : 0;
    return { base, discount, gst, platform, total: roundMoney(taxable + gst + platform) };
};

const publicOrder = (order) => ({
    orderId: order.merchant_order_id,
    item: { type: order.item_type, id: order.item_id, name: order.item_name },
    amount: Number(order.order_amount),
    refundedAmount: Number(order.refunded_amount),
    currency: order.currency,
    status: order.status,
    paidAt: order.paid_at,
    createdAt: order.created_at
});

const createOrder = async (req, res) => {
    let merchantOrderId;
    try {
        const courseId = Number.parseInt(req.body.currentAffairsId, 10);
        if (!Number.isInteger(courseId) || courseId < 1) {
            return res.status(400).json({ success: false, message: "currentAffairsId is required" });
        }
        const course = await getCurrentAffairsCourseById(courseId);
        if (!course || course.status !== "PUBLISHED") {
            return res.status(404).json({ success: false, message: "Purchasable item not found" });
        }
        const owned = await findOwnedPaidItem(req.user.id, "CURRENT_AFFAIRS", course.id);
        if (owned) {
            return res.status(409).json({ success: false, message: "You already own this item", orderId: owned.merchant_order_id });
        }
        const price = calculateCoursePrice(course);
        if (price.total < 1) {
            return res.status(422).json({ success: false, message: "Cashfree orders must be at least ₹1" });
        }

        merchantOrderId = `dns_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
        await createLocalOrder({
            merchantOrderId, userId: req.user.id, itemType: "CURRENT_AFFAIRS", itemId: course.id,
            itemName: course.course_name, baseAmount: price.base, discountAmount: price.discount,
            gstAmount: price.gst, platformAmount: price.platform, orderAmount: price.total
        });
        const gatewayOrder = await createCashfreeOrder({
            merchantOrderId, amount: price.total, customer: req.user, itemName: course.course_name,
            origin: `${req.protocol}://${req.get("host")}`
        });
        await activateLocalOrder(merchantOrderId, gatewayOrder);
        return res.status(201).json({
            success: true,
            order: { orderId: merchantOrderId, amount: price.total, currency: "INR", priceBreakdown: price },
            cashfree: { paymentSessionId: gatewayOrder.payment_session_id, environment: gatewayOrder.dns_environment }
        });
    } catch (error) {
        if (merchantOrderId) await failLocalOrder(merchantOrderId, error.message);
        console.error("Create payment order error:", error);
        const status = error instanceof CashfreeError ? error.status : 500;
        return res.status(status).json({ success: false, message: error.message || "Unable to create order" });
    }
};

const syncOrder = async (order) => {
    const remote = await getCashfreeOrder(order.merchant_order_id);
    const amountMatches = roundMoney(remote.order_amount) === roundMoney(order.order_amount) && remote.order_currency === order.currency;
    if (remote.order_status === "PAID" && amountMatches) {
        await markOrderFromGateway(order.merchant_order_id, { status: "PAID" });
    } else if (["EXPIRED", "TERMINATED"].includes(remote.order_status)) {
        await markOrderFromGateway(order.merchant_order_id, { status: "EXPIRED" });
    }
    return getOrderByMerchantId(order.merchant_order_id);
};

const getOrder = async (req, res) => {
    try {
        let order = await getOrderByMerchantId(req.params.orderId);
        if (!order || order.user_id !== req.user.id) return res.status(404).json({ success: false, message: "Order not found" });
        if (["CREATED", "ACTIVE"].includes(order.status)) order = await syncOrder(order);
        return res.json({ success: true, order: publicOrder(order) });
    } catch (error) {
        console.error("Get payment order error:", error);
        return res.status(error instanceof CashfreeError ? error.status : 500).json({ success: false, message: error.message });
    }
};

const getPurchases = async (req, res) => {
    try {
        const purchases = await listUserPurchases(req.user.id);
        const absoluteUrl = (path) => path ? new URL(path, `${req.protocol}://${req.get("host")}`).href : null;
        return res.json({ success: true, data: purchases.map((purchase) => ({
            ...publicOrder(purchase),
            description: purchase.short_description,
            imageUrl: absoluteUrl(purchase.default_image_path),
            documents: purchase.documents.map((document) => ({
                id: document.id, type: document.document_type, name: document.document_name,
                downloadUrl: absoluteUrl(`/api/v1/payments/documents/${document.id}/download`)
            }))
        })) });
    } catch (error) {
        console.error("Purchase history error:", error);
        return res.status(500).json({ success: false, message: "Unable to load purchases" });
    }
};

const downloadDocument = async (req, res) => {
    try {
        const documentId = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(documentId) || documentId < 1) return res.status(404).json({ success: false, message: "Document not found" });
        const document = await getPurchasedDocument(req.user.id, documentId);
        if (!document?.file_path) return res.status(404).json({ success: false, message: "Document not found or not purchased" });
        const absolutePath = path.resolve(documentRoot, path.basename(document.file_path));
        if (!absolutePath.startsWith(`${documentRoot}${path.sep}`)) return res.status(400).json({ success: false, message: "Invalid document path" });
        return res.download(absolutePath, document.document_name || path.basename(absolutePath), (error) => {
            if (error && !res.headersSent) res.status(404).json({ success: false, message: "Document file is unavailable" });
        });
    } catch (error) {
        console.error("Purchased document error:", error);
        return res.status(500).json({ success: false, message: "Unable to download document" });
    }
};

const webhook = async (req, res) => {
    let webhookKey;
    try {
        const rawBody = req.rawBody || "";
        const timestamp = req.get("x-webhook-timestamp");
        const signature = req.get("x-webhook-signature");
        if (!await verifyCashfreeWebhook({ rawBody, timestamp, signature })) {
            return res.status(401).json({ success: false, message: "Invalid webhook signature" });
        }
        const event = req.body;
        webhookKey = req.get("x-idempotency-key") || `${timestamp}:${signature}`;
        const isNew = await recordWebhook(webhookKey, event.type || "UNKNOWN", crypto.createHash("sha256").update(rawBody).digest("hex"));
        if (!isNew) return res.status(200).json({ success: true, duplicate: true });

        if (event.type?.startsWith("PAYMENT_")) {
            const remoteOrder = event.data?.order || {};
            const payment = event.data?.payment || {};
            const local = await getOrderByMerchantId(remoteOrder.order_id);
            if (local && roundMoney(remoteOrder.order_amount) === roundMoney(local.order_amount) && remoteOrder.order_currency === local.currency) {
                const status = payment.payment_status === "SUCCESS" ? "PAID"
                    : event.type === "PAYMENT_USER_DROPPED_WEBHOOK" ? "USER_DROPPED" : "FAILED";
                await markOrderFromGateway(local.merchant_order_id, {
                    status,
                    paymentId: payment.cf_payment_id,
                    paymentMethod: payment.payment_group,
                    failureMessage: payment.payment_message
                });
            }
        }

        if (event.type === "REFUND_STATUS_WEBHOOK") {
            const refund = event.data?.refund;
            if (refund?.refund_id) {
                await updateRefundFromGateway(refund.refund_id, {
                    cashfreeRefundId: refund.cf_refund_id,
                    status: refund.refund_status,
                    description: refund.status_description
                });
            }
        }
        if (event.type === "AUTO_REFUND_STATUS_WEBHOOK") {
            const refund = event.data?.auto_refund;
            const local = refund?.order_id ? await getOrderByMerchantId(refund.order_id) : null;
            if (local && refund?.cf_refund_id && Number(refund.refund_amount) > 0) {
                const refundableAmount = Math.min(
                    Number(refund.refund_amount),
                    Math.max(0, Number(local.order_amount) - Number(local.refunded_amount))
                );
                if (refundableAmount <= 0) return res.status(200).json({ success: true });
                const refundId = `auto_${crypto.createHash("sha256").update(String(refund.cf_refund_id)).digest("hex").slice(0, 32)}`;
                try {
                    await createRefundRecord({
                        orderId: local.id, refundId, amount: refundableAmount.toFixed(2),
                        note: "Cashfree automatic refund", speed: "STANDARD"
                    });
                } catch (error) {
                    if (error.code !== "ER_DUP_ENTRY") throw error;
                }
                await updateRefundFromGateway(refundId, {
                    cashfreeRefundId: refund.cf_refund_id,
                    status: refund.refund_status,
                    description: refund.status_description || refund.refund_reason
                });
            }
        }
        return res.status(200).json({ success: true });
    } catch (error) {
        if (webhookKey) await deleteWebhook(webhookKey).catch(() => {});
        console.error("Cashfree webhook error:", error);
        return res.status(500).json({ success: false });
    }
};

const showPaymentReturn = (req, res) => res.render("payment/return", { orderId: req.query.order_id || "" });

export { calculateCoursePrice, createOrder, downloadDocument, getOrder, getPurchases, showPaymentReturn, webhook };
