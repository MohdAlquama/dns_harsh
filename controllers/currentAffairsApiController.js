import { countPublicCurrentAffairs, getPublicCurrentAffairsById, listPublicCurrentAffairs } from "../models/currentAffairsModel.js";

const absoluteUrl = (req, path) => path ? new URL(path, `${req.protocol}://${req.get("host")}`).href : null;

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const priceBreakdown = (course) => {
    const base = roundMoney(course.base_price);
    const offer = course.offers?.[0];
    let discount = offer
        ? offer.discount_type === "PERCENT"
            ? roundMoney(base * Number(offer.discount_value) / 100)
            : roundMoney(offer.discount_value)
        : 0;
    discount = Math.min(base, discount);
    const taxable = roundMoney(base - discount);
    const gst = course.gst_enabled ? roundMoney(taxable * Number(course.gst_percent || 0) / 100) : 0;
    const platform = course.platform_charge_enabled ? roundMoney(course.platform_charge || 0) : 0;
    return { base, discount, gst, platform, total: roundMoney(taxable + gst + platform), currency: "INR" };
};

const moduleContent = (course, key) => course.modules?.find((module) => module.key === key)?.content || {};

const serializeCourse = (req, course, { includeSections = false } = {}) => {
    const breakdown = priceBreakdown(course);
    const highlights = moduleContent(course, "HIGHLIGHTS");
    const coverage = moduleContent(course, "EXAM_COVERAGE");
    const sample = moduleContent(course, "SAMPLE_PREVIEW");
    const canPurchase = course.status === "PUBLISHED" && breakdown.total >= 1;

    return {
    id: course.id,
    name: course.course_name,
    description: {
        short: course.short_description,
        long: course.long_description
    },
    imageUrl: absoluteUrl(req, course.default_image_path),
    schedule: { startDate: course.start_date, endDate: course.end_date },
    status: course.status,
    pricing: {
        currency: "INR",
        basePrice: Number(course.base_price),
        gstPercent: course.gst_enabled ? Number(course.gst_percent || 0) : 0,
        platformCharge: course.platform_charge_enabled ? Number(course.platform_charge || 0) : 0,
        breakdown
    },
    offers: course.offers.map((offer) => ({
        id: offer.id,
        name: offer.offer_name,
        type: offer.discount_type,
        value: Number(offer.discount_value)
    })),
    notifications: course.notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        description: notification.description,
        startDate: notification.start_date,
        endDate: notification.end_date
    })),
    purchase: {
        type: breakdown.total > 0 ? "PAID" : "FREE",
        available: canPurchase,
        requiresLogin: canPurchase,
        createOrderEndpoint: canPurchase ? "/api/v1/payments/orders" : null,
        request: canPurchase ? { method: "POST", body: { currentAffairsId: course.id } } : null
    },
    detailEndpoint: `/api/v1/current-affairs/${course.id}`,
    preview: {
        highlights: (highlights.items || []).slice(0, 4),
        examTags: (coverage.exams || []).slice(0, 8),
        languages: coverage.languages || [],
        updateFrequency: coverage.frequency || null,
        freeSampleAvailable: Boolean(sample.previewUrl)
    },
    ...(includeSections ? { sections: course.modules || [] } : {}),
    documents: course.documents.map((document) => ({
        id: document.id,
        type: document.document_type,
        name: document.document_name,
        locked: breakdown.total > 0,
        downloadUrl: breakdown.total > 0 ? null : absoluteUrl(req, document.file_path)
    }))
    };
};

const getCurrentAffairs = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
        const search = String(req.query.q || "").trim().slice(0, 80);
        const [courses, total] = await Promise.all([
            listPublicCurrentAffairs({ limit, offset: (page - 1) * limit, search }),
            countPublicCurrentAffairs({ search })
        ]);

        return res.status(200).json({
            success: true,
            data: courses.map((course) => serializeCourse(req, course)),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total },
            filters: { q: search || null }
        });
    } catch (error) {
        console.error("Current Affairs API Error:", error);
        return res.status(500).json({ success: false, message: "Unable to load current affairs" });
    }
};

const getCurrentAffairsDetail = async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({ success: false, message: "A valid current-affairs id is required" });
        }
        const course = await getPublicCurrentAffairsById(id);
        if (!course) return res.status(404).json({ success: false, message: "Current affairs not found" });

        res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
        return res.status(200).json({ success: true, data: serializeCourse(req, course, { includeSections: true }) });
    } catch (error) {
        console.error("Current Affairs Detail API Error:", error);
        return res.status(500).json({ success: false, message: "Unable to load current affairs details" });
    }
};

export { getCurrentAffairs, getCurrentAffairsDetail, priceBreakdown, serializeCourse };
