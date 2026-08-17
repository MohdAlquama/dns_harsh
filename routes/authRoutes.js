import express from "express";

import {
    startAuth,
    register,
    login,
    refreshToken,
    logout,
    forgotPassword,
    verifyAuthOtp
} from "../controllers/authController.js";

const router = express.Router();

router.post("/start", startAuth);

router.post("/register", register);

router.post("/login", login);

router.post("/refresh", refreshToken);

router.post("/logout", logout);

router.post("/forgot-password", forgotPassword);

router.post("/verify-otp", verifyAuthOtp);

export default router;