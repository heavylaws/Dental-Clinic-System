import { Router } from "express";
import { db } from "../../db/index.js";
import { treatmentPlans, treatmentPlanItems } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

// ─── Get all treatment plans for a patient ──────────────────────────

router.get("/patient/:patientId", async (req, res) => {
    try {
        const plans = await db.query.treatmentPlans.findMany({
            where: eq(treatmentPlans.patientId, req.params.patientId),
            with: {
                items: {
                    orderBy: (items, { asc }) => [asc(items.sequenceOrder)]
                }
            },
            orderBy: [desc(treatmentPlans.createdAt)],
        });
        res.json(plans);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Create a treatment plan ────────────────────────────────────────

router.post("/", async (req, res) => {
    try {
        const { patientId, title, priority, notes } = req.body;
        
        const [plan] = await db.insert(treatmentPlans).values({
            patientId,
            title,
            priority: priority || "normal",
            notes,
            createdBy: (req.user as any)?.id,
            status: "draft"
        }).returning();

        res.status(201).json(plan);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Update a treatment plan ────────────────────────────────────────

router.patch("/:id", async (req, res) => {
    try {
        const { title, status, priority, notes } = req.body;
        
        const [plan] = await db.update(treatmentPlans).set({
            title: title ?? undefined,
            status: status ?? undefined,
            priority: priority ?? undefined,
            notes: notes ?? undefined,
            updatedAt: new Date()
        })
        .where(eq(treatmentPlans.id, req.params.id))
        .returning();

        if (!plan) return res.status(404).json({ error: "Treatment plan not found" });

        res.json(plan);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Delete a treatment plan ────────────────────────────────────────

router.delete("/:id", async (req, res) => {
    try {
        await db.delete(treatmentPlans).where(eq(treatmentPlans.id, req.params.id));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Add item to treatment plan ─────────────────────────────────────

router.post("/:id/items", async (req, res) => {
    try {
        const { patientId, toothCode, surfaces, procedureCode, procedureName, description, estimatedCost, discount } = req.body;
        
        const [item] = await db.insert(treatmentPlanItems).values({
            treatmentPlanId: req.params.id,
            patientId,
            toothCode,
            surfaces,
            procedureCode,
            procedureName,
            description,
            estimatedCost: estimatedCost || "0",
            discount: discount || "0",
            status: "proposed"
        }).returning();

        // Update plan total
        const plan = await db.query.treatmentPlans.findFirst({
            where: eq(treatmentPlans.id, req.params.id),
            with: { items: true }
        });
        
        if (plan) {
            const total = plan.items.reduce((acc: number, curr: any) => acc + (Number(curr.estimatedCost) - Number(curr.discount)), 0);
            await db.update(treatmentPlans).set({ totalEstimatedCost: total.toString() }).where(eq(treatmentPlans.id, plan.id));
        }

        res.status(201).json(item);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Update item status ─────────────────────────────────────────────

router.patch("/items/:itemId", async (req, res) => {
    try {
        const { status } = req.body;
        
        const [item] = await db.update(treatmentPlanItems).set({
            status,
            updatedAt: new Date()
        })
        .where(eq(treatmentPlanItems.id, req.params.itemId))
        .returning();

        if (!item) return res.status(404).json({ error: "Item not found" });

        res.json(item);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Delete an item ─────────────────────────────────────────────────

router.delete("/items/:itemId", async (req, res) => {
    try {
        const item = await db.query.treatmentPlanItems.findFirst({
            where: eq(treatmentPlanItems.id, req.params.itemId)
        });
        
        if (!item) return res.status(404).json({ error: "Item not found" });
        
        await db.delete(treatmentPlanItems).where(eq(treatmentPlanItems.id, req.params.itemId));
        
        // Recalculate total
        const plan = await db.query.treatmentPlans.findFirst({
            where: eq(treatmentPlans.id, item.treatmentPlanId),
            with: { items: true }
        });
        
        if (plan) {
            const total = plan.items.reduce((acc: number, curr: any) => acc + (Number(curr.estimatedCost) - Number(curr.discount)), 0);
            await db.update(treatmentPlans).set({ totalEstimatedCost: total.toString() }).where(eq(treatmentPlans.id, plan.id));
        }

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export { router as treatmentPlanRouter };
