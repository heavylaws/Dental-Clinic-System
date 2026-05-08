import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import { demoReferrals } from "../../demo-store.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();
router.use(requireAuth);

router.get("/patient/:patientId", (req, res) => {
    const results = demoReferrals.filter((r) => r.patientId === req.params.patientId);
    res.json(results);
});

router.get("/visit/:visitId", (req, res) => {
    const results = demoReferrals.filter((r) => r.visitId === req.params.visitId);
    res.json(results);
});

router.post("/", (req, res) => {
    const referral = { id: uuidv4(), status: "pending", createdAt: new Date().toISOString(), ...req.body };
    demoReferrals.push(referral);
    res.status(201).json(referral);
});

router.put("/:id", (req, res) => {
    const idx = demoReferrals.findIndex((r) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Referral not found" });
    demoReferrals[idx] = { ...demoReferrals[idx], ...req.body };
    res.json(demoReferrals[idx]);
});

router.delete("/:id", (req, res) => {
    const idx = demoReferrals.findIndex((r) => r.id === req.params.id);
    if (idx !== -1) demoReferrals.splice(idx, 1);
    res.json({ success: true });
});

export { router as referralRouter };
