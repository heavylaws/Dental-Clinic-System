// ─── Reminder Module — Phase 5A + 5B + 5C ────────────────────────────────────
// HTTP router only. Shared types and send logic live in core.ts.
// Scheduler state lives in scheduler.ts.
// Settings and preferences live in settings.ts.

import { Router } from "express";
import { requireAuth, requireRole } from "../auth/index.js";
import { logAuditEvent } from "../../audit.js";
import { demoReminderLogs, sendAppointmentReminder } from "./core.js";
import { getSchedulerState, runReminderSchedulerOnce } from "./scheduler.js";
import {
    getReminderSettings,
    setReminderSettings,
    resetReminderSettings,
    getPatientPreferences,
    setPatientPreferences,
} from "./settings.js";

// Re-export for consumers (e.g. server startup code)
export type { ReminderLog, SendReminderOptions, SendReminderResult } from "./core.js";
export { demoReminderLogs, sendAppointmentReminder } from "./core.js";

const router = Router();
router.use(requireAuth);

// GET /api/reminders/logs
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

    logs.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    res.json(logs);
});

// POST /api/reminders/send  (manual, triggerType: "manual")
router.post("/send", async (req, res) => {
    const body = req.body || {};
    const appointmentId: string = String(body.appointmentId || "").trim();
    if (!appointmentId) {
        return res.status(400).json({ success: false, message: "appointmentId is required" });
    }

    const result = await sendAppointmentReminder({
        appointmentId,
        channel: body.channel,
        message: body.message ? String(body.message).trim() : undefined,
        ruleKey: "manual",
        triggerType: "manual",
    });

    return res.status(result.httpStatus ?? 200).json(result);
});

// GET /api/reminders/scheduler/status
router.get("/scheduler/status", (_req, res) => {
    res.json(getSchedulerState());
});

// POST /api/reminders/scheduler/run-once  (admin only)
router.post("/scheduler/run-once", requireRole("admin"), async (_req, res) => {
    try {
        const summary = await runReminderSchedulerOnce();
        res.json({ success: true, summary });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── Settings routes (Phase 5C) ───────────────────────────────────────────────

// GET /api/reminders/settings
router.get("/settings", (_req, res) => {
    res.json(getReminderSettings());
});

// PUT /api/reminders/settings  (admin only)
router.put("/settings", requireRole("admin"), (req, res) => {
    try {
        const updated = setReminderSettings(req.body ?? {});
        logAuditEvent({
            req,
            action: "UPDATE_REMINDER_SETTINGS",
            entityType: "ReminderSettings",
            summary: `Reminder settings updated by ${(req as any).user?.username}`,
        });
        res.json(updated);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// POST /api/reminders/settings/reset  (admin only)
router.post("/settings/reset", requireRole("admin"), (_req, res) => {
    res.json(resetReminderSettings());
});

// ─── Patient preference routes (Phase 5C) ────────────────────────────────────

// GET /api/reminders/preferences/:patientId
router.get("/preferences/:patientId", (req, res) => {
    const { patientId } = req.params;
    if (!patientId) return res.status(400).json({ error: "patientId required" });
    res.json(getPatientPreferences(patientId));
});

// PUT /api/reminders/preferences/:patientId (admin/doctor/reception)
router.put("/preferences/:patientId", requireRole("admin", "doctor", "reception"), (req, res) => {
    const patientId = req.params.patientId as string;
    if (!patientId) return res.status(400).json({ error: "patientId required" });
    try {
        const updated = setPatientPreferences(patientId, req.body ?? {});
        logAuditEvent({
            req,
            action: "UPDATE_PATIENT_REMINDER_PREFS",
            entityType: "ReminderPreferences",
            entityId: patientId,
            patientId,
            summary: `Reminder preferences updated for patient ${patientId}`,
        });
        res.json(updated);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

export { router as reminderRouter };
