import express from "express";

import {
    saveTwoFactor
} from "../controllers/authConfigController.js";

const router = express.Router();

router.post("/2factor", saveTwoFactor);

export default router;