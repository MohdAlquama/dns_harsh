import {
    countPublicCatalogProducts, getPublicCatalogProductById, listPublicCatalogProducts
} from "../models/catalogProductModel.js";
import { parseJsonArray } from "../services/catalogProductService.js";

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const absoluteUrl = (req, value) => value ? new URL(value, `${req.protocol}://${req.get("host")}`).href : null;

const serializeCatalogProduct = (req, product, { detail = false } = {}) => {
    const base = roundMoney(product.base_price);
    const gst = product.gst_enabled ? roundMoney(base * Number(product.gst_percent || 0) / 100) : 0;
    const platform = product.platform_charge_enabled ? roundMoney(product.platform_charge || 0) : 0;
    const common = {
        id: product.id, type: product.product_type, title: product.title, slug: product.slug,
        description: { short: product.short_description, ...(detail ? { long: product.long_description } : {}) },
        coverImageUrl: absoluteUrl(req, product.cover_image_url), status: product.status,
        pricing: { currency: "INR", base, gst, platform, total: roundMoney(base + gst + platform) },
        detailEndpoint: `/api/v1/${product.product_type === "TEST_SERIES" ? "test-series" : "books"}/${product.id}`
    };
    if (product.product_type === "TEST_SERIES") return { ...common, testSeries: {
        mode: product.test_mode, durationMinutes: Number(product.duration_minutes),
        totalQuestions: Number(product.total_questions), totalMarks: Number(product.total_marks),
        negativeMarks: Number(product.negative_marks), attemptLimit: Number(product.attempt_limit),
        availability: { start: product.availability_start, end: product.availability_end },
        languages: parseJsonArray(product.languages_json), syllabus: parseJsonArray(product.syllabus_json),
        ...(detail ? { instructions: product.instructions } : {})
    } };
    return { ...common, book: {
        author: product.author, publisher: product.publisher, isbn: product.isbn,
        language: product.language, edition: product.edition, pageCount: product.page_count ? Number(product.page_count) : null,
        format: product.book_format,
        inStock: ["DIGITAL", "BOTH"].includes(product.book_format) || Number(product.stock_quantity) > 0,
        sampleUrl: absoluteUrl(req, product.sample_url)
    } };
};

const listCatalog = (type) => async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
        const search = String(req.query.q || "").trim().slice(0, 80);
        const rawFilter = String(type === "TEST_SERIES" ? req.query.mode || "" : req.query.format || "").toUpperCase();
        const filter = type === "TEST_SERIES"
            ? (["PRACTICE", "MOCK", "LIVE"].includes(rawFilter) ? rawFilter : "")
            : (["PHYSICAL", "DIGITAL", "BOTH"].includes(rawFilter) ? rawFilter : "");
        const [products, total] = await Promise.all([
            listPublicCatalogProducts({ type, search, filter, limit, offset: (page - 1) * limit }),
            countPublicCatalogProducts({ type, search, filter })
        ]);
        return res.json({
            success: true, data: products.map((item) => serializeCatalogProduct(req, item)),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total },
            filters: { q: search || null, [type === "TEST_SERIES" ? "mode" : "format"]: filter || null }
        });
    } catch (error) {
        console.error("Catalog API list error:", error);
        return res.status(500).json({ success: false, message: "Unable to load catalog" });
    }
};

const getCatalogDetail = (type) => async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: "A valid product id is required" });
        const product = await getPublicCatalogProductById(id, type);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });
        res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
        return res.json({ success: true, data: serializeCatalogProduct(req, product, { detail: true }) });
    } catch (error) {
        console.error("Catalog API detail error:", error);
        return res.status(500).json({ success: false, message: "Unable to load product" });
    }
};

const getTestSeries = listCatalog("TEST_SERIES");
const getTestSeriesDetail = getCatalogDetail("TEST_SERIES");
const getBooks = listCatalog("BOOK");
const getBookDetail = getCatalogDetail("BOOK");

export { getBookDetail, getBooks, getTestSeries, getTestSeriesDetail, serializeCatalogProduct };
