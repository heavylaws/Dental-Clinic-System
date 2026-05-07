import { Router } from "express";
import { db } from "../../db/index.js";
import { dentalCharts, toothRecords, dentalFindings } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

// ─── Get all dental charts for a patient ────────────────────────────

router.get("/patient/:patientId", async (req, res) => {
    try {
        const charts = await db.query.dentalCharts.findMany({
            where: eq(dentalCharts.patientId, req.params.patientId),
            orderBy: [desc(dentalCharts.chartDate)],
        });
        res.json(charts);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Get active chart and tooth records for a patient ───────────────
// This aggregates the latest state of teeth for the patient's main chart

router.get("/patient/:patientId/active", async (req, res) => {
    try {
        // Find existing chart or create one
        let chart = await db.query.dentalCharts.findFirst({
            where: eq(dentalCharts.patientId, req.params.patientId),
            orderBy: [desc(dentalCharts.chartDate)],
            with: {
                toothRecords: true,
                dentalFindings: {
                    where: eq(dentalFindings.status, "active")
                }
            }
        });

        if (!chart) {
            const [newChart] = await db.insert(dentalCharts).values({
                patientId: req.params.patientId,
                chartType: "existing",
                dentistId: (req.user as any)?.id,
            }).returning();
            
            chart = { ...newChart, toothRecords: [], dentalFindings: [] } as any;
        }

        res.json(chart);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Update tooth record status ─────────────────────────────────────

router.patch("/:chartId/tooth/:toothCode", async (req, res) => {
    try {
        const { status, notationSystem, dentition, arch, quadrant, toothType } = req.body;
        
        // Find existing tooth record
        const existing = await db.query.toothRecords.findFirst({
            where: (t, { and, eq }) => and(
                eq(t.chartId, req.params.chartId),
                eq(t.toothCode, req.params.toothCode)
            )
        });

        let record;
        if (existing) {
            [record] = await db.update(toothRecords).set({
                status: status ?? existing.status,
                updatedAt: new Date(),
            })
            .where(eq(toothRecords.id, existing.id))
            .returning();
        } else {
            // Get patientId from chart
            const chart = await db.query.dentalCharts.findFirst({
                where: eq(dentalCharts.id, req.params.chartId)
            });
            if (!chart) return res.status(404).json({ error: "Chart not found" });

            [record] = await db.insert(toothRecords).values({
                chartId: req.params.chartId,
                patientId: chart.patientId,
                toothCode: req.params.toothCode,
                status: status ?? "present",
                notationSystem,
                dentition,
                arch,
                quadrant,
                toothType,
            }).returning();
        }

        res.json(record);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export { router as dentalChartRouter };
