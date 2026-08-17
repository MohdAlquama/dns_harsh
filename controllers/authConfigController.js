import {
    getTwoFactorConfigStatus,
    saveTwoFactorConfig
} from "../models/authConfigModel.js";


const showAuthSettings = (req, res) => {
    res.render("layouts/layout", {
        title: "OTP Settings | DNS Admin",
        page: "../auth_config/index"
    });
};


const getTwoFactorStatus = async (req, res) => {
    try {
        const config = await getTwoFactorConfigStatus();

        return res.status(200).json({
            success: true,
            configured: Boolean(config),
            enabled: config?.status === 1,
            provider: config?.provider || "2FACTOR",
            updatedAt: config?.updated_at || null
        });
    } catch (error) {
        console.error("Get 2Factor Config Status Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};


const saveTwoFactor = async (req, res) => {
    try {

        const apiKey = typeof req.body.apiKey === "string" ? req.body.apiKey.trim() : "";

        if (!apiKey) {
            return res.status(400).json({
                success: false,
                message: "2Factor API key is required"
            });
        }

        await saveTwoFactorConfig(apiKey);

        return res.status(200).json({
            success: true,
            message: "2Factor configuration saved successfully"
        });

    } catch (error) {

        console.error("Save 2Factor Config Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


export {
    getTwoFactorStatus,
    showAuthSettings,
    saveTwoFactor
};
