import db from "../config/db.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
    getActiveEnrollment
} from "../models/courseEnrollmentModel.js";

import {
    getS3ClientAndConfig
} from "./courseOrganization/utils/s3.js";


// =====================================================
// MY COURSES
// =====================================================

export const showMyCourses = async (req, res) => {
    try {

        const [courses] = await db.execute(
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

        return res.render("courses/my-courses", {
            courses
        });

    } catch (error) {

        console.error(
            "Show my courses error:",
            error
        );

        return res
            .status(500)
            .send("Unable to load your courses");
    }
};


// =====================================================
// MY COURSE DETAILS
// Course → Subject → Chapters → Videos
// =====================================================

export const showMyCourseDetails = async (req, res) => {

    try {

        const courseId = Number(
            req.params.courseId
        );

        if (
            !Number.isInteger(courseId) ||
            courseId < 1
        ) {
            return res
                .status(400)
                .send("Invalid course ID");
        }


        // ---------------------------------------------
        // CHECK ACTIVE ENROLLMENT
        // ---------------------------------------------

        const enrollment =
            await getActiveEnrollment(
                req.user.id,
                courseId
            );

        if (!enrollment) {

            return res
                .status(403)
                .send(
                    "You are not enrolled in this course"
                );
        }


        // ---------------------------------------------
        // GET COURSE
        // ---------------------------------------------

        const [courseRows] =
            await db.execute(
                `
                SELECT
                    c.id,
                    c.name AS course_name,
                    c.slug,
                    c.short_description,
                    c.long_description,
                    c.cover_image_url,
                    c.price,
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


        const course = courseRows[0];


        if (!course) {

            return res
                .status(404)
                .send("Course not found");
        }


        // ---------------------------------------------
        // GET CHAPTERS
        // Only direct children of Subject
        // ---------------------------------------------

        const [chapters] =
            await db.execute(
                `
                SELECT
                    chapter.id,
                    chapter.folder_name AS chapter_name

                FROM course_organizations chapter

                WHERE chapter.parent_id = ?

                ORDER BY chapter.id ASC
                `,
                [
                    course.subject_folder_id
                ]
            );


        // ---------------------------------------------
        // GET VIDEOS FOR EVERY CHAPTER
        // ---------------------------------------------

        for (const chapter of chapters) {

            const [videos] =
                await db.execute(
                    `
                    SELECT
                        id,
                        video_name,
                        video_description,
                        video_icon,
                        s3_key,
                        created_at

                    FROM course_folder_videos

                    WHERE folder_id = ?

                    ORDER BY id ASC
                    `,
                    [chapter.id]
                );

            chapter.videos = videos;
        }


        return res.render(
            "courses/my-course",
            {
                course,
                chapters,
                enrollment
            }
        );


    } catch (error) {

        console.error(
            "Show my course details error:",
            error
        );

        return res
            .status(500)
            .send("Unable to load course");
    }
};


// =====================================================
// GET VIDEO SIGNED URL
// Only ACTIVE enrolled student can access
// =====================================================

export const getCourseVideo = async (req, res) => {

    try {

        const courseId = Number(
            req.params.courseId
        );

        const videoId = Number(
            req.params.videoId
        );


        if (
            !Number.isInteger(courseId) ||
            courseId < 1 ||
            !Number.isInteger(videoId) ||
            videoId < 1
        ) {

            return res.status(400).json({
                success: false,
                error: "Invalid course or video ID"
            });
        }


        // ---------------------------------------------
        // CHECK ENROLLMENT
        // ---------------------------------------------

        const enrollment =
            await getActiveEnrollment(
                req.user.id,
                courseId
            );

        if (!enrollment) {

            return res.status(403).json({
                success: false,
                error: "You are not enrolled in this course"
            });
        }


        // ---------------------------------------------
        // GET COURSE SUBJECT + VIDEO
        // ---------------------------------------------

        const [rows] =
            await db.execute(
                `
                SELECT

                    v.id,
                    v.video_name,
                    v.video_description,
                    v.video_icon,
                    v.s3_key,

                    chapter.id AS chapter_id,
                    chapter.parent_id AS subject_id

                FROM course_folder_videos v

                INNER JOIN course_organizations chapter
                    ON chapter.id = v.folder_id

                INNER JOIN courses c
                    ON c.subject_folder_id = chapter.parent_id

                WHERE v.id = ?
                  AND c.id = ?

                LIMIT 1
                `,
                [
                    videoId,
                    courseId
                ]
            );


        const video = rows[0];


        if (!video) {

            return res.status(404).json({
                success: false,
                error: "Video does not belong to this course"
            });
        }


        // ---------------------------------------------
        // GET AWS CONFIG
        // ---------------------------------------------

        const {
            client,
            config
        } = await getS3ClientAndConfig();


        // ---------------------------------------------
        // CDN STORAGE
        // ---------------------------------------------

        if (
            config.storage_type === "s3_cdn" &&
            config.cdn_url
        ) {

            const baseUrl =
                config.cdn_url.replace(
                    /\/$/,
                    ""
                );

            const videoUrl =
                `${baseUrl}/${video.s3_key}`;

            return res.json({
                success: true,
                video: {
                    id: video.id,
                    name: video.video_name,
                    description:
                        video.video_description,
                    url: videoUrl
                }
            });
        }


        // ---------------------------------------------
        // NORMAL S3
        // Temporary signed URL
        // ---------------------------------------------

        const command =
            new GetObjectCommand({
                Bucket: config.bucket_name,
                Key: video.s3_key
            });


        const videoUrl =
            await getSignedUrl(
                client,
                command,
                {
                    expiresIn: 3600
                }
            );


        return res.json({

            success: true,

            video: {
                id: video.id,
                name: video.video_name,
                description:
                    video.video_description,
                url: videoUrl
            }

        });


    } catch (error) {

        console.error(
            "Get course video error:",
            error
        );

        return res.status(500).json({
            success: false,
            error: "Unable to load video"
        });
    }
};