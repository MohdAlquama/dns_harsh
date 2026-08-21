import express from "express";
import adminSearch from "../controllers/adminSearchController.js";

const router = express.Router();
router.get("/search", adminSearch);

export default router;
