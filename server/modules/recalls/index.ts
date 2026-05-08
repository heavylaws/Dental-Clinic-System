import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import { demoRecalls, demoPatients } from "../../demo-store.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();
router.use(requireAuth);

router.get("/", (_req, res) => {
    const results = demoRecalls.map((r) => {
        const pt = demoPatients.find((p) => p.id === r.patientId);
        return { ...r, patientName: pt ? `${pt.firstName} ${pt.lastName}` : "", patientPhone: pt?.phone };
    });
    res.json(results);
});

router.get("/patient/:patientId", (req, res) => {
    const results = demoRecalls.filter((r) => r.patientId === req.params.patientId);
    res.json(results);
});

router.post("/", (req, res) => {
    const recall = { id: uuidv4(), status: "pending", createdAt: new Date().toISOString(), ...req.body };
    demoRecalls.push(recall);
    res.status(201).json(recall);
});

router.put("/:id", (req, res) => {
    const idx = demoRecalls.findIndex((r) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Recall not found" });
    demoRecalls[idx] = { ...demoRecalls[idx], ...req.body };
    res.json(demoRecalls[idx]);
});

router.patch("/:id", (req, res) => {
    const idx = demoRecalls.findIndex((r) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Recall not found" });
    demoRecalls[idx] = { ...demoRecalls[idx], ...req.body };
    res.json(demoRecalls[idx]);
});

router.delete("/:id", (req, res) => {
    const idx = demoRecalls.findIndex((r) => r.id === req.params.id);
    if (idx !== -1) demoRecalls.splice(idx, 1);
    res.json({ success: true });
});

export { router as recallsRouter };
