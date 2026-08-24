import { admin, getFirebaseAdminApp } from "../config/firebaseAdmin.js";
import {
    deleteFcmTokens,
    findFcmTokensByUserId
} from "../models/fcmTokenModel.js";

const STALE_TOKEN_ERRORS = new Set([
    "messaging/invalid-registration-token",
    "messaging/registration-token-not-registered"
]);
const MAX_TOKENS_PER_MULTICAST = 500;

const normalizeData = (data) => Object.fromEntries(
    Object.entries(data || {}).map(([key, value]) => [key, String(value)])
);

const sendNotificationToUser = async ({ userId, title, body, data = {} }) => {
    if (!Number.isInteger(Number(userId)) || Number(userId) < 1) {
        throw new Error("A valid userId is required");
    }
    if (!title?.trim() || !body?.trim()) {
        throw new Error("Notification title and body are required");
    }

    const tokens = await findFcmTokensByUserId(Number(userId));
    if (!tokens.length) {
        return { successCount: 0, failureCount: 0, staleTokenCount: 0 };
    }

    getFirebaseAdminApp();
    const staleTokens = [];
    let successCount = 0;
    let failureCount = 0;

    // Firebase accepts at most 500 registration tokens per multicast request.
    for (let start = 0; start < tokens.length; start += MAX_TOKENS_PER_MULTICAST) {
        const tokenBatch = tokens.slice(start, start + MAX_TOKENS_PER_MULTICAST);
        const response = await admin.messaging().sendEachForMulticast({
            tokens: tokenBatch,
            notification: { title: title.trim(), body: body.trim() },
            data: normalizeData(data)
        });
        successCount += response.successCount;
        failureCount += response.failureCount;

        // Responses preserve the original request order, so each error maps to
        // the token at the same index in this batch.
        response.responses.forEach((item, index) => {
            if (!item.success && STALE_TOKEN_ERRORS.has(item.error?.code)) {
                staleTokens.push(tokenBatch[index]);
            }
        });
    }

    const staleTokenCount = await deleteFcmTokens(staleTokens);
    return {
        successCount,
        failureCount,
        staleTokenCount
    };
};

export { sendNotificationToUser };
