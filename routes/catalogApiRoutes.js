import express from "express";
import { getBookDetail, getBooks, getTestSeries, getTestSeriesDetail } from "../controllers/catalogApiController.js";

const router = express.Router();
router.get("/test-series", getTestSeries);
router.get("/test-series/:id", getTestSeriesDetail);
router.get("/books", getBooks);
router.get("/books/:id", getBookDetail);

export default router;
