import db from "../config/db.js";

import {
    getPublishedCourses,
    getPublishedCourseById
} from "../models/courseModel.js";

import {
    GetObjectCommand
} from "@aws-sdk/client-s3";

import {
    getSignedUrl
} from "@aws-sdk/s3-request-presigner";

import {
    getS3ClientAndConfig
} from "./courseOrganization/utils/s3.js";

const getActiveEnrollment = async (userId, courseId) => {
    const [rows] = await db.execute(
        `
        SELECT
            id,
            user_id,
            course_id,
            order_id,
            status,
            enrolled_at
        FROM course_enrollments
        WHERE user_id = ?
          AND course_id = ?
          AND status = 'ACTIVE'
        LIMIT 1
        `,
        [userId, courseId]
    );

    return rows[0] || null;
};

const getCourseRow = async (courseId) => {
    const [rows] = await db.execute(
        `
        SELECT
            c.id,
            c.name AS course_name,
            c.slug,
            c.short_description,
            c.long_description,
            c.cover_image_url,
            c.price,
            c.status,
            c.subject_folder_id,
            o.folder_name AS subject_name
        FROM courses c
        LEFT JOIN course_organizations o
            ON o.id = c.subject_folder_id
        WHERE c.id = ?
        LIMIT 1
        `,
        [courseId]
    );

    return rows[0] || null;
};

// =====================================================
// PUBLIC COURSES
// =====================================================
export const getCourses = async (req, res) => {
    try {
        const courses = await getPublishedCourses();

        return res.json({
            success: true,
            data: courses.map(course => ({
                id: course.id,
                name: course.course_name,
                slug: course.slug,
                subject: {
                    id: course.subject_folder_id,
                    name: course.subject_name
                },
                description: {
                    short: course.short_description,
                    long: course.long_description
                },
                imageUrl: course.cover_image_url,
                price: Number(course.price),
                currency: "INR",
                status: course.status
            }))
        });
    } catch (error) {
        console.error("Get courses API error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load courses"
        });
    }
};

// =====================================================
// PUBLIC COURSE DETAIL
// No video data here.
// =====================================================
export const getCourse = async (req, res) => {
    try {
        const courseId = Number(req.params.courseId);
        const course = await getPublishedCourseById(courseId);

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }

        return res.json({
            success: true,
            data: {
                id: course.id,
                name: course.course_name,
                slug: course.slug,
                subject: {
                    id: course.subject_folder_id,
                    name: course.subject_name
                },
                description: {
                    short: course.short_description,
                    long: course.long_description
                },
                imageUrl: course.cover_image_url,
                price: Number(course.price),
                currency: "INR",
                purchase: {
                    available: true,
                    requiresLogin: true,
                    createOrderEndpoint: "/api/v1/course-payments/orders"
                }
            }
        });
    } catch (error) {
        console.error("Get course API error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load course"
        });
    }
};

// =====================================================
// MY COURSES
// =====================================================
export const getMyCourses = async (req, res) => {
    try {
        const [rows] = await db.execute(
            `
            SELECT
                c.id,
                c.name AS course_name,
                c.slug,
                c.short_description,
                c.cover_image_url,
                c.price,
                c.status,
                e.id AS enrollment_id,
                e.order_id,
                e.enrolled_at,
                o.folder_name AS subject_name
            FROM course_enrollments e
            INNER JOIN courses c
                ON c.id = e.course_id
            LEFT JOIN course_organizations o
                ON o.id = c.subject_folder_id
            WHERE e.user_id = ?
              AND e.status = 'ACTIVE'
            ORDER BY e.enrolled_at DESC
            `,
            [req.user.id]
        );

        return res.json({
            success: true,
            data: rows.map(course => ({
                id: course.id,
                name: course.course_name,
                slug: course.slug,
                subject: course.subject_name,
                shortDescription: course.short_description,
                imageUrl: course.cover_image_url,
                price: Number(course.price),
                status: course.status,
                enrollment: {
                    id: course.enrollment_id,
                    orderId: course.order_id,
                    enrolledAt: course.enrolled_at
                }
            }))
        });
    } catch (error) {
        console.error("My courses API error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load purchased courses"
        });
    }
};

// =====================================================
// MY COURSE DETAILS
// Organization subject -> chapters
// =====================================================
export const getMyCourseDetails = async (req, res) => {
    try {
        const courseId = Number(req.params.courseId);
        const enrollment = await getActiveEnrollment(req.user.id, courseId);

        if (!enrollment) {
            return res.status(403).json({
                success: false,
                message: "You are not enrolled in this course"
            });
        }

        const course = await getCourseRow(courseId);

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }

        const [chapters] = await db.execute(
            `
            SELECT
                id,
                folder_name AS chapter_name
            FROM course_organizations
            WHERE parent_id = ?
            ORDER BY id ASC
            `,
            [course.subject_folder_id]
        );

        return res.json({
            success: true,
            data: {
                id: course.id,
                name: course.course_name,
                slug: course.slug,
                subject: {
                    id: course.subject_folder_id,
                    name: course.subject_name
                },
                description: {
                    short: course.short_description,
                    long: course.long_description
                },
                imageUrl: course.cover_image_url,
                enrollment: {
                    id: enrollment.id,
                    orderId: enrollment.order_id,
                    enrolledAt: enrollment.enrolled_at
                },
                chapters: chapters.map(chapter => ({
                    id: chapter.id,
                    name: chapter.chapter_name,
                    contentEndpoint:
                        `/api/v1/my-courses/${courseId}/chapters/${chapter.id}`
                }))
            }
        });
    } catch (error) {
        console.error("My course details API error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load course"
        });
    }
};

// =====================================================
// APP VIDEO API
// Organization directly owns videos.
// No course_contents table is used.
// =====================================================
export const getMyChapterContent = async (req, res) => {
    try {
        const courseId = Number(req.params.courseId);
        const chapterId = Number(req.params.chapterId);

        if (
            !Number.isInteger(courseId) ||
            !Number.isInteger(chapterId) ||
            courseId < 1 ||
            chapterId < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid course or chapter"
            });
        }

        const enrollment = await getActiveEnrollment(req.user.id, courseId);

        if (!enrollment) {
            return res.status(403).json({
                success: false,
                message: "You are not enrolled in this course"
            });
        }

        const course = await getCourseRow(courseId);

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }

        const [chapterRows] = await db.execute(
            `
            SELECT
                id,
                folder_name
            FROM course_organizations
            WHERE id = ?
              AND parent_id = ?
            LIMIT 1
            `,
            [chapterId, course.subject_folder_id]
        );

        const chapter = chapterRows[0];

        if (!chapter) {
            return res.status(403).json({
                success: false,
                message: "This chapter does not belong to this course"
            });
        }

        const [videos] = await db.execute(
            `
            SELECT
                id AS video_id,
                video_name,
                video_description,
                video_icon,
                s3_key,
                created_at
            FROM course_folder_videos
            WHERE folder_id = ?
            ORDER BY id ASC
            `,
            [chapterId]
        );

        const { client, config } = await getS3ClientAndConfig();

        const securedVideos = await Promise.all(
            videos.map(async (video) => {
                let videoUrl = null;

                if (video.s3_key) {
                    if (
                        config.storage_type === "s3_cdn" &&
                        config.cdn_url
                    ) {
                        videoUrl =
                            `${config.cdn_url.replace(/\/$/, "")}/${video.s3_key}`;
                    } else {
                        const command = new GetObjectCommand({
                            Bucket: config.bucket_name,
                            Key: video.s3_key
                        });

                        videoUrl = await getSignedUrl(
                            client,
                            command,
                            { expiresIn: 900 }
                        );
                    }
                }

                return {
                    id: video.video_id,
                    title: video.video_name,
                    description: video.video_description,
                    thumbnail: video.video_icon,
                    videoUrl,
                    createdAt: video.created_at
                };
            })
        );

        return res.json({
            success: true,
            data: {
                courseId,
                chapter: {
                    id: chapter.id,
                    name: chapter.folder_name
                },
                videos: securedVideos
            }
        });
    } catch (error) {
        console.error("My chapter content API error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load chapter content"
        });
    }
};
