import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import { demoFollowUps, demoPatients } from "../../demo-store.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();
router.use(requireAuth);

router.get("/patient/:patientId", (req, res) => {
    const results = demoFollowUps.filter((f) => f.patientId === req.params.patientId);
    res.json(results);
});

router.get("/visit/:visitId", (req, res) => {
    const results = demoFollowUps.filter((f) => f.visitId === req.params.visitId);
    res.json(results);
});

router.get("/upcoming", (_req, res) => {
    const now = new Date();
    const upcoming = demoFollowUps
        .filter((f) => f.status === "pending" && new Date(f.scheduledDate) >= now)
        .map((f) => {
            const pt = demoPatients.find((p) => p.id === f.patientId);
            return {
                ...f,
                patientName: pt?.firstName || "",
                patientLastName: pt?.lastName || "",
                patientFileNumber: pt?.fileNumber || "",
            };
        });
    res.json(upcoming);
});

router.get("/overdue", (_req, res) => {
    const now = new Date();
    const overdue = demoFollowUps
        .filter((f) => f.status === "pending" && new Date(f.scheduledDate) < now)
        .map((f) => {
            const pt = demoPatients.find((p) => p.id === f.patientId);
            return {
                ...f,
                patientName: pt?.firstName || "",
                patientLastName: pt?.lastName || "",
                patientFileNumber: pt?.fileNumber || "",
            };
        });
    res.json(overdue);
});

router.post("/", (req, res) => {
    const followUp = { id: uuidv4(), status: "pending", createdAt: new Date().toISOString(), ...req.body };
    demoFollowUps.push(followUp);
    res.status(201).json(followUp);
});

router.put("/:id", (req, res) => {
    const idx = demoFollowUps.findIndex((f) => f.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Follow-up not found" });
    demoFollowUps[idx] = { ...demoFollowUps[idx], ...req.body };
    res.json(demoFollowUps[idx]);
});

router.delete("/:id", (req, res) => {
    const idx = demoFollowUps.findIndex((f) => f.id === req.params.id);
    if (idx !== -1) demoFollowUps.splice(idx, 1);
    res.json({ success: true });
});

export { router as followUpRouter };
