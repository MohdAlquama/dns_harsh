import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import { getDashboard } from "./routes/dashboardRoutes.js";

import authRoutes from "./routes/authRoutes.js";

import authConfigRoutes from "./routes/authConfigRoutes.js";
import { showAuthSettings } from "./controllers/authConfigController.js";

import currentAffairsRoutes from "./routes/currentAffairsRoutes.js";
import currentAffairsApiRoutes from "./routes/currentAffairsApiRoutes.js";

import adRoutes from "./routes/adRoutes.js";
import apiCors from "./middleware/apiCors.js";

import paymentRoutes from "./routes/paymentRoutes.js";
import paymentAdminRoutes from "./routes/paymentAdminRoutes.js";
import { showPaymentReturn } from "./controllers/paymentController.js";
import protectPaidDocument from "./middleware/protectPaidDocument.js";

import adminAuthRoutes from "./routes/adminAuthRoutes.js";
import adminManagementRoutes from "./routes/adminManagementRoutes.js";
import { requireAdmin } from "./middleware/adminAuth.js";

import socialMediaRoutes from "./routes/socialMediaRoutes.js";
import adminSearchRoutes from "./routes/adminSearchRoutes.js";
import userRoutes from "./routes/userRoutes.js";

import catalogAdminRoutes from "./routes/catalogAdminRoutes.js";
import catalogApiRoutes from "./routes/catalogApiRoutes.js";

import notificationRoutes from "./routes/notificationRoutes.js";
import notificationAdminRoutes from "./routes/notificationAdminRoutes.js";

import appVersionRoutes from "./routes/appVersionRoutes.js";
import appVersionPageRoutes from "./routes/appVersionPageRoutes.js";

import courseOrganizationRoutes from "./routes/courseOrganizationRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import courseApiRoutes from "./routes/courseApiRoutes.js";
import coursePaymentRoutes from "./routes/coursePaymentRoutes.js";
import courseLearningRoutes from "./routes/courseLearningRoutes.js";

import createAuthTables from "./models/authTable.js";
import createOtpTable from "./models/otpTable.js";
import createRefreshTokenTable from "./models/refreshTokenTable.js";
import createAuthConfigTable from "./models/authConfigTable.js";
import createCurrentAffairsTables from "./models/currentAffairsTables.js";
import createAwsConfigurationTable from "./models/createAwsConfigurationTable.js";
import createAdTables from "./models/adTables.js";
import createPaymentTables from "./models/paymentTables.js";
import createAdminTables from "./models/adminTables.js";
import createSocialMediaTables from "./models/socialMediaTables.js";
import createFcmTokenTable from "./models/fcmTokenTable.js";
import createAppVersionTables from "./models/appVersionTables.js";
import createCatalogProductTables from "./models/catalogProductTables.js";
import createCourseFolderTables from "./models/createCourseFolderTables.js";
import createCourseTables from "./models/courseTables.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use("/uploads/current-affairs", protectPaidDocument);
app.use(express.static(path.join(__dirname, "public")));

app.use(
  express.json({
    verify: (req, _res, buffer) => {
      if (req.originalUrl === "/api/v1/payments/webhook") {
        req.rawBody = buffer.toString("utf8");
      }
    }
  })
);

app.use(express.urlencoded({ extended: true }));
app.use("/api", apiCors);

app.use("/admin", adminAuthRoutes);
app.use("/", socialMediaRoutes);

app.use("/app-versions", appVersionPageRoutes);
app.use("/api/v1/app-version", appVersionRoutes);

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/ads", adRoutes);

app.use("/api/v1/current-affairs", currentAffairsApiRoutes);

app.use("/api/v1/payments", paymentRoutes);
app.get("/payment/return", showPaymentReturn);

app.use("/organization", requireAdmin, courseOrganizationRoutes);

// All API routes must come before catch-all "/" admin routes
app.use("/api/v1", catalogApiRoutes);
app.use("/api/v1", courseApiRoutes);
app.use("/api/v1/course-payments", coursePaymentRoutes);

// Admin HTML routes
app.use("/", requireAdmin, currentAffairsRoutes);
app.use("/", requireAdmin, catalogAdminRoutes);

app.use("/api/notifications", notificationRoutes);
app.use("/", notificationAdminRoutes);

app.use("/dashboard", requireAdmin, getDashboard);
app.use("/api/v1/auth-config", requireAdmin, authConfigRoutes);
app.get("/auth-settings", requireAdmin, showAuthSettings);

app.use("/api/v1/admin", requireAdmin, adminSearchRoutes);

app.use("/", requireAdmin, paymentAdminRoutes);
app.use("/", requireAdmin, adminManagementRoutes);
app.use("/", requireAdmin, userRoutes);


app.use("/", courseLearningRoutes);


app.use("/", courseRoutes);

app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

const initializeDatabase = async () => {
  await createAuthTables();
  await createOtpTable();
  await createRefreshTokenTable();
  await createAuthConfigTable();
  await createAdminTables();
  await createCurrentAffairsTables();
  await createCatalogProductTables();
  await createAdTables();
  await createPaymentTables();
  await createSocialMediaTables();
  await createFcmTokenTable();
  await createAppVersionTables();
  await createAwsConfigurationTable();
  await createCourseFolderTables();
  await createCourseTables();
};

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();