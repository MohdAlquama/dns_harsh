import express from "express";
import {
    createCurrentAffairs,
    removeCurrentAffairs,
    showCurrentAffairs,
    showCurrentAffairsForm,
    showEditCurrentAffairsForm,
    updateCurrentAffairs
} from "../controllers/current_affairs.js";
import currentAffairsUpload from "../middleware/currentAffairsUpload.js";

const currentAffairsRoutes = express.Router();

currentAffairsRoutes.get("/current-affairs", showCurrentAffairs);
currentAffairsRoutes.get("/current-affairs/new", showCurrentAffairsForm);
currentAffairsRoutes.get("/current-affairs/:id/edit", showEditCurrentAffairsForm);

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

currentAffairsRoutes.post(
    "/current-affairs/:id/edit",
    (req, res, next) => currentAffairsUpload(req, res, (error) => {
        if (!error) return next();
        return res.status(400).render("layouts/layout", {
            title: "Edit Current Affairs Course | DNS Admin",
            page: "../current_affairs/current_affairs_form",
            error: error.message,
            courseId: req.params.id,
            formData: req.body || {}
        });
    }),
    updateCurrentAffairs
);

currentAffairsRoutes.post("/current-affairs/:id/delete", removeCurrentAffairs);

export default currentAffairsRoutes;
