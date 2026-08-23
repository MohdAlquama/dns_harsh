import test from "node:test";
import assert from "node:assert/strict";
import db from "../config/db.js";
import { serializeCatalogProduct } from "../controllers/catalogApiController.js";

test.after(() => db.end());

const req = { protocol: "https", get: () => "api.example.com" };

test("book serializer never exposes its protected digital asset", () => {
    const result = serializeCatalogProduct(req, {
        id: 7, product_type: "BOOK", title: "Guide", slug: "guide",
        short_description: "Short", long_description: "Long", cover_image_url: "/guide.jpg",
        status: "PUBLISHED", base_price: 100, gst_enabled: 0,
        platform_charge_enabled: 0, author: "Author", publisher: "Publisher",
        isbn: null, language: "English", edition: null, page_count: 100,
        book_format: "DIGITAL", stock_quantity: 0, sample_url: "/sample.pdf",
        digital_asset_url: "/private/full-book.pdf"
    }, { detail: true });
    assert.equal(result.book.inStock, true);
    assert.equal(result.digital_asset_url, undefined);
    assert.equal(result.book.digitalAssetUrl, undefined);
    assert.equal(result.book.sampleUrl, "https://api.example.com/sample.pdf");
});

test("test series serializer returns parsed arrays and calculated pricing", () => {
    const result = serializeCatalogProduct(req, {
        id: 4, product_type: "TEST_SERIES", title: "Mock", slug: "mock",
        status: "PUBLISHED", base_price: 100, gst_enabled: 1, gst_percent: 18,
        platform_charge_enabled: 1, platform_charge: 5, test_mode: "MOCK",
        duration_minutes: 60, total_questions: 50, total_marks: 100,
        negative_marks: 0.25, attempt_limit: 2, languages_json: '["English"]',
        syllabus_json: '["Math"]'
    });
    assert.equal(result.pricing.total, 123);
    assert.deepEqual(result.testSeries.languages, ["English"]);
});
