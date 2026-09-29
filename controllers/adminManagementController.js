import bcrypt from "bcrypt";

import {
    createAdmin,
    deleteAdminById,
    listAdmins
} from "../models/adminModel.js";

const normalizePhone = (value) => {
    return String(value || "")
        .replace(/\D/g, "")
        .slice(-10);
};

const showAdmins = async (
    req,
    res
) => {
    try {
        return res.render(
            "layouts/layout",
            {
                title: "Administrators | DNS Admin",

                page: "../admins/index",

                admins: await listAdmins(),

                saved:
                    req.query.saved === "1",

                deleted:
                    req.query.deleted === "1",

                error:
                    req.query.error || null,

                currentAdminId:
                    req.admin?.admin_id || null
            }
        );
    } catch (error) {
        console.error(
            "Admin list error:",
            error
        );

        return res
            .status(500)
            .send(
                "Unable to load administrators"
            );
    }
};

const addAdmin = async (
    req,
    res
) => {
    try {
        const name = String(
            req.body.name || ""
        ).trim();

        const phone = normalizePhone(
            req.body.phoneNumber
        );

        const password = String(
            req.body.password || ""
        );

        const role = String(
            req.body.role || "ADMIN"
        ).toUpperCase();

        if (
            !name ||
            !/^\d{10}$/.test(phone)
        ) {
            throw new Error(
                "Name and a valid 10-digit phone number are required"
            );
        }

        if (password.length < 8) {
            throw new Error(
                "Password must be at least 8 characters"
            );
        }

        /*
         * Only these two roles are allowed.
         */
        if (
            ![
                "ADMIN",
                "SUPER_ADMIN"
            ].includes(role)
        ) {
            throw new Error(
                "Invalid administrator role"
            );
        }

        await createAdmin({
            name,
            phone,

            passwordHash:
                await bcrypt.hash(
                    password,
                    12
                ),

            role
        });

        return res.redirect(
            "/admins?saved=1"
        );

    } catch (error) {

        console.error(
            "Create admin error:",
            error
        );

        const message =
            error.code === "ER_DUP_ENTRY"
                ? "That administrator phone number already exists"
                : error.message;

        return res.redirect(
            `/admins?error=${encodeURIComponent(
                message ||
                "Unable to add administrator"
            )}`
        );
    }
};

const removeAdmin = async (
    req,
    res
) => {
    try {

        const adminId = Number(
            req.params.id
        );

        if (
            !Number.isInteger(adminId) ||
            adminId <= 0
        ) {
            return res.redirect(
                `/admins?error=${encodeURIComponent(
                    "Invalid administrator"
                )}`
            );
        }

        /*
         * req.admin.admin_id comes from
         * the authenticated admin session.
         *
         * This prevents a Super Admin from
         * deleting his own account.
         */
        await deleteAdminById(
            adminId,
            req.admin?.admin_id
        );

        return res.redirect(
            "/admins?deleted=1"
        );

    } catch (error) {

        console.error(
            "Delete admin error:",
            error
        );

        let message =
            "Unable to delete administrator";

        if (
            error.code ===
            "CANNOT_DELETE_SELF"
        ) {
            message =
                "You cannot delete your own administrator account";
        }

        if (
            error.code ===
            "ADMIN_NOT_FOUND"
        ) {
            message =
                "Administrator not found";
        }

        return res.redirect(
            `/admins?error=${encodeURIComponent(
                message
            )}`
        );
    }
};

export {
    addAdmin,
    removeAdmin,
    showAdmins
};