import { listCurrentAffairsCourses } from "../models/currentAffairsModel.js";
import { createOfferCode, listOfferCodes, normalizeOfferCode, setOfferCodeStatus } from "../models/offerCodeModel.js";
import { findUserByPhone } from "../models/authModel.js";

const optionalNumber = (value, label, { integer = false, min = 0 } = {}) => {
    if (value === "" || value === undefined || value === null) return null;
    if (integer && !/^\d+$/.test(String(value))) throw new Error(`${label} must be a whole number`);
    const number = integer ? Number.parseInt(value, 10) : Number(value);
    if (!Number.isFinite(number) || number < min || (integer && !Number.isInteger(number))) {
        throw new Error(`${label} must be ${integer ? "a whole number" : "a valid amount"}`);
    }
    return number;
};

const showOfferCodes = async (req, res) => {
    try {
        const [offers, courses] = await Promise.all([listOfferCodes(), listCurrentAffairsCourses()]);
        return res.render("layouts/layout", {
            title: "Offer Codes | DNS Admin", page: "../offer_codes/index", offers, courses,
            saved: req.query.saved === "1", error: req.query.error || null
        });
    } catch (error) {
        console.error("Offer code list error:", error);
        return res.status(500).send("Unable to load offer codes");
    }
};

const addOfferCode = async (req, res) => {
    try {
        const code = normalizeOfferCode(req.body.code);
        const name = String(req.body.name || "").trim().slice(0, 150);
        const discountType = String(req.body.discount_type || "").toUpperCase();
        const discountValue = optionalNumber(req.body.discount_value, "Discount value", { min: 0.01 });
        if (!/^[A-Z0-9_-]{3,50}$/.test(code)) throw new Error("Code must be 3–50 letters, numbers, hyphens, or underscores");
        if (!name) throw new Error("Offer name is required");
        if (!['PERCENT', 'FIXED'].includes(discountType)) throw new Error("Choose a valid discount type");
        if (discountType === "PERCENT" && discountValue > 100) throw new Error("Percentage discount cannot exceed 100");

        const validFrom = req.body.valid_from || null;
        const validUntil = req.body.valid_until || null;
        if (validFrom && validUntil && new Date(validUntil) <= new Date(validFrom)) {
            throw new Error("Valid-until time must be after valid-from time");
        }
        const eligiblePhone = String(req.body.eligible_phone || "").replace(/\D/g, "").slice(-10);
        const eligibleUser = eligiblePhone ? await findUserByPhone(eligiblePhone) : null;
        if (eligiblePhone && !eligibleUser) throw new Error("No registered user found with that phone number");
        await createOfferCode({
            code, name,
            courseId: optionalNumber(req.body.course_id, "Course", { integer: true, min: 1 }),
            discountType, discountValue,
            minOrderAmount: optionalNumber(req.body.min_order_amount, "Minimum order", { min: 0 }) ?? 0,
            maxDiscountAmount: optionalNumber(req.body.max_discount_amount, "Maximum discount", { min: 0.01 }),
            totalUsageLimit: optionalNumber(req.body.total_usage_limit, "Total usage limit", { integer: true, min: 1 }),
            perUserLimit: optionalNumber(req.body.per_user_limit, "Per-user limit", { integer: true, min: 1 }) ?? 1,
            validFrom, validUntil,
            eligibleUserId: eligibleUser?.id || null,
            stackWithCourseOffer: req.body.stack_with_course_offer === "on",
            isActive: req.body.is_active === "on"
        });
        return res.redirect("/offer-codes?saved=1");
    } catch (error) {
        console.error("Create offer code error:", error);
        const message = error.code === "ER_DUP_ENTRY" ? "That offer code already exists" : error.message;
        return res.redirect(`/offer-codes?error=${encodeURIComponent(message || "Unable to create offer code")}`);
    }
};

const updateOfferCodeStatus = async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id < 1 || !await setOfferCodeStatus(id, req.body.is_active === "1")) {
            throw new Error("Offer code not found");
        }
        return res.redirect("/offer-codes?saved=1");
    } catch (error) {
        return res.redirect(`/offer-codes?error=${encodeURIComponent(error.message || "Unable to update offer code")}`);
    }
};

export { addOfferCode, showOfferCodes, updateOfferCodeStatus };
