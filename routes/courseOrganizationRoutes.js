import express from "express";
import {  apiAssignVideoToFolder, apiGetS3VideosList, courseOrganizationPageShow, CreateFolder, deleteFolder, openFolderDetails } from "../controllers/courseOrganization/courseOrganizationController.js";
import { awsConfigPageShow, awsConfigSave ,awsConfigTestConnection, awsVideosPageShow, deleteS3Video, getUploadUrl} from "../controllers/courseOrganization/awsConfigurationController.js";

const router = express.Router();

router.get("/", courseOrganizationPageShow);
router.get("/awsConfig", awsConfigPageShow);
router.post("/awsConfig", awsConfigSave );
router.post('/aws/config/test', awsConfigTestConnection); 
router.get('/aws/videos', awsVideosPageShow);
router.get('/aws/videos/upload-url', getUploadUrl);
router.delete('/aws/videos', deleteS3Video);
router.post('/create-folders', CreateFolder);
router.delete('/delete-folders/:id',deleteFolder);
router.get('/folders-open/:id', openFolderDetails);
router.get('/api/s3-video-list', apiGetS3VideosList);
router.post('/api/assign-video', apiAssignVideoToFolder);

export default router;
