import { S3Client } from "@aws-sdk/client-s3";
import { getAwsConfiguration } from "../../../models/awsConfigurationModel.js"; 
const createS3Client = (region, accessKeyId, secretAccessKey) => new S3Client({
    region, credentials: { accessKeyId, secretAccessKey }
});

const getS3ClientAndConfig = async () => {
    const config = await getAwsConfiguration();
    
    if (!config || !config.access_key_id) {
        throw new Error("AWS Configuration is missing. Please save it first.");
    }
    
    const client = createS3Client(config.region, config.access_key_id, config.secret_access_key);
    return { client, config }; 
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
export { createS3Client, getS3ClientAndConfig ,timeAgo };