import { Router } from "express";
import { requireAuth, requireRole } from "../auth/index.js";
import { logAuditEvent } from "../../audit.js";
import { v4 as uuidv4 } from "uuid";
import { demoPatients, demoVisits, demoBillings } from "../../demo-store.js";

const router = Router();
router.use(requireAuth);

// ─── Types (Phase 7A) ───────────────────────────────────────────────

type TreatmentPlanStatus = "draft" | "presented" | "accepted" | "partially_accepted" | "declined" | "completed" | "cancelled";
type TreatmentPlanItemStatus = "proposed" | "accepted" | "declined" | "completed" | "cancelled";
type Priority = "low" | "medium" | "high" | "urgent";

interface TreatmentPlan {
    id: string;
    patientId: string;
    title: string;
    description?: string;
    status: TreatmentPlanStatus;
    createdAt: string;
    updatedAt: string;
}

interface TreatmentPlanItem {
    id: string;
    planId: string;
    patientId: string;
    tooth?: string | null;
    area?: string | null;
    procedureName: string;
    category?: string | null;
    description?: string;
    estimatedCost: number;
    priority: Priority;
    status: TreatmentPlanItemStatus;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    // Phase 7C: Conversion tracking fields
    convertedAt?: string | null;
    convertedVisitId?: string | null;
    convertedBillingId?: string | null;
}

// ─── In-Memory Store ────────────────────────────────────────────────

const demoTreatmentPlans: TreatmentPlan[] = [];
const demoTreatmentPlanItems: TreatmentPlanItem[] = [];

// ─── Helpers ────────────────────────────────────────────────────────

function roundToTwoDecimals(n: number): number {
    return Math.round(n * 100) / 100;
}

function getPatientName(patientId: string): string {
    const patient = demoPatients.find((p) => p.id === patientId);
    if (!patient) return "Unknown";
    return `${patient.firstName} ${patient.lastName}`;
}

function calculatePlanSummary(planId: string) {
    const items = demoTreatmentPlanItems.filter((i) => i.planId === planId);

    const proposedTotal = roundToTwoDecimals(
        items
            .filter((i) => ["proposed", "accepted", "completed"].includes(i.status))
            .reduce((sum, i) => sum + i.estimatedCost, 0)
    );

    const acceptedTotal = roundToTwoDecimals(
        items
            .filter((i) => ["accepted", "completed"].includes(i.status))
            .reduce((sum, i) => sum + i.estimatedCost, 0)
    );

    const completedTotal = roundToTwoDecimals(
        items
            .filter((i) => i.status === "completed")
            .reduce((sum, i) => sum + i.estimatedCost, 0)
    );

    const declinedTotal = roundToTwoDecimals(
        items
            .filter((i) => i.status === "declined")
            .reduce((sum, i) => sum + i.estimatedCost, 0)
    );

    const remainingAcceptedTotal = roundToTwoDecimals(acceptedTotal - completedTotal);

    return {
        itemCount: items.length,
        proposedTotal,
        acceptedTotal,
        completedTotal,
        declinedTotal,
        remainingAcceptedTotal,
    };
}

// ─── Validation Helpers ─────────────────────────────────────────────

const VALID_PLAN_STATUSES: TreatmentPlanStatus[] = ["draft", "presented", "accepted", "partially_accepted", "declined", "completed", "cancelled"];
const VALID_ITEM_STATUSES: TreatmentPlanItemStatus[] = ["proposed", "accepted", "declined", "completed", "cancelled"];
const VALID_PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

// ─── Endpoints ──────────────────────────────────────────────────────

// GET /api/treatment-plans/patient/:patientId - Get all plans for patient with summaries
router.get("/patient/:patientId", (req, res) => {
    const { patientId } = req.params;

    // Validate patient exists
    const patient = demoPatients.find((p) => p.id === patientId);
    if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
    }

    const plans = demoTreatmentPlans.filter((p) => p.patientId === patientId);

    const result = {
        patientId,
        patientName: getPatientName(patientId),
        plans: plans.map((plan) => ({
            plan,
            items: demoTreatmentPlanItems.filter((i) => i.planId === plan.id),
            summary: calculatePlanSummary(plan.id),
        })),
    };

    res.json(result);
});

// POST /api/treatment-plans/patient/:patientId - Create new plan (admin/doctor only)
router.post("/patient/:patientId", requireRole("admin", "doctor"), (req, res) => {
    const patientId = req.params.patientId as string;
    const { title, description } = req.body;

    // Validate patient exists
    const patient = demoPatients.find((p) => p.id === patientId);
    if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
    }

    // Validate title
    if (!title || typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json({ error: "Title is required" });
    }

    const now = new Date().toISOString();
    const plan: TreatmentPlan = {
        id: uuidv4(),
        patientId,
        title: title.trim(),
        description: description?.trim(),
        status: "draft",
        createdAt: now,
        updatedAt: now,
    };

    demoTreatmentPlans.push(plan);

    logAuditEvent({
        req,
        action: "TREATMENT_PLAN_CREATE",
        entityType: "TreatmentPlan",
        entityId: plan.id,
        patientId,
        summary: `Treatment plan "${plan.title}" created for patient ${patientId}`,
    });

    res.status(201).json(plan);
});

// PUT /api/treatment-plans/:planId - Update plan (admin/doctor only)
router.put("/:planId", requireRole("admin", "doctor"), (req, res) => {
    const planId = req.params.planId as string;
    const { title, description, status } = req.body;

    const plan = demoTreatmentPlans.find((p) => p.id === planId);
    if (!plan) {
        return res.status(404).json({ error: "Treatment plan not found" });
    }

    // Validate status if provided
    if (status !== undefined) {
        if (!VALID_PLAN_STATUSES.includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        plan.status = status;
    }

    // Validate title if provided
    if (title !== undefined) {
        if (typeof title !== "string" || title.trim().length === 0) {
            return res.status(400).json({ error: "Title cannot be empty" });
        }
        plan.title = title.trim();
    }

    if (description !== undefined) {
        plan.description = description?.trim();
    }

    plan.updatedAt = new Date().toISOString();

    logAuditEvent({
        req,
        action: "TREATMENT_PLAN_UPDATE",
        entityType: "TreatmentPlan",
        entityId: planId,
        patientId: plan.patientId,
        summary: `Treatment plan "${plan.title}" updated (status: ${plan.status})`,
    });

    res.json(plan);
});

// POST /api/treatment-plans/:planId/items - Add item to plan (admin/doctor only)
router.post("/:planId/items", requireRole("admin", "doctor"), (req, res) => {
    const planId = req.params.planId as string;
    const {
        tooth,
        area,
        procedureName,
        category,
        description,
        estimatedCost,
        priority = "medium",
        notes,
    } = req.body;

    const plan = demoTreatmentPlans.find((p) => p.id === planId);
    if (!plan) {
        return res.status(404).json({ error: "Treatment plan not found" });
    }

    // Validate procedureName
    if (!procedureName || typeof procedureName !== "string" || procedureName.trim().length === 0) {
        return res.status(400).json({ error: "Procedure name is required" });
    }

    // Validate estimatedCost
    const cost = Number(estimatedCost);
    if (isNaN(cost) || cost < 0) {
        return res.status(400).json({ error: "Estimated cost must be >= 0" });
    }

    // Validate priority
    if (!VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: "Invalid priority. Must be low, medium, high, or urgent" });
    }

    const now = new Date().toISOString();
    const item: TreatmentPlanItem = {
        id: uuidv4(),
        planId,
        patientId: plan.patientId,
        tooth: tooth?.trim() || null,
        area: area?.trim() || null,
        procedureName: procedureName.trim(),
        category: category?.trim() || null,
        description: description?.trim(),
        estimatedCost: roundToTwoDecimals(cost),
        priority,
        status: "proposed",
        notes: notes?.trim(),
        createdAt: now,
        updatedAt: now,
    };

    demoTreatmentPlanItems.push(item);

    logAuditEvent({
        req,
        action: "TREATMENT_ITEM_CREATE",
        entityType: "TreatmentPlanItem",
        entityId: item.id,
        patientId: plan.patientId,
        summary: `Treatment item "${item.procedureName}" added to plan "${plan.title}"`,
        metadata: { estimatedCost: item.estimatedCost, tooth: item.tooth },
    });

    res.status(201).json(item);
});

// PUT /api/treatment-plans/items/:itemId - Update item (admin/doctor only)
router.put("/items/:itemId", requireRole("admin", "doctor"), (req, res) => {
    const itemId = req.params.itemId as string;
    const {
        tooth,
        area,
        procedureName,
        category,
        description,
        estimatedCost,
        priority,
        status,
        notes,
    } = req.body;

    const item = demoTreatmentPlanItems.find((i) => i.id === itemId);
    if (!item) {
        return res.status(404).json({ error: "Treatment plan item not found" });
    }

    // Validate procedureName if provided
    if (procedureName !== undefined) {
        if (typeof procedureName !== "string" || procedureName.trim().length === 0) {
            return res.status(400).json({ error: "Procedure name cannot be empty" });
        }
        item.procedureName = procedureName.trim();
    }

    // Validate estimatedCost if provided
    if (estimatedCost !== undefined) {
        const cost = Number(estimatedCost);
        if (isNaN(cost) || cost < 0) {
            return res.status(400).json({ error: "Estimated cost must be >= 0" });
        }
        item.estimatedCost = roundToTwoDecimals(cost);
    }

    // Validate priority if provided
    if (priority !== undefined) {
        if (!VALID_PRIORITIES.includes(priority)) {
            return res.status(400).json({ error: "Invalid priority" });
        }
        item.priority = priority;
    }

    // Validate status if provided
    if (status !== undefined) {
        if (!VALID_ITEM_STATUSES.includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        item.status = status;
    }

    if (tooth !== undefined) item.tooth = tooth?.trim() || null;
    if (area !== undefined) item.area = area?.trim() || null;
    if (category !== undefined) item.category = category?.trim() || null;
    if (description !== undefined) item.description = description?.trim();
    if (notes !== undefined) item.notes = notes?.trim();

    item.updatedAt = new Date().toISOString();

    logAuditEvent({
        req,
        action: "TREATMENT_ITEM_UPDATE",
        entityType: "TreatmentPlanItem",
        entityId: itemId,
        patientId: item.patientId,
        summary: `Treatment item "${item.procedureName}" updated (status: ${item.status})`,
    });

    res.json(item);
});

// DELETE /api/treatment-plans/items/:itemId - Delete item (admin/doctor only)
router.delete("/items/:itemId", requireRole("admin", "doctor"), (req, res) => {
    const itemId = req.params.itemId as string;

    const itemIndex = demoTreatmentPlanItems.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) {
        return res.status(404).json({ error: "Treatment plan item not found" });
    }

    const item = demoTreatmentPlanItems[itemIndex];

    // For accepted/completed items, prefer cancellation over deletion
    if (["accepted", "completed"].includes(item.status)) {
        item.status = "cancelled";
        item.updatedAt = new Date().toISOString();
        return res.json({
            success: true,
            message: "Item status changed to cancelled",
            item,
        });
    }

    // Hard delete for draft/proposed items
    demoTreatmentPlanItems.splice(itemIndex, 1);

    logAuditEvent({
        req,
        action: "TREATMENT_ITEM_DELETE",
        entityType: "TreatmentPlanItem",
        entityId: itemId,
        patientId: item.patientId,
        summary: `Treatment item "${item.procedureName}" deleted`,
    });

    res.json({ success: true, message: "Item deleted" });
});

// POST /api/treatment-plans/items/:itemId/convert - Convert accepted item to visit/billing (admin/doctor only)
// Phase 7C: Convert Accepted Treatment Plan Items to Visit/Billing
router.post("/items/:itemId/convert", requireRole("admin", "doctor"), (req, res) => {
    const itemId = req.params.itemId as string;
    const { visitDate, doctorId, notes } = req.body;

    // ─── Step 1: Find and validate item ────────────────────────────────
    const item = demoTreatmentPlanItems.find((i) => i.id === itemId);
    if (!item) {
        return res.status(404).json({ error: "Treatment plan item not found" });
    }

    // ─── Step 2: Find parent plan and patient ──────────────────────────
    const plan = demoTreatmentPlans.find((p) => p.id === item.planId);
    if (!plan) {
        return res.status(404).json({ error: "Parent treatment plan not found" });
    }

    const patient = demoPatients.find((p) => p.id === item.patientId);
    if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
    }

    // ─── Step 3: Idempotency check ─────────────────────────────────────
    if (item.convertedVisitId || item.convertedBillingId || item.convertedAt) {
        return res.status(409).json({
            error: "Item has already been converted",
            convertedAt: item.convertedAt,
            convertedVisitId: item.convertedVisitId,
            convertedBillingId: item.convertedBillingId,
            message: "This item has already been converted. Cannot convert twice.",
        });
    }

    // ─── Step 4: Validate item status (only accepted items) ─────────────
    if (item.status !== "accepted") {
        return res.status(400).json({
            error: "Only accepted treatment plan items can be converted",
            currentStatus: item.status,
            allowedStatus: "accepted",
        });
    }

    // ─── Step 5: Validate estimated cost ───────────────────────────────
    if (item.estimatedCost < 0) {
        return res.status(400).json({ error: "Invalid estimated cost. Must be >= 0" });
    }

    // ─── Step 6: Prepare visit record ──────────────────────────────────
    const now = new Date().toISOString();
    const visitNumber = demoVisits.filter((v) => v.patientId === item.patientId).length + 1;

    // Build description with treatment plan reference
    const locationInfo = item.tooth ? `Tooth ${item.tooth}` : item.area || "General";
    const procedureDescription = `${item.procedureName} — ${locationInfo}`;
    const notesText = notes ? `\nAdditional notes: ${notes}` : "";
    const sourceRef = `\n[Source: Treatment Plan "${plan.title}" — Item ${item.id}]`;

    const visitRecord = {
        id: uuidv4(),
        patientId: item.patientId,
        doctorId: doctorId || null,
        visitNumber,
        visitType: "treatment", // converted from treatment plan
        chiefComplaint: procedureDescription,
        clinicalNotes: `Converted from treatment plan item.\nOriginal procedure: ${item.procedureName}${item.category ? ` (${item.category})` : ""}${notesText}${sourceRef}`,
        examination: item.description || null,
        status: "completed", // visit is completed when converted
        startedAt: visitDate ? new Date(visitDate).toISOString() : now,
        completedAt: now,
        // Empty arrays for related data (can be added later if needed)
        dentalFindings: [],
        prescriptions: [],
        labOrders: [],
        dentalProcedures: [] as any[], // populated after visit ID is known
        dentalMedia: [],
        billing: null, // will be linked after billing creation
    };

    // Add dental procedure with correct visit ID now that we have it
    if (item.estimatedCost > 0) {
        visitRecord.dentalProcedures.push({
            id: uuidv4(),
            visitId: visitRecord.id,
            patientId: item.patientId,
            treatmentPlanItemId: item.id,
            procedureName: item.procedureName,
            category: item.category || "other",
            toothCode: item.tooth || null,
            cost: String(item.estimatedCost),
            status: "completed",
            performedAt: now,
            notes: item.notes || null,
        });
    }

    // ─── Step 7: Prepare billing record ────────────────────────────────
    const billingRecord = {
        id: uuidv4(),
        visitId: visitRecord.id,
        totalAmount: String(item.estimatedCost),
        paidAmount: "0",
        currency: "USD",
        status: item.estimatedCost === 0 ? "paid" : "unpaid", // zero-cost is auto-paid
        notes: `Treatment plan conversion — ${item.procedureName}${item.tooth ? ` (Tooth ${item.tooth})` : ""}${item.area ? ` (${item.area})` : ""}`,
        createdAt: now,
        payments: [],
        // Source tracking for idempotency/audit
        sourceType: "treatment_plan_item",
        sourceId: item.id,
    };

    // Update dental procedure with visit ID (visit is already created with this ID)
    if (visitRecord.dentalProcedures.length > 0) {
        visitRecord.dentalProcedures[0].visitId = visitRecord.id;
    }

    // ─── Step 8: Execute mutations (all or nothing) ────────────────────
    try {
        // Push visit to store
        demoVisits.push(visitRecord);

        // Push billing to store
        demoBillings.push(billingRecord);

        // Update item with conversion references
        item.convertedAt = now;
        item.convertedVisitId = visitRecord.id;
        item.convertedBillingId = billingRecord.id;
        item.status = "completed"; // Mark as completed after successful conversion
        item.updatedAt = now;

        // ─── Step 9: Return success response ─────────────────────────────
        logAuditEvent({
            req,
            action: "TREATMENT_ITEM_CONVERT",
            entityType: "TreatmentPlanItem",
            entityId: item.id,
            patientId: item.patientId,
            summary: `Treatment item "${item.procedureName}" converted to visit ${visitRecord.id} and billing ${billingRecord.id}`,
            metadata: { visitId: visitRecord.id, billingId: billingRecord.id, estimatedCost: item.estimatedCost },
        });

        res.json({
            success: true,
            message: "Treatment plan item converted successfully",
            item: {
                id: item.id,
                status: item.status,
                convertedAt: item.convertedAt,
                convertedVisitId: item.convertedVisitId,
                convertedBillingId: item.convertedBillingId,
                procedureName: item.procedureName,
                estimatedCost: item.estimatedCost,
            },
            visit: {
                id: visitRecord.id,
                visitNumber: visitRecord.visitNumber,
                startedAt: visitRecord.startedAt,
                status: visitRecord.status,
            },
            billing: {
                id: billingRecord.id,
                totalAmount: billingRecord.totalAmount,
                status: billingRecord.status,
                notes: billingRecord.notes,
            },
        });
    } catch (error: any) {
        // ─── Rollback on error (best effort for in-memory) ───────────────
        const visitIdx = demoVisits.findIndex((v) => v.id === visitRecord.id);
        if (visitIdx !== -1) demoVisits.splice(visitIdx, 1);

        const billingIdx = demoBillings.findIndex((b) => b.id === billingRecord.id);
        if (billingIdx !== -1) demoBillings.splice(billingIdx, 1);

        res.status(500).json({
            error: "Conversion failed",
            message: error?.message || "Unknown error during conversion",
        });
    }
});

export { router as treatmentPlanRouter };
