// ─── Reminder Scheduler — Phase 5B ───────────────────────────────────────────
//
// Scheduler decision: setInterval-based (no node-cron dependency).
// Runs every 60 seconds. Evaluates three built-in reminder rules per appointment.
//
// Rules:
//   day_before_18h   — fires at 18:00 the day before the appointment
//   same_day_08h     — fires at 08:00 on the appointment day
//   two_hours_before — fires within the 5-minute window 2 hours before appt time
//
// Idempotency:
//   A (appointmentId, channel, ruleKey) triple is only ever processed once.
//   If any log already exists for that triple (any status), the rule is skipped.
//   This means failed sends are not retried automatically — document as limitation.
//
// Anti-spam:
//   Skips cancelled, completed, no_show appointments.
//   Skips appointments without appointmentDate or timeSlot.
//
// Singleton guard:
//   A module-level flag prevents multiple scheduler instances during tsx watch reloads.
//
// Environment:
//   REMINDER_SCHEDULER_ENABLED=false  → scheduler does not start.
//   Default is enabled (safe because idempotency prevents duplicates).

import { demoAppointments } from "../../demo-store.js";
import { demoReminderLogs, sendAppointmentReminder } from "./core.js";

// ─── Rule definitions ─────────────────────────────────────────────────────────

export interface ReminderRule {
    key: string;
    label: string;
    description: string;
    isDue(now: Date, apptDate: string, apptTime: string): boolean;
    dueAt(apptDate: string, apptTime: string): string;
}

// Parse "YYYY-MM-DD" into local-midnight Date without timezone shift
function localDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
}

// Parse "HH:MM" into { h, m }
function parseTime(timeStr: string): { h: number; m: number } {
    const [h, m] = timeStr.split(":").map(Number);
    return { h: h ?? 0, m: m ?? 0 };
}

// Build a local Date for a given date + time
function localDateTime(dateStr: string, timeStr: string): Date {
    const d = localDate(dateStr);
    const { h, m } = parseTime(timeStr);
    d.setHours(h, m, 0, 0);
    return d;
}

// A rule fires if `now` is within [targetTime, targetTime + 5 min) — enough for
// a once-per-minute tick to catch it even under slight timing jitter.
const WINDOW_MS = 5 * 60 * 1000;

export const REMINDER_RULES: ReminderRule[] = [
    {
        key: "day_before_18h",
        label: "Day-before reminder",
        description: "Sent at 18:00 the evening before the appointment",
        isDue(now, apptDate) {
            const apptDay = localDate(apptDate);
            const fireTime = new Date(apptDay);
            fireTime.setDate(fireTime.getDate() - 1);
            fireTime.setHours(18, 0, 0, 0);
            return now >= fireTime && now < new Date(fireTime.getTime() + WINDOW_MS);
        },
        dueAt(apptDate) {
            const apptDay = localDate(apptDate);
            const t = new Date(apptDay);
            t.setDate(t.getDate() - 1);
            t.setHours(18, 0, 0, 0);
            return t.toISOString();
        },
    },
    {
        key: "same_day_08h",
        label: "Same-day morning reminder",
        description: "Sent at 08:00 on the day of the appointment",
        isDue(now, apptDate) {
            const fireTime = localDate(apptDate);
            fireTime.setHours(8, 0, 0, 0);
            return now >= fireTime && now < new Date(fireTime.getTime() + WINDOW_MS);
        },
        dueAt(apptDate) {
            const t = localDate(apptDate);
            t.setHours(8, 0, 0, 0);
            return t.toISOString();
        },
    },
    {
        key: "two_hours_before",
        label: "2-hour-before reminder",
        description: "Sent approximately 2 hours before the appointment time",
        isDue(now, apptDate, apptTime) {
            const apptStart = localDateTime(apptDate, apptTime);
            const fireTime = new Date(apptStart.getTime() - 2 * 60 * 60 * 1000);
            return now >= fireTime && now < new Date(fireTime.getTime() + WINDOW_MS);
        },
        dueAt(apptDate, apptTime) {
            const apptStart = localDateTime(apptDate, apptTime);
            return new Date(apptStart.getTime() - 2 * 60 * 60 * 1000).toISOString();
        },
    },
];

// ─── Skippable statuses ───────────────────────────────────────────────────────

const SKIP_STATUSES = new Set(["cancelled", "canceled", "completed", "no_show", "no-show"]);

// ─── Scheduler state ──────────────────────────────────────────────────────────

export interface SchedulerRunSummary {
    checked: number;
    sent: number;
    skipped: number;
    failed: number;
    errors: string[];
}

interface SchedulerState {
    enabled: boolean;
    running: boolean;
    rules: Array<{ key: string; label: string; description: string }>;
    lastRunAt: string | null;
    lastRunSummary: SchedulerRunSummary | null;
}

const state: SchedulerState = {
    enabled: false,
    running: false,
    rules: REMINDER_RULES.map(({ key, label, description }) => ({ key, label, description })),
    lastRunAt: null,
    lastRunSummary: null,
};

export function getSchedulerState(): SchedulerState {
    return { ...state };
}

// ─── Idempotency check ────────────────────────────────────────────────────────
// Returns true if a log already exists for (appointmentId, channel, ruleKey).
// Any status (sent/stubbed/failed/not_configured) counts — we do not retry.

function alreadyHandled(appointmentId: string, channel: string, ruleKey: string): boolean {
    return demoReminderLogs.some(
        (l) => l.appointmentId === appointmentId && l.channel === channel && l.ruleKey === ruleKey
    );
}

// ─── Core run logic ───────────────────────────────────────────────────────────

export async function runReminderSchedulerOnce(): Promise<SchedulerRunSummary> {
    if (state.running) {
        return { checked: 0, sent: 0, skipped: 0, failed: 0, errors: ["Scheduler already running"] };
    }

    state.running = true;
    state.lastRunAt = new Date().toISOString();

    const summary: SchedulerRunSummary = { checked: 0, sent: 0, skipped: 0, failed: 0, errors: [] };
    const now = new Date();
    const channel = "whatsapp" as const;

    try {
        for (const appt of demoAppointments) {
            // Skip terminal or invalid appointments
            if (!appt.appointmentDate || !appt.timeSlot) continue;
            if (SKIP_STATUSES.has(String(appt.status || "").toLowerCase())) continue;
            if (localDateTime(appt.appointmentDate, appt.timeSlot).getTime() < now.getTime()) continue;

            for (const rule of REMINDER_RULES) {
                summary.checked++;

                // Check if rule is due now
                if (!rule.isDue(now, appt.appointmentDate, appt.timeSlot)) {
                    summary.skipped++;
                    continue;
                }

                // Idempotency: skip if already handled for this triple
                if (alreadyHandled(appt.id, channel, rule.key)) {
                    summary.skipped++;
                    continue;
                }

                // Send
                try {
                    const result = await sendAppointmentReminder({
                        appointmentId: appt.id,
                        channel,
                        ruleKey: rule.key,
                        triggerType: "automatic",
                        dueAt: rule.dueAt(appt.appointmentDate, appt.timeSlot),
                    });

                    if (result.success || result.log?.status === "stubbed" || result.log?.status === "not_configured") {
                        summary.sent++;
                    } else {
                        summary.failed++;
                        if (result.log?.error) summary.errors.push(`${appt.id}/${rule.key}: ${result.log.error}`);
                    }
                } catch (err: any) {
                    summary.failed++;
                    summary.errors.push(`${appt.id}/${rule.key}: ${err.message}`);
                }
            }
        }
    } finally {
        state.running = false;
        state.lastRunSummary = summary;
    }

    const total = summary.sent + summary.failed;
    if (total > 0 || summary.errors.length > 0) {
        console.log(
            `[ReminderScheduler] run complete — checked:${summary.checked} sent:${summary.sent} skipped:${summary.skipped} failed:${summary.failed}`
        );
    }

    return summary;
}

// ─── Scheduler lifecycle ──────────────────────────────────────────────────────

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

// Singleton guard — prevents double-start during tsx watch hot-reload
let schedulerStarted = false;

export function startReminderScheduler(): void {
    const envEnabled = process.env.REMINDER_SCHEDULER_ENABLED;
    if (envEnabled === "false") {
        console.log("[ReminderScheduler] Disabled via REMINDER_SCHEDULER_ENABLED=false");
        state.enabled = false;
        return;
    }

    if (schedulerStarted) {
        console.log("[ReminderScheduler] Already started — skipping duplicate start");
        return;
    }

    schedulerStarted = true;
    state.enabled = true;

    // Run once immediately on startup, then every 60 s
    void runReminderSchedulerOnce();

    schedulerInterval = setInterval(() => {
        void runReminderSchedulerOnce();
    }, 60_000);

    // Unref so the interval does not prevent Node from exiting cleanly
    if (schedulerInterval.unref) schedulerInterval.unref();

    console.log("[ReminderScheduler] Started — polling every 60 s");
}

export function stopReminderScheduler(): void {
    if (schedulerInterval !== null) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
    }
    schedulerStarted = false;
    state.enabled = false;
    console.log("[ReminderScheduler] Stopped");
}
