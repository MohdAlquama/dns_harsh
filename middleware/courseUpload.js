import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const uploadDir = path.resolve("public/uploads/courses");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = crypto.randomBytes(12).toString("hex");
        cb(null, `${Date.now()}-${safeName}${ext}`);
    }
});

const fileFilter = (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
        return cb(null, true);
    }

    cb(new Error("Only JPG, PNG and WEBP images are allowed."));
};

const courseUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
}).fields([
    { name: "cover_image", maxCount: 1 },
    { name: "ad_image", maxCount: 1 }
]);

export default courseUpload;
