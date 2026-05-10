// ─── Reminder Core — Phase 5A + 5B ───────────────────────────────────────────
// Shared between the HTTP router (index.ts) and the scheduler (scheduler.ts).
// Keeping this separate avoids a circular import between index ↔ scheduler.

import { v4 as uuidv4 } from "uuid";
import { demoAppointments, demoPatients, demoSettings } from "../../demo-store.js";
import { sendWhatsApp } from "../whatsapp/index.js";

// ─── ReminderLog type ─────────────────────────────────────────────────────────
// Phase 5B additions: ruleKey, triggerType, dueAt (all optional for backward compat).

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
    // Phase 5B fields
    ruleKey?: string;
    triggerType?: "manual" | "automatic";
    dueAt?: string;
}

// ─── In-memory log store ──────────────────────────────────────────────────────
// TODO: replace with a real DB table via Drizzle migration in a later phase.

export const demoReminderLogs: ReminderLog[] = [];

// ─── Default message builder ──────────────────────────────────────────────────

function buildReminderMessage(patientName: string, appointmentDate: string, timeSlot: string): string {
    return (
        `Hello ${patientName}, this is a reminder for your dental appointment on ` +
        `${appointmentDate} at ${timeSlot}. Please contact us if you need to reschedule.`
    );
}

// ─── Shared send function ─────────────────────────────────────────────────────
// Single dispatch point for all reminder sends.
// HTTP route calls with triggerType: "manual"; scheduler calls with triggerType: "automatic".

export interface SendReminderOptions {
    appointmentId: string;
    channel?: "whatsapp" | "sms" | "email";
    message?: string;
    ruleKey?: string;
    triggerType?: "manual" | "automatic";
    dueAt?: string;
}

export interface SendReminderResult {
    success: boolean;
    message: string;
    waUrl?: string;
    log: ReminderLog;
    httpStatus?: number;
}

export async function sendAppointmentReminder(opts: SendReminderOptions): Promise<SendReminderResult> {
    const channel: "whatsapp" | "sms" | "email" =
        opts.channel === "sms" || opts.channel === "email" ? opts.channel : "whatsapp";
    const ruleKey = opts.ruleKey ?? "manual";
    const triggerType = opts.triggerType ?? "manual";
    const dueAt = opts.dueAt;

    const appt = demoAppointments.find((a) => a.id === opts.appointmentId);
    if (!appt) {
        return { success: false, message: "Appointment not found", log: {} as ReminderLog, httpStatus: 404 };
    }

    const patient = demoPatients.find((p) => p.id === appt.patientId);
    const patientName: string = patient
        ? `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() || "Patient"
        : "Patient";
    const phone: string | null = patient?.phone || null;

    const message = opts.message || buildReminderMessage(patientName, appt.appointmentDate, appt.timeSlot);

    const baseLog: Omit<ReminderLog, "id" | "status" | "error" | "waUrl"> = {
        appointmentId: opts.appointmentId,
        patientId: patient?.id ?? null,
        patientName,
        phone,
        channel,
        message,
        sentAt: new Date().toISOString(),
        appointmentDate: appt.appointmentDate,
        timeSlot: appt.timeSlot,
        ruleKey,
        triggerType,
        dueAt,
    };

    if (!phone) {
        const log: ReminderLog = { ...baseLog, id: uuidv4(), status: "failed", error: "Patient phone number is missing" };
        demoReminderLogs.push(log);
        return { success: false, message: "Patient phone number is missing. Reminder was not sent.", log, httpStatus: 400 };
    }

    if (channel === "sms") {
        const log: ReminderLog = { ...baseLog, id: uuidv4(), status: "not_configured", error: "SMS provider not configured" };
        demoReminderLogs.push(log);
        return { success: false, message: "SMS channel is not configured. Log entry created.", log };
    }

    if (channel === "email") {
        const log: ReminderLog = { ...baseLog, id: uuidv4(), status: "not_configured", error: "Email provider not configured" };
        demoReminderLogs.push(log);
        return { success: false, message: "Email channel is not configured. Log entry created.", log };
    }

    // WhatsApp
    const digits = phone.replace(/\D/g, "");
    const waResult = await sendWhatsApp(phone, message);

    if (waResult.ok) {
        const log: ReminderLog = { ...baseLog, id: uuidv4(), status: "sent" };
        demoReminderLogs.push(log);
        return { success: true, message: `WhatsApp reminder sent to ${patientName}.`, log };
    }

    // Stubbed — WhatsApp not connected; provide wa.me URL, do not claim delivery
    const encodedText = encodeURIComponent(message);
    const waUrl = `https://wa.me/${digits}?text=${encodedText}`;
    const log: ReminderLog = {
        ...baseLog,
        id: uuidv4(),
        status: "stubbed",
        error: waResult.error || "WhatsApp client not connected",
        waUrl,
    };
    demoReminderLogs.push(log);
    return {
        success: false,
        message: "WhatsApp client is not connected. Use the link to send manually.",
        waUrl,
        log,
    };
}
