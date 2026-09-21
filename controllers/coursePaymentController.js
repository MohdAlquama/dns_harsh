import crypto from "crypto";

import {
    getPublishedCourseById
} from "../models/courseModel.js";

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
// CREATE COURSE PAYMENT ORDER
// POST /api/v1/course-payments/orders
// =====================================================

export const createCoursePaymentOrder = async (req, res) => {

    let merchantOrderId = null;

    try {

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


        // =========================================
        // GET PUBLISHED COURSE
        // =========================================

        const course = await getPublishedCourseById(
            courseId
        );

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Published course not found"
            });
        }


        // =========================================
        // CHECK ALREADY PURCHASED
        // =========================================

        const owned = await findOwnedPaidItem(
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


        // =========================================
        // COURSE PRICE
        // =========================================

        const amount = Number(course.price);

        if (
            !Number.isFinite(amount) ||
            amount < 1
        ) {
            return res.status(422).json({
                success: false,
                message: "Course price must be at least ₹1"
            });
        }


        // =========================================
        // MERCHANT ORDER ID
        // =========================================

        merchantOrderId =
            `dns_course_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;


        // =========================================
        // CREATE LOCAL ORDER
        // =========================================

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
                amount,

            discountAmount:
                0,

            gstAmount:
                0,

            platformAmount:
                0,

            orderAmount:
                amount
        });


        // =========================================
        // CREATE CASHFREE ORDER
        // =========================================

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


        // =========================================
        // ACTIVATE LOCAL ORDER
        // =========================================

        await activateLocalOrder(
            merchantOrderId,
            gatewayOrder
        );


        // =========================================
        // RESPONSE
        // =========================================

        return res.status(201).json({

            success: true,

            order: {

                orderId:
                    merchantOrderId,

                amount,

                currency:
                    "INR",

                courseId:
                    course.id
            },

            cashfree: {

                paymentSessionId:
                    gatewayOrder.payment_session_id,

                environment:
                    gatewayOrder.dns_environment
            }
        });


    } catch (error) {

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


        const status =
            error instanceof CashfreeError
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
// VERIFY COURSE PAYMENT
// GET /api/v1/course-payments/orders/:orderId
// =====================================================

export const verifyCoursePayment = async (req, res) => {

    try {

        // =========================================
        // GET LOCAL ORDER
        // =========================================

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


        // =========================================
        // USER CHECK
        // =========================================

        if (
            Number(order.user_id) !==
            Number(req.user.id)
        ) {

            return res.status(403).json({
                success: false,
                message: "You cannot access this order"
            });
        }


        // =========================================
        // COURSE ORDER CHECK
        // =========================================

        if (
            order.item_type !== "COURSE"
        ) {

            return res.status(400).json({
                success: false,
                message: "This is not a course order"
            });
        }


        // =========================================
        // VERIFY WITH CASHFREE
        // =========================================

        if (
            ["CREATED", "ACTIVE"]
                .includes(order.status)
        ) {

            const remote =
                await getCashfreeOrder(
                    order.merchant_order_id
                );


            const amountMatches =
                Number(remote.order_amount) ===
                Number(order.order_amount);


            const currencyMatches =
                remote.order_currency ===
                order.currency;


            // =====================================
            // PAYMENT SUCCESS
            // =====================================

            if (
                remote.order_status === "PAID" &&
                amountMatches &&
                currencyMatches
            ) {

                /*
                 * IMPORTANT:
                 *
                 * markOrderFromGateway()
                 * will mark payment as PAID
                 * AND create course enrollment.
                 */

                await markOrderFromGateway(
                    order.merchant_order_id,
                    {
                        status: "PAID"
                    }
                );
            }


            // =====================================
            // PAYMENT EXPIRED / TERMINATED
            // =====================================

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


            // =====================================
            // RELOAD ORDER
            // =====================================

            order =
                await getOrderByMerchantId(
                    order.merchant_order_id
                );
        }


        // =========================================
        // FINAL RESPONSE
        // =========================================

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