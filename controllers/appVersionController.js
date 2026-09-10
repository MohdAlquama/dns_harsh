import {
    createAppVersion,
    getAppVersionById,
    getAllAppVersions,
    getActiveAppVersion,
    updateAppVersion,
    deleteAppVersion,
    setAppVersionActive
} from "../models/appVersionModel.js";


const validateAppVersionData = (data) => {
    const {
        platform,
        versionName,
        versionCode,
        minimumVersionCode,
        title
    } = data;

    if (!platform) {
        return "Platform is required";
    }

    if (!["ANDROID", "IOS", "BOTH"].includes(platform)) {
        return "Invalid platform";
    }

    if (!versionName) {
        return "Version name is required";
    }

    if (
        versionCode === undefined ||
        versionCode === null ||
        Number(versionCode) < 1
    ) {
        return "Valid version code is required";
    }

    if (
        minimumVersionCode === undefined ||
        minimumVersionCode === null ||
        Number(minimumVersionCode) < 1
    ) {
        return "Valid minimum version code is required";
    }

    if (Number(minimumVersionCode) > Number(versionCode)) {
        return "Minimum version code cannot be greater than version code";
    }

    if (!title) {
        return "Title is required";
    }

    return null;
};


const addAppVersion = async (req, res) => {
    try {
        const validationError = validateAppVersionData(req.body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const id = await createAppVersion(req.body);

        const appVersion = await getAppVersionById(id);

        return res.status(201).json({
            success: true,
            message: "App version created successfully",
            data: appVersion
        });
    } catch (error) {
        console.error("Add app version error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create app version"
        });
    }
};


const getAppVersions = async (req, res) => {
    try {
        const appVersions = await getAllAppVersions();

        return res.status(200).json({
            success: true,
            data: appVersions
        });
    } catch (error) {
        console.error("Get app versions error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch app versions"
        });
    }
};


const getAppVersion = async (req, res) => {
    try {
        const { id } = req.params;

        const appVersion = await getAppVersionById(id);

        if (!appVersion) {
            return res.status(404).json({
                success: false,
                message: "App version not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: appVersion
        });
    } catch (error) {
        console.error("Get app version error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch app version"
        });
    }
};



const checkAppVersion = async (req, res) => {
    try {
        const { platform } = req.query;

        const currentVersionCode = Number(
            req.query.versionCode
        );

        if (!platform) {
            return res.status(400).json({
                success: false,
                message: "Platform is required"
            });
        }

        if (!["ANDROID", "IOS"].includes(platform)) {
            return res.status(400).json({
                success: false,
                message: "Invalid platform"
            });
        }

        if (
            !Number.isInteger(currentVersionCode) ||
            currentVersionCode < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid version code is required"
            });
        }

        const latestVersion =
            await getActiveAppVersion(platform);

        if (!latestVersion) {
            return res.status(200).json({
                success: true,
                updateAvailable: false,
                forceUpdate: false,
                skipAllowed: false,
                data: null
            });
        }

        const updateAvailable =
            currentVersionCode <
            Number(latestVersion.version_code);

        const forceUpdate =
            currentVersionCode <
            Number(latestVersion.minimum_version_code);

        return res.status(200).json({
            success: true,
            updateAvailable,
            forceUpdate,
            skipAllowed:
                Boolean(latestVersion.skip_allowed),

            data: {
                id: latestVersion.id,

                platform:
                    latestVersion.platform,

                versionName:
                    latestVersion.version_name,

                versionCode:
                    latestVersion.version_code,

                minimumVersionCode:
                    latestVersion.minimum_version_code,

                title:
                    latestVersion.title,

                description:
                    latestVersion.description,

                screen:
                    latestVersion.screen,

                buttonType:
                    latestVersion.button_type,

                buttonName:
                    latestVersion.button_name,

                buttonUrl:
                    latestVersion.button_url
            }
        });
    } catch (error) {
        console.error(
            "Check app version error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to check app version"
        });
    }
};
     

const editAppVersion = async (req, res) => {
    try {
        const { id } = req.params;

        const validationError = validateAppVersionData(req.body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const existingVersion = await getAppVersionById(id);

        if (!existingVersion) {
            return res.status(404).json({
                success: false,
                message: "App version not found"
            });
        }

        const updated = await updateAppVersion(id, req.body);

        if (!updated) {
            return res.status(400).json({
                success: false,
                message: "App version was not updated"
            });
        }

        const appVersion = await getAppVersionById(id);

        return res.status(200).json({
            success: true,
            message: "App version updated successfully",
            data: appVersion
        });
    } catch (error) {
        console.error("Update app version error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update app version"
        });
    }
};


const removeAppVersion = async (req, res) => {
    try {
        const { id } = req.params;

        const existingVersion = await getAppVersionById(id);

        if (!existingVersion) {
            return res.status(404).json({
                success: false,
                message: "App version not found"
            });
        }

        await deleteAppVersion(id);

        return res.status(200).json({
            success: true,
            message: "App version deleted successfully"
        });
    } catch (error) {
        console.error("Delete app version error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete app version"
        });
    }
};


const toggleAppVersion = async (req, res) => {
    try {
        const { id } = req.params;

        const existingVersion = await getAppVersionById(id);

        if (!existingVersion) {
            return res.status(404).json({
                success: false,
                message: "App version not found"
            });
        }

        const isActive = !Boolean(existingVersion.is_active);

        await setAppVersionActive(id, isActive);

        const appVersion = await getAppVersionById(id);

        return res.status(200).json({
            success: true,
            message: isActive
                ? "App version activated successfully"
                : "App version deactivated successfully",
            data: appVersion
        });
    } catch (error) {
        console.error("Toggle app version error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to change app version status"
        });
    }
};


export {
    addAppVersion,
    getAppVersions,
    getAppVersion,
    checkAppVersion,
    editAppVersion,
    removeAppVersion,
    toggleAppVersion
};
