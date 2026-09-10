import {
    createAppVersion,
    deleteAppVersion,
    getAllAppVersions,
    getAppVersionById,
    setAppVersionActive,
    updateAppVersion
} from "../models/appVersionModel.js";

const parseId = (value) => {
    const id = Number.parseInt(value, 10);

    return Number.isInteger(id) && id > 0
        ? id
        : null;
};

const buildFormData = (data = {}) => {
    return {
        platform: data.platform || "ANDROID",
        versionName: data.versionName || data.version_name || "",
        versionCode: data.versionCode || data.version_code || "",
        minimumVersionCode:
            data.minimumVersionCode ||
            data.minimum_version_code ||
            "",
        title: data.title || "",
        description: data.description || "",
        skipAllowed:
            data.skipAllowed ??
            data.skip_allowed ??
            1,
        scheduleDate:
            data.scheduleDate ||
            data.schedule_date ||
            "",
        screen: data.screen || "ALL",
        imagePath:
            data.imagePath ||
            data.image_path ||
            "",
        logoPath:
            data.logoPath ||
            data.logo_path ||
            "",
        buttonType:
            data.buttonType ||
            data.button_type ||
            "UPDATE",
        buttonName:
            data.buttonName ||
            data.button_name ||
            "Update Now",
        buttonUrl:
            data.buttonUrl ||
            data.button_url ||
            "",
        isActive:
            data.isActive ??
            data.is_active ??
            0
    };
};

const renderForm = (
    res,
    {
        status = 200,
        error = null,
        versionId = null,
        formData = {}
    } = {}
) => {
    return res.status(status).render("layouts/layout", {
        title: `${versionId ? "Edit" : "New"} App Version | DNS Admin`,
        page: "../app_versions/form",
        error,
        versionId,
        formData: buildFormData(formData)
    });
};

const showAppVersionList = async (req, res) => {
    try {
        const versions = await getAllAppVersions();

        return res.render("layouts/layout", {
            title: "App Versions | DNS Admin",
            page: "../app_versions/index",
            versions,
            saved: req.query.saved === "1",
            updated: req.query.updated === "1",
            deleted: req.query.deleted === "1",
            toggled: req.query.toggled === "1",
            error: req.query.error || null
        });
    } catch (error) {
        console.error("App version list error:", error);

        return res.status(500).render("layouts/layout", {
            title: "App Versions | DNS Admin",
            page: "../app_versions/index",
            versions: [],
            saved: false,
            updated: false,
            deleted: false,
            toggled: false,
            error: "Unable to load app versions"
        });
    }
};

const showNewAppVersionForm = (req, res) => {
    return renderForm(res);
};

const showEditAppVersionForm = async (req, res) => {
    const id = parseId(req.params.id);

    if (!id) {
        return res.status(404).send("App version not found");
    }

    try {
        const version = await getAppVersionById(id);

        if (!version) {
            return res.status(404).send("App version not found");
        }

        return renderForm(res, {
            versionId: id,
            formData: version
        });
    } catch (error) {
        console.error("Load app version error:", error);

        return res.status(500).send(
            "Unable to load app version"
        );
    }
};

const addAppVersionPage = async (req, res) => {
    try {
        await createAppVersion({
            platform: req.body.platform,
            versionName: req.body.versionName,
            versionCode: req.body.versionCode,
            minimumVersionCode: req.body.minimumVersionCode,
            title: req.body.title,
            description: req.body.description,
            skipAllowed: req.body.skipAllowed,
            scheduleDate: req.body.scheduleDate,
            screen: req.body.screen,
            imagePath: req.body.imagePath,
            logoPath: req.body.logoPath,
            buttonType: req.body.buttonType,
            buttonName: req.body.buttonName,
            buttonUrl: req.body.buttonUrl,
            isActive: req.body.isActive
        });

        return res.redirect(
            "/app-versions?saved=1"
        );
    } catch (error) {
        console.error(
            "Create app version page error:",
            error
        );

        return renderForm(res, {
            status: 400,
            error: error.message,
            formData: req.body
        });
    }
};

const editAppVersionPage = async (req, res) => {
    const id = parseId(req.params.id);

    if (!id) {
        return res.status(404).send(
            "App version not found"
        );
    }

    try {
        const updated = await updateAppVersion(
            id,
            {
                platform: req.body.platform,
                versionName: req.body.versionName,
                versionCode: req.body.versionCode,
                minimumVersionCode: req.body.minimumVersionCode,
                title: req.body.title,
                description: req.body.description,
                skipAllowed: req.body.skipAllowed,
                scheduleDate: req.body.scheduleDate,
                screen: req.body.screen,
                imagePath: req.body.imagePath,
                logoPath: req.body.logoPath,
                buttonType: req.body.buttonType,
                buttonName: req.body.buttonName,
                buttonUrl: req.body.buttonUrl,
                isActive: req.body.isActive
            }
        );

        if (!updated) {
            return res.status(404).send(
                "App version not found"
            );
        }

        return res.redirect(
            "/app-versions?updated=1"
        );
    } catch (error) {
        console.error(
            "Update app version page error:",
            error
        );

        return renderForm(res, {
            status: 400,
            error: error.message,
            versionId: id,
            formData: req.body
        });
    }
};

const removeAppVersionPage = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (
            !id ||
            !await deleteAppVersion(id)
        ) {
            throw new Error(
                "App version not found"
            );
        }

        return res.redirect(
            "/app-versions?deleted=1"
        );
    } catch (error) {
        return res.redirect(
            `/app-versions?error=${encodeURIComponent(
                error.message
            )}`
        );
    }
};

const toggleAppVersionPage = async (req, res) => {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            throw new Error(
                "App version not found"
            );
        }

        const version = await getAppVersionById(id);

        if (!version) {
            throw new Error(
                "App version not found"
            );
        }

        await setAppVersionActive(
            id,
            !version.is_active
        );

        return res.redirect(
            "/app-versions?toggled=1"
        );
    } catch (error) {
        return res.redirect(
            `/app-versions?error=${encodeURIComponent(
                error.message
            )}`
        );
    }
};

export {
    addAppVersionPage,
    editAppVersionPage,
    removeAppVersionPage,
    showAppVersionList,
    showEditAppVersionForm,
    showNewAppVersionForm,
    toggleAppVersionPage
};