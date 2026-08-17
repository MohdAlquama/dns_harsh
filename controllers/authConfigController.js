import {
    saveTwoFactorConfig
} from "../models/authConfigModel.js";


const saveTwoFactor = async (req, res) => {
    try {

        const { apiKey } = req.body;

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
    saveTwoFactor
};