// ─── Reminder Module — Phase 5A + 5B ─────────────────────────────────────────
// HTTP router only. Shared types and send logic live in core.ts.
// Scheduler state lives in scheduler.ts.

import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import { demoReminderLogs, sendAppointmentReminder } from "./core.js";
import { getSchedulerState, runReminderSchedulerOnce } from "./scheduler.js";

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

// POST /api/reminders/scheduler/run-once  (admin/test)
router.post("/scheduler/run-once", async (_req, res) => {
    try {
        const summary = await runReminderSchedulerOnce();
        res.json({ success: true, summary });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

export { router as reminderRouter };
