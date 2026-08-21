import express from "express";
import {
    getAdminSocialMedia,
    getPublicSocialMedia,
    showSocialMediaSettings,
    updateSocialMedia
} from "../controllers/socialMediaController.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import requireSameOrigin from "../middleware/requireSameOrigin.js";

const router = express.Router();

router.get("/api/v1/social-media", getPublicSocialMedia);
router.get("/social-media-settings", requireAdmin, showSocialMediaSettings);
router.get("/api/v1/admin/social-media", requireAdmin, getAdminSocialMedia);
router.put("/api/v1/admin/social-media", requireAdmin, requireSameOrigin, updateSocialMedia);

export default router;
