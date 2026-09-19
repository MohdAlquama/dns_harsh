import db from '../config/db.js';
// Sidebar Tree ke liye Folders aur Files dono fetch karna
export const getFullFolderTree = async () => {
    // 1. Saare Folders le aao
    const folderQuery = `SELECT * FROM course_organizations ORDER BY created_at ASC`;
    const [folders] = await db.query(folderQuery);

    // 2. Saari Videos (Files) le aao
    const videoQuery = `SELECT * FROM course_folder_videos ORDER BY created_at ASC`;
    const [videos] = await db.query(videoQuery);

    // 3. Recursive function jo Tree banayega
    const buildTree = (folderList, parentId = null) => {
        return folderList
            .filter(folder => folder.parent_id === parentId)
            .map(folder => {
                // Is folder ke andar ki videos dhoondo
                const folderFiles = videos.filter(v => v.folder_id === folder.id);
                
                return {
                    ...folder,
                    files: folderFiles, // Videos ko attach kiya
                    children: buildTree(folderList, folder.id) // Subfolders ko attach kiya
                };
            });
    };

    return buildTree(folders);
};
// 1. Ek hi function Main Folder aur Subfolder dono banayega
export const createFolder = async (folderName, courseName, parentId = null) => {
    const query = `INSERT INTO course_organizations (folder_name, course_name, parent_id) VALUES (?, ?, ?)`;
    const [result] = await db.query(query, [folderName, courseName, parentId]);
    return result.insertId;
};
export const getAssignedVideosByFolderId = async (folderId) => {
    const query = `SELECT * FROM course_folder_videos WHERE folder_id = ? ORDER BY created_at DESC`;
    const [rows] = await db.query(query, [folderId]);
    return rows;
};
// 2. Sirf Main Folders lana (Jinka parent_id NULL hai)
export const getAllFolders = async () => {
    const query = `SELECT * FROM course_organizations WHERE parent_id IS NULL ORDER BY created_at DESC`;
    const [rows] = await db.query(query);
    return rows;
};

// 3. Ek specific folder fetch karna
export const getFolderById = async (id) => {
    const query = `SELECT * FROM course_organizations WHERE id = ?`;
    const [rows] = await db.query(query, [id]);
    return rows[0];
};

// 4. Folder Delete karna
export const deleteFolderById = async (id) => {
    const query = `DELETE FROM course_organizations WHERE id = ?`;
    const [result] = await db.query(query, [id]);
    return result.affectedRows;
};

// 5. Kisi Folder ke andar ke Subfolders nikalna
export const getSubfoldersByParentId = async (parentId) => {
    const query = `SELECT * FROM course_organizations WHERE parent_id = ? ORDER BY created_at DESC`;
    const [rows] = await db.query(query, [parentId]);
    return rows;
};