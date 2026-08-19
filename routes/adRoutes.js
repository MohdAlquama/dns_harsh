import express from "express";
import { decideAd, trackAdEvent } from "../controllers/adController.js";

const router = express.Router();

router.post("/decision", decideAd);
router.post("/events", trackAdEvent);

export default router;
