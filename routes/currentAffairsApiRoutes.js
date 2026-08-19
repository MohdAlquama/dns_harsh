import express from "express";
import { getCurrentAffairs } from "../controllers/currentAffairsApiController.js";

const router = express.Router();
router.get("/", getCurrentAffairs);

export default router;
