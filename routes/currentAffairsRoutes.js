import express from "express";
import { current_affairs_mode_edit, current_affairs_sql_table } from "../controllers/current_affairs.js";

const currentAffairsRoutes = express.Router();

currentAffairsRoutes.get("/current-affairs", (req, res) => {
    res.render("layouts/layout", {
        title: "Current Affairs | DNS Admin",
        page: "../current_affairs/index",
    });
});

currentAffairsRoutes.post("/current-affairs-fresh-form", (req, res) => {
  
    res.render("layouts/layout", {
        title: "Current Affairs | DNS Admin",
        page: "../current_affairs/current_affairs_form",
    });
});


 

// currentAffairsRoutes.post("current-affairs-fresh-form" , )

export default currentAffairsRoutes;