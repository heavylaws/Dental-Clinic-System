import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();
router.use(requireAuth);

const demoTreatmentPlans: any[] = [];

router.get("/patient/:patientId", (req, res) => {
    const plans = demoTreatmentPlans.filter((p) => p.patientId === req.params.patientId);
    res.json(plans);
});

router.post("/", (req, res) => {
    const plan = {
        id: uuidv4(),
        status: "draft",
        priority: "normal",
        createdBy: (req.user as any)?.id,
        createdAt: new Date().toISOString(),
        items: [],
        ...req.body,
    };
    demoTreatmentPlans.push(plan);
    res.status(201).json(plan);
});

router.patch("/:id", (req, res) => {
    const idx = demoTreatmentPlans.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Treatment plan not found" });
    demoTreatmentPlans[idx] = { ...demoTreatmentPlans[idx], ...req.body };
    res.json(demoTreatmentPlans[idx]);
});

router.delete("/:id", (req, res) => {
    const idx = demoTreatmentPlans.findIndex((p) => p.id === req.params.id);
    if (idx !== -1) demoTreatmentPlans.splice(idx, 1);
    res.json({ success: true });
});

router.post("/:id/items", (req, res) => {
    const plan = demoTreatmentPlans.find((p) => p.id === req.params.id);
    if (!plan) return res.status(404).json({ error: "Treatment plan not found" });
    const item = { id: uuidv4(), planId: req.params.id, status: "pending", sequenceOrder: plan.items.length + 1, ...req.body };
    plan.items.push(item);
    res.status(201).json(item);
});

router.patch("/:id/items/:itemId", (req, res) => {
    const plan = demoTreatmentPlans.find((p) => p.id === req.params.id);
    if (!plan) return res.status(404).json({ error: "Treatment plan not found" });
    const idx = plan.items.findIndex((i: any) => i.id === req.params.itemId);
    if (idx === -1) return res.status(404).json({ error: "Item not found" });
    plan.items[idx] = { ...plan.items[idx], ...req.body };
    res.json(plan.items[idx]);
});

router.delete("/:id/items/:itemId", (req, res) => {
    const plan = demoTreatmentPlans.find((p) => p.id === req.params.id);
    if (!plan) return res.status(404).json({ error: "Treatment plan not found" });
    plan.items = plan.items.filter((i: any) => i.id !== req.params.itemId);
    res.json({ success: true });
});

export { router as treatmentPlanRouter };
