import { Router } from "express";
import { requireAuth, requireRole } from "../auth/index.js";
import {
    demoSettings, demoPatients, demoVisits, demoAppointments,
    demoBillings, demoRecalls, demoFollowUps, demoReferrals,
} from "../../demo-store.js";
import os from "os";
import path from "path";
import fs from "fs";

const router = Router();
router.use(requireAuth);

// Server info (non-DB, keep original logic)
router.get("/server-info", requireRole("admin"), (_req, res) => {
    const interfaces = os.networkInterfaces();
    const addresses: { name: string; address: string; family: string }[] = [];
    for (const [name, nets] of Object.entries(interfaces)) {
        if (!nets) continue;
        for (const net of nets) {
            if (!net.internal && net.family === "IPv4") {
                addresses.push({ name, address: net.address, family: net.family });
            }
        }
    }
    const port = process.env.PORT || "3002";
    const uiPort = process.env.UI_PORT || "5175";
    const hostname = os.hostname();
    const certPath = path.join(process.cwd(), "certs", "cert.pem");
    const httpsEnabled = fs.existsSync(certPath);
    res.json({
        hostname, port, uiPort, addresses,
        accessUrls: addresses.map((a) => `http://${a.address}:${uiPort}`),
        httpsUrls: httpsEnabled ? addresses.map((a) => `https://${a.address}:${uiPort}`) : [],
    });
});

// Get all settings
router.get("/", (_req, res) => {
    res.json({ ...demoSettings });
});

// Update settings
router.put("/", requireRole("admin"), (req, res) => {
    const entries = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(entries)) {
        demoSettings[key] = value;
    }
    res.json({ ...demoSettings });
});

// Backup: export all in-memory data as JSON
router.get("/backup", requireRole("admin"), (_req, res) => {
    const payload = {
        exportedAt: new Date().toISOString(),
        version: 1,
        data: {
            settings: { ...demoSettings },
            patients: demoPatients,
            visits: demoVisits,
            appointments: demoAppointments,
            billings: demoBillings,
            recalls: demoRecalls,
            followUps: demoFollowUps,
            referrals: demoReferrals,
        },
    };
    const filename = `dental-backup-${new Date().toISOString().split("T")[0]}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.json(payload);
});

router.post("/restore", requireRole("admin"), (_req, res) => {
    res.json({ message: "Restore not available in demo mode — contact your system administrator to restore from a backup file." });
});

export { router as settingsRouter };
