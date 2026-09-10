import express from "express";

import {
    addAppVersionPage,
    editAppVersionPage,
    removeAppVersionPage,
    showAppVersionList,
    showEditAppVersionForm,
    showNewAppVersionForm,
    toggleAppVersionPage
} from "../controllers/appVersionPageController.js";

import {
    requireAdmin,
    requireSuperAdmin
} from "../middleware/adminAuth.js";

const router = express.Router();

router.use(
    requireAdmin,
    requireSuperAdmin
);

router.get(
    "/",
    showAppVersionList
);

router.get(
    "/new",
    showNewAppVersionForm
);

router.post(
    "/",
    addAppVersionPage
);

router.get(
    "/:id/edit",
    showEditAppVersionForm
);

router.post(
    "/:id",
    editAppVersionPage
);

router.post(
    "/:id/delete",
    removeAppVersionPage
);

router.post(
    "/:id/toggle",
    toggleAppVersionPage
);

export default router;