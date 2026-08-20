import express from "express";
import { addAdmin, showAdmins } from "../controllers/adminManagementController.js";
import { requireSuperAdmin } from "../middleware/adminAuth.js";
import requireSameOrigin from "../middleware/requireSameOrigin.js";

const router = express.Router();
router.use(requireSuperAdmin);
router.get("/admins", showAdmins);
router.post("/admins", requireSameOrigin, addAdmin);

export default router;
