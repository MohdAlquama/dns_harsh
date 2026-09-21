import express from "express";

import {
    showCourses,
    showCreateCourse,
    createCourse,
    showEditCourse,
    updateCourse,
    publishCourse,
    deleteCourse
} from "../controllers/courseController.js";

import { requireAdmin } from "../middleware/adminAuth.js";
import requireSameOrigin from "../middleware/requireSameOrigin.js";
import courseUpload from "../middleware/courseUpload.js";

const router = express.Router();

router.get("/courses", requireAdmin, showCourses);
router.get("/courses/create", requireAdmin, showCreateCourse);
router.post("/courses", requireAdmin, courseUpload, requireSameOrigin, createCourse);
router.get("/courses/:id/edit", requireAdmin, showEditCourse);
router.post("/courses/:id/update", requireAdmin, courseUpload, requireSameOrigin, updateCourse);
router.post("/courses/:id/publish", requireAdmin, requireSameOrigin, publishCourse);
router.post("/courses/:id/delete", requireAdmin, requireSameOrigin, deleteCourse);

export default router;
