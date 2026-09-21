import db from "../config/db.js";


// =====================================================
// ENROLL USER IN COURSE
// Used by paymentModel.js
// =====================================================

const enrollUserWithConnection = async (
    connection,
    {
        userId,
        courseId,
        orderId
    }
) => {

    if (!connection) {
        throw new Error(
            "Database connection is required"
        );
    }

    if (!userId) {
        throw new Error(
            "User ID is required for enrollment"
        );
    }

    if (!courseId) {
        throw new Error(
            "Course ID is required for enrollment"
        );
    }

    if (!orderId) {
        throw new Error(
            "Order ID is required for enrollment"
        );
    }


    await connection.execute(
        `
        INSERT INTO course_enrollments
        (
            user_id,
            course_id,
            order_id,
            status,
            enrolled_at
        )

        VALUES
        (
            ?,
            ?,
            ?,
            'ACTIVE',
            CURRENT_TIMESTAMP
        )

        ON DUPLICATE KEY UPDATE
            status = 'ACTIVE',
            order_id = VALUES(order_id)
        `,
        [
            userId,
            courseId,
            orderId
        ]
    );
};


// =====================================================
// GET ACTIVE ENROLLMENT
// =====================================================

export const getActiveEnrollment = async (
    userId,
    courseId
) => {

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
        [
            userId,
            courseId
        ]
    );

    return rows[0] || null;
};


// =====================================================
// CHECK USER ENROLLED
// =====================================================

const isUserEnrolled = async (
    userId,
    courseId
) => {

    const enrollment =
        await getActiveEnrollment(
            userId,
            courseId
        );

    return Boolean(enrollment);
};


// =====================================================
// GET USER PURCHASED COURSES
// =====================================================

const getUserCourses = async (
    userId
) => {

    const [rows] = await db.execute(
        `
        SELECT
            e.id AS enrollment_id,
            e.user_id,
            e.course_id,
            e.order_id,
            e.status,
            e.enrolled_at,

            c.id,
            c.course_name,
            c.slug,
            c.subject_folder_id,
            c.short_description,
            c.long_description,
            c.cover_image_url,
            c.price,
            c.status AS course_status

        FROM course_enrollments e

        INNER JOIN courses c
            ON c.id = e.course_id

        WHERE e.user_id = ?
          AND e.status = 'ACTIVE'

        ORDER BY e.enrolled_at DESC
        `,
        [
            userId
        ]
    );

    return rows;
};


// =====================================================
// GET COURSE ENROLLMENT
// =====================================================

const getCourseEnrollment = async (
    userId,
    courseId
) => {

    return await getActiveEnrollment(
        userId,
        courseId
    );
};


// =====================================================
// DEFAULT EXPORT
// =====================================================

const courseEnrollmentModel = {

    enrollUserWithConnection,

    getActiveEnrollment,

    isUserEnrolled,

    getUserCourses,

    getCourseEnrollment

};

export default courseEnrollmentModel;