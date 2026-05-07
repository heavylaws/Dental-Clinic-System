import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import { createServer } from "http";
import { createServer as createHttpsServer } from "https";
import fs from "fs";
import { db } from "./db/index.js";
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
import { setupWebSocket } from "./ws.js";
import path from "path";

const app = express();
const server = createServer(app);

// ─── Middleware ──────────────────────────────────────────────────────

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

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

// ─── Static file serving for uploads ────────────────────────────────

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ─── Health check ───────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── WebSocket ──────────────────────────────────────────────────────

setupWebSocket(server);

// ─── Start ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3002");
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || "3443");

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
