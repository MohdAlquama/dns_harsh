import bcrypt from "bcrypt";
import { createAdmin, listAdmins } from "../models/adminModel.js";

const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(-10);

const showAdmins = async (req, res) => {
    try {
        return res.render("layouts/layout", {
            title: "Administrators | DNS Admin", page: "../admins/index", admins: await listAdmins(),
            saved: req.query.saved === "1", error: req.query.error || null
        });
    } catch (error) {
        console.error("Admin list error:", error);
        return res.status(500).send("Unable to load administrators");
    }
};

const addAdmin = async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const phone = normalizePhone(req.body.phoneNumber);
        const password = String(req.body.password || "");
        if (!name || !/^\d{10}$/.test(phone)) throw new Error("Name and a valid 10-digit phone number are required");
        if (password.length < 8) throw new Error("Password must be at least 8 characters");
        await createAdmin({ name, phone, passwordHash: await bcrypt.hash(password, 12), role: "ADMIN" });
        return res.redirect("/admins?saved=1");
    } catch (error) {
        console.error("Create admin error:", error);
        const message = error.code === "ER_DUP_ENTRY" ? "That administrator phone number already exists" : error.message;
        return res.redirect(`/admins?error=${encodeURIComponent(message || "Unable to add administrator")}`);
    }
};

export { addAdmin, showAdmins };
