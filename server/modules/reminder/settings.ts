// ─── Reminder Settings & Patient Preferences — Phase 5C ──────────────────────
//
// In-memory demo-store style. All data resets on server restart.
// TODO: migrate to DB table in a future phase.
//
// Settings control:
//   - schedulerEnabled: master on/off for automatic scheduling
//   - defaultChannel: fallback channel if per-rule channel not set
//   - rules: per-rule enabled flag + channel override
//   - templates: per-rule message templates with variable substitution
//
// Patient preferences control per-patient opt-in/out.
// Default is fully opted-in (whatsapp: true).

import { demoSettings } from "../../demo-store.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReminderChannel = "whatsapp" | "sms" | "email";

export interface ReminderRuleSettings {
    enabled: boolean;
    channel: ReminderChannel;
}

export interface ReminderSettings {
    schedulerEnabled: boolean;
    defaultChannel: ReminderChannel;
    rules: Record<string, ReminderRuleSettings>;
    templates: Record<string, string>;
}

export interface PatientReminderPreferences {
    remindersEnabled: boolean;
    whatsapp: boolean;
    sms: boolean;
    email: boolean;
    // Opt-out flags (Phase 5C addition)
    smsOptOut?: boolean;
    emailOptOut?: boolean;
    whatsappOptOut?: boolean;
}

// ─── Default templates ────────────────────────────────────────────────────────
// Variables: {patientName}, {appointmentDate}, {timeSlot}, {clinicName}

function defaultTemplates(): Record<string, string> {
    return {
        manual:
            "Hello {patientName}, this is a reminder for your dental appointment on {appointmentDate} at {timeSlot}. Please contact us if you need to reschedule. – {clinicName}",
        day_before_18h:
            "Hello {patientName}, just a reminder that you have a dental appointment tomorrow on {appointmentDate} at {timeSlot}. See you then! – {clinicName}",
        same_day_08h:
            "Hello {patientName}, your dental appointment is today at {timeSlot}. We look forward to seeing you! – {clinicName}",
        two_hours_before:
            "Hello {patientName}, your dental appointment is in about 2 hours at {timeSlot}. Please arrive a few minutes early. – {clinicName}",
    };
}

// ─── Default rule settings ────────────────────────────────────────────────────

function defaultRules(): Record<string, ReminderRuleSettings> {
    return {
        day_before_18h: { enabled: true, channel: "whatsapp" },
        same_day_08h: { enabled: true, channel: "whatsapp" },
        two_hours_before: { enabled: true, channel: "whatsapp" },
    };
}

// ─── In-memory settings store ─────────────────────────────────────────────────

let reminderSettings: ReminderSettings = {
    schedulerEnabled: true,
    defaultChannel: "whatsapp",
    rules: defaultRules(),
    templates: defaultTemplates(),
};

// ─── In-memory patient preferences store ─────────────────────────────────────

const patientPreferences: Map<string, PatientReminderPreferences> = new Map();

const DEFAULT_PREFERENCES: PatientReminderPreferences = {
    remindersEnabled: true,
    whatsapp: true,
    sms: false,
    email: false,
    smsOptOut: false,
    emailOptOut: false,
    whatsappOptOut: false,
};

// ─── Accessors ────────────────────────────────────────────────────────────────

export function getReminderSettings(): ReminderSettings {
    return { ...reminderSettings, rules: { ...reminderSettings.rules }, templates: { ...reminderSettings.templates } };
}

export function setReminderSettings(patch: Partial<ReminderSettings>): ReminderSettings {
    const VALID_CHANNELS = new Set<string>(["whatsapp", "sms", "email"]);
    const VALID_RULE_KEYS = new Set<string>(["day_before_18h", "same_day_08h", "two_hours_before"]);
    const VALID_TEMPLATE_KEYS = new Set<string>(["manual", "day_before_18h", "same_day_08h", "two_hours_before"]);
    const nextSettings: ReminderSettings = {
        schedulerEnabled: reminderSettings.schedulerEnabled,
        defaultChannel: reminderSettings.defaultChannel,
        rules: { ...reminderSettings.rules },
        templates: { ...reminderSettings.templates },
    };

    if (patch.schedulerEnabled !== undefined) {
        nextSettings.schedulerEnabled = Boolean(patch.schedulerEnabled);
    }

    if (patch.defaultChannel !== undefined) {
        if (!VALID_CHANNELS.has(patch.defaultChannel)) {
            throw new Error(`Invalid defaultChannel: ${patch.defaultChannel}`);
        }
        nextSettings.defaultChannel = patch.defaultChannel;
    }

    if (patch.rules !== undefined) {
        for (const [key, val] of Object.entries(patch.rules)) {
            if (!VALID_RULE_KEYS.has(key)) {
                throw new Error(`Unknown rule key: ${key}`);
            }
            if (!val || typeof val !== "object") continue;
            if (val.channel !== undefined && !VALID_CHANNELS.has(val.channel)) {
                throw new Error(`Invalid channel for rule ${key}: ${val.channel}`);
            }
            const existing = nextSettings.rules[key] ?? { enabled: true, channel: nextSettings.defaultChannel };
            nextSettings.rules[key] = {
                enabled: val.enabled !== undefined ? Boolean(val.enabled) : existing.enabled,
                channel: val.channel !== undefined ? val.channel : existing.channel,
            };
        }
    }

    if (patch.templates !== undefined) {
        for (const [key, val] of Object.entries(patch.templates)) {
            if (!VALID_TEMPLATE_KEYS.has(key)) {
                throw new Error(`Unknown template key: ${key}`);
            }
            if (typeof val === "string") {
                nextSettings.templates[key] = val;
            }
        }
    }

    reminderSettings = nextSettings;
    return getReminderSettings();
}

export function resetReminderSettings(): ReminderSettings {
    reminderSettings = {
        schedulerEnabled: true,
        defaultChannel: "whatsapp",
        rules: defaultRules(),
        templates: defaultTemplates(),
    };
    return getReminderSettings();
}

export function getPatientPreferences(patientId: string): PatientReminderPreferences {
    return { ...(patientPreferences.get(patientId) ?? DEFAULT_PREFERENCES) };
}

export function setPatientPreferences(
    patientId: string,
    patch: Partial<PatientReminderPreferences>
): PatientReminderPreferences {
    const current = patientPreferences.get(patientId) ?? { ...DEFAULT_PREFERENCES };
    const updated: PatientReminderPreferences = {
        remindersEnabled: patch.remindersEnabled !== undefined ? Boolean(patch.remindersEnabled) : current.remindersEnabled,
        whatsapp: patch.whatsapp !== undefined ? Boolean(patch.whatsapp) : current.whatsapp,
        sms: patch.sms !== undefined ? Boolean(patch.sms) : current.sms,
        email: patch.email !== undefined ? Boolean(patch.email) : current.email,
        smsOptOut: patch.smsOptOut !== undefined ? Boolean(patch.smsOptOut) : Boolean(current.smsOptOut),
        emailOptOut: patch.emailOptOut !== undefined ? Boolean(patch.emailOptOut) : Boolean(current.emailOptOut),
        whatsappOptOut: patch.whatsappOptOut !== undefined ? Boolean(patch.whatsappOptOut) : Boolean(current.whatsappOptOut),
    };
    patientPreferences.set(patientId, updated);
    return { ...updated };
}

// ─── Template rendering ───────────────────────────────────────────────────────
// Replaces {patientName}, {appointmentDate}, {timeSlot}, {clinicName}.
// Missing variables are left as-is (no crash).

export function renderTemplate(
    templateKey: string,
    vars: { patientName: string; appointmentDate: string; timeSlot: string }
): string {
    const clinicName =
        demoSettings.clinic_name || demoSettings.clinicName || "Dental Clinic";

    const template =
        reminderSettings.templates[templateKey] ??
        reminderSettings.templates["manual"] ??
        "Hello {patientName}, your appointment is on {appointmentDate} at {timeSlot}. – {clinicName}";

    return template
        .replace(/\{patientName\}/g, vars.patientName)
        .replace(/\{appointmentDate\}/g, vars.appointmentDate)
        .replace(/\{timeSlot\}/g, vars.timeSlot)
        .replace(/\{clinicName\}/g, clinicName);
}
