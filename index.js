import express from 'express';
import db from "./config/db.js"
import createAuthTables from "./models/authTable.js";
import path from 'path';
import createOtpTable from "./models/otpTable.js";
import { fileURLToPath } from 'url';
import { getDashboard } from './routes/dashboardRoutes.js';
import currentAffairsRoutes from "./routes/currentAffairsRoutes.js";
import router from './routes/currentAffairsRoutes.js';
import createRefreshTokenTable from "./models/refreshTokenTable.js";
import authRoutes from "./routes/authRoutes.js";
import createAuthConfigTable from "./models/authConfigTable.js";
import authConfigRoutes from "./routes/authConfigRoutes.js";
import { showAuthSettings } from "./controllers/authConfigController.js";
import createCurrentAffairsTables from "./models/currentAffairsTables.js";
import createAdTables from "./models/adTables.js";
import adRoutes from "./routes/adRoutes.js";
import currentAffairsApiRoutes from "./routes/currentAffairsApiRoutes.js";
import apiCors from "./middleware/apiCors.js";
import createPaymentTables from "./models/paymentTables.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import paymentAdminRoutes from "./routes/paymentAdminRoutes.js";
import { showPaymentReturn } from "./controllers/paymentController.js";
import protectPaidDocument from "./middleware/protectPaidDocument.js";
import createAdminTables from "./models/adminTables.js";
import adminAuthRoutes from "./routes/adminAuthRoutes.js";
import adminManagementRoutes from "./routes/adminManagementRoutes.js";
import { requireAdmin } from "./middleware/adminAuth.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();



// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use("/uploads/current-affairs", protectPaidDocument);
app.use(express.static(path.join(__dirname, 'public')));

// Body parsers
app.use(express.json({
  verify: (req, _res, buffer) => {
    if (req.originalUrl === "/api/v1/payments/webhook") req.rawBody = buffer.toString("utf8");
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use("/api", apiCors);

// Routes
app.use("/admin", adminAuthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/ads", adRoutes);
app.use("/api/v1/current-affairs", currentAffairsApiRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.get("/payment/return", showPaymentReturn);
app.use('/dashboard', requireAdmin, getDashboard);
app.use("/", requireAdmin, currentAffairsRoutes);
app.use("/api/v1/auth-config", requireAdmin, authConfigRoutes);
app.use("/", requireAdmin, paymentAdminRoutes);
app.use("/", requireAdmin, adminManagementRoutes);
app.get("/auth-settings", requireAdmin, showAuthSettings);

// Redirect root to dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

await createAuthTables();
await createOtpTable();
await createRefreshTokenTable();
await createAuthConfigTable();
await createAdminTables();
await createCurrentAffairsTables();
await createAdTables();
await createPaymentTables();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
