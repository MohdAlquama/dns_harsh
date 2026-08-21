import {
    getTwoFactorConfig
} from "../models/authConfigModel.js";

const PROVIDER_TIMEOUT_MS = 15000;
const CONNECT_RETRY_DELAY_MS = 300;

class OtpProviderError extends Error {
    constructor(message, { code = "OTP_PROVIDER_ERROR", statusCode = 503, cause } = {}) {
        super(message, cause ? { cause } : undefined);
        this.name = "OtpProviderError";
        this.code = code;
        this.statusCode = statusCode;
    }
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const isConnectionFailure = (error) => {
    const code = error?.cause?.code || error?.code;
    return [
        "UND_ERR_CONNECT_TIMEOUT",
        "ECONNREFUSED",
        "EAI_AGAIN",
        "ENETUNREACH"
    ].includes(code);
};

const requestProvider = async (url) => {
    // Retry only failures that happen while establishing the connection. Retrying
    // arbitrary failures could send two OTP messages when the first request was accepted.
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { Accept: "application/json" },
                signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
            });
            const data = await response.json().catch(() => ({}));
            return { response, data };
        } catch (error) {
            if (attempt === 0 && isConnectionFailure(error)) {
                await wait(CONNECT_RETRY_DELAY_MS);
                continue;
            }

            const timedOut = error?.name === "TimeoutError" || error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT";
            throw new OtpProviderError(
                timedOut
                    ? "OTP service timed out. Please try again in a moment."
                    : "OTP service is temporarily unreachable. Please try again in a moment.",
                { code: timedOut ? "OTP_PROVIDER_TIMEOUT" : "OTP_PROVIDER_UNAVAILABLE", cause: error }
            );
        }
    }
};

const assertProviderSuccess = (response, data, fallbackMessage) => {
    if (response.ok && data.Status === "Success") return;

    if (response.status === 429 || response.status >= 500) {
        throw new OtpProviderError("OTP service is temporarily unavailable. Please try again shortly.", {
            code: "OTP_PROVIDER_UNAVAILABLE"
        });
    }

    throw new OtpProviderError(data.Details || fallbackMessage, {
        code: "OTP_PROVIDER_REJECTED",
        statusCode: 502
    });
};

const sendOtpWithApiKey = async (phoneNumber, apiKey) => {
    const url =
        `https://2factor.in/API/V1/${encodeURIComponent(apiKey)}/SMS/${encodeURIComponent(phoneNumber)}/AUTOGEN`;

    const { response, data } = await requestProvider(url);
    assertProviderSuccess(response, data, "2Factor OTP sending failed");

    return {
        sessionId: data.Details
    };
};

const sendOtp = async (phoneNumber) => {
    const config = await getTwoFactorConfig();
    if (!config) throw new Error("2Factor configuration not found");
    return sendOtpWithApiKey(phoneNumber, config.api_key);
};


const verifyOtp = async (sessionId, otp) => {

    const config = await getTwoFactorConfig();

    if (!config) {
        throw new Error("2Factor configuration not found");
    }

    const url =
        `https://2factor.in/API/V1/${encodeURIComponent(config.api_key)}/SMS/VERIFY/${encodeURIComponent(sessionId)}/${encodeURIComponent(otp)}`;

    const { response, data } = await requestProvider(url);
    if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
            throw new OtpProviderError("OTP service is temporarily unavailable. Please try again shortly.", {
                code: "OTP_PROVIDER_UNAVAILABLE"
            });
        }
        throw new OtpProviderError(data.Details || "2Factor OTP verification failed", {
            code: "OTP_PROVIDER_REJECTED",
            statusCode: 502
        });
    }

    return data;
};


export {
    OtpProviderError,
    sendOtp,
    sendOtpWithApiKey,
    verifyOtp
};
