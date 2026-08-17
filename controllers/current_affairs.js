import {
    createCurrentAffairsCourse,
    listCurrentAffairsCourses
} from "../models/currentAffairsModel.js";
import createCurrentAffairsTables from "../models/currentAffairsTables.js";
import { unlink } from "fs/promises";

const checked = (value) => value === "on" || value === "1" || value === true;
const filePath = (file) => file ? `/uploads/current-affairs/${file.filename}` : null;

const removeUploadedFiles = async (files = {}) => {
    const uploadedFiles = Object.values(files).flat();
    await Promise.allSettled(uploadedFiles.map((file) => unlink(file.path)));
};

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

const showCurrentAffairs = async (req, res) => {
    try {
        const courses = await listCurrentAffairsCourses();
        return res.render("layouts/layout", {
            title: "Current Affairs | DNS Admin",
            page: "../current_affairs/index",
            courses,
            saved: req.query.saved === "1",
            error: null
        });
    } catch (error) {
        console.error("Current Affairs List Error:", error);
        return res.status(500).render("layouts/layout", {
            title: "Current Affairs | DNS Admin",
            page: "../current_affairs/index",
            courses: [],
            saved: false,
            error: "Unable to load current affairs courses"
        });
    }
};

const showCurrentAffairsForm = (_req, res) => res.render("layouts/layout", {
    title: "Current Affairs Course Settings | DNS Admin",
    page: "../current_affairs/current_affairs_form",
    error: null
});

const createCurrentAffairs = async (req, res) => {
    try {
        const courseName = typeof req.body.course_name === "string"
            ? req.body.course_name.trim()
            : "";
        if (!courseName) throw new Error("Course name is required");

        validateDateRange(req.body.course_start_date, req.body.course_end_date, "Course");
        validateDateRange(req.body.ad_start_date, req.body.ad_end_date, "Advertisement");
        validateDateRange(
            req.body.notification_start_date,
            req.body.notification_end_date,
            "Notification"
        );

        const gstEnabled = checked(req.body.gst_enabled);
        const platformChargeEnabled = checked(req.body.platform_charge_enabled);
        const adsEnabled = checked(req.body.ads_enabled);
        const notificationEnabled = checked(req.body.notification_enabled);
        const offerEnabled = checked(req.body.offer_enabled);
        const comingSoon = checked(req.body.coming_soon);

        if (comingSoon && adsEnabled) {
            throw new Error("Coming Soon and Ads cannot both be enabled");
        }

        const offerType = req.body.offer_type?.toUpperCase();
        if (offerEnabled && !["PERCENT", "FIXED"].includes(offerType)) {
            throw new Error("Select a valid offer type");
        }

        const linkType = req.body.link_type?.toUpperCase() || null;
        if (adsEnabled && linkType && !["IMAGE", "BUTTON", "BOTH"].includes(linkType)) {
            throw new Error("Select a valid advertisement link type");
        }

        const uploadType = req.body.upload_type?.toUpperCase();
        const normalPdf = req.files?.normal_pdf?.[0];
        const document = uploadType === "MASTER_PDF"
            ? { type: "MASTER_PDF", name: req.body.pdf_name || "Master PDF", filePath: null }
            : uploadType === "NORMAL_PDF"
                ? { type: "NORMAL_PDF", name: req.body.pdf_name, filePath: filePath(normalPdf) }
                : null;

        if (document?.type === "NORMAL_PDF" && (!document.name || !normalPdf)) {
            throw new Error("PDF name and PDF file are required for Normal PDF");
        }

        const data = {
            courseName,
            shortDescription: req.body.short_description?.trim(),
            longDescription: req.body.long_description?.trim(),
            defaultImagePath: filePath(req.files?.default_image?.[0]),
            startDate: req.body.course_start_date,
            endDate: req.body.course_end_date,
            status: comingSoon ? "COMING_SOON" : "DRAFT",
            pricing: {
                basePrice: parseAmount(req.body.base_price, "Price") || "0.00",
                gstEnabled,
                gstPercent: gstEnabled
                    ? parseAmount(req.body.gst_percent, "GST", { max: 100 })
                    : null,
                platformChargeEnabled,
                platformCharge: platformChargeEnabled
                    ? parseAmount(req.body.platform_charge, "Platform charge")
                    : null
            },
            ad: adsEnabled ? {
                isEnabled: true,
                startDate: req.body.ad_start_date,
                endDate: req.body.ad_end_date,
                imagePath: filePath(req.files?.ad_image?.[0]),
                linkType,
                imageUrl: req.body.image_url?.trim(),
                buttonUrl: req.body.button_url?.trim()
            } : null,
            notification: notificationEnabled ? {
                isEnabled: true,
                title: req.body.notification_title?.trim(),
                description: req.body.notification_description?.trim(),
                startDate: req.body.notification_start_date,
                endDate: req.body.notification_end_date
            } : null,
            document,
            offer: offerEnabled ? {
                name: req.body.offer_name?.trim(),
                type: offerType,
                value: parseAmount(
                    req.body.offer_rate,
                    "Offer rate",
                    { max: offerType === "PERCENT" ? 100 : null }
                )
            } : null
        };

        if (data.offer && (!data.offer.name || data.offer.value === null)) {
            throw new Error("Offer name and rate are required");
        }
        if (gstEnabled && data.pricing.gstPercent === null) {
            throw new Error("GST percentage is required when GST is enabled");
        }
        if (platformChargeEnabled && data.pricing.platformCharge === null) {
            throw new Error("Platform charge is required when it is enabled");
        }
        if (data.notification && !data.notification.title) {
            throw new Error("Notification title is required when notification is enabled");
        }

        await createCurrentAffairsCourse(data);
        return res.redirect("/current-affairs?saved=1");
    } catch (error) {
        await removeUploadedFiles(req.files);
        console.error("Create Current Affairs Error:", error);
        const status = error.code === "ER_DUP_ENTRY" ? 409 : 400;
        const message = error.code === "ER_DUP_ENTRY"
            ? "A course with this name already exists"
            : error.message || "Unable to save course";

        return res.status(status).render("layouts/layout", {
            title: "Current Affairs Course Settings | DNS Admin",
            page: "../current_affairs/current_affairs_form",
            error: message
        });
    }
};

const current_affairs_sql_table = createCurrentAffairsTables;

export {
    createCurrentAffairs,
    current_affairs_sql_table,
    showCurrentAffairs,
    showCurrentAffairsForm
};
