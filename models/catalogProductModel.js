import db from "../config/db.js";

const detailInsert = async (connection, productId, type, details) => {
    if (type === "TEST_SERIES") {
        await connection.execute(
            `INSERT INTO test_series_details
             (product_id, test_mode, duration_minutes, total_questions, total_marks,
              negative_marks, attempt_limit, availability_start, availability_end,
              languages_json, syllabus_json, instructions)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [productId, details.testMode, details.durationMinutes, details.totalQuestions,
                details.totalMarks, details.negativeMarks, details.attemptLimit,
                details.availabilityStart, details.availabilityEnd,
                JSON.stringify(details.languages), JSON.stringify(details.syllabus), details.instructions]
        );
        return;
    }
    await connection.execute(
        `INSERT INTO book_details
         (product_id, author, publisher, isbn, sku, language, edition, page_count,
          book_format, stock_quantity, sample_url, digital_asset_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, details.author, details.publisher, details.isbn, details.sku,
            details.language, details.edition, details.pageCount, details.bookFormat,
            details.stockQuantity, details.sampleUrl, details.digitalAssetUrl]
    );
};

const commonValues = (common) => [
    common.type, common.title, common.slug, common.shortDescription, common.longDescription,
    common.coverImageUrl, common.status, common.basePrice, common.gstEnabled,
    common.gstPercent, common.platformChargeEnabled, common.platformCharge
];

const createCatalogProduct = async ({ common, details }) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [result] = await connection.execute(
            `INSERT INTO catalog_products
             (product_type, title, slug, short_description, long_description,
              cover_image_url, status, base_price, gst_enabled, gst_percent,
              platform_charge_enabled, platform_charge)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, commonValues(common)
        );
        await detailInsert(connection, result.insertId, common.type, details);
        await connection.commit();
        return result.insertId;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const updateCatalogProduct = async (id, type, { common, details }) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [result] = await connection.execute(
            `UPDATE catalog_products SET title = ?, slug = ?, short_description = ?,
             long_description = ?, cover_image_url = ?, status = ?, base_price = ?,
             gst_enabled = ?, gst_percent = ?, platform_charge_enabled = ?, platform_charge = ?
             WHERE id = ? AND product_type = ?`,
            [common.title, common.slug, common.shortDescription, common.longDescription,
                common.coverImageUrl, common.status, common.basePrice, common.gstEnabled,
                common.gstPercent, common.platformChargeEnabled, common.platformCharge, id, type]
        );
        if (!result.affectedRows) {
            const error = new Error("Product not found");
            error.code = "NOT_FOUND";
            throw error;
        }
        const detailTable = type === "TEST_SERIES" ? "test_series_details" : "book_details";
        await connection.query(`DELETE FROM ${detailTable} WHERE product_id = ?`, [id]);
        await detailInsert(connection, id, type, details);
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const selectFields = `p.*, t.test_mode, t.duration_minutes, t.total_questions,
    t.total_marks, t.negative_marks, t.attempt_limit, t.availability_start,
    t.availability_end, t.languages_json, t.syllabus_json, t.instructions,
    b.author, b.publisher, b.isbn, b.sku, b.language, b.edition, b.page_count,
    b.book_format, b.stock_quantity, b.sample_url, b.digital_asset_url`;

const joins = `LEFT JOIN test_series_details t ON t.product_id = p.id
    LEFT JOIN book_details b ON b.product_id = p.id`;

const listAdminCatalogProducts = async (type) => {
    const [rows] = await db.execute(
        `SELECT ${selectFields} FROM catalog_products p ${joins}
         WHERE p.product_type = ? ORDER BY p.id DESC`, [type]
    );
    return rows;
};

const getCatalogProductById = async (id, type) => {
    const [rows] = await db.execute(
        `SELECT ${selectFields} FROM catalog_products p ${joins}
         WHERE p.id = ? AND p.product_type = ? LIMIT 1`, [id, type]
    );
    return rows[0] || null;
};

const deleteCatalogProduct = async (id, type) => {
    const [result] = await db.execute(`DELETE FROM catalog_products WHERE id = ? AND product_type = ?`, [id, type]);
    return result.affectedRows > 0;
};

const publicWhere = (type, search, filter) => {
    const conditions = ["p.product_type = ?", "p.status IN ('PUBLISHED','COMING_SOON')"];
    const params = [type];
    if (search) {
        conditions.push("(p.title LIKE ? OR p.short_description LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
    }
    if (type === "TEST_SERIES" && filter) {
        conditions.push("t.test_mode = ?"); params.push(filter);
    }
    if (type === "TEST_SERIES") conditions.push("(t.availability_end IS NULL OR t.availability_end >= NOW())");
    if (type === "BOOK" && filter) {
        conditions.push("b.book_format = ?"); params.push(filter);
    }
    return { sql: conditions.join(" AND "), params };
};

const listPublicCatalogProducts = async ({ type, search = "", filter = "", limit, offset }) => {
    const where = publicWhere(type, search, filter);
    const [rows] = await db.query(
        `SELECT ${selectFields} FROM catalog_products p ${joins}
         WHERE ${where.sql} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`,
        [...where.params, limit, offset]
    );
    return rows;
};

const countPublicCatalogProducts = async ({ type, search = "", filter = "" }) => {
    const where = publicWhere(type, search, filter);
    const [rows] = await db.execute(
        `SELECT COUNT(*) AS total FROM catalog_products p ${joins} WHERE ${where.sql}`, where.params
    );
    return Number(rows[0]?.total || 0);
};

const getPublicCatalogProductById = async (id, type) => {
    const [rows] = await db.execute(
        `SELECT ${selectFields} FROM catalog_products p ${joins}
         WHERE p.id = ? AND p.product_type = ? AND p.status IN ('PUBLISHED','COMING_SOON') LIMIT 1`, [id, type]
    );
    return rows[0] || null;
};

export {
    countPublicCatalogProducts, createCatalogProduct, deleteCatalogProduct,
    getCatalogProductById, getPublicCatalogProductById, listAdminCatalogProducts,
    listPublicCatalogProducts, updateCatalogProduct
};
