const TYPES = ["TEST_SERIES", "BOOK"];
const STATUSES = ["DRAFT", "PUBLISHED", "COMING_SOON"];

const cleanText = (value, max = 1000) => String(value || "").trim().slice(0, max);
const checked = (value) => value === true || value === "on" || value === "1";
const lines = (value, maxItems = 50, maxLength = 160) => cleanText(value, 10000)
    .split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
    .slice(0, maxItems).map((item) => item.slice(0, maxLength));

const numberValue = (value, label, { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false, optional = false } = {}) => {
    if (optional && (value === "" || value === null || value === undefined)) return null;
    if (integer && !/^\d+$/.test(String(value))) throw new Error(`${label} must be a whole number`);
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
        throw new Error(`${label} is invalid`);
    }
    return number;
};

const optionalUrl = (value, label) => {
    const url = cleanText(value, 1000);
    if (!url) return null;
    if (url.startsWith("/")) return url;
    try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        return parsed.href;
    } catch {
        throw new Error(`${label} must be an http(s) URL or an absolute site path`);
    }
};

const slugify = (value) => cleanText(value, 220).toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 200);

const dateTimeValue = (value, label) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new Error(`${label} is invalid`);
    return cleanText(value, 30).replace("T", " ");
};

const buildCatalogProduct = (type, body = {}) => {
    if (!TYPES.includes(type)) throw new Error("Unsupported product type");
    const title = cleanText(body.title, 200);
    const slug = slugify(body.slug || title);
    const status = STATUSES.includes(body.status) ? body.status : "DRAFT";
    if (!title) throw new Error("Title is required");
    if (slug.length < 2) throw new Error("A valid slug is required");
    const gstEnabled = checked(body.gst_enabled);
    const platformChargeEnabled = checked(body.platform_charge_enabled);

    const common = {
        type, title, slug,
        shortDescription: cleanText(body.short_description, 500) || null,
        longDescription: cleanText(body.long_description, 20000) || null,
        coverImageUrl: optionalUrl(body.cover_image_url, "Cover image URL"), status,
        basePrice: numberValue(body.base_price || 0, "Base price", { min: 0 }),
        gstEnabled,
        gstPercent: gstEnabled ? numberValue(body.gst_percent, "GST percentage", { min: 0, max: 100 }) : null,
        platformChargeEnabled,
        platformCharge: platformChargeEnabled ? numberValue(body.platform_charge, "Platform charge", { min: 0 }) : null
    };

    if (type === "TEST_SERIES") {
        const start = dateTimeValue(body.availability_start, "Availability start");
        const end = dateTimeValue(body.availability_end, "Availability end");
        if (start && end && new Date(end) <= new Date(start)) throw new Error("Availability end must be after start");
        const testMode = ["PRACTICE", "MOCK", "LIVE"].includes(body.test_mode) ? body.test_mode : "MOCK";
        return { common, details: {
            testMode,
            durationMinutes: numberValue(body.duration_minutes, "Duration", { integer: true, min: 1, max: 1440 }),
            totalQuestions: numberValue(body.total_questions, "Total questions", { integer: true, min: 1, max: 10000 }),
            totalMarks: numberValue(body.total_marks, "Total marks", { min: 0.01 }),
            negativeMarks: numberValue(body.negative_marks || 0, "Negative marks", { min: 0 }),
            attemptLimit: numberValue(body.attempt_limit || 1, "Attempt limit", { integer: true, min: 1, max: 1000 }),
            availabilityStart: start, availabilityEnd: end,
            languages: lines(body.languages, 20, 80), syllabus: lines(body.syllabus, 100, 240),
            instructions: cleanText(body.instructions, 10000) || null
        } };
    }

    const bookFormat = ["PHYSICAL", "DIGITAL", "BOTH"].includes(body.book_format) ? body.book_format : "PHYSICAL";
    const digitalAssetUrl = optionalUrl(body.digital_asset_url, "Digital asset URL");
    if (["DIGITAL", "BOTH"].includes(bookFormat) && !digitalAssetUrl) throw new Error("Digital asset URL is required for a digital book");
    const author = cleanText(body.author, 200);
    const language = cleanText(body.language, 80);
    if (!author) throw new Error("Author is required");
    if (!language) throw new Error("Language is required");
    const isbn = cleanText(body.isbn, 20).replace(/[^0-9Xx-]/g, "") || null;
    const compactIsbn = isbn?.replace(/-/g, "");
    if (compactIsbn && !(/^(?:\d{9}[\dXx]|\d{13})$/.test(compactIsbn))) {
        throw new Error("ISBN must be a valid ISBN-10 or ISBN-13 format");
    }
    return { common, details: {
        author, publisher: cleanText(body.publisher, 200) || null,
        isbn,
        sku: cleanText(body.sku, 80) || null, language,
        edition: cleanText(body.edition, 100) || null,
        pageCount: numberValue(body.page_count, "Page count", { integer: true, min: 1, optional: true }),
        bookFormat,
        stockQuantity: numberValue(body.stock_quantity || 0, "Stock quantity", { integer: true, min: 0 }),
        sampleUrl: optionalUrl(body.sample_url, "Sample URL"), digitalAssetUrl
    } };
};

const parseJsonArray = (value) => {
    if (Array.isArray(value)) return value;
    try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};

const toFormData = (product) => product.product_type === "TEST_SERIES" ? {
    ...product, languages: parseJsonArray(product.languages_json).join("\n"),
    syllabus: parseJsonArray(product.syllabus_json).join("\n"),
    availability_start: product.availability_start ? new Date(product.availability_start).toISOString().slice(0, 16) : "",
    availability_end: product.availability_end ? new Date(product.availability_end).toISOString().slice(0, 16) : ""
} : { ...product };

export { buildCatalogProduct, cleanText, parseJsonArray, slugify, toFormData, TYPES };
