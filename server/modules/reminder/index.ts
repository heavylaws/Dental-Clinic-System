// ─── Reminder Module — Phase 5A ──────────────────────────────────────────────
// Manual send + notification log.
// No cron/scheduled automation (deferred to Phase 5B).
//
// Known limitations:
// - Reminder log uses in-memory demo-store style persistence (no DB migration in 5A).
// - SMS and email channels are stubs; only WhatsApp is attempted via the existing
//   whatsapp-web.js client (if connected).
// - Backend WhatsApp delivery requires the WhatsApp client to be connected and
//   authenticated (via /api/whatsapp/connect). If not connected, a "stubbed" log
//   entry is created with a wa.me URL in the response instead.
// - Patient opt-in/out preference fields are not yet in the schema; sending is
//   not blocked by opt-out in this phase (TODO: Phase 5C patient preferences).

import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../auth/index.js";
import { demoAppointments, demoPatients, demoSettings } from "../../demo-store.js";
import { sendWhatsApp } from "../whatsapp/index.js";

const router = Router();
router.use(requireAuth);

// ─── ReminderLog type ─────────────────────────────────────────────────────────

export interface ReminderLog {
    id: string;
    appointmentId: string;
    patientId: string | null;
    patientName: string;
    phone: string | null;
    channel: "whatsapp" | "sms" | "email";
    status: "sent" | "failed" | "stubbed" | "not_configured";
    message: string;
    error?: string;
    waUrl?: string;
    sentAt: string;
    appointmentDate: string;
    timeSlot: string;
}

// ─── In-memory log store ──────────────────────────────────────────────────────
// TODO Phase 5C: replace with a real DB table via Drizzle migration.

export const demoReminderLogs: ReminderLog[] = [];

// ─── Default message builder ──────────────────────────────────────────────────

function buildReminderMessage(patientName: string, appointmentDate: string, timeSlot: string): string {
    return (
        `Hello ${patientName}, this is a reminder for your dental appointment on ` +
        `${appointmentDate} at ${timeSlot}. Please contact us if you need to reschedule.`
    );
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/reminders/logs
// Query: appointmentId?, patientId?, status?, from?, to?
// Returns logs sorted newest first.
router.get("/logs", (req, res) => {
    const { appointmentId, patientId, status, from, to } = req.query as Record<string, string>;

    let logs = [...demoReminderLogs];

    if (appointmentId) logs = logs.filter((l) => l.appointmentId === appointmentId);
    if (patientId) logs = logs.filter((l) => l.patientId === patientId);
    if (status) logs = logs.filter((l) => l.status === status);
    if (from) logs = logs.filter((l) => l.sentAt >= from);
    if (to) {
        const toEnd = to.length === 10 ? to + "T23:59:59.999Z" : to;
        logs = logs.filter((l) => l.sentAt <= toEnd);
    }

    // Newest first
    logs.sort((a, b) => b.sentAt.localeCompare(a.sentAt));

    res.json(logs);
});

// POST /api/reminders/send
// Body: { appointmentId: string, channel?: "whatsapp"|"sms"|"email", message?: string }
router.post("/send", async (req, res) => {
    const body = req.body || {};
    const appointmentId: string = String(body.appointmentId || "").trim();
    const channel: "whatsapp" | "sms" | "email" =
        body.channel === "sms" || body.channel === "email" ? body.channel : "whatsapp";
    const customMessage: string | undefined =
        body.message ? String(body.message).trim() : undefined;

    if (!appointmentId) {
        return res.status(400).json({ success: false, message: "appointmentId is required" });
    }

    // ── Find appointment ──
    const appt = demoAppointments.find((a) => a.id === appointmentId);
    if (!appt) {
        return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    // ── Find patient ──
    const patient = demoPatients.find((p) => p.id === appt.patientId);
    const patientName: string = patient
        ? `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() || "Patient"
        : "Patient";
    const phone: string | null = patient?.phone || null;

    const message = customMessage || buildReminderMessage(patientName, appt.appointmentDate, appt.timeSlot);

    // ── No phone ──
    if (!phone) {
        const log: ReminderLog = {
            id: uuidv4(),
            appointmentId,
            patientId: patient?.id ?? null,
            patientName,
            phone: null,
            channel,
            status: "failed",
            message,
            error: "Patient phone number is missing",
            sentAt: new Date().toISOString(),
            appointmentDate: appt.appointmentDate,
            timeSlot: appt.timeSlot,
        };
        demoReminderLogs.push(log);
        return res.status(400).json({
            success: false,
            message: "Patient phone number is missing. Reminder was not sent.",
            log,
        });
    }

    // ── Channel dispatch ──

    if (channel === "sms") {
        // SMS stub — not configured in Phase 5A
        const log: ReminderLog = {
            id: uuidv4(),
            appointmentId,
            patientId: patient?.id ?? null,
            patientName,
            phone,
            channel: "sms",
            status: "not_configured",
            message,
            error: "SMS provider not configured (Phase 5A stub)",
            sentAt: new Date().toISOString(),
            appointmentDate: appt.appointmentDate,
            timeSlot: appt.timeSlot,
        };
        demoReminderLogs.push(log);
        return res.json({
            success: false,
            message: "SMS channel is not configured in Phase 5A. Log entry created.",
            log,
        });
    }

    if (channel === "email") {
        // Email stub — not configured in Phase 5A
        const log: ReminderLog = {
            id: uuidv4(),
            appointmentId,
            patientId: patient?.id ?? null,
            patientName,
            phone,
            channel: "email",
            status: "not_configured",
            message,
            error: "Email provider not configured (Phase 5A stub)",
            sentAt: new Date().toISOString(),
            appointmentDate: appt.appointmentDate,
            timeSlot: appt.timeSlot,
        };
        demoReminderLogs.push(log);
        return res.json({
            success: false,
            message: "Email channel is not configured in Phase 5A. Log entry created.",
            log,
        });
    }

    // ── WhatsApp ──
    // Try real backend send via whatsapp-web.js client.
    // If not connected, fall back to a "stubbed" log with a wa.me URL.

    const digits = phone.replace(/\D/g, "");
    const clinicName: string =
        demoSettings.clinic_name || demoSettings.clinicName || "the clinic";

    const waResult = await sendWhatsApp(phone, message);

    if (waResult.ok) {
        const log: ReminderLog = {
            id: uuidv4(),
            appointmentId,
            patientId: patient?.id ?? null,
            patientName,
            phone,
            channel: "whatsapp",
            status: "sent",
            message,
            sentAt: new Date().toISOString(),
            appointmentDate: appt.appointmentDate,
            timeSlot: appt.timeSlot,
        };
        demoReminderLogs.push(log);
        return res.json({
            success: true,
            message: `WhatsApp reminder sent to ${patientName}.`,
            log,
        });
    }

    // WhatsApp not connected or failed — create stubbed log with wa.me URL
    // DO NOT claim delivery. Provide wa.me URL so staff can send manually.
    const encodedText = encodeURIComponent(message);
    const waUrl = `https://wa.me/${digits}?text=${encodedText}`;

    const log: ReminderLog = {
        id: uuidv4(),
        appointmentId,
        patientId: patient?.id ?? null,
        patientName,
        phone,
        channel: "whatsapp",
        status: "stubbed",
        message,
        error: waResult.error || "WhatsApp client not connected",
        waUrl,
        sentAt: new Date().toISOString(),
        appointmentDate: appt.appointmentDate,
        timeSlot: appt.timeSlot,
    };
    demoReminderLogs.push(log);

    // 200 (not 5xx) — staff can use the waUrl to send manually
    return res.json({
        success: false,
        message: `WhatsApp client is not connected. Use the link below to send manually via WhatsApp Web.`,
        waUrl,
        clinicName,
        log,
    });
});

export { router as reminderRouter };
