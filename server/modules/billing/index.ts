import { Router } from "express";
import { requireAuth, requireRole } from "../auth/index.js";
import { demoBillings, getLiveDemoBillings, getLiveDemoVisits, demoVisits, demoPatients } from "../../demo-store.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();
router.use(requireAuth);

// Get billing for a visit (admin/reception only)
router.get("/visit/:visitId", requireRole("admin", "reception"), (req, res) => {
    const billing = demoBillings.find((b) => b.visitId === req.params.visitId);
    res.json(billing || null);
});

// Billing summary (filtered by date) (admin/reception only)
router.get("/", requireRole("admin", "reception"), (req, res) => {
    const { startDate, endDate } = req.query;
    let start: Date, end: Date;
    if (startDate) {
        const [y, m, d] = (startDate as string).split("-").map(Number);
        start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    } else {
        const t = new Date();
        start = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0, 0));
    }
    if (endDate) {
        const [y, m, d] = (endDate as string).split("-").map(Number);
        end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
    } else {
        const t = new Date();
        end = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59, 999));
    }

    const results = getLiveDemoBillings()
        .filter((b) => {
            const d = new Date(b.createdAt);
            return d >= start && d <= end;
        })
        .map((b) => {
            const visit = getLiveDemoVisits().find((v) => v.id === b.visitId);
            const patient = visit ? demoPatients.find((p) => p.id === visit.patientId) : null;
            return {
                ...b,
                patientFirstName: patient ? patient.firstName : "",
                patientLastName: patient ? patient.lastName : "",
            };
        });

    const totalBilled = results.reduce((sum, b) => sum + parseFloat(b.totalAmount || "0"), 0);
    const totalPaid = results.reduce((sum, b) => sum + parseFloat(b.paidAmount || "0"), 0);

    res.json({ billings: results, totalBilled, totalPaid, outstanding: totalBilled - totalPaid });
});

// Create billing (admin/reception only)
router.post("/", requireRole("admin", "reception"), (req, res) => {
    const billing = {
        id: uuidv4(),
        currency: "USD",
        status: "unpaid",
        createdAt: new Date().toISOString(),
        payments: [],
        ...req.body,
    };
    demoBillings.push(billing);
    // Update visit status
    const vIdx = demoVisits.findIndex((v) => v.id === billing.visitId);
    if (vIdx !== -1) demoVisits[vIdx].status = "billed";
    res.status(201).json(billing);
});

// Update billing (admin/reception only)
router.put("/:id", requireRole("admin", "reception"), (req, res) => {
    const idx = demoBillings.findIndex((b) => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Billing not found" });
    demoBillings[idx] = { ...demoBillings[idx], ...req.body };
    res.json(demoBillings[idx]);
});

// Add payment (admin/reception only)
router.post("/:id/payments", requireRole("admin", "reception"), (req, res) => {
    const billing = demoBillings.find((b) => b.id === req.params.id);
    if (!billing) return res.status(404).json({ error: "Billing not found" });
    const payment = { id: uuidv4(), billingId: req.params.id, method: "cash", paidAt: new Date().toISOString(), ...req.body };
    billing.payments.push(payment);
    // Recalculate paid amount and status
    const totalPaid = billing.payments.reduce((s: number, p: any) => s + parseFloat(p.amount || "0"), 0);
    billing.paidAmount = String(totalPaid);
    const total = parseFloat(billing.totalAmount || "0");
    if (totalPaid >= total) billing.status = "paid";
    else if (totalPaid > 0) billing.status = "partial";
    else billing.status = "unpaid";
    res.status(201).json(payment);
});

export { router as billingRouter };
