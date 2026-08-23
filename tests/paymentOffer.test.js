import test from "node:test";
import assert from "node:assert/strict";
import db from "../config/db.js";
import { calculateCoursePrice } from "../controllers/paymentController.js";
import { normalizeOfferCode } from "../models/offerCodeModel.js";

test.after(() => db.end());

const course = {
    base_price: 100,
    gst_enabled: 1,
    gst_percent: 18,
    platform_charge_enabled: 1,
    platform_charge: 5,
    offer: { is_active: 1, discount_type: "PERCENT", discount_value: 10 }
};

test("non-stacking code replaces the automatic course offer", () => {
    assert.deepEqual(calculateCoursePrice(course, {
        code: "SAVE20", discount_type: "PERCENT", discount_value: 20,
        max_discount_amount: null, stack_with_course_offer: 0
    }), {
        base: 100, discount: 20, gst: 14.4, platform: 5, total: 99.4,
        courseDiscount: 0, offerCodeDiscount: 20, offerCode: "SAVE20"
    });
});

test("stacking code applies after course offer and respects discount cap", () => {
    assert.deepEqual(calculateCoursePrice(course, {
        code: "STACK", discount_type: "PERCENT", discount_value: 50,
        max_discount_amount: 15, stack_with_course_offer: 1
    }), {
        base: 100, discount: 25, gst: 13.5, platform: 5, total: 93.5,
        courseDiscount: 10, offerCodeDiscount: 15, offerCode: "STACK"
    });
});

test("offer codes normalize consistently", () => assert.equal(normalizeOfferCode(" welcome-20 "), "WELCOME-20"));
