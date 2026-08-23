import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ejs from "ejs";
import { buildCatalogProduct, slugify } from "../services/catalogProductService.js";

test("slugify creates stable URL-safe slugs", () => {
    assert.equal(slugify("  SSC CGL – Mock Test 2026  "), "ssc-cgl-mock-test-2026");
});

test("test series input is normalized into common and typed details", () => {
    const result = buildCatalogProduct("TEST_SERIES", {
        title: "SSC Mock", status: "PUBLISHED", base_price: "100", gst_enabled: "on",
        gst_percent: "18", test_mode: "MOCK", duration_minutes: "60",
        total_questions: "100", total_marks: "200", negative_marks: "0.5",
        attempt_limit: "3", languages: "English\nHindi", syllabus: "Math\nReasoning"
    });
    assert.equal(result.common.slug, "ssc-mock");
    assert.equal(result.common.gstPercent, 18);
    assert.deepEqual(result.details.languages, ["English", "Hindi"]);
    assert.equal(result.details.totalQuestions, 100);
});

test("digital book requires a protected asset location", () => {
    assert.throws(() => buildCatalogProduct("BOOK", {
        title: "Digital Book", author: "A. Author", language: "English",
        book_format: "DIGITAL", base_price: "50"
    }), /Digital asset URL is required/);
});

test("book input validates inventory and URLs", () => {
    const result = buildCatalogProduct("BOOK", {
        title: "Exam Guide", author: "A. Author", language: "English",
        book_format: "BOTH", stock_quantity: "12", page_count: "320",
        digital_asset_url: "/protected/books/exam-guide.pdf", sample_url: "https://example.com/sample"
    });
    assert.equal(result.details.stockQuantity, 12);
    assert.equal(result.details.digitalAssetUrl, "/protected/books/exam-guide.pdf");
});

test("shared catalog templates compile", () => {
    for (const file of ["../views/catalog/index.ejs", "../views/catalog/form.ejs"]) {
        const template = fs.readFileSync(new URL(file, import.meta.url), "utf8");
        assert.doesNotThrow(() => ejs.compile(template));
    }
});
