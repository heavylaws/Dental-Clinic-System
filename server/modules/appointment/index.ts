import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import { demoAppointments, demoPatients } from "../../demo-store.js";
import { v4 as uuidv4 } from "uuid";

const DOCTOR_NAMES: Record<string, string> = {
    "2": "Dr. Mohammed Al-Mansouri",
    "4": "Dr. Layla Boujdaria",
};

const router = Router();
router.use(requireAuth);

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
    const appt = { id: uuidv4(), status: "scheduled", createdAt: new Date().toISOString(), ...req.body };
    demoAppointments.push(appt);
    res.status(201).json(appt);
});

// Update appointment
router.put("/:id", (req, res) => {
    const idx = demoAppointments.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Appointment not found" });
    demoAppointments[idx] = { ...demoAppointments[idx], ...req.body };
    res.json(demoAppointments[idx]);
});

// Delete appointment
router.delete("/:id", (req, res) => {
    const idx = demoAppointments.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Appointment not found" });
    demoAppointments.splice(idx, 1);
    res.json({ success: true });
});

export { router as appointmentRouter };
