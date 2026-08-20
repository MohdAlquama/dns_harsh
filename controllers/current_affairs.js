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
        } : null
    };

    if (data.offer && (!data.offer.name || data.offer.value === null)) throw new Error("Offer name and rate are required");
    if (gstEnabled && data.pricing.gstPercent === null) throw new Error("GST percentage is required when GST is enabled");
    if (platformChargeEnabled && data.pricing.platformCharge === null) throw new Error("Platform charge is required when it is enabled");
    if (data.notification && !data.notification.title) throw new Error("Notification title is required when notification is enabled");
    return data;
};

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
    offer_rate: course.offer?.discount_value
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
    createCurrentAffairs,
    current_affairs_sql_table,
    removeCurrentAffairs,
    showCurrentAffairs,
    showCurrentAffairsForm,
    showEditCurrentAffairsForm,
    updateCurrentAffairs
};
