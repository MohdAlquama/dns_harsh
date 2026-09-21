import express from "express";

import requireAuth from "../middleware/requireAuth.js";

import {
    showMyCourses,
    showMyCourseDetails,
    getCourseVideo
} from "../controllers/courseLearningController.js";


const router = express.Router();


// =====================================================
// MY COURSES
// =====================================================

router.get(
    "/my-courses",
    requireAuth,
    showMyCourses
);


// =====================================================
// COURSE DETAILS
// =====================================================

router.get(
    "/my-courses/:courseId",
    requireAuth,
    showMyCourseDetails
);


// =====================================================
// COURSE VIDEO
// Returns temporary S3/CDN URL
// =====================================================

router.get(
    "/my-courses/:courseId/videos/:videoId",
    requireAuth,
    getCourseVideo
);


export default router;