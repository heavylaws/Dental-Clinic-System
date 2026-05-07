import { Router } from "express";
import { db } from "../../db/index.js";
import { recalls } from "../../db/schema.js";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

// ─── Get all recalls for a patient ──────────────────────────────────

router.get("/patient/:patientId", async (req, res) => {
    try {
        const patientRecalls = await db.query.recalls.findMany({
            where: eq(recalls.patientId, req.params.patientId),
            orderBy: [asc(recalls.dueDate)],
        });
        res.json(patientRecalls);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Create a recall ────────────────────────────────────────────────

router.post("/", async (req, res) => {
    try {
        const { patientId, recallType, dueDate, notes } = req.body;
        
        const [recall] = await db.insert(recalls).values({
            patientId,
            recallType,
            dueDate: new Date(dueDate),
            notes,
            status: "pending"
        }).returning();

        res.status(201).json(recall);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Update a recall ────────────────────────────────────────────────

router.patch("/:id", async (req, res) => {
    try {
        const { status, notes, dueDate } = req.body;
        
        const [recall] = await db.update(recalls).set({
            status: status ?? undefined,
            notes: notes ?? undefined,
            dueDate: dueDate ? new Date(dueDate) : undefined
        })
        .where(eq(recalls.id, req.params.id))
        .returning();

        if (!recall) return res.status(404).json({ error: "Recall not found" });

        res.json(recall);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Delete a recall ────────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
    try {
        await db.delete(recalls).where(eq(recalls.id, req.params.id));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export { router as recallsRouter };
