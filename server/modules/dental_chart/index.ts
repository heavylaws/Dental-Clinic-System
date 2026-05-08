import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();
router.use(requireAuth);

// In-memory dental charts store
const demoCharts: any[] = [];

function getOrCreateChart(patientId: string, userId: string) {
    let chart = demoCharts.find((c) => c.patientId === patientId);
    if (!chart) {
        chart = {
            id: uuidv4(),
            patientId,
            chartType: "existing",
            dentistId: userId,
            chartDate: new Date().toISOString(),
            toothRecords: [],
            dentalFindings: [],
        };
        demoCharts.push(chart);
    }
    return chart;
}

router.get("/patient/:patientId", (req, res) => {
    const charts = demoCharts.filter((c) => c.patientId === req.params.patientId);
    res.json(charts);
});

router.get("/patient/:patientId/active", (req, res) => {
    const chart = getOrCreateChart(req.params.patientId, (req.user as any)?.id);
    res.json(chart);
});

router.patch("/:chartId/tooth/:toothCode", (req, res) => {
    const chart = demoCharts.find((c) => c.id === req.params.chartId);
    if (!chart) return res.status(404).json({ error: "Chart not found" });
    const existing = chart.toothRecords.find((t: any) => t.toothCode === req.params.toothCode);
    if (existing) {
        Object.assign(existing, req.body);
    } else {
        chart.toothRecords.push({ id: uuidv4(), chartId: req.params.chartId, toothCode: req.params.toothCode, ...req.body });
    }
    res.json(chart);
});

export { router as dentalChartRouter };
