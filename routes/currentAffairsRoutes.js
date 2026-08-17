import express from "express";
import {
    createCurrentAffairs,
    showCurrentAffairs,
    showCurrentAffairsForm
} from "../controllers/current_affairs.js";
import currentAffairsUpload from "../middleware/currentAffairsUpload.js";

const currentAffairsRoutes = express.Router();

currentAffairsRoutes.get("/current-affairs", showCurrentAffairs);
currentAffairsRoutes.get("/current-affairs/new", showCurrentAffairsForm);

// Backward compatibility for the existing New Current Affairs button.
currentAffairsRoutes.post("/current-affairs-fresh-form", showCurrentAffairsForm);

currentAffairsRoutes.post(
    "/current-affairs",
    (req, res, next) => currentAffairsUpload(req, res, (error) => {
        if (!error) return next();
        return res.status(400).render("layouts/layout", {
            title: "Current Affairs Course Settings | DNS Admin",
            page: "../current_affairs/current_affairs_form",
            error: error.message
        });
    }),
    createCurrentAffairs
);

export default currentAffairsRoutes;
