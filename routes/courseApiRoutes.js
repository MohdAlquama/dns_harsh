import express from "express";

import requireAuth from "../middleware/requireAuth.js";

import {
    getCourses,
    getCourse,
    getMyCourses,
    getMyCourseDetails,
    getMyChapterContent
} from "../controllers/courseApiController.js";

const router = express.Router();

// Public
router.get("/courses", getCourses);

router.get("/courses/:courseId", getCourse);

// Purchased courses
router.get(
    "/my-courses",
    requireAuth,
    getMyCourses
);

router.get(
    "/my-courses/:courseId",
    requireAuth,
    getMyCourseDetails
);

router.get(
    "/my-courses/:courseId/chapters/:chapterId",
    requireAuth,
    getMyChapterContent
);

export default router;