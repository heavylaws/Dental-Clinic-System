// ─── Reminder Core — Phase 5A + 5B + 5C ─────────────────────────────────────
// Shared between the HTTP router (index.ts) and the scheduler (scheduler.ts).
// Keeping this separate avoids a circular import between index ↔ scheduler.

import { v4 as uuidv4 } from "uuid";
import { demoAppointments, demoPatients } from "../../demo-store.js";
import { sendWhatsApp } from "../whatsapp/index.js";
import { getPatientPreferences, renderTemplate } from "./settings.js";

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

    // ── Phase 5C: patient opt-out check ──
    if (patient?.id) {
        const prefs = getPatientPreferences(patient.id);
        if (!prefs.remindersEnabled) {
            const log: ReminderLog = {
                id: uuidv4(),
                appointmentId: opts.appointmentId,
                patientId: patient.id,
                patientName,
                phone,
                channel,
                status: "not_configured",
                message: "",
                error: "Patient has opted out of reminders",
                sentAt: new Date().toISOString(),
                appointmentDate: appt.appointmentDate,
                timeSlot: appt.timeSlot,
                ruleKey,
                triggerType,
                dueAt,
            };
            demoReminderLogs.push(log);
            return { success: false, message: "Patient has opted out of reminders.", log, httpStatus: 200 };
        }

        if (!prefs[channel]) {
            const log: ReminderLog = {
                id: uuidv4(),
                appointmentId: opts.appointmentId,
                patientId: patient.id,
                patientName,
                phone,
                channel,
                status: "not_configured",
                message: "",
                error: `Patient has disabled ${channel} reminders`,
                sentAt: new Date().toISOString(),
                appointmentDate: appt.appointmentDate,
                timeSlot: appt.timeSlot,
                ruleKey,
                triggerType,
                dueAt,
            };
            demoReminderLogs.push(log);
            return {
                success: false,
                message: `Patient has disabled ${channel} reminders.`,
                log,
                httpStatus: 200,
            };
        }
    }

    // ── Phase 5C: template rendering ──
    // Custom message always wins; otherwise use per-rule template.
    const message = opts.message || renderTemplate(ruleKey, {
        patientName,
        appointmentDate: appt.appointmentDate,
        timeSlot: appt.timeSlot,
    });

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
