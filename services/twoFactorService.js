import {
    getTwoFactorConfig
} from "../models/authConfigModel.js";


const sendOtpWithApiKey = async (phoneNumber, apiKey) => {
    const url =
        `https://2factor.in/API/V1/${encodeURIComponent(apiKey)}/SMS/${encodeURIComponent(phoneNumber)}/AUTOGEN`;

    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.Status !== "Success") {
        throw new Error(
            data.Details || "2Factor OTP sending failed"
        );
    }

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

    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) throw new Error(data.Details || "2Factor OTP verification failed");

    return data;
};


export {
    sendOtp,
    sendOtpWithApiKey,
    verifyOtp
};
