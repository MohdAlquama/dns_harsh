import path from "path";
import { fileURLToPath } from "url";
import { unlink } from "fs/promises";
import {
    createCurrentAffairsCourse,
    deleteCurrentAffairsCourse,
    getCurrentAffairsCourseById,
    listCurrentAffairsCourses,
    updateCurrentAffairsCourse
} from "../models/currentAffairsModel.js";
import createCurrentAffairsTables from "../models/currentAffairsTables.js";

const uploadRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "uploads", "current-affairs");
const checked = (value) => value === "on" || value === "1" || value === true;
const filePath = (file) => file ? `/uploads/current-affairs/${file.filename}` : null;
const dateValue = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";

const cleanText = (value, maxLength = 1000) => typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";

const lines = (value, maxItems = 20, maxLength = 180) => cleanText(value, 10000)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength));

const httpUrl = (value, fieldName) => {
    const cleaned = cleanText(value, 1000);
    if (!cleaned) return null;
    try {
        const parsed = new URL(cleaned);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        return parsed.href;
    } catch {
        throw new Error(`${fieldName} must be a valid http(s) URL`);
    }
};

const faqItems = (value) => lines(value, 20, 500).map((line) => {
    const separator = line.indexOf("|");
    if (separator < 1 || separator === line.length - 1) {
        throw new Error("Each FAQ must use: Question | Answer");
    }
    return { question: line.slice(0, separator).trim(), answer: line.slice(separator + 1).trim() };
});

const arrayValue = (value) => Array.isArray(value) ? value : (value === undefined ? [] : [value]);

const faqItemsFromBody = (body) => {
    const questions = arrayValue(body.faq_question);
    const answers = arrayValue(body.faq_answer);
    if (questions.length === 0 && answers.length === 0) return faqItems(body.faq_items);
    if (Math.max(questions.length, answers.length) > 20) throw new Error("A maximum of 20 FAQs is allowed");

    return Array.from({ length: Math.max(questions.length, answers.length) }, (_, index) => ({
        question: cleanText(questions[index], 220),
        answer: cleanText(answers[index], 1000)
    })).filter((item) => {
        if (!item.question && !item.answer) return false;
        if (!item.question || !item.answer) throw new Error("Every FAQ needs both a question and an answer");
        return true;
    });
};

const deliverableItems = (value) => lines(value, 20, 700).map((line) => {
    const [title, description = "", frequency = ""] = line.split("|").map((item) => item.trim());
    if (!title) throw new Error("Each deliverable must use: Title | Description | Frequency");
    return { title, description, frequency };
});

const buildModules = (body) => [
    {
        key: "HIGHLIGHTS", enabled: checked(body.highlights_enabled), sortOrder: 10,
        content: { heading: cleanText(body.highlights_heading, 120), items: lines(body.highlights_items) }
    },
    {
        key: "EXAM_COVERAGE", enabled: checked(body.coverage_enabled), sortOrder: 20,
        content: {
            heading: cleanText(body.coverage_heading, 120), exams: lines(body.coverage_exams, 30, 100),
            subjects: lines(body.coverage_subjects, 30, 100),
            languages: lines(body.coverage_languages, 12, 60), frequency: cleanText(body.coverage_frequency, 120)
        }
    },
    {
        key: "DELIVERABLES", enabled: checked(body.deliverables_enabled), sortOrder: 30,
        content: {
            heading: cleanText(body.deliverables_heading, 120) || "What you will get",
            items: checked(body.deliverables_enabled) ? deliverableItems(body.deliverables_items) : []
        }
    },
    {
        key: "SAMPLE_PREVIEW", enabled: checked(body.preview_enabled), sortOrder: 40,
        content: {
            heading: cleanText(body.preview_heading, 120), description: cleanText(body.preview_description, 800),
            previewUrl: checked(body.preview_enabled) ? httpUrl(body.preview_url, "Sample preview URL") : null,
            ctaLabel: cleanText(body.preview_cta_label, 60) || "View free sample"
        }
    },
    {
        key: "SMART_REVISION", enabled: checked(body.revision_enabled), sortOrder: 50,
        content: {
            heading: cleanText(body.revision_heading, 120), description: cleanText(body.revision_description, 800),
            minutesPerDay: Math.min(240, Math.max(0, Number.parseInt(body.revision_minutes, 10) || 0)),
            features: lines(body.revision_features)
        }
    },
    {
        key: "PRACTICE", enabled: checked(body.practice_enabled), sortOrder: 60,
        content: {
            heading: cleanText(body.practice_heading, 120) || "Practice and assessment",
            dailyMcqs: Math.min(10000, Math.max(0, Number.parseInt(body.practice_daily_mcqs, 10) || 0)),
            mockTests: Math.min(10000, Math.max(0, Number.parseInt(body.practice_mock_tests, 10) || 0)),
            answerWriting: checked(body.practice_answer_writing),
            performanceAnalytics: checked(body.practice_analytics),
            description: cleanText(body.practice_description, 800)
        }
    },
    {
        key: "TRUST", enabled: checked(body.trust_enabled), sortOrder: 70,
        content: {
            heading: cleanText(body.trust_heading, 120), expertName: cleanText(body.trust_expert_name, 120),
            sourcePolicy: cleanText(body.trust_source_policy, 800),
            updatePromise: cleanText(body.trust_update_promise, 240),
            guaranteeText: cleanText(body.trust_guarantee_text, 240)
        }
    },
    {
        key: "MENTOR_SUPPORT", enabled: checked(body.mentor_enabled), sortOrder: 80,
        content: {
            heading: cleanText(body.mentor_heading, 120) || "Expert support",
            facultyName: cleanText(body.mentor_faculty_name, 120),
            experience: cleanText(body.mentor_experience, 160),
            supportMode: cleanText(body.mentor_support_mode, 240),
            description: cleanText(body.mentor_description, 800)
        }
    },
    {
        key: "FAQ", enabled: checked(body.faq_enabled), sortOrder: 90,
        content: {
            heading: cleanText(body.faq_heading, 120) || "Frequently asked questions",
            items: checked(body.faq_enabled) ? faqItemsFromBody(body) : []
        }
    },
    {
        key: "PURCHASE_CTA", enabled: checked(body.cta_enabled), sortOrder: 100,
        content: {
            label: cleanText(body.cta_label, 60) || "Buy now", subtext: cleanText(body.cta_subtext, 240),
            urgencyText: cleanText(body.cta_urgency_text, 160)
        }
    }
];

const removeUploadedFiles = async (files = {}) => {
    await Promise.allSettled(Object.values(files).flat().map((file) => unlink(file.path)));
};

const removeStoredFiles = async (paths = []) => {
    await Promise.allSettled(paths.filter(Boolean).map((storedPath) => {
        const absolutePath = path.resolve(uploadRoot, path.basename(storedPath));
        return absolutePath.startsWith(`${uploadRoot}${path.sep}`) ? unlink(absolutePath) : null;
    }));
};

const storedFiles = (course) => [course?.default_image_path, course?.ad?.image_path, course?.document?.file_path].filter(Boolean);

const parseAmount = (value, fieldName, { max = null } = {}) => {
    if (value === undefined || value === "") return null;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0 || (max !== null && amount > max)) {
        throw new Error(`${fieldName} is invalid`);
    }
    return amount.toFixed(2);
};

const validateDateRange = (startDate, endDate, label) => {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        throw new Error(`${label} end date must be after start date`);
    }
};

const buildCourseData = (req, existing = null) => {
    const courseName = typeof req.body.course_name === "string" ? req.body.course_name.trim() : "";
    if (!courseName) throw new Error("Course name is required");
    validateDateRange(req.body.course_start_date, req.body.course_end_date, "Course");
    validateDateRange(req.body.ad_start_date, req.body.ad_end_date, "Advertisement");
    validateDateRange(req.body.notification_start_date, req.body.notification_end_date, "Notification");

    const gstEnabled = checked(req.body.gst_enabled);
    const platformChargeEnabled = checked(req.body.platform_charge_enabled);
    const adsEnabled = checked(req.body.ads_enabled);
    const notificationEnabled = checked(req.body.notification_enabled);
    const offerEnabled = checked(req.body.offer_enabled);
    const comingSoon = checked(req.body.coming_soon);
    if (comingSoon && adsEnabled) throw new Error("Coming Soon and Ads cannot both be enabled");

    const offerType = req.body.offer_type?.toUpperCase();
    if (offerEnabled && !["PERCENT", "FIXED"].includes(offerType)) throw new Error("Select a valid offer type");
    const linkType = req.body.link_type?.toUpperCase() || null;
    if (adsEnabled && linkType && !["IMAGE", "BUTTON", "BOTH"].includes(linkType)) {
        throw new Error("Select a valid advertisement link type");
    }

    const uploadType = req.body.upload_type?.toUpperCase();
    const normalPdf = req.files?.normal_pdf?.[0];
    const existingDocumentPath = existing?.document?.document_type === "NORMAL_PDF" ? existing.document.file_path : null;
    const document = uploadType === "MASTER_PDF"
        ? { type: "MASTER_PDF", name: req.body.pdf_name || "Master PDF", filePath: null }
        : uploadType === "NORMAL_PDF"
            ? { type: "NORMAL_PDF", name: req.body.pdf_name, filePath: filePath(normalPdf) || existingDocumentPath }
            : null;
    if (document?.type === "NORMAL_PDF" && (!document.name || !document.filePath)) {
        throw new Error("PDF name and PDF file are required for Normal PDF");
    }

    const modules = buildModules(req.body);
    const requiredModuleContent = {
        HIGHLIGHTS: (content) => content.heading && content.items.length,
        EXAM_COVERAGE: (content) => content.exams.length || content.languages.length,
        DELIVERABLES: (content) => content.items.length,
        SAMPLE_PREVIEW: (content) => content.heading && content.previewUrl,
        SMART_REVISION: (content) => content.heading && content.features.length,
        PRACTICE: (content) => content.dailyMcqs || content.mockTests || content.answerWriting || content.performanceAnalytics || content.description,
        TRUST: (content) => content.heading && content.sourcePolicy,
        MENTOR_SUPPORT: (content) => content.supportMode || content.description,
        FAQ: (content) => content.items.length,
        PURCHASE_CTA: (content) => content.label
    };
    const incompleteModule = modules.find((module) => module.enabled && !requiredModuleContent[module.key](module.content));
    if (incompleteModule) throw new Error(`${incompleteModule.key.replaceAll("_", " ")} section is enabled but incomplete`);

    const data = {
        courseName,
        shortDescription: req.body.short_description?.trim(),
        longDescription: req.body.long_description?.trim(),
        defaultImagePath: filePath(req.files?.default_image?.[0]) || existing?.default_image_path || null,
        startDate: req.body.course_start_date,
        endDate: req.body.course_end_date,
        status: comingSoon ? "COMING_SOON" : (req.body.course_status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"),
        pricing: {
            basePrice: parseAmount(req.body.base_price, "Price") || "0.00",
            gstEnabled,
            gstPercent: gstEnabled ? parseAmount(req.body.gst_percent, "GST", { max: 100 }) : null,
            platformChargeEnabled,
            platformCharge: platformChargeEnabled ? parseAmount(req.body.platform_charge, "Platform charge") : null
        },
        ad: adsEnabled ? {
            isEnabled: true, startDate: req.body.ad_start_date, endDate: req.body.ad_end_date,
            imagePath: filePath(req.files?.ad_image?.[0]) || existing?.ad?.image_path || null,
            linkType, imageUrl: req.body.image_url?.trim(), buttonUrl: req.body.button_url?.trim()
        } : null,
        notification: notificationEnabled ? {
            isEnabled: true, title: req.body.notification_title?.trim(),
            description: req.body.notification_description?.trim(),
            startDate: req.body.notification_start_date, endDate: req.body.notification_end_date
        } : null,
        document,
        offer: offerEnabled ? {
            name: req.body.offer_name?.trim(), type: offerType,
            value: parseAmount(req.body.offer_rate, "Offer rate", { max: offerType === "PERCENT" ? 100 : null })
        } : null,
        modules
    };

    if (data.offer && (!data.offer.name || data.offer.value === null)) throw new Error("Offer name and rate are required");
    if (gstEnabled && data.pricing.gstPercent === null) throw new Error("GST percentage is required when GST is enabled");
    if (platformChargeEnabled && data.pricing.platformCharge === null) throw new Error("Platform charge is required when it is enabled");
    if (data.notification && !data.notification.title) throw new Error("Notification title is required when notification is enabled");
    return data;
};

const moduleContent = (course, key) => course.modules?.find((module) => module.key === key)?.content || {};
const moduleEnabled = (course, key) => Boolean(course.modules?.find((module) => module.key === key)?.enabled);
const joined = (items) => Array.isArray(items) ? items.join("\n") : "";

const toFormData = (course) => ({
    course_name: course.course_name,
    short_description: course.short_description,
    long_description: course.long_description,
    base_price: course.base_price,
    gst_enabled: Boolean(course.gst_enabled),
    gst_percent: course.gst_percent,
    platform_charge_enabled: Boolean(course.platform_charge_enabled),
    platform_charge: course.platform_charge,
    course_start_date: dateValue(course.start_date),
    course_end_date: dateValue(course.end_date),
    coming_soon: course.status === "COMING_SOON",
    course_status: course.status === "COMING_SOON" ? "DRAFT" : course.status,
    ads_enabled: Boolean(course.ad?.is_enabled),
    ad_start_date: dateValue(course.ad?.start_date),
    ad_end_date: dateValue(course.ad?.end_date),
    link_type: course.ad?.link_type?.toLowerCase(),
    image_url: course.ad?.image_url,
    button_url: course.ad?.button_url,
    notification_enabled: Boolean(course.notification?.is_enabled),
    notification_title: course.notification?.title,
    notification_description: course.notification?.description,
    notification_start_date: dateValue(course.notification?.start_date),
    notification_end_date: dateValue(course.notification?.end_date),
    upload_type: course.document?.document_type?.toLowerCase(),
    pdf_name: course.document?.document_name,
    offer_enabled: Boolean(course.offer?.is_active),
    offer_name: course.offer?.offer_name,
    offer_type: course.offer?.discount_type,
    offer_rate: course.offer?.discount_value,
    highlights_enabled: moduleEnabled(course, "HIGHLIGHTS"),
    highlights_heading: moduleContent(course, "HIGHLIGHTS").heading,
    highlights_items: joined(moduleContent(course, "HIGHLIGHTS").items),
    coverage_enabled: moduleEnabled(course, "EXAM_COVERAGE"),
    coverage_heading: moduleContent(course, "EXAM_COVERAGE").heading,
    coverage_exams: joined(moduleContent(course, "EXAM_COVERAGE").exams),
    coverage_subjects: joined(moduleContent(course, "EXAM_COVERAGE").subjects),
    coverage_languages: joined(moduleContent(course, "EXAM_COVERAGE").languages),
    coverage_frequency: moduleContent(course, "EXAM_COVERAGE").frequency,
    deliverables_enabled: moduleEnabled(course, "DELIVERABLES"),
    deliverables_heading: moduleContent(course, "DELIVERABLES").heading,
    deliverables_items: (moduleContent(course, "DELIVERABLES").items || [])
        .map((item) => `${item.title} | ${item.description || ""} | ${item.frequency || ""}`).join("\n"),
    preview_enabled: moduleEnabled(course, "SAMPLE_PREVIEW"),
    preview_heading: moduleContent(course, "SAMPLE_PREVIEW").heading,
    preview_description: moduleContent(course, "SAMPLE_PREVIEW").description,
    preview_url: moduleContent(course, "SAMPLE_PREVIEW").previewUrl,
    preview_cta_label: moduleContent(course, "SAMPLE_PREVIEW").ctaLabel,
    revision_enabled: moduleEnabled(course, "SMART_REVISION"),
    revision_heading: moduleContent(course, "SMART_REVISION").heading,
    revision_description: moduleContent(course, "SMART_REVISION").description,
    revision_minutes: moduleContent(course, "SMART_REVISION").minutesPerDay,
    revision_features: joined(moduleContent(course, "SMART_REVISION").features),
    practice_enabled: moduleEnabled(course, "PRACTICE"),
    practice_heading: moduleContent(course, "PRACTICE").heading,
    practice_daily_mcqs: moduleContent(course, "PRACTICE").dailyMcqs,
    practice_mock_tests: moduleContent(course, "PRACTICE").mockTests,
    practice_answer_writing: Boolean(moduleContent(course, "PRACTICE").answerWriting),
    practice_analytics: Boolean(moduleContent(course, "PRACTICE").performanceAnalytics),
    practice_description: moduleContent(course, "PRACTICE").description,
    trust_enabled: moduleEnabled(course, "TRUST"),
    trust_heading: moduleContent(course, "TRUST").heading,
    trust_expert_name: moduleContent(course, "TRUST").expertName,
    trust_source_policy: moduleContent(course, "TRUST").sourcePolicy,
    trust_update_promise: moduleContent(course, "TRUST").updatePromise,
    trust_guarantee_text: moduleContent(course, "TRUST").guaranteeText,
    mentor_enabled: moduleEnabled(course, "MENTOR_SUPPORT"),
    mentor_heading: moduleContent(course, "MENTOR_SUPPORT").heading,
    mentor_faculty_name: moduleContent(course, "MENTOR_SUPPORT").facultyName,
    mentor_experience: moduleContent(course, "MENTOR_SUPPORT").experience,
    mentor_support_mode: moduleContent(course, "MENTOR_SUPPORT").supportMode,
    mentor_description: moduleContent(course, "MENTOR_SUPPORT").description,
    faq_enabled: moduleEnabled(course, "FAQ"),
    faq_heading: moduleContent(course, "FAQ").heading,
    faq_question: (moduleContent(course, "FAQ").items || []).map((item) => item.question),
    faq_answer: (moduleContent(course, "FAQ").items || []).map((item) => item.answer),
    cta_enabled: moduleEnabled(course, "PURCHASE_CTA"),
    cta_label: moduleContent(course, "PURCHASE_CTA").label,
    cta_subtext: moduleContent(course, "PURCHASE_CTA").subtext,
    cta_urgency_text: moduleContent(course, "PURCHASE_CTA").urgencyText
});

const renderForm = (res, { status = 200, error = null, courseId = null, formData = {} } = {}) => res.status(status).render("layouts/layout", {
    title: `${courseId ? "Edit" : "New"} Current Affairs Course | DNS Admin`,
    page: "../current_affairs/current_affairs_form", error, courseId, formData
});

const showCurrentAffairs = async (req, res) => {
    try {
        const courses = await listCurrentAffairsCourses();
        return res.render("layouts/layout", {
            title: "Current Affairs | DNS Admin", page: "../current_affairs/index", courses,
            saved: req.query.saved === "1", updated: req.query.updated === "1",
            deleted: req.query.deleted === "1", error: null
        });
    } catch (error) {
        console.error("Current Affairs List Error:", error);
        return res.status(500).render("layouts/layout", {
            title: "Current Affairs | DNS Admin", page: "../current_affairs/index", courses: [],
            saved: false, updated: false, deleted: false, error: "Unable to load current affairs courses"
        });
    }
};

const showCurrentAffairsForm = (_req, res) => renderForm(res);

const showEditCurrentAffairsForm = async (req, res) => {
    try {
        const course = await getCurrentAffairsCourseById(req.params.id);
        if (!course) return res.status(404).send("Current Affairs course not found");
        return renderForm(res, { courseId: course.id, formData: toFormData(course) });
    } catch (error) {
        console.error("Edit Current Affairs Form Error:", error);
        return res.status(500).send("Unable to load Current Affairs course");
    }
};

const createCurrentAffairs = async (req, res) => {
    try {
        await createCurrentAffairsCourse(buildCourseData(req));
        return res.redirect("/current-affairs?saved=1");
    } catch (error) {
        await removeUploadedFiles(req.files);
        console.error("Create Current Affairs Error:", error);
        const duplicate = error.code === "ER_DUP_ENTRY";
        return renderForm(res, {
            status: duplicate ? 409 : 400,
            error: duplicate ? "A course with this name already exists" : error.message || "Unable to save course",
            formData: req.body
        });
    }
};

const updateCurrentAffairs = async (req, res) => {
    try {
        const existing = await getCurrentAffairsCourseById(req.params.id);
        if (!existing) {
            await removeUploadedFiles(req.files);
            return res.status(404).send("Current Affairs course not found");
        }
        const data = buildCourseData(req, existing);
        await updateCurrentAffairsCourse(req.params.id, data);
        const retained = new Set([data.defaultImagePath, data.ad?.imagePath, data.document?.filePath]);
        await removeStoredFiles(storedFiles(existing).filter((item) => !retained.has(item)));
        return res.redirect("/current-affairs?updated=1");
    } catch (error) {
        await removeUploadedFiles(req.files);
        console.error("Update Current Affairs Error:", error);
        const duplicate = error.code === "ER_DUP_ENTRY";
        return renderForm(res, {
            status: duplicate ? 409 : 400,
            error: duplicate ? "A course with this name already exists" : error.message || "Unable to update course",
            courseId: req.params.id, formData: req.body
        });
    }
};

const removeCurrentAffairs = async (req, res) => {
    try {
        const course = await getCurrentAffairsCourseById(req.params.id);
        if (!course) return res.status(404).send("Current Affairs course not found");
        await deleteCurrentAffairsCourse(req.params.id);
        await removeStoredFiles(storedFiles(course));
        return res.redirect("/current-affairs?deleted=1");
    } catch (error) {
        console.error("Delete Current Affairs Error:", error);
        return res.status(500).send("Unable to delete Current Affairs course");
    }
};

const current_affairs_sql_table = createCurrentAffairsTables;

export {
    buildModules,
    createCurrentAffairs,
    current_affairs_sql_table,
    removeCurrentAffairs,
    showCurrentAffairs,
    showCurrentAffairsForm,
    showEditCurrentAffairsForm,
    updateCurrentAffairs
};
