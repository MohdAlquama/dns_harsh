import db from "../config/db.js";

const createCourseFolderTables = async () => {
    const connection = await db.getConnection();

    try {
        // Ek hi table jisme Main Folder aur Subfolder dono support honge
        await connection.query(`
            CREATE TABLE IF NOT EXISTS course_organizations (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                parent_id INT UNSIGNED NULL, -- NULL hoga toh Main Folder, ID hogi toh Subfolder
                folder_name VARCHAR(200) NOT NULL,
                course_name VARCHAR(200) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_folder_name (folder_name),
                INDEX idx_parent_id (parent_id),
                
                -- Parent Folder delete hone par uske Subfolders bhi delete ho jayenge
                CONSTRAINT fk_parent_folder FOREIGN KEY (parent_id) 
                    REFERENCES course_organizations(id) ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS course_folder_videos (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                folder_id INT UNSIGNED NOT NULL,
                video_name VARCHAR(255) NOT NULL,
                video_description TEXT NULL,
                video_icon VARCHAR(1000) NULL,
                s3_key VARCHAR(1000) NOT NULL, -- S3 video ka asli naam yahan save hoga
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_video_folder FOREIGN KEY (folder_id) 
                    REFERENCES course_organizations(id) ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);

        console.log("✅ Course Organization table ready (Main & Subfolders supported)");
    } catch (error) {
         console.error("❌ Error creating table:", error);
    } finally {
        connection.release();
    }
};

export default createCourseFolderTables;