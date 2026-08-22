import express from "express";
import { getCurrentAffairs, getCurrentAffairsDetail } from "../controllers/currentAffairsApiController.js";

const router = express.Router();
router.get("/", getCurrentAffairs);
router.get("/:id", getCurrentAffairsDetail);

export default router;
