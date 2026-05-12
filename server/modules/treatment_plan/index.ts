import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import { v4 as uuidv4 } from "uuid";
import { demoPatients } from "../../demo-store.js";

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

// POST /api/treatment-plans/patient/:patientId - Create new plan
router.post("/patient/:patientId", (req, res) => {
    const { patientId } = req.params;
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

    res.status(201).json(plan);
});

// PUT /api/treatment-plans/:planId - Update plan
router.put("/:planId", (req, res) => {
    const { planId } = req.params;
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

    res.json(plan);
});

// POST /api/treatment-plans/:planId/items - Add item to plan
router.post("/:planId/items", (req, res) => {
    const { planId } = req.params;
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

    res.status(201).json(item);
});

// PUT /api/treatment-plans/items/:itemId - Update item
router.put("/items/:itemId", (req, res) => {
    const { itemId } = req.params;
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

    res.json(item);
});

// DELETE /api/treatment-plans/items/:itemId - Delete item
router.delete("/items/:itemId", (req, res) => {
    const { itemId } = req.params;

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
    res.json({ success: true, message: "Item deleted" });
});

export { router as treatmentPlanRouter };
