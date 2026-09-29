import express from "express";

import {
    addAdmin,
    removeAdmin,
    showAdmins
} from "../controllers/adminManagementController.js";

import {
    requireSuperAdmin
} from "../middleware/adminAuth.js";

import requireSameOrigin from "../middleware/requireSameOrigin.js";

const router = express.Router();

/*
 * Only SUPER_ADMIN can access
 * administrator management.
 */
router.use(
    requireSuperAdmin
);

/*
 * Administrator list
 */
router.get(
    "/admins",
    showAdmins
);

/*
 * Create ADMIN / SUPER_ADMIN
 */
router.post(
    "/admins",
    requireSameOrigin,
    addAdmin
);

/*
 * Delete ADMIN / SUPER_ADMIN
 */
router.post(
    "/admins/:id/delete",
    requireSameOrigin,
    removeAdmin
);

export default router;