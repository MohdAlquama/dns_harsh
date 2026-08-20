import { listPublicCurrentAffairs } from "../models/currentAffairsModel.js";

const absoluteUrl = (req, path) => path ? new URL(path, `${req.protocol}://${req.get("host")}`).href : null;

const serializeCourse = (req, course) => ({
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
        platformCharge: course.platform_charge_enabled ? Number(course.platform_charge || 0) : 0
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
        requiresLogin: Number(course.base_price) > 0,
        createOrderEndpoint: "/api/v1/payments/orders",
        requestField: "currentAffairsId"
    },
    documents: course.documents.map((document) => ({
        id: document.id,
        type: document.document_type,
        name: document.document_name,
        locked: Number(course.base_price) > 0,
        downloadUrl: Number(course.base_price) > 0 ? null : absoluteUrl(req, document.file_path)
    }))
});

const getCurrentAffairs = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
        const courses = await listPublicCurrentAffairs({ limit, offset: (page - 1) * limit });

        return res.status(200).json({
            success: true,
            data: courses.map((course) => serializeCourse(req, course)),
            pagination: { page, limit, hasMore: courses.length === limit }
        });
    } catch (error) {
        console.error("Current Affairs API Error:", error);
        return res.status(500).json({ success: false, message: "Unable to load current affairs" });
    }
};

export { getCurrentAffairs };
