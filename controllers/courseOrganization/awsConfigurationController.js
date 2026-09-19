import {  HeadBucketCommand, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getAwsConfiguration, saveAwsConfiguration } from "../../models/awsConfigurationModel.js";
import { isValidStorageType, isValidUrl, isNotEmpty } from "./utils/validators.js";
import { createS3Client , getS3ClientAndConfig} from "./utils/s3.js";

export const awsConfigTestConnection = async (req, res) => {
    try {
        const { aws_access_key, aws_secret_key, aws_region, aws_bucket } = req.body;
        if (!aws_region || !aws_bucket || !aws_access_key || !aws_secret_key) {
             return res.status(400).json({ success: false, error: "All fields are required to test." });
        }
        
        const client = createS3Client(aws_region, aws_access_key, aws_secret_key);
        await client.send(new HeadBucketCommand({ Bucket: aws_bucket }));
        
        return res.status(200).json({ success: true, message: "Connection successful! S3 is accessible." });
    } catch (error) {
        let msg = "Unable to connect.";
        if (error.$metadata?.httpStatusCode === 403) msg = "Access Denied. Check IAM permissions.";
        if (error.$metadata?.httpStatusCode === 404) msg = "Bucket not found. Check Name and Region.";
        return res.status(400).json({ success: false, error: msg });
    }
};

export const awsConfigPageShow = async (req, res) => {
    try {
        return res.render("layouts/layout", {
            title: "AWS Config | Admin", page: "../courseOrganization/awsConfig", 
            awsConfig: await getAwsConfiguration(), saved: req.query.saved === "1", error: req.query.error || null
        });
    } catch (error) {
        return res.status(500).send("Unable to load page.");
    }
};

export const awsConfigSave = async (req, res) => {
    try {
        const { storage_type, aws_access_key, aws_secret_key, aws_region, aws_bucket, cdn_url } = req.body;
        
        if (!isValidStorageType(storage_type)) return res.status(400).json({ success: false, error: "Invalid storage type." });
        if (!isNotEmpty(aws_region) || !isNotEmpty(aws_bucket)) return res.status(400).json({ success: false, error: "Region and Bucket required." });
        if (storage_type === 's3_cdn' && (!isNotEmpty(cdn_url) || !isValidUrl(cdn_url))) return res.status(400).json({ success: false, error: "Valid CDN URL required." });

        await saveAwsConfiguration({
            storage_type, access_key_id: aws_access_key || null, secret_access_key: aws_secret_key || null,
            region: aws_region, bucket_name: aws_bucket, cdn_url: storage_type === 's3_cdn' ? cdn_url : null, is_active: 1
        });
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, error: "Server error saving configuration." });
    }
};
const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
};

export const awsVideosPageShow = async (req, res) => {
    try {
        const { client, config } = await getS3ClientAndConfig();
        
        const response = await client.send(new ListObjectsV2Command({ Bucket: config.bucket_name }));

        const videos = await Promise.all((response.Contents || [])
            .filter(item => item.Key.match(/\.(mp4|mov|avi|mkv|webm)$/i))
            .map(async (item) => {
                const isCdn = config.storage_type === 's3_cdn' && config.cdn_url;
                const fileUrl = isCdn ? `${config.cdn_url.replace(/\/$/, '')}/${item.Key}` : 
                    await getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket_name, Key: item.Key }), { expiresIn: 3600 });

                const rawDate = item.LastModified ? new Date(item.LastModified) : null;
                const fileExt = item.Key.split('.').pop().toUpperCase();
                const eTag = item.ETag ? item.ETag.replace(/"/g, '') : 'N/A'; // Remove extra quotes from S3 ETag

                return {
                    fileName: item.Key,
                    fileFormat: fileExt,
                    fileHash: eTag,
                    size: (item.Size / (1024 * 1024)).toFixed(2) + ' MB',
                    storageClass: item.StorageClass || 'STANDARD',
                    
                    uploadDate: rawDate ? rawDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
                    uploadTime: rawDate ? rawDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A',
                    relativeTime: rawDate ? timeAgo(rawDate) : 'Unknown',
                    
                    url: fileUrl
                };
            })
        );

        return res.render("layouts/layout", { title: "Videos", page: "../courseOrganization/videoList", videos, error: null });
    } catch (error) {
        return res.render("layouts/layout", { title: "Videos", page: "../courseOrganization/videoList", videos: [], error: error.message });
    }
};

export const getUploadUrl = async (req, res) => {
    try {
        const { fileName, fileType } = req.query;
        if (!fileName || !fileType) return res.status(400).json({ success: false, error: "File details missing." });

        const { client, config } = await getS3ClientAndConfig();
        
        const safeFileName = Date.now() + "_" + fileName.replace(/\s+/g, '-');
        const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: config.bucket_name, Key: safeFileName, ContentType: fileType }), { expiresIn: 7200 });

        return res.status(200).json({ success: true, uploadUrl, fileName: safeFileName });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteS3Video = async (req, res) => {
    try {
        if (!req.body.fileName) return res.status(400).json({ success: false, error: "File name required." });
        
        const { client, config } = await getS3ClientAndConfig();
        await client.send(new DeleteObjectCommand({ Bucket: config.bucket_name, Key: req.body.fileName }));

        return res.status(200).json({ success: true, message: "Deleted successfully." });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};