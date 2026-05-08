import { Router } from "express";
import { requireAuth } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

// ─── WhatsApp Client State ──────────────────────────────────────────

interface WaState {
    status: "disconnected" | "connecting" | "qr_ready" | "authenticated" | "ready" | "error";
    qr: string | null;
    errorMsg: string | null;
    clientPhone: string | null;
}

let waState: WaState = {
    status: "disconnected",
    qr: null,
    errorMsg: null,
    clientPhone: null,
};

let waClient: any = null;

// ─── Lazy-load whatsapp-web.js to avoid crash if not installed ──────

async function getWaClient() {
    const { Client, LocalAuth } = await import("whatsapp-web.js");
    return { Client, LocalAuth };
}

// ─── Initialize ─────────────────────────────────────────────────────

async function initWhatsApp() {
    if (waState.status === "ready" || waState.status === "connecting" || waState.status === "qr_ready") return;

    waState = { status: "connecting", qr: null, errorMsg: null, clientPhone: null };

    const { Client, LocalAuth } = await getWaClient();

    waClient = new Client({
        authStrategy: new LocalAuth({ dataPath: ".wa-session" }),
        puppeteer: {
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
        },
    });

    waClient.on("qr", (qr: string) => {
        waState.status = "qr_ready";
        waState.qr = qr;
        console.log("[WhatsApp] QR code ready — scan it from the Clinic Settings or WhatsApp page.");
    });

    waClient.on("authenticated", () => {
        waState.status = "authenticated";
        waState.qr = null;
        console.log("[WhatsApp] Authenticated");
    });

    waClient.on("ready", async () => {
        waState.status = "ready";
        waState.qr = null;
        try {
            const info = waClient.info;
            waState.clientPhone = info?.wid?.user || null;
        } catch {}
        console.log("[WhatsApp] Client ready. Phone:", waState.clientPhone);
    });

    waClient.on("disconnected", (reason: string) => {
        waState = { status: "disconnected", qr: null, errorMsg: reason, clientPhone: null };
        waClient = null;
        console.log("[WhatsApp] Disconnected:", reason);
    });

    waClient.on("auth_failure", (msg: string) => {
        waState = { status: "error", qr: null, errorMsg: msg, clientPhone: null };
        waClient = null;
    });

    await waClient.initialize();
}

// ─── Send helper (exported for internal use) ────────────────────────

export async function sendWhatsApp(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
    if (!waClient || waState.status !== "ready") {
        return { ok: false, error: "WhatsApp not connected" };
    }
    // Normalize phone: strip non-digits, append @c.us
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) return { ok: false, error: "Invalid phone number" };
    const chatId = `${digits}@c.us`;
    try {
        await waClient.sendMessage(chatId, message);
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e.message };
    }
}

// ─── Routes ─────────────────────────────────────────────────────────

// GET /api/whatsapp/status
router.get("/status", (_req, res) => {
    res.json({ status: waState.status, qr: waState.qr, clientPhone: waState.clientPhone, error: waState.errorMsg });
});

// POST /api/whatsapp/connect — start the client
router.post("/connect", async (_req, res) => {
    try {
        await initWhatsApp();
        res.json({ message: "Connecting…", status: waState.status });
    } catch (e: any) {
        waState = { status: "error", qr: null, errorMsg: e.message, clientPhone: null };
        res.status(500).json({ error: e.message });
    }
});

// POST /api/whatsapp/disconnect
router.post("/disconnect", async (_req, res) => {
    if (waClient) {
        await waClient.destroy().catch(() => {});
        waClient = null;
    }
    waState = { status: "disconnected", qr: null, errorMsg: null, clientPhone: null };
    res.json({ message: "Disconnected" });
});

// POST /api/whatsapp/send — send an arbitrary message
router.post("/send", async (req, res) => {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: "phone and message required" });
    const result = await sendWhatsApp(phone, message);
    if (result.ok) res.json({ success: true });
    else res.status(503).json({ error: result.error });
});

// POST /api/whatsapp/send-appointment-reminder
router.post("/send-appointment-reminder", async (req, res) => {
    const { patientName, phone, doctorName, date, time, clinicName } = req.body;
    if (!phone || !patientName) return res.status(400).json({ error: "phone and patientName required" });
    const msg =
        `Hello ${patientName},\n\n` +
        `This is a reminder for your appointment at *${clinicName || "the clinic"}*.\n` +
        `📅 Date: ${date}\n⏰ Time: ${time}\n👨‍⚕️ Doctor: ${doctorName || "your doctor"}\n\n` +
        `Please reply to confirm or call us to reschedule. Thank you!`;
    const result = await sendWhatsApp(phone, msg);
    if (result.ok) res.json({ success: true });
    else res.status(503).json({ error: result.error });
});

// POST /api/whatsapp/send-recall-reminder
router.post("/send-recall-reminder", async (req, res) => {
    const { patientName, phone, recallType, dueDate, clinicName } = req.body;
    if (!phone || !patientName) return res.status(400).json({ error: "phone and patientName required" });
    const msg =
        `Hello ${patientName},\n\n` +
        `We'd like to remind you that your *${recallType || "check-up"}* is due.\n` +
        `📅 Due: ${dueDate}\n\n` +
        `Please contact *${clinicName || "the clinic"}* to schedule your appointment. Thank you!`;
    const result = await sendWhatsApp(phone, msg);
    if (result.ok) res.json({ success: true });
    else res.status(503).json({ error: result.error });
});

export { router as whatsappRouter };
