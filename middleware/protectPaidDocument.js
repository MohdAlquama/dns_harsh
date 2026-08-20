import { getDocumentPricingByPath } from "../models/paymentModel.js";

const protectPaidDocument = async (req, res, next) => {
    try {
        const requestedPath = decodeURIComponent(req.originalUrl.split("?", 1)[0]);
        const document = await getDocumentPricingByPath(requestedPath);
        if (!document || Number(document.base_price) <= 0) return next();
        // Paid files are served only by the ownership-checked download route.
        return res.status(404).send("File not found");
    } catch (error) {
        console.error("Paid document protection error:", error);
        return res.status(500).send("Unable to verify file access");
    }
};

export default protectPaidDocument;
