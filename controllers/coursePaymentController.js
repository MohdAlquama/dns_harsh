import crypto from "crypto";

import {
    getPublishedCourseById
} from "../models/courseModel.js";

import {
    findOfferByCode,
    OfferCodeError
} from "../models/offerCodeModel.js";

import {
    createLocalOrder,
    activateLocalOrder,
    failLocalOrder,
    findOwnedPaidItem,
    getOrderByMerchantId,
    markOrderFromGateway
} from "../models/paymentModel.js";

import {
    createCashfreeOrder,
    getCashfreeOrder,
    CashfreeError
} from "../services/cashfreeService.js";


// =====================================================
// MONEY HELPER
// =====================================================

const roundMoney = (value) =>
    Math.round((Number(value) + Number.EPSILON) * 100) / 100;


// =====================================================
// COURSE PRICE CALCULATOR
// =====================================================

const calculateCoursePrice = (
    course,
    offerCode = null
) => {

    const pricing = course.pricing || {};

    const base = roundMoney(
        pricing.base_price ?? course.price
    );


    // =================================================
    // AUTOMATIC COURSE OFFER
    // =================================================

    let courseDiscount = 0;

    if (course.offer?.is_active) {

        courseDiscount =
            course.offer.discount_type === "PERCENT"

                ? roundMoney(
                    (
                        base *
                        Number(
                            course.offer.discount_value || 0
                        )
                    ) / 100
                )

                : roundMoney(
                    course.offer.discount_value || 0
                );

        courseDiscount = Math.min(
            base,
            courseDiscount
        );
    }


    // =================================================
    // OFFER CODE
    // =================================================

    let offerCodeDiscount = 0;

    if (offerCode) {

        // If offer code cannot stack with
        // automatic course offer
        if (!offerCode.stack_with_course_offer) {
            courseDiscount = 0;
        }

        const offerBasis = roundMoney(
            base - courseDiscount
        );


        offerCodeDiscount =
            offerCode.discount_type === "PERCENT"

                ? roundMoney(
                    (
                        offerBasis *
                        Number(
                            offerCode.discount_value || 0
                        )
                    ) / 100
                )

                : roundMoney(
                    offerCode.discount_value || 0
                );


        // Maximum discount limit
        if (offerCode.max_discount_amount !== null) {

            offerCodeDiscount = Math.min(
                offerCodeDiscount,
                Number(
                    offerCode.max_discount_amount
                )
            );
        }


        // Discount cannot be greater
        // than remaining amount
        offerCodeDiscount = Math.min(
            offerBasis,
            roundMoney(offerCodeDiscount)
        );
    }


    // =================================================
    // TOTAL DISCOUNT
    // =================================================

    const discount = roundMoney(
        courseDiscount +
        offerCodeDiscount
    );


    // =================================================
    // TAXABLE AMOUNT
    // =================================================

    const taxable = roundMoney(
        base - discount
    );


    // =================================================
    // GST
    // =================================================

    const gst =
        Number(pricing.gst_enabled) &&
        Number(pricing.gst_percent) > 0

            ? roundMoney(
                (
                    taxable *
                    Number(
                        pricing.gst_percent
                    )
                ) / 100
            )

            : 0;


    // =================================================
    // PLATFORM CHARGE
    // =================================================

    const platform =
        Number(pricing.platform_charge_enabled)

            ? roundMoney(
                pricing.platform_charge || 0
            )

            : 0;


    // =================================================
    // FINAL TOTAL
    // =================================================

    const total = roundMoney(
        taxable +
        gst +
        platform
    );


    return {

        base,

        courseDiscount,

        offerCodeDiscount,

        discount,

        taxable,

        gst,

        platform,

        total,

        currency: "INR"
    };
};


// =====================================================
// CREATE COURSE PAYMENT ORDER
// POST /api/v1/course-payments/orders
// =====================================================

export const createCoursePaymentOrder = async (req, res) => {

    let merchantOrderId = null;

    try {

        // =================================================
        // COURSE ID
        // =================================================

        const courseId = Number.parseInt(
            req.body.courseId,
            10
        );

        if (
            !Number.isInteger(courseId) ||
            courseId < 1
        ) {

            return res.status(400).json({
                success: false,
                message: "courseId is required"
            });
        }


        // =================================================
        // GET PUBLISHED COURSE
        // =================================================

        const course =
            await getPublishedCourseById(
                courseId
            );

        if (!course) {

            return res.status(404).json({
                success: false,
                message: "Published course not found"
            });
        }


        // =================================================
        // CHECK ALREADY PURCHASED
        // =================================================

        const owned =
            await findOwnedPaidItem(
                req.user.id,
                "COURSE",
                course.id
            );

        if (owned) {

            return res.status(409).json({
                success: false,
                message: "You already own this course",
                orderId: owned.merchant_order_id
            });
        }


        // =================================================
        // OFFER CODE
        // =================================================

        const offerCode =
            String(
                req.body.offerCode || ""
            ).trim() || null;


        // =================================================
        // VALIDATE OFFER CODE
        // =================================================

        const offer = offerCode

            ? await findOfferByCode({
                code: offerCode,
                userId: req.user.id,
                courseId: course.id,

                subtotal: Number(
                    course.pricing?.base_price ??
                    course.price
                )
            })

            : null;


        // =================================================
        // CALCULATE FINAL COURSE PRICE
        // =================================================

        const price =
            calculateCoursePrice(
                course,
                offer
            );


        const amount = price.total;


        // =================================================
        // MINIMUM PAYMENT
        // =================================================

        if (
            !Number.isFinite(amount) ||
            amount < 1
        ) {

            return res.status(422).json({
                success: false,
                message:
                    "Course price must be at least ₹1"
            });
        }


        // =================================================
        // MERCHANT ORDER ID
        // =================================================

        merchantOrderId =
            `dns_course_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;


        // =================================================
        // CREATE LOCAL ORDER
        // =================================================

        await createLocalOrder({

            merchantOrderId,

            userId:
                req.user.id,

            itemType:
                "COURSE",

            itemId:
                course.id,

            itemName:
                course.course_name,

            baseAmount:
                price.base,

            discountAmount:
                price.discount,

            gstAmount:
                price.gst,

            platformAmount:
                price.platform,

            orderAmount:
                price.total
        });


        // =================================================
        // CREATE CASHFREE ORDER
        // =================================================

        const gatewayOrder =
            await createCashfreeOrder({

                merchantOrderId,

                amount,

                customer:
                    req.user,

                itemName:
                    course.course_name,

                origin:
                    `${req.protocol}://${req.get("host")}`
            });


        // =================================================
        // ACTIVATE LOCAL ORDER
        // =================================================

        await activateLocalOrder(
            merchantOrderId,
            gatewayOrder
        );


        // =================================================
        // RESPONSE
        // =================================================

        return res.status(201).json({

            success: true,

            order: {

                orderId:
                    merchantOrderId,

                amount:
                    price.total,

                currency:
                    "INR",

                courseId:
                    course.id,

                priceBreakdown:
                    price
            },

            cashfree: {

                paymentSessionId:
                    gatewayOrder.payment_session_id,

                environment:
                    gatewayOrder.dns_environment
            }
        });


    } catch (error) {

        // =================================================
        // FAIL LOCAL ORDER
        // =================================================

        if (merchantOrderId) {

            try {

                await failLocalOrder(
                    merchantOrderId,
                    error.message
                );

            } catch (failError) {

                console.error(
                    "Failed to mark course order as failed:",
                    failError
                );
            }
        }


        console.error(
            "Course payment order error:",
            error
        );


        // =================================================
        // ERROR STATUS
        // =================================================

        const status =
            error instanceof CashfreeError ||
            error instanceof OfferCodeError

                ? error.status

                : 500;


        return res.status(status).json({

            success: false,

            message:
                error.message ||
                "Unable to create course payment order"
        });
    }
};


// =====================================================
// VALIDATE COURSE OFFER
// POST /api/v1/course-payments/offers/validate
// =====================================================

export const validateCourseOffer = async (req, res) => {

    try {

        // =================================================
        // COURSE ID
        // =================================================

        const courseId =
            Number.parseInt(
                req.body.courseId,
                10
            );


        // =================================================
        // OFFER CODE
        // =================================================

        const offerCode =
            String(
                req.body.offerCode || ""
            ).trim();


        if (
            !Number.isInteger(courseId) ||
            courseId < 1 ||
            !offerCode
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "courseId and offerCode are required"
            });
        }


        // =================================================
        // GET COURSE
        // =================================================

        const course =
            await getPublishedCourseById(
                courseId
            );


        if (!course) {

            return res.status(404).json({
                success: false,
                message:
                    "Published course not found"
            });
        }


        // =================================================
        // VALIDATE OFFER
        // =================================================

        const offer =
            await findOfferByCode({

                code:
                    offerCode,

                userId:
                    req.user.id,

                courseId:
                    course.id,

                subtotal:
                    Number(
                        course.pricing?.base_price ??
                        course.price
                    )
            });


        // =================================================
        // CALCULATE PRICE
        // =================================================

        const price =
            calculateCoursePrice(
                course,
                offer
            );


        // =================================================
        // RESPONSE
        // =================================================

        return res.json({

            success: true,

            data: {

                offerCode:
                    offer.code,

                priceBreakdown:
                    price
            }
        });


    } catch (error) {

        console.error(
            "Course offer validation error:",
            error
        );


        const status =
            error instanceof OfferCodeError
                ? error.status
                : 500;


        return res.status(status).json({

            success: false,

            message:
                error.message ||
                "Unable to validate offer"
        });
    }
};


// =====================================================
// VERIFY COURSE PAYMENT
// GET /api/v1/course-payments/orders/:orderId
// =====================================================

export const verifyCoursePayment = async (req, res) => {

    try {

        // =================================================
        // GET LOCAL ORDER
        // =================================================

        let order =
            await getOrderByMerchantId(
                req.params.orderId
            );


        if (!order) {

            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }


        // =================================================
        // USER CHECK
        // =================================================

        if (
            Number(order.user_id) !==
            Number(req.user.id)
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "You cannot access this order"
            });
        }


        // =================================================
        // COURSE ORDER CHECK
        // =================================================

        if (
            order.item_type !== "COURSE"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "This is not a course order"
            });
        }


        // =================================================
        // VERIFY WITH CASHFREE
        // =================================================

        if (
            ["CREATED", "ACTIVE"]
                .includes(order.status)
        ) {

            const remote =
                await getCashfreeOrder(
                    order.merchant_order_id
                );


            // =================================================
            // AMOUNT CHECK
            // =================================================

            const amountMatches =
                Number(remote.order_amount) ===
                Number(order.order_amount);


            // =================================================
            // CURRENCY CHECK
            // =================================================

            const currencyMatches =
                remote.order_currency ===
                order.currency;


            // =================================================
            // PAYMENT SUCCESS
            // =================================================

            if (
                remote.order_status === "PAID" &&
                amountMatches &&
                currencyMatches
            ) {

                await markOrderFromGateway(
                    order.merchant_order_id,
                    {
                        status: "PAID"
                    }
                );
            }


            // =================================================
            // PAYMENT EXPIRED / TERMINATED
            // =================================================

            else if (
                ["EXPIRED", "TERMINATED"]
                    .includes(remote.order_status)
            ) {

                await markOrderFromGateway(
                    order.merchant_order_id,
                    {
                        status: "EXPIRED"
                    }
                );
            }


            // =================================================
            // RELOAD ORDER
            // =================================================

            order =
                await getOrderByMerchantId(
                    order.merchant_order_id
                );
        }


        // =================================================
        // FINAL RESPONSE
        // =================================================

        return res.json({

            success: true,

            data: {

                orderId:
                    order.merchant_order_id,

                courseId:
                    order.item_id,

                status:
                    order.status,

                amount:
                    Number(order.order_amount),

                currency:
                    order.currency,

                paidAt:
                    order.paid_at,

                unlocked:
                    order.status === "PAID"
            }
        });


    } catch (error) {

        console.error(
            "Course payment verification error:",
            error
        );


        return res.status(
            error instanceof CashfreeError
                ? error.status
                : 500
        ).json({

            success: false,

            message:
                error.message ||
                "Unable to verify payment"
        });
    }
};