import {
    getTwoFactorConfig
} from "../models/authConfigModel.js";


const sendOtp = async (phoneNumber) => {

    // Get 2Factor config from database
    const config = await getTwoFactorConfig();

    if (!config) {
        throw new Error("2Factor configuration not found");
    }

    // 2Factor AUTOGEN
    const url =
        `https://2factor.in/API/V1/${config.api_key}/SMS/${phoneNumber}/AUTOGEN`;

    const response = await fetch(url);

    const data = await response.json();

    if (data.Status !== "Success") {
        throw new Error(
            data.Details || "2Factor OTP sending failed"
        );
    }

    return {
        sessionId: data.Details
    };
};


const verifyOtp = async (sessionId, otp) => {

    const config = await getTwoFactorConfig();

    if (!config) {
        throw new Error("2Factor configuration not found");
    }

    const url =
        `https://2factor.in/API/V1/${config.api_key}/SMS/VERIFY/${sessionId}/${otp}`;

    const response = await fetch(url);

    const data = await response.json();

    return data;
};


export {
    sendOtp,
    verifyOtp
};