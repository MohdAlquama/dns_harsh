import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ejs from "ejs";
import { priceBreakdown, serializeCourse } from "../controllers/currentAffairsApiController.js";
import { buildModules } from "../controllers/current_affairs.js";

const course = {
    id: 12,
    course_name: "Current Affairs 2026",
    short_description: "Exam-ready updates",
    long_description: "Daily analysis and revision",
    default_image_path: "/cover.webp",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    status: "PUBLISHED",
    base_price: "100.00",
    gst_enabled: 1,
    gst_percent: "18.00",
    platform_charge_enabled: 1,
    platform_charge: "5.00",
    offers: [{ id: 1, offer_name: "Launch", discount_type: "PERCENT", discount_value: "10.00" }],
    notifications: [],
    documents: [],
    modules: [
        { key: "HIGHLIGHTS", enabled: true, sortOrder: 10, content: { items: ["Daily quiz"] } },
        { key: "EXAM_COVERAGE", enabled: true, sortOrder: 20, content: { exams: ["UPSC"], languages: ["Hindi"] } }
    ]
};

test("priceBreakdown mirrors checkout pricing order", () => {
    assert.deepEqual(priceBreakdown(course), {
        base: 100, discount: 10, gst: 16.2, platform: 5, total: 111.2, currency: "INR"
    });
});

test("serializer exposes detail endpoint and enabled content sections", () => {
    const result = serializeCourse(
        { protocol: "https", get: () => "api.example.com" }, course, { includeSections: true }
    );
    assert.equal(result.detailEndpoint, "/api/v1/current-affairs/12");
    assert.equal(result.pricing.breakdown.total, 111.2);
    assert.equal(result.sections[0].key, "HIGHLIGHTS");
    assert.equal(result.imageUrl, "https://api.example.com/cover.webp");
    assert.deepEqual(result.preview.examTags, ["UPSC"]);
    assert.equal(result.purchase.request.body.currentAffairsId, 12);
});

test("catalog serializer omits full sections", () => {
    const result = serializeCourse({ protocol: "https", get: () => "api.example.com" }, course);
    assert.equal(result.sections, undefined);
    assert.deepEqual(result.preview.highlights, ["Daily quiz"]);
});

test("admin module parser creates structured deliverables, practice and mentor support", () => {
    const modules = buildModules({
        deliverables_enabled: "on",
        deliverables_items: "Daily Quiz | 10 questions with solutions | Daily",
        practice_enabled: "on",
        practice_daily_mcqs: "10",
        practice_answer_writing: "on",
        mentor_enabled: "on",
        mentor_support_mode: "Weekly live doubt class"
    });
    assert.deepEqual(modules.find((item) => item.key === "DELIVERABLES").content.items[0], {
        title: "Daily Quiz", description: "10 questions with solutions", frequency: "Daily"
    });
    assert.equal(modules.find((item) => item.key === "PRACTICE").content.dailyMcqs, 10);
    assert.equal(modules.find((item) => item.key === "PRACTICE").content.answerWriting, true);
    assert.equal(modules.find((item) => item.key === "MENTOR_SUPPORT").content.supportMode, "Weekly live doubt class");
});

test("admin module parser supports multiple FAQ question and answer rows", () => {
    const modules = buildModules({
        faq_enabled: "on",
        faq_question: ["Is Hindi included?", "Can I use it on mobile?"],
        faq_answer: ["Yes, Hindi is included.", "Yes, web and mobile are supported."]
    });
    assert.deepEqual(modules.find((item) => item.key === "FAQ").content.items, [
        { question: "Is Hindi included?", answer: "Yes, Hindi is included." },
        { question: "Can I use it on mobile?", answer: "Yes, web and mobile are supported." }
    ]);
});

test("admin current-affairs form compiles with EJS", () => {
    const template = fs.readFileSync(new URL("../views/current_affairs/current_affairs_form.ejs", import.meta.url), "utf8");
    assert.doesNotThrow(() => ejs.compile(template));
});
