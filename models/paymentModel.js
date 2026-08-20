import db from "../config/db.js";

const getPaymentConfig = async () => {
    const [rows] = await db.execute(`SELECT * FROM payment_gateway_config WHERE id = 1`);
    return rows[0] || null;
};

const savePaymentConfig = async (data) => {
    await db.execute(
        `UPDATE payment_gateway_config SET environment = ?, client_id = ?,
         client_secret_encrypted = COALESCE(?, client_secret_encrypted), api_version = ?,
         return_url = ?, notify_url = ?, is_enabled = ? WHERE id = 1`,
        [data.environment, data.clientId || null, data.encryptedSecret || null, data.apiVersion,
            data.returnUrl || null, data.notifyUrl || null, data.isEnabled]
    );
};

const createLocalOrder = async (data) => {
    const [result] = await db.execute(
        `INSERT INTO payment_orders
         (merchant_order_id, user_id, item_type, item_id, item_name, base_amount,
          discount_amount, gst_amount, platform_amount, order_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.merchantOrderId, data.userId, data.itemType, data.itemId, data.itemName,
            data.baseAmount, data.discountAmount, data.gstAmount, data.platformAmount, data.orderAmount]
    );
    return result.insertId;
};

const activateLocalOrder = async (merchantOrderId, cashfree) => db.execute(
    `UPDATE payment_orders SET cashfree_order_id = ?, payment_session_id = ?, status = 'ACTIVE'
     WHERE merchant_order_id = ?`,
    [cashfree.cf_order_id || null, cashfree.payment_session_id, merchantOrderId]
);

const failLocalOrder = async (merchantOrderId, message) => db.execute(
    `UPDATE payment_orders SET status = 'FAILED', failure_message = ? WHERE merchant_order_id = ?`,
    [String(message).slice(0, 1000), merchantOrderId]
);

const getOrderByMerchantId = async (merchantOrderId) => {
    const [rows] = await db.execute(
        `SELECT o.*, u.name AS customer_name, u.phone_number AS customer_phone
         FROM payment_orders o INNER JOIN auth_users u ON u.id = o.user_id
         WHERE o.merchant_order_id = ? LIMIT 1`, [merchantOrderId]
    );
    return rows[0] || null;
};

const getOrderById = async (id) => {
    const [rows] = await db.execute(
        `SELECT o.*, u.name AS customer_name, u.phone_number AS customer_phone
         FROM payment_orders o INNER JOIN auth_users u ON u.id = o.user_id WHERE o.id = ? LIMIT 1`, [id]
    );
    return rows[0] || null;
};

const findOwnedPaidItem = async (userId, itemType, itemId) => {
    const [rows] = await db.execute(
        `SELECT id, merchant_order_id FROM payment_orders
         WHERE user_id = ? AND item_type = ? AND item_id = ?
           AND status IN ('PAID','PARTIALLY_REFUNDED') LIMIT 1`, [userId, itemType, itemId]
    );
    return rows[0] || null;
};

const markOrderFromGateway = async (merchantOrderId, update) => db.execute(
    `UPDATE payment_orders SET status = ?, cashfree_payment_id = COALESCE(?, cashfree_payment_id),
     payment_method = COALESCE(?, payment_method), failure_message = ?,
     paid_at = CASE WHEN ? = 'PAID' THEN COALESCE(paid_at, NOW()) ELSE paid_at END
     WHERE merchant_order_id = ?`,
    [update.status, update.paymentId || null, update.paymentMethod || null,
        update.failureMessage || null, update.status, merchantOrderId]
);

const listUserOrders = async (userId) => {
    const [rows] = await db.execute(
        `SELECT merchant_order_id, item_type, item_id, item_name, order_amount, refunded_amount,
                currency, status, paid_at, created_at
         FROM payment_orders WHERE user_id = ? ORDER BY id DESC`, [userId]
    );
    return rows;
};

const listUserPurchases = async (userId) => {
    const [orders] = await db.execute(
        `SELECT o.merchant_order_id, o.item_type, o.item_id, o.item_name, o.order_amount,
                o.refunded_amount, o.currency, o.status, o.paid_at, o.created_at,
                c.short_description, c.default_image_path
         FROM payment_orders o
         LEFT JOIN current_affairs_courses c ON o.item_type = 'CURRENT_AFFAIRS' AND c.id = o.item_id
         WHERE o.user_id = ? AND o.status IN ('PAID','PARTIALLY_REFUNDED') ORDER BY o.paid_at DESC`, [userId]
    );
    if (!orders.length) return [];
    const courseIds = orders.filter((order) => order.item_type === "CURRENT_AFFAIRS").map((order) => order.item_id);
    let documents = [];
    if (courseIds.length) {
        const placeholders = courseIds.map(() => "?").join(",");
        [documents] = await db.execute(
            `SELECT course_id, id, document_type, document_name, file_path
             FROM current_affairs_documents WHERE status = 'ACTIVE' AND course_id IN (${placeholders})`, courseIds
        );
    }
    return orders.map((order) => ({ ...order, documents: documents.filter((doc) => doc.course_id === order.item_id) }));
};

const getPurchasedDocument = async (userId, documentId) => {
    const [rows] = await db.execute(
        `SELECT d.id, d.document_name, d.file_path
         FROM current_affairs_documents d
         INNER JOIN payment_orders o ON o.item_type = 'CURRENT_AFFAIRS' AND o.item_id = d.course_id
         WHERE d.id = ? AND d.status = 'ACTIVE' AND o.user_id = ?
           AND o.status IN ('PAID','PARTIALLY_REFUNDED') LIMIT 1`, [documentId, userId]
    );
    return rows[0] || null;
};

const getDocumentPricingByPath = async (filePath) => {
    const [rows] = await db.execute(
        `SELECT d.id, p.base_price FROM current_affairs_documents d
         INNER JOIN current_affairs_pricing p ON p.course_id = d.course_id
         WHERE d.file_path = ? AND d.status = 'ACTIVE' LIMIT 1`, [filePath]
    );
    return rows[0] || null;
};

const listAdminOrders = async () => {
    const [rows] = await db.execute(
        `SELECT o.*, u.name AS customer_name, u.phone_number AS customer_phone
         FROM payment_orders o INNER JOIN auth_users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 500`
    );
    return rows;
};

const createRefundRecord = async (data) => {
    const [result] = await db.execute(
        `INSERT INTO payment_refunds (order_id, merchant_refund_id, amount, note, speed)
         VALUES (?, ?, ?, ?, ?)`, [data.orderId, data.refundId, data.amount, data.note, data.speed]
    );
    return result.insertId;
};

const updateRefundFromGateway = async (refundId, data) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [existing] = await connection.execute(
            `SELECT order_id, amount, status FROM payment_refunds WHERE merchant_refund_id = ? FOR UPDATE`, [refundId]
        );
        await connection.execute(
            `UPDATE payment_refunds SET cashfree_refund_id = COALESCE(?, cashfree_refund_id),
             status = ?, status_description = ? WHERE merchant_refund_id = ?`,
            [data.cashfreeRefundId || null, data.status, data.description || null, refundId]
        );
        if (data.status === "SUCCESS" && existing[0]?.status !== "SUCCESS") {
            if (existing[0]) {
                await connection.execute(
                    `UPDATE payment_orders SET
                     status = IF(refunded_amount + ? >= order_amount, 'REFUNDED', 'PARTIALLY_REFUNDED'),
                     refunded_amount = LEAST(order_amount, refunded_amount + ?)
                     WHERE id = ? AND status IN ('PAID','PARTIALLY_REFUNDED')`,
                    [existing[0].amount, existing[0].amount, existing[0].order_id]
                );
            }
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const recordWebhook = async (key, type, hash) => {
    try {
        await db.execute(`INSERT INTO payment_webhook_events (idempotency_key, event_type, payload_hash) VALUES (?, ?, ?)`, [key, type, hash]);
        return true;
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") return false;
        throw error;
    }
};

const deleteWebhook = (key) => db.execute(`DELETE FROM payment_webhook_events WHERE idempotency_key = ?`, [key]);

const listRefundsByOrders = async (orderIds) => {
    if (!orderIds.length) return [];
    const placeholders = orderIds.map(() => "?").join(",");
    const [rows] = await db.execute(`SELECT * FROM payment_refunds WHERE order_id IN (${placeholders}) ORDER BY id DESC`, orderIds);
    return rows;
};

export {
    activateLocalOrder, createLocalOrder, createRefundRecord, deleteWebhook, failLocalOrder, findOwnedPaidItem,
    getDocumentPricingByPath, getOrderById, getOrderByMerchantId, getPaymentConfig, getPurchasedDocument,
    listAdminOrders, listRefundsByOrders,
    listUserOrders, listUserPurchases, markOrderFromGateway, recordWebhook, savePaymentConfig, updateRefundFromGateway
};
