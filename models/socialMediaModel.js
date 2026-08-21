import db from "../config/db.js";

const listSocialMedia = async ({ activeOnly = false } = {}) => {
    const [rows] = await db.execute(
        `SELECT platform, label, profile_url, is_active, updated_at
         FROM social_media_config
         ${activeOnly ? "WHERE is_active = 1 AND label IS NOT NULL AND profile_url IS NOT NULL" : ""}
         ORDER BY sort_order, id`
    );
    return rows;
};

const saveSocialMedia = async (accounts) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        for (const account of accounts) {
            await connection.execute(
                `UPDATE social_media_config
                 SET label = ?, profile_url = ?, is_active = ?
                 WHERE platform = ?`,
                [account.label || null, account.profileUrl || null, account.isActive ? 1 : 0, account.platform]
            );
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

export { listSocialMedia, saveSocialMedia };
