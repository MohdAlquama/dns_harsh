import db from "../config/db.js";

const buildUserWhere = ({ search, status }) => {
    const conditions = [];
    const params = [];

    if (search) {
        conditions.push("(name LIKE ? OR phone_number LIKE ?)");
        const pattern = `%${search}%`;
        params.push(pattern, pattern);
    }
    if (status === "active" || status === "inactive") {
        conditions.push("status = ?");
        params.push(status === "active" ? 1 : 0);
    }

    return {
        sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
        params
    };
};

const getUserSummary = async () => {
    const [rows] = await db.execute(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(status = 1), 0) AS active,
                COALESCE(SUM(status = 0), 0) AS inactive
         FROM auth_users`
    );
    return {
        total: Number(rows[0]?.total || 0),
        active: Number(rows[0]?.active || 0),
        inactive: Number(rows[0]?.inactive || 0)
    };
};

const listUsers = async ({ search = "", status = "all", page = 1, pageSize = 20 }) => {
    const { sql, params } = buildUserWhere({ search, status });
    // Some MySQL/MariaDB versions reject prepared placeholders for LIMIT/OFFSET.
    // Normalize both values before embedding them; all user-provided filter values
    // remain parameterized below.
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safePageSize = [10, 20, 50, 100].includes(pageSize) ? pageSize : 20;
    const offset = (safePage - 1) * safePageSize;
    const [[countRows], [users], summary] = await Promise.all([
        db.execute(`SELECT COUNT(*) AS total FROM auth_users ${sql}`, params),
        db.execute(
            `SELECT id, phone_number, name, status, created_at, updated_at
             FROM auth_users ${sql}
             ORDER BY created_at DESC, id DESC
             LIMIT ${safePageSize} OFFSET ${offset}`,
            params
        ),
        getUserSummary()
    ]);

    return {
        users,
        total: Number(countRows[0]?.total || 0),
        summary
    };
};

export { buildUserWhere, getUserSummary, listUsers };
