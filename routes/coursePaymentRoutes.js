import express from "express";

import requireAuth
    from "../middleware/requireAuth.js";

import {
    createCoursePaymentOrder,
    validateCourseOffer,
    verifyCoursePayment
} from "../controllers/coursePaymentController.js";


const router =
    express.Router();


router.post(
    "/orders",
    requireAuth,
    createCoursePaymentOrder
);

router.post(
    "/offers/validate",
    requireAuth,
    validateCourseOffer
);


router.get(
    "/orders/:orderId",
    requireAuth,
    verifyCoursePayment
);


export default router;