import db from "../../../config/db.js";
export const executeQuery = async (query, params = []) => {
    try {
        const [result] = await db.query(query, params);
        return result;
    } catch (error) {
        console.error("Database Query Error:", error);
        throw new Error("Database operation failed"); 
    }
};