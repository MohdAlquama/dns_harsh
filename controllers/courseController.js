import {
    getAllCourses,
    getCourseById,
    getCourseSubjects,
    createCourse as createCourseModel,
    updateCourse as updateCourseModel,
    publishCourse as publishCourseModel,
    deleteCourse as deleteCourseModel
} from "../models/courseModel.js";

const value = (data, key, fallback = null) => {
    const item = data?.[key];
    return item === undefined || item === null || item === ""
        ? fallback
        : item;
};

const booleanValue = (data, key) => {
    const item = data?.[key];
    return item === "1" || item === "true" || item === "on" || item === true;
};

const numberValue = (data, key, fallback = 0) => {
    const number = Number(data?.[key]);
    return Number.isFinite(number) ? number : fallback;
};

const filePath = (file) => {
    if (!file) return null;
    return file.path || file.location || file.url || file.filename || null;
};

const getUploadedFile = (files, field) =>
    files?.[field]?.[0] || null;

const lines = (text) =>
    String(text || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);

const pipeItems = (text) =>
    lines(text).map((line) => {
        const [title = "", description = "", frequency = ""] = line.split("|");
        return {
            title: title.trim(),
            description: description.trim(),
            frequency: frequency.trim()
        };
    }).filter((item) => item.title || item.description || item.frequency);

const buildFaq = (body) => {
    const questions = Array.isArray(body?.faq_question)
        ? body.faq_question
        : body?.faq_question ? [body.faq_question] : [];

    const answers = Array.isArray(body?.faq_answer)
        ? body.faq_answer
        : body?.faq_answer ? [body.faq_answer] : [];

    return questions.map((question, index) => ({
        question: String(question || "").trim(),
        answer: String(answers[index] || "").trim()
    })).filter((item) => item.question || item.answer);
};

const buildModules = (body) => {
    const definitions = [
        ["HIGHLIGHTS", "highlights_enabled", () => ({
            heading: value(body, "highlights_heading", ""),
            items: lines(value(body, "highlights_items", ""))
        })],
        ["EXAM_COVERAGE", "coverage_enabled", () => ({
            heading: value(body, "coverage_heading", ""),
            frequency: value(body, "coverage_frequency", ""),
            exams: lines(value(body, "coverage_exams", "")),
            subjects: lines(value(body, "coverage_subjects", "")),
            languages: lines(value(body, "coverage_languages", ""))
        })],
        ["DELIVERABLES", "deliverables_enabled", () => ({
            heading: value(body, "deliverables_heading", ""),
            items: pipeItems(value(body, "deliverables_items", ""))
        })],
        ["SAMPLE_PREVIEW", "preview_enabled", () => ({
            heading: value(body, "preview_heading", ""),
            url: value(body, "preview_url", ""),
            description: value(body, "preview_description", ""),
            ctaLabel: value(body, "preview_cta_label", "")
        })],
        ["SMART_REVISION", "revision_enabled", () => ({
            heading: value(body, "revision_heading", ""),
            minutes: numberValue(body, "revision_minutes", 0),
            description: value(body, "revision_description", ""),
            features: lines(value(body, "revision_features", ""))
        })],
        ["PRACTICE", "practice_enabled", () => ({
            heading: value(body, "practice_heading", ""),
            dailyMcqs: numberValue(body, "practice_daily_mcqs", 0),
            mockTests: numberValue(body, "practice_mock_tests", 0),
            answerWriting: booleanValue(body, "practice_answer_writing"),
            analytics: booleanValue(body, "practice_analytics"),
            description: value(body, "practice_description", "")
        })],
        ["TRUST", "trust_enabled", () => ({
            heading: value(body, "trust_heading", ""),
            expertName: value(body, "trust_expert_name", ""),
            sourcePolicy: value(body, "trust_source_policy", ""),
            updatePromise: value(body, "trust_update_promise", ""),
            guaranteeText: value(body, "trust_guarantee_text", "")
        })],
        ["MENTOR_SUPPORT", "mentor_enabled", () => ({
            heading: value(body, "mentor_heading", ""),
            facultyName: value(body, "mentor_faculty_name", ""),
            experience: value(body, "mentor_experience", ""),
            supportMode: value(body, "mentor_support_mode", ""),
            description: value(body, "mentor_description", "")
        })],
        ["FAQ", "faq_enabled", () => ({
            heading: value(body, "faq_heading", ""),
            items: buildFaq(body)
        })],
        ["PURCHASE_CTA", "cta_enabled", () => ({
            label: value(body, "cta_label", ""),
            subtext: value(body, "cta_subtext", ""),
            urgencyText: value(body, "cta_urgency_text", "")
        })]
    ];

    return definitions.map(([key, enabledField, contentFactory], index) => ({
        module_key: key,
        is_enabled: booleanValue(body, enabledField) ? 1 : 0,
        sort_order: index,
        content_json: contentFactory()
    }));
};

const moduleToForm = (formData, modules = []) => {
    const map = Object.fromEntries(
        modules.map((module) => [module.key, module])
    );

    const setModule = (key, enabledField, fields) => {
        const module = map[key];
        if (!module) return;
        formData[enabledField] = module.enabled;
        const content = module.content || {};
        Object.assign(formData, fields(content));
    };

    setModule("HIGHLIGHTS", "highlights_enabled", (c) => ({
        highlights_heading: c.heading || "",
        highlights_items: Array.isArray(c.items) ? c.items.join("\n") : ""
    }));
    setModule("EXAM_COVERAGE", "coverage_enabled", (c) => ({
        coverage_heading: c.heading || "",
        coverage_frequency: c.frequency || "",
        coverage_exams: Array.isArray(c.exams) ? c.exams.join("\n") : "",
        coverage_subjects: Array.isArray(c.subjects) ? c.subjects.join("\n") : "",
        coverage_languages: Array.isArray(c.languages) ? c.languages.join("\n") : ""
    }));
    setModule("DELIVERABLES", "deliverables_enabled", (c) => ({
        deliverables_heading: c.heading || "",
        deliverables_items: (c.items || []).map((x) => `${x.title || ""} | ${x.description || ""} | ${x.frequency || ""}`).join("\n")
    }));
    setModule("SAMPLE_PREVIEW", "preview_enabled", (c) => ({
        preview_heading: c.heading || "",
        preview_url: c.url || "",
        preview_description: c.description || "",
        preview_cta_label: c.ctaLabel || ""
    }));
    setModule("SMART_REVISION", "revision_enabled", (c) => ({
        revision_heading: c.heading || "",
        revision_minutes: c.minutes ?? "",
        revision_description: c.description || "",
        revision_features: Array.isArray(c.features) ? c.features.join("\n") : ""
    }));
    setModule("PRACTICE", "practice_enabled", (c) => ({
        practice_heading: c.heading || "",
        practice_daily_mcqs: c.dailyMcqs ?? "",
        practice_mock_tests: c.mockTests ?? "",
        practice_answer_writing: c.answerWriting,
        practice_analytics: c.analytics,
        practice_description: c.description || ""
    }));
    setModule("TRUST", "trust_enabled", (c) => ({
        trust_heading: c.heading || "",
        trust_expert_name: c.expertName || "",
        trust_source_policy: c.sourcePolicy || "",
        trust_update_promise: c.updatePromise || "",
        trust_guarantee_text: c.guaranteeText || ""
    }));
    setModule("MENTOR_SUPPORT", "mentor_enabled", (c) => ({
        mentor_heading: c.heading || "",
        mentor_faculty_name: c.facultyName || "",
        mentor_experience: c.experience || "",
        mentor_support_mode: c.supportMode || "",
        mentor_description: c.description || ""
    }));
    setModule("FAQ", "faq_enabled", (c) => ({
        faq_heading: c.heading || "",
        faq_question: (c.items || []).map((x) => x.question || ""),
        faq_answer: (c.items || []).map((x) => x.answer || "")
    }));
    setModule("PURCHASE_CTA", "cta_enabled", (c) => ({
        cta_label: c.label || "",
        cta_subtext: c.subtext || "",
        cta_urgency_text: c.urgencyText || ""
    }));
};

const buildCourseData = (body = {}, files = {}, oldCourse = null) => {
    const coverFile = getUploadedFile(files, "cover_image");
    const adFile = getUploadedFile(files, "ad_image");

    const coverImageUrl =
        filePath(coverFile) ||
        value(body, "cover_image_url", oldCourse?.cover_image_url || null);

    const adImagePath =
        filePath(adFile) ||
        value(body, "ad_image", oldCourse?.ads?.image_path || null);

    const basePrice = numberValue(body, "base_price", Number(oldCourse?.price || 0));

    return {
        subject_folder_id: numberValue(body, "subject_folder_id", Number(oldCourse?.subject_folder_id || 0)),
        course_name: String(value(body, "course_name", oldCourse?.course_name || "")).trim(),
        slug: String(value(body, "slug", oldCourse?.slug || "")).trim(),
        short_description: value(body, "short_description", oldCourse?.short_description || null),
        long_description: value(body, "long_description", oldCourse?.long_description || null),
        cover_image_url: coverImageUrl,
        price: basePrice,
        course_start_date: value(body, "course_start_date", oldCourse?.start_date || null),
        course_end_date: value(body, "course_end_date", oldCourse?.end_date || null),
        coming_soon: booleanValue(body, "coming_soon") ? 1 : 0,
        status: value(body, "course_status", oldCourse?.status || "DRAFT"),
        pricing: {
            base_price: basePrice,
            gst_enabled: booleanValue(body, "gst_enabled") ? 1 : 0,
            gst_percent: numberValue(body, "gst_percent", Number(oldCourse?.pricing?.gst_percent || 0)),
            platform_charge_enabled: booleanValue(body, "platform_charge_enabled") ? 1 : 0,
            platform_charge: numberValue(body, "platform_charge", Number(oldCourse?.pricing?.platform_charge || 0))
        },
        ads: {
            is_enabled: booleanValue(body, "ads_enabled") ? 1 : 0,
            start_date: value(body, "ad_start_date", oldCourse?.ads?.start_date || null),
            end_date: value(body, "ad_end_date", oldCourse?.ads?.end_date || null),
            image_path: adImagePath,
            link_type: String(value(body, "link_type", oldCourse?.ads?.link_type || "IMAGE")).toUpperCase(),
            image_url: value(body, "image_url", oldCourse?.ads?.image_url || null),
            button_url: value(body, "button_url", oldCourse?.ads?.button_url || null)
        },
        notification: {
            is_enabled: booleanValue(body, "notification_enabled") ? 1 : 0,
            title: value(body, "notification_title", oldCourse?.notification?.title || null),
            description: value(body, "notification_description", oldCourse?.notification?.description || null),
            start_date: value(body, "notification_start_date", oldCourse?.notification?.start_date || null),
            end_date: value(body, "notification_end_date", oldCourse?.notification?.end_date || null)
        },
        offer: booleanValue(body, "offer_enabled")
            ? {
                is_active: 1,
                offer_name: value(body, "offer_name", oldCourse?.offer?.offer_name || null),
                discount_type: value(body, "offer_type", oldCourse?.offer?.discount_type || "PERCENT"),
                discount_value: numberValue(body, "offer_rate", Number(oldCourse?.offer?.discount_value || 0))
            }
            : null,
        modules: buildModules(body)
    };
};

const prepareRender = async (courseId, formData = {}, error = null) => ({
    title: `${courseId ? "Edit" : "New"} Course | DNS Admin`,
    page: "../courses/form",
    courseId,
    formData,
    subjectList: await getCourseSubjects(),
    moduleData: {},
    pricingData: formData.pricing || {},
    adsData: formData.ads || {},
    notificationData: formData.notification || {},
    offerData: formData.offer || {},
    error
});

export const showCourses = async (req, res) => {
    try {
        return res.render("layouts/layout", {
            title: "Courses | DNS Admin",
            page: "../courses/index",
            courses: await getAllCourses(),
            error: null
        });
    } catch (error) {
        console.error("showCourses error:", error);
        return res.status(500).render("layouts/layout", {
            title: "Courses | DNS Admin",
            page: "../courses/index",
            courses: [],
            error: error.message || "Unable to load courses"
        });
    }
};

export const showCreateCourse = async (req, res) => {
    try {
        return res.render("layouts/layout", await prepareRender(null, {}));
    } catch (error) {
        return res.status(500).send(error.message || "Unable to load course form");
    }
};

export const createCourse = async (req, res) => {
    try {
        const data = buildCourseData(req.body || {}, req.files || {});

        if (!data.subject_folder_id || !data.course_name || !data.slug) {
            return res.status(400).render(
                "layouts/layout",
                await prepareRender(null, req.body || {}, "Course name, slug and subject are required.")
            );
        }

        await createCourseModel(data);
        return res.redirect("/courses?created=1");
    } catch (error) {
        console.error("createCourse error:", error);
        return res.status(400).send(error.message || "Unable to create course");
    }
};

export const showEditCourse = async (req, res) => {
    try {
        const courseId = Number(req.params.id);
        if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).send("Invalid course ID");

        const course = await getCourseById(courseId);
        if (!course) return res.status(404).send("Course not found");

        const formData = {
            ...course,
            course_status: course.status,
            course_start_date: course.start_date,
            course_end_date: course.end_date,
            coming_soon: Boolean(course.coming_soon),
            base_price: course.pricing?.base_price ?? course.price,
            gst_enabled: Boolean(course.pricing?.gst_enabled),
            gst_percent: course.pricing?.gst_percent,
            platform_charge_enabled: Boolean(course.pricing?.platform_charge_enabled),
            platform_charge: course.pricing?.platform_charge,
            ads_enabled: Boolean(course.ads?.is_enabled),
            ad_start_date: course.ads?.start_date,
            ad_end_date: course.ads?.end_date,
            link_type: course.ads?.link_type?.toLowerCase(),
            image_url: course.ads?.image_url,
            button_url: course.ads?.button_url,
            notification_enabled: Boolean(course.notification?.is_enabled),
            notification_title: course.notification?.title,
            notification_description: course.notification?.description,
            notification_start_date: course.notification?.start_date,
            notification_end_date: course.notification?.end_date,
            offer_enabled: Boolean(course.offer?.is_active),
            offer_name: course.offer?.offer_name,
            offer_type: course.offer?.discount_type,
            offer_rate: course.offer?.discount_value
        };

        moduleToForm(formData, course.modules || []);

        return res.render("layouts/layout", await prepareRender(courseId, formData));
    } catch (error) {
        console.error("showEditCourse error:", error);
        return res.status(500).send(error.message || "Unable to load course");
    }
};

export const updateCourse = async (req, res) => {
    try {
        const courseId = Number(req.params.id);
        if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).send("Invalid course ID");

        const oldCourse = await getCourseById(courseId);
        if (!oldCourse) return res.status(404).send("Course not found");

        const data = buildCourseData(req.body || {}, req.files || {}, oldCourse);
        await updateCourseModel(courseId, data);

        return res.redirect("/courses?updated=1");
    } catch (error) {
        console.error("updateCourse error:", error);
        return res.status(400).send(error.message || "Unable to update course");
    }
};

export const publishCourse = async (req, res) => {
    try {
        await publishCourseModel(req.params.id);
        return res.redirect("/courses?published=1");
    } catch (error) {
        return res.status(400).send(error.message || "Unable to publish course");
    }
};

export const deleteCourse = async (req, res) => {
    try {
        await deleteCourseModel(req.params.id);
        return res.redirect("/courses?deleted=1");
    } catch (error) {
        console.error("deleteCourse error:", error);
        return res.status(400).send(error.message || "Unable to delete course");
    }
};

export { buildModules, buildCourseData };
