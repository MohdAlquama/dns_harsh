import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import {  createFolder,  deleteFolderById,   getFolderById,   getAllFolders,  getSubfoldersByParentId, getAssignedVideosByFolderId, getFullFolderTree  } from "../../models/courseFolderModel.js";
import { getS3ClientAndConfig } from "./utils/s3.js";
import db from "../../config/db.js";

export const courseOrganizationPageShow = async (req, res) => {
    try {
        const foldersList = await getAllFolders(); 
        const folderTree = await getFullFolderTree(); 
        return res.render("layouts/layout", {
            title: "Course Organization | DNS Admin", 
            page: "../courseOrganization/index",
            folders: foldersList, 
            folderTree: folderTree,
            error: null
        });
    } catch (error) {
        console.error("Course organization page error:", error);
        return res.status(500).send("Unable to load course organization page");
    }
};

export const CreateFolder = async (req, res) => {
    try {
        const { folderName, courseName, parentId } = req.body;

        if (!folderName || !courseName) {
            return res.status(400).json({ success: false, error: "Folder Name aur Course Name zaroori hain." });
        }
        
        const newId = await createFolder(folderName, courseName, parentId || null);
        return res.status(200).json({ 
            success: true, 
            message: parentId ? `${folderName} Subfolder Created!` : `${folderName} Main Folder Created!`, 
            id: newId 
        });
    } catch (error) {
        console.error("DETAILED FOLDER ERROR:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};


export const deleteFolder = async (req, res) => {
    try {
        const folderId = req.params.id; 
        const affectedRows = await deleteFolderById(folderId);
        if (affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Folder not found!" });
        }
        return res.status(200).json({ success: true, message: "Folder successfully deleted!" });
    } catch (error) {
        console.error("Delete Folder Error:", error);
        return res.status(500).json({ success: false, error: "Folder delete karne mein error aayi." });
    }
};


export const openFolderDetails = async (req, res) => {
    try {
        const folderId = req.params.id; 
        
        const folderData = await getFolderById(folderId);
        if (!folderData) return res.status(404).send("Folder nahi mila!");
        
     
        const subfoldersData = await getSubfoldersByParentId(folderId);
        const folderVideos = await getAssignedVideosByFolderId(folderId);
        
        return res.render("layouts/layout", {
            title: `${folderData.folder_name} | DNS Admin`, 
            page: "../courseOrganization/Organization/folderView", 
            folder: folderData, 
            subfolders: subfoldersData,
            videos: folderVideos 
        });
    } catch (error) {
        console.error("Open folder details error:", error);
        return res.status(500).send("Server Error: Folder load nahi ho paya.");
    }
};

export const apiGetS3VideosList = async (req, res) => {
    try {
        const { client, config } = await getS3ClientAndConfig();
        const response = await client.send(new ListObjectsV2Command({ Bucket: config.bucket_name }));

        const videos = (response.Contents || [])
            .filter(item => item.Key.match(/\.(mp4|mov|avi|mkv|webm)$/i))
            .map(item => ({
                key: item.Key,
                size: (item.Size / (1024 * 1024)).toFixed(2) + ' MB'
            }));

        return res.status(200).json({ success: true, videos });
    } catch (error) {
        console.error("S3 Fetch Error:", error);
        return res.status(500).json({ success: false, error: "S3 se videos fetch nahi ho payi." });
    }
};

export const apiAssignVideoToFolder = async (req, res) => {
    try {
        const { folderId, videoName, videoDesc, videoIcon, s3Key } = req.body;

        if (!folderId || !videoName || !s3Key) {
            return res.status(400).json({ success: false, error: "Video Name aur S3 Video select karna zaroori hai." });
        }

        const query = `INSERT INTO course_folder_videos (folder_id, video_name, video_description, video_icon, s3_key) VALUES (?, ?, ?, ?, ?)`;
        await db.query(query, [folderId, videoName, videoDesc, videoIcon || null, s3Key]);

        return res.status(200).json({ success: true, message: "Video successfully assigned!" });
    } catch (error) {
        console.error("Assign Video Error:", error);
        return res.status(500).json({ success: false, error: "Database mein video save karne mein error aayi." });
    }
};