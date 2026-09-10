import express from "express";

import {
    addAppVersion,
    getAppVersions,
    getAppVersion,
    checkAppVersion,
    editAppVersion,
    removeAppVersion,
    toggleAppVersion
} from "../controllers/appVersionController.js";

import {
    requireAdmin,
    requireSuperAdmin
} from "../middleware/adminAuth.js";

const router = express.Router();


// ========================================
// MOBILE APP
// ========================================

router.get(
    "/check",
    checkAppVersion
);


// ========================================
// ADMIN
// ========================================

router.get(
    "/",
    requireAdmin,
    requireSuperAdmin,
    getAppVersions
);

router.get(
    "/:id",
    requireAdmin,
    requireSuperAdmin,
    getAppVersion
);

router.post(
    "/",
    requireAdmin,
    requireSuperAdmin,
    addAppVersion
);

router.put(
    "/:id",
    requireAdmin,
    requireSuperAdmin,
    editAppVersion
);

router.delete(
    "/:id",
    requireAdmin,
    requireSuperAdmin,
    removeAppVersion
);

router.patch(
    "/:id/toggle",
    requireAdmin,
    requireSuperAdmin,
    toggleAppVersion
);


export default router;  