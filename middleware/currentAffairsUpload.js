import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.join(currentDirectory, "..", "public", "uploads", "current-affairs");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => {
        const safeExtension = path.extname(file.originalname).toLowerCase();
        callback(null, `${Date.now()}-${crypto.randomUUID()}${safeExtension}`);
    }
});

const allowedImages = new Set(["image/jpeg", "image/png", "image/webp"]);

const fileFilter = (_req, file, callback) => {
    if (["default_image", "ad_image"].includes(file.fieldname)) {
        return callback(null, allowedImages.has(file.mimetype));
    }
    if (file.fieldname === "normal_pdf") {
        return callback(null, file.mimetype === "application/pdf");
    }
    return callback(null, false);
};

const currentAffairsUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 25 * 1024 * 1024, files: 3 }
}).fields([
    { name: "default_image", maxCount: 1 },
    { name: "ad_image", maxCount: 1 },
    { name: "normal_pdf", maxCount: 1 }
]);

export default currentAffairsUpload;
