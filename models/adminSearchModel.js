import db from "../config/db.js";

const searchAdminData = async (query, { includeAdmins = false } = {}) => {
    const pattern = `%${query}%`;
    const searches = [
        db.execute(
            `SELECT c.id, c.course_name, c.short_description, c.status
             FROM current_affairs_courses c
             WHERE c.course_name LIKE ? OR c.short_description LIKE ? OR c.status LIKE ?
             ORDER BY c.updated_at DESC LIMIT 6`,
            [pattern, pattern, pattern]
        ),
        db.execute(
            `SELECT d.id, d.course_id, d.document_name, d.document_type, c.course_name
             FROM current_affairs_documents d
             INNER JOIN current_affairs_courses c ON c.id = d.course_id
             WHERE d.document_name LIKE ? OR d.document_type LIKE ? OR c.course_name LIKE ?
             ORDER BY d.updated_at DESC LIMIT 5`,
            [pattern, pattern, pattern]
        ),
        db.execute(
            `SELECT o.id, o.merchant_order_id, o.item_name, o.status,
                    u.name AS customer_name, u.phone_number AS customer_phone
             FROM payment_orders o
             INNER JOIN auth_users u ON u.id = o.user_id
             WHERE o.merchant_order_id LIKE ? OR o.item_name LIKE ? OR o.status LIKE ?
                OR u.name LIKE ? OR u.phone_number LIKE ?
             ORDER BY o.updated_at DESC LIMIT 6`,
            [pattern, pattern, pattern, pattern, pattern]
        ),
        db.execute(
            `SELECT platform, label, profile_url, is_active
             FROM social_media_config
             WHERE platform LIKE ? OR label LIKE ? OR profile_url LIKE ?
             ORDER BY sort_order LIMIT 4`,
            [pattern, pattern, pattern]
        )
    ];

    if (includeAdmins) {
        searches.push(db.execute(
            `SELECT id, name, phone_number, role, status
             FROM admin_users
             WHERE name LIKE ? OR phone_number LIKE ? OR role LIKE ?
             ORDER BY name LIMIT 5`,
            [pattern, pattern, pattern]
        ));
    }

    const results = await Promise.all(searches);
    return {
        courses: results[0][0],
        documents: results[1][0],
        orders: results[2][0],
        socialAccounts: results[3][0],
        admins: includeAdmins ? results[4][0] : []
    };
};

export default searchAdminData;
