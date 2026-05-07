// Shared validation schemas and types
import { z } from "zod";

// ─── Patient ────────────────────────────────────────────────────────

export const insertPatientSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    fatherName: z.string().optional(),
    gender: z.enum(["Male", "Female"]).optional(),
    dateOfBirth: z.string().optional(),
    phone: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    maritalStatus: z.enum(["Single", "Married", "Divorced", "Widowed"]).optional(),
    allergies: z.string().optional(),
    chronicConditions: z.string().optional(),
    insurance: z.string().optional(),
    notes: z.string().optional(),
});

export type InsertPatient = z.infer<typeof insertPatientSchema>;

// ─── Visit ──────────────────────────────────────────────────────────

export const insertVisitSchema = z.object({
    patientId: z.string().uuid(),
    visitType: z.string().default("consultation"),
    chiefComplaint: z.string().optional(),
    clinicalNotes: z.string().optional(),
    examination: z.string().optional(),
});

export type InsertVisit = z.infer<typeof insertVisitSchema>;

// ─── Dental Findings ────────────────────────────────────────────────

export const insertDentalFindingSchema = z.object({
    visitId: z.string().uuid().optional(),
    chartId: z.string().uuid().optional(),
    toothCode: z.string().optional(),
    surfaces: z.array(z.string()).optional(),
    findingType: z.string().min(1),
    severity: z.string().optional(),
    description: z.string().optional(),
    status: z.string().default("active"),
});

// ─── Dental Procedures ──────────────────────────────────────────────

export const insertDentalProcedureSchema = z.object({
    visitId: z.string().uuid(),
    treatmentPlanItemId: z.string().uuid().optional(),
    toothCode: z.string().optional(),
    surfaces: z.array(z.string()).optional(),
    procedureCode: z.string().optional(),
    procedureName: z.string().min(1),
    category: z.string().optional(),
    notes: z.string().optional(),
    cost: z.string().optional(),
});

// ─── Prescription ───────────────────────────────────────────────────

export const insertPrescriptionSchema = z.object({
    visitId: z.string().uuid(),
    medicationName: z.string().min(1),
    dosage: z.string().optional(),
    frequency: z.string().optional(),
    duration: z.string().optional(),
    route: z.string().optional(),
    instructions: z.string().optional(),
});

// ─── Lab Order ──────────────────────────────────────────────────────

export const insertLabOrderSchema = z.object({
    visitId: z.string().uuid(),
    testName: z.string().min(1),
});

// ─── Billing ────────────────────────────────────────────────────────

export const insertBillingSchema = z.object({
    visitId: z.string().uuid(),
    totalAmount: z.string(),
    currency: z.string().default("USD"),
    notes: z.string().optional(),
});

// ─── Payment ────────────────────────────────────────────────────────

export const insertPaymentSchema = z.object({
    billingId: z.string().uuid(),
    amount: z.string(),
    method: z.string().default("cash"),
});

// ─── Auth ───────────────────────────────────────────────────────────

export const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});

// ─── Autocomplete ───────────────────────────────────────────────────

export const autocompleteQuerySchema = z.object({
    category: z.enum(["medication", "lab_test", "complaint", "dental_finding", "dental_procedure"]),
    query: z.string().min(1),
    limit: z.number().int().min(1).max(20).default(8),
});

// ─── Visit status constants ─────────────────────────────────────────

export const VISIT_STATUSES = ["queued", "in_progress", "completed", "billed"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

// ─── Appointment ────────────────────────────────────────────────────

export const insertAppointmentSchema = z.object({
    patientId: z.string().uuid(),
    doctorId: z.string().uuid().optional(),
    appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeSlot: z.string().regex(/^\d{2}:\d{2}$/),
    duration: z.number().int().min(5).max(240).default(30),
    type: z.string().default("consultation"),
    status: z.enum(["scheduled", "confirmed", "cancelled", "completed"]).default("scheduled"),
    notes: z.string().optional(),
});

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

// ─── Follow-up ──────────────────────────────────────────────────────

export const insertFollowUpSchema = z.object({
    visitId: z.string().uuid(),
    patientId: z.string().uuid(),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().optional(),
    status: z.enum(["pending", "completed", "missed"]).default("pending"),
    notes: z.string().optional(),
});

// ─── Referral ───────────────────────────────────────────────────────

export const insertReferralSchema = z.object({
    visitId: z.string().uuid(),
    patientId: z.string().uuid(),
    referredTo: z.string().min(1),
    specialty: z.string().optional(),
    reason: z.string().optional(),
    status: z.enum(["pending", "accepted", "completed"]).default("pending"),
    notes: z.string().optional(),
});

