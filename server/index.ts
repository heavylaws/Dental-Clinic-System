import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import { createServer } from "http";
import { createServer as createHttpsServer } from "https";
import fs from "fs";
import { authRouter, setupPassport } from "./modules/auth/index.js";
import { patientRouter } from "./modules/patient/index.js";
import { visitRouter } from "./modules/visit/index.js";
import { autocompleteRouter } from "./modules/autocomplete/index.js";
import { billingRouter } from "./modules/billing/index.js";
import { reportRouter } from "./modules/report/index.js";
import { appointmentRouter } from "./modules/appointment/index.js";
import { imageRouter } from "./modules/images/index.js";
import { userRouter } from "./modules/user/index.js";
import { settingsRouter } from "./modules/settings/index.js";
import { followUpRouter } from "./modules/followup/index.js";
import { referralRouter } from "./modules/referral/index.js";
import { aiRouter } from "./modules/ai/index.js";
import { dentalChartRouter } from "./modules/dental_chart/index.js";
import { treatmentPlanRouter } from "./modules/treatment_plan/index.js";
import { procedureCatalogRouter } from "./modules/procedure_catalog/index.js";
import { recallsRouter } from "./modules/recalls/index.js";
import { whatsappRouter } from "./modules/whatsapp/index.js";
import { setupWebSocket } from "./ws.js";
import { createAuditMiddleware, auditLog } from "./audit.js";
import { demoSettings } from "./demo-store.js";
import { initPersistence, isPersistenceEnabled, persistState } from "./persistence.js";
import path from "path";

const app = express();
const server = createServer(app);

// ─── Middleware ──────────────────────────────────────────────────────

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// Persist in-memory data to PostgreSQL after successful write operations.
app.use((req, res, next) => {
    const shouldPersist =
        ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
        req.path.startsWith("/api/") &&
        !req.path.startsWith("/api/auth/");

    if (shouldPersist) {
        res.on("finish", () => {
            if (res.statusCode < 400) {
                void persistState();
            }
        });
    }

    next();
});

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || "dermclinic-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
        httpOnly: true,
        secure: false, // local network only
    },
});

app.use(sessionMiddleware);
setupPassport(app);

// ─── Audit Middleware ───────────────────────────────────────────────
app.use(createAuditMiddleware());

// ─── API Routes ─────────────────────────────────────────────────────

app.use("/api/auth", authRouter);
app.use("/api/patients", patientRouter);
app.use("/api/visits", visitRouter);
app.use("/api/autocomplete", autocompleteRouter);
app.use("/api/billing", billingRouter);
app.use("/api/reports", reportRouter);
app.use("/api/appointments", appointmentRouter);
app.use("/api/images", imageRouter);
app.use("/api/users", userRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/followups", followUpRouter);
app.use("/api/referrals", referralRouter);
app.use("/api/ai", aiRouter);
app.use("/api/dental-charts", dentalChartRouter);
app.use("/api/treatment-plans", treatmentPlanRouter);
app.use("/api/procedure-catalog", procedureCatalogRouter);
app.use("/api/recalls", recallsRouter);
app.use("/api/whatsapp", whatsappRouter);

// ─── Static file serving for uploads ────────────────────────────────

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Public branding (used by login/startup screens before auth)
app.get("/api/public/branding", (_req, res) => {
    res.json({
        clinicName: demoSettings.clinic_name || demoSettings.clinicName || "DentalClinic",
        clinicIcon: demoSettings.clinic_icon || "🦷",
        clinicSubtitle:
            demoSettings.clinic_subtitle ||
            demoSettings.clinicSubtitle ||
            "Dental Practice Management System",
    });
});

// ─── Health check ───────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        persistence: isPersistenceEnabled() ? "postgres" : "memory",
    });
});

// ─── Audit Log endpoint (admin only) ────────────────────────────────

app.get("/api/audit-log", (req: any, res) => {
    if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const limit = parseInt(req.query.limit as string) || 100;
    const resource = req.query.resource as string;
    let entries = auditLog;
    if (resource) entries = entries.filter((e) => e.resourceType.toLowerCase() === resource.toLowerCase());
    res.json(entries.slice(0, limit));
});

// ─── WebSocket ──────────────────────────────────────────────────────

setupWebSocket(server);

// ─── Start ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3002");
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || "3443");

void initPersistence();

server.listen(PORT, "0.0.0.0", () => {
    console.log(`🩺 DermClinic server running on http://0.0.0.0:${PORT}`);
});

// ─── HTTPS (needed for camera access from phones on LAN) ────────────

const certPath = path.join(process.cwd(), "certs", "cert.pem");
const keyPath = path.join(process.cwd(), "certs", "key.pem");

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const httpsServer = createHttpsServer(
        {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath),
        },
        app
    );

    setupWebSocket(httpsServer);

    httpsServer.listen(HTTPS_PORT, "0.0.0.0", () => {
        console.log(`🔒 DermClinic HTTPS running on https://0.0.0.0:${HTTPS_PORT}`);
        console.log(`📱 Use https://<server-ip>:${HTTPS_PORT} from phones for camera access`);
    });
} else {
    console.log("⚠️  No SSL certs found in certs/ — HTTPS disabled (camera won't work on phones)");
    console.log("   Run: openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 3650 -nodes -subj '/CN=DermClinic'");
}
