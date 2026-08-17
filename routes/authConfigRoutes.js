import express from "express";

import {
    getTwoFactorStatus,
    saveTwoFactor
} from "../controllers/authConfigController.js";

const router = express.Router();

router.get("/2factor", getTwoFactorStatus);

router.post("/2factor", saveTwoFactor);

export default router;
