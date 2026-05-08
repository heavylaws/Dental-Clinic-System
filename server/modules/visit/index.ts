import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import { demoVisits, getLiveDemoVisits, demoPatients, demoBillings, getLiveDemoBillings } from "../../demo-store.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();
router.use(requireAuth);

export function learnTerm(_category: string, _term: string) {}

// Today queue
router.get("/queue", (_req, res) => {
    const gmtDate = new Date().toISOString().split("T")[0];
    const queue = getLiveDemoVisits()
        .filter((v) => (v.startedAt || "").startsWith(gmtDate))
        .filter((v) => v.status !== "billed" && v.status !== "cancelled")
        .map((v) => {
            const pt = demoPatients.find((p) => p.id === v.patientId);
            return {
                ...v,
                patientName: pt ? `${pt.firstName} ${pt.lastName}` : "Unknown",
                patientFileNumber: pt ? pt.fileNumber : null,
            };
        })
        .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    res.json(queue);
});

// Visits for a patient
router.get("/patient/:patientId", (req, res) => {
    const pvs = demoVisits
        .filter((v) => v.patientId === req.params.patientId)
        .map((v) => ({
            ...v,
            billing: demoBillings.find((b) => b.visitId === v.id) || null,
        }))
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    res.json(pvs);
});

// Single visit
router.get("/:id", (req, res) => {
    const v = demoVisits.find((v) => v.id === req.params.id);
    if (!v) return res.status(404).json({ error: "Visit not found" });
    const patient = demoPatients.find((p) => p.id === v.patientId);
    res.json({ ...v, patient, billing: demoBillings.find((b) => b.visitId === v.id) || null });
});

// Create visit
router.post("/", (req, res) => {
    const patientId = req.body.patientId;
    const prevCount = demoVisits.filter((v) => v.patientId === patientId).length;
    const visit = {
        id: uuidv4(),
        visitNumber: prevCount + 1,
        status: "queued",
        dentalFindings: [],
        prescriptions: [],
        labOrders: [],
        dentalProcedures: [],
        dentalMedia: [],
        ...req.body,
        startedAt: new Date().toISOString(),
        completedAt: null,
        billing: null,
    };
    demoVisits.push(visit);
    res.status(201).json(visit);
});

// Update visit
router.put("/:id", (req, res) => {
    const idx = demoVisits.findIndex((v) => v.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Visit not found" });
    demoVisits[idx] = { ...demoVisits[idx], ...req.body };
    res.json(demoVisits[idx]);
});

// Update status
router.patch("/:id/status", (req, res) => {
    const idx = demoVisits.findIndex((v) => v.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Visit not found" });
    const { status } = req.body;
    demoVisits[idx].status = status;
    if (status === "completed" || status === "billed") {
        demoVisits[idx].completedAt = new Date().toISOString();
    }
    res.json(demoVisits[idx]);
});

// Add finding
router.post("/:id/findings", (req, res) => {
    const visit = demoVisits.find((v) => v.id === req.params.id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    const finding = { id: uuidv4(), visitId: req.params.id, ...req.body };
    visit.dentalFindings.push(finding);
    res.status(201).json(finding);
});

// Delete finding
router.delete("/:id/findings/:findingId", (req, res) => {
    const visit = demoVisits.find((v) => v.id === req.params.id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    visit.dentalFindings = visit.dentalFindings.filter((f: any) => f.id !== req.params.findingId);
    res.json({ success: true });
});

// Add prescription
router.post("/:id/prescriptions", (req, res) => {
    const visit = demoVisits.find((v) => v.id === req.params.id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    const rx = { id: uuidv4(), visitId: req.params.id, ...req.body };
    visit.prescriptions.push(rx);
    res.status(201).json(rx);
});

// Delete prescription
router.delete("/:id/prescriptions/:rxId", (req, res) => {
    const visit = demoVisits.find((v) => v.id === req.params.id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    visit.prescriptions = visit.prescriptions.filter((r: any) => r.id !== req.params.rxId);
    res.json({ success: true });
});

// Add lab order
router.post("/:id/lab-orders", (req, res) => {
    const visit = demoVisits.find((v) => v.id === req.params.id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    const lab = { id: uuidv4(), visitId: req.params.id, orderedAt: new Date().toISOString(), status: "ordered", ...req.body };
    visit.labOrders.push(lab);
    res.status(201).json(lab);
});

// Update lab order status
router.patch("/:id/lab-orders/:labId", (req, res) => {
    const visit = demoVisits.find((v) => v.id === req.params.id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    const lab = visit.labOrders.find((l: any) => l.id === req.params.labId);
    if (!lab) return res.status(404).json({ error: "Lab order not found" });
    Object.assign(lab, req.body);
    res.json(lab);
});

// Delete lab order
router.delete("/:id/lab-orders/:labId", (req, res) => {
    const visit = demoVisits.find((v) => v.id === req.params.id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    visit.labOrders = visit.labOrders.filter((l: any) => l.id !== req.params.labId);
    res.json({ success: true });
});

// Add procedure
router.post("/:id/procedures", (req, res) => {
    const visit = demoVisits.find((v) => v.id === req.params.id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    const proc = { id: uuidv4(), visitId: req.params.id, performedAt: new Date().toISOString(), ...req.body };
    visit.dentalProcedures.push(proc);
    res.status(201).json(proc);
});

// Delete procedure
router.delete("/:id/procedures/:procId", (req, res) => {
    const visit = demoVisits.find((v) => v.id === req.params.id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    visit.dentalProcedures = visit.dentalProcedures.filter((p: any) => p.id !== req.params.procId);
    res.json({ success: true });
});

export { router as visitRouter };
