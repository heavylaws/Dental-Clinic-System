import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import { demoAppointments, demoPatients } from "../../demo-store.js";
import { v4 as uuidv4 } from "uuid";

const DOCTOR_NAMES: Record<string, string> = {
    "2": "Dr. Mohammed Al-Mansouri",
    "4": "Dr. Layla Boujdaria",
};

// ─── Working hours config (Phase 4A) ─────────────────────────────────
// Default clinic hours: Mon–Sat, 08:00–18:00. Sunday closed.
// Stored as constants for now; future phases may move this to a settings store.

const WORKING_HOURS = {
    openMinutes: 8 * 60,    // 08:00
    closeMinutes: 18 * 60,  // 18:00
    closedDaysOfWeek: [0],  // 0 = Sunday (JS Date.getUTCDay)
};

const DEFAULT_DURATION_MIN = 30;
const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Helpers ─────────────────────────────────────────────────────────

function timeToMinutes(hhmm: string): number | null {
    if (!hhmm || !TIME_RE.test(hhmm)) return null;
    const [h, m] = hhmm.split(":").map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
}

function safeDuration(d: any): number {
    const n = parseInt(String(d), 10);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_DURATION_MIN;
    return n;
}

function dayOfWeekUtc(dateStr: string): number | null {
    if (!DATE_RE.test(dateStr)) return null;
    const d = new Date(dateStr + "T00:00:00.000Z");
    if (Number.isNaN(d.getTime())) return null;
    return d.getUTCDay();
}

interface ApptShape {
    id?: string;
    patientId?: string;
    doctorId?: string;
    appointmentDate?: string;
    timeSlot?: string;
    duration?: any;
    status?: string;
}

const BLOCKING_STATUS_EXCLUSIONS = new Set(["cancelled", "no_show", "no-show"]);

function isBlocking(a: ApptShape): boolean {
    const s = String(a.status || "").toLowerCase();
    return !BLOCKING_STATUS_EXCLUSIONS.has(s);
}

/**
 * Returns null if a is valid against working hours, else an error message.
 * Validates: date format, day-of-week not closed, start >= open, end <= close.
 */
function validateWorkingHours(appointmentDate: string, timeSlot: string, durationMin: number): string | null {
    const dow = dayOfWeekUtc(appointmentDate);
    if (dow === null) return "Invalid appointmentDate. Use YYYY-MM-DD.";
    if (WORKING_HOURS.closedDaysOfWeek.includes(dow)) {
        return "Appointment is outside clinic working hours (clinic is closed that day).";
    }
    const startMin = timeToMinutes(timeSlot);
    if (startMin === null) return "Invalid timeSlot. Use HH:mm (24-hour).";
    const endMin = startMin + durationMin;
    if (startMin < WORKING_HOURS.openMinutes || endMin > WORKING_HOURS.closeMinutes) {
        return "Appointment is outside clinic working hours (08:00–18:00).";
    }
    return null;
}

/**
 * Find the first conflicting appointment, or null if none.
 * Checks for:
 * A) Doctor conflict: same doctor, same date, time-overlap, both blocking statuses
 * B) Patient conflict: same patient, same date, time-overlap, both blocking statuses
 * Overlap rule: A starts before B ends AND B starts before A ends.
 */
function findConflict(
    appts: ApptShape[],
    candidate: { patientId?: string; doctorId?: string; appointmentDate: string; timeSlot: string; duration: number; status?: string },
    excludeId?: string,
): { conflict: ApptShape; type: "doctor_conflict" | "patient_conflict" } | null {
    if (!isBlocking(candidate)) return null;
    const aStart = timeToMinutes(candidate.timeSlot);
    if (aStart === null) return null;
    const aEnd = aStart + candidate.duration;

    for (const b of appts) {
        if (!b || b.id === excludeId) continue;
        if (b.appointmentDate !== candidate.appointmentDate) continue;
        if (!isBlocking(b)) continue;

        const bStart = timeToMinutes(b.timeSlot || "");
        if (bStart === null) continue;
        const bEnd = bStart + safeDuration(b.duration);

        // Check overlap: A starts before B ends AND B starts before A ends
        if (aStart >= bEnd || bStart >= aEnd) continue; // No overlap

        // Overlap exists. Check conflict types:
        // A) Doctor conflict (same doctor)
        if (b.doctorId === candidate.doctorId) {
            return { conflict: b, type: "doctor_conflict" };
        }

        // B) Patient conflict (same patient)
        if (b.patientId === candidate.patientId) {
            return { conflict: b, type: "patient_conflict" };
        }
    }
    return null;
}

function buildConflictResponse(conflictInfo: { conflict: ApptShape; type: "doctor_conflict" | "patient_conflict" }) {
    const { conflict, type } = conflictInfo;
    const pt = conflict.id ? demoPatients.find((p) => {
        const a = demoAppointments.find((x) => x.id === conflict.id);
        return a && p.id === a.patientId;
    }) : null;
    
    const message = type === "patient_conflict"
        ? "Patient already has an overlapping appointment"
        : "Appointment conflict detected";

    return {
        message,
        type,
        conflict: {
            appointmentId: conflict.id,
            patientName: pt ? `${pt.firstName ?? ""} ${pt.lastName ?? ""}`.trim() || null : null,
            doctorName: conflict.doctorId ? (DOCTOR_NAMES[conflict.doctorId] || null) : null,
            appointmentDate: conflict.appointmentDate,
            timeSlot: conflict.timeSlot,
            duration: safeDuration(conflict.duration),
        },
    };
}

// ─── Router ──────────────────────────────────────────────────────────

const router = Router();
router.use(requireAuth);

// Working hours info (read-only, for clients that want to know)
router.get("/working-hours", (_req, res) => {
    res.json({
        openMinutes: WORKING_HOURS.openMinutes,
        closeMinutes: WORKING_HOURS.closeMinutes,
        open: "08:00",
        close: "18:00",
        closedDaysOfWeek: WORKING_HOURS.closedDaysOfWeek,
        defaultDuration: DEFAULT_DURATION_MIN,
    });
});

// List appointments by date or range (optional doctorId filter)
router.get("/", (req, res) => {
    const { date, from, to, doctorId } = req.query as Record<string, string>;
    const dateFrom = date || from || new Date().toISOString().split("T")[0];
    const dateTo = date || to || dateFrom;

    const results = demoAppointments
        .filter((a) => {
            if (a.appointmentDate < dateFrom || a.appointmentDate > dateTo) return false;
            if (doctorId && a.doctorId !== doctorId) return false;
            return true;
        })
        .map((a) => {
            const pt = demoPatients.find((p) => p.id === a.patientId);
            return {
                ...a,
                patientName: pt ? `${pt.firstName} ${pt.lastName}` : "",
                patientPhone: pt ? pt.phone : null,
                doctorName: DOCTOR_NAMES[a.doctorId] || "Unknown Doctor",
            };
        })
        .sort((a, b) => {
            if (a.appointmentDate !== b.appointmentDate) return a.appointmentDate.localeCompare(b.appointmentDate);
            return (a.timeSlot || "").localeCompare(b.timeSlot || "");
        });

    res.json(results);
});

// All doctors for the appointments calendar
router.get("/doctors", (_req, res) => {
    res.json(Object.entries(DOCTOR_NAMES).map(([id, name]) => ({ id, name })));
});

// Upcoming appointments for a patient
router.get("/patient/:patientId", (req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const results = demoAppointments
        .filter((a) => a.patientId === req.params.patientId && a.appointmentDate >= today)
        .sort((a, b) => {
            if (a.appointmentDate !== b.appointmentDate) return a.appointmentDate.localeCompare(b.appointmentDate);
            return (a.timeSlot || "").localeCompare(b.timeSlot || "");
        });
    res.json(results);
});

// Create appointment
router.post("/", (req, res) => {
    const body = req.body || {};
    const appointmentDate = String(body.appointmentDate || "");
    const timeSlot = String(body.timeSlot || "");
    const duration = safeDuration(body.duration);
    const doctorId = body.doctorId ? String(body.doctorId) : undefined;
    const patientId = body.patientId ? String(body.patientId) : undefined;
    const status = body.status ? String(body.status) : "scheduled";

    if (!patientId) return res.status(400).json({ message: "patientId is required" });
    if (!doctorId) return res.status(400).json({ message: "doctorId is required" });
    if (!appointmentDate) return res.status(400).json({ message: "appointmentDate is required" });
    if (!timeSlot) return res.status(400).json({ message: "timeSlot is required" });

    // Working hours validation (skip for cancelled/no_show records, which don't block)
    if (isBlocking({ status })) {
        const whErr = validateWorkingHours(appointmentDate, timeSlot, duration);
        if (whErr) return res.status(400).json({ message: whErr });
    }

    // Conflict detection (doctor or patient)
    const conflictInfo = findConflict(demoAppointments, {
        patientId,
        doctorId,
        appointmentDate,
        timeSlot,
        duration,
        status,
    });
    if (conflictInfo) {
        return res.status(409).json(buildConflictResponse(conflictInfo));
    }

    const appt = {
        id: uuidv4(),
        status,
        createdAt: new Date().toISOString(),
        ...body,
        doctorId,
        patientId,
        appointmentDate,
        timeSlot,
        duration,
    };
    demoAppointments.push(appt);
    res.status(201).json(appt);
});

// Update appointment (preserves all existing fields not in body, like type/walk-in)
router.put("/:id", (req, res) => {
    const idx = demoAppointments.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: "Appointment not found" });

    const existing = demoAppointments[idx];
    const merged = { ...existing, ...req.body, id: existing.id };

    const appointmentDate = String(merged.appointmentDate || "");
    const timeSlot = String(merged.timeSlot || "");
    const duration = safeDuration(merged.duration);
    const doctorId = merged.doctorId ? String(merged.doctorId) : undefined;
    const patientId = merged.patientId ? String(merged.patientId) : undefined;

    // Re-validate working hours and conflicts only if the appointment is in a blocking state
    if (isBlocking(merged)) {
        const whErr = validateWorkingHours(appointmentDate, timeSlot, duration);
        if (whErr) return res.status(400).json({ message: whErr });

        const conflictInfo = findConflict(demoAppointments, {
            patientId,
            doctorId,
            appointmentDate,
            timeSlot,
            duration,
            status: merged.status,
        }, existing.id);
        if (conflictInfo) {
            return res.status(409).json(buildConflictResponse(conflictInfo));
        }
    }

    demoAppointments[idx] = { ...merged, doctorId, patientId, appointmentDate, timeSlot, duration };
    res.json(demoAppointments[idx]);
});

// Update appointment status or notes (PATCH - no schedule validation)
function patchAppointment(req: any, res: any) {
    const idx = demoAppointments.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: "Appointment not found" });

    const existing = demoAppointments[idx];
    const updates: any = {};
    
    // Only allow non-schedule fields to be patched
    if (req.body.status !== undefined) updates.status = String(req.body.status);
    if (req.body.notes !== undefined) updates.notes = req.body.notes;
    if (req.body.type !== undefined) updates.type = String(req.body.type);
    
    const merged = { ...existing, ...updates };
    demoAppointments[idx] = merged;
    res.json(merged);
}

// Backward-compatible status route used by desktop/mobile clients
router.patch("/:id/status", patchAppointment);

// Generic patch route for future-safe clients
router.patch("/:id", patchAppointment);

// Delete appointment
router.delete("/:id", (req, res) => {
    const idx = demoAppointments.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: "Appointment not found" });
    demoAppointments.splice(idx, 1);
    res.json({ success: true });
});

export { router as appointmentRouter };
