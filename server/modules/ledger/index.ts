import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import { demoBillings, demoPatients, demoVisits, getLiveDemoBillings, getLiveDemoVisits } from "../../demo-store.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();
router.use(requireAuth);

// ─── Types ─────────────────────────────────────────────────────────────────

interface LedgerEntry {
    id: string;
    patientId: string;
    date: string;
    type: "charge" | "payment" | "adjustment";
    sourceType: "visit" | "invoice" | "payment" | "manual";
    sourceId: string;
    description: string;
    debit: number;
    credit: number;
    balanceAfter: number;
    status?: string;
}

interface LedgerAdjustment {
    id: string;
    patientId: string;
    date: string;
    amount: number;
    description: string;
    direction: "debit" | "credit";
    sourceType?: "manual" | "payment";
    sourceId?: string;
}

interface PatientLedger {
    patientId: string;
    patientName: string;
    totals: {
        charged: number;
        paid: number;
        balance: number;
        invoiceCount: number;
        paymentCount: number;
        lastPaymentDate: string | null;
        lastChargeDate: string | null;
    };
    entries: LedgerEntry[];
}

interface PatientBalanceSummary {
    patientId: string;
    patientName: string;
    charged: number;
    paid: number;
    balance: number;
    lastActivityDate: string | null;
}

// In-memory adjustments for demo (resets on server restart)
const demoAdjustments: LedgerAdjustment[] = [];

export function createLedgerCreditEntry(params: {
    patientId: string;
    amount: number;
    description: string;
    sourceId: string;
    sourceType?: "manual" | "payment";
    date?: string;
}): LedgerEntry {
    const patient = demoPatients.find((p) => p.id === params.patientId);
    if (!patient) {
        throw new Error("Patient not found");
    }

    const amount = safeParseFloat(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Amount must be a positive number");
    }

    const adjustment: LedgerAdjustment = {
        id: uuidv4(),
        patientId: params.patientId,
        date: params.date || new Date().toISOString(),
        amount,
        description: params.description || "Manual adjustment",
        direction: "credit",
        sourceType: params.sourceType || "payment",
        sourceId: params.sourceId,
    };

    demoAdjustments.push(adjustment);

    return {
        id: `adj-${adjustment.id}`,
        patientId: adjustment.patientId,
        date: adjustment.date,
        type: adjustment.sourceType === "payment" ? "payment" : "adjustment",
        sourceType: adjustment.sourceType === "payment" ? "payment" : "manual",
        sourceId: adjustment.sourceId || adjustment.id,
        description: adjustment.description,
        debit: 0,
        credit: adjustment.amount,
        balanceAfter: 0,
    };
}

// ─── Helper Functions ──────────────────────────────────────────────────────

function safeParseFloat(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
}

function getPatientVisits(patientId: string): any[] {
    return getLiveDemoVisits().filter((v) => v.patientId === patientId);
}

function getPatientBillings(patientId: string): any[] {
    const visits = getPatientVisits(patientId);
    const visitIds = new Set(visits.map((v) => v.id));
    return getLiveDemoBillings().filter((b) => visitIds.has(b.visitId));
}

function getPatientAdjustments(patientId: string): typeof demoAdjustments {
    return demoAdjustments.filter((a) => a.patientId === patientId);
}

function computeLedgerEntries(patientId: string): LedgerEntry[] {
    const entries: LedgerEntry[] = [];
    const visits = getPatientVisits(patientId);
    const billings = getPatientBillings(patientId);

    // Create charge entries from billings
    for (const billing of billings) {
        const visit = visits.find((v) => v.id === billing.visitId);
        const amount = safeParseFloat(billing.totalAmount);
        if (amount > 0) {
            entries.push({
                id: `charge-${billing.id}`,
                patientId,
                date: billing.createdAt || new Date().toISOString(),
                type: "charge",
                sourceType: "invoice",
                sourceId: billing.id,
                description: visit?.visitType
                    ? `${visit.visitType.charAt(0).toUpperCase() + visit.visitType.slice(1)} - Visit #${visit.visitNumber || "?"}`
                    : "Invoice",
                debit: amount,
                credit: 0,
                balanceAfter: 0, // Will be calculated
                status: billing.status,
            });
        }

        // Create payment entries from billing payments
        if (billing.payments && Array.isArray(billing.payments)) {
            for (const payment of billing.payments) {
                const paymentAmount = safeParseFloat(payment.amount);
                if (paymentAmount > 0) {
                    entries.push({
                        id: `payment-${payment.id}`,
                        patientId,
                        date: payment.paidAt || billing.createdAt || new Date().toISOString(),
                        type: "payment",
                        sourceType: "payment",
                        sourceId: payment.id,
                        description: `Payment - ${payment.method || "cash"}`,
                        debit: 0,
                        credit: paymentAmount,
                        balanceAfter: 0, // Will be calculated
                    });
                }
            }
        }
    }

    // Add manual adjustments
    const adjustments = getPatientAdjustments(patientId);
    for (const adj of adjustments) {
        const isPaymentCredit = adj.sourceType === "payment" && adj.direction === "credit";
        entries.push({
            id: `adj-${adj.id}`,
            patientId,
            date: adj.date,
            type: isPaymentCredit ? "payment" : "adjustment",
            sourceType: isPaymentCredit ? "payment" : "manual",
            sourceId: adj.sourceId || adj.id,
            description: adj.description || "Manual adjustment",
            debit: adj.direction === "debit" ? adj.amount : 0,
            credit: adj.direction === "credit" ? adj.amount : 0,
            balanceAfter: 0, // Will be calculated
        });
    }

    // Sort by date ascending, then by type (charges before payments on same date)
    entries.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        // On same date, charges come before payments
        if (a.type === "charge" && b.type !== "charge") return -1;
        if (a.type !== "charge" && b.type === "charge") return 1;
        return 0;
    });

    // Calculate running balance
    let runningBalance = 0;
    for (const entry of entries) {
        runningBalance += entry.debit - entry.credit;
        entry.balanceAfter = runningBalance;
    }

    return entries;
}

function computePatientLedger(patientId: string): PatientLedger | null {
    const patient = demoPatients.find((p) => p.id === patientId);
    if (!patient) return null;

    const entries = computeLedgerEntries(patientId);

    const charged = entries.reduce((sum, e) => sum + e.debit, 0);
    const paid = entries.reduce((sum, e) => sum + e.credit, 0);

    const chargeEntries = entries.filter((e) => e.type === "charge");
    const paymentEntries = entries.filter((e) => e.type === "payment");

    const lastPaymentDate = paymentEntries.length > 0
        ? paymentEntries[paymentEntries.length - 1].date
        : null;
    const lastChargeDate = chargeEntries.length > 0
        ? chargeEntries[chargeEntries.length - 1].date
        : null;

    return {
        patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        totals: {
            charged,
            paid,
            balance: charged - paid,
            invoiceCount: chargeEntries.length,
            paymentCount: paymentEntries.length,
            lastPaymentDate,
            lastChargeDate,
        },
        entries,
    };
}

function computeAllPatientBalances(): PatientBalanceSummary[] {
    const summaries: PatientBalanceSummary[] = [];

    for (const patient of demoPatients) {
        const entries = computeLedgerEntries(patient.id);
        const charged = entries.reduce((sum, e) => sum + e.debit, 0);
        const paid = entries.reduce((sum, e) => sum + e.credit, 0);

        // Find last activity date
        const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
        const lastActivityDate = lastEntry ? lastEntry.date : null;

        summaries.push({
            patientId: patient.id,
            patientName: `${patient.firstName} ${patient.lastName}`,
            charged,
            paid,
            balance: charged - paid,
            lastActivityDate,
        });
    }

    // Sort by balance descending (non-zero first, then by balance amount)
    summaries.sort((a, b) => {
        // Put zero balances at the end
        if (a.balance === 0 && b.balance !== 0) return 1;
        if (a.balance !== 0 && b.balance === 0) return -1;
        return b.balance - a.balance;
    });

    return summaries;
}

// ─── Routes ────────────────────────────────────────────────────────────────

// GET /api/ledger/patient/:patientId - Get patient ledger
router.get("/patient/:patientId", (req, res) => {
    const { patientId } = req.params;
    const ledger = computePatientLedger(patientId);

    if (!ledger) {
        return res.status(404).json({ error: "Patient not found" });
    }

    res.json(ledger);
});

// GET /api/ledger/patients - Get all patient balances
router.get("/patients", (_req, res) => {
    const summaries = computeAllPatientBalances();
    res.json(summaries);
});

// POST /api/ledger/patient/:patientId/adjustment - Add manual adjustment
router.post("/patient/:patientId/adjustment", (req, res) => {
    const { patientId } = req.params;
    const { amount, description, direction } = req.body;

    // Validate patient exists
    const patient = demoPatients.find((p) => p.id === patientId);
    if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
    }

    // Validate amount
    const numAmount = safeParseFloat(amount);
    if (numAmount <= 0 || isNaN(numAmount)) {
        return res.status(400).json({ error: "Amount must be a positive number" });
    }

    // Validate direction
    if (direction !== "debit" && direction !== "credit") {
        return res.status(400).json({ error: "Direction must be 'debit' or 'credit'" });
    }

    const adjustment = {
        id: uuidv4(),
        patientId,
        date: new Date().toISOString(),
        amount: numAmount,
        description: description || "Manual adjustment",
        direction,
    };

    demoAdjustments.push(adjustment);

    res.status(201).json({
        success: true,
        adjustment: {
            id: adjustment.id,
            patientId: adjustment.patientId,
            date: adjustment.date,
            amount: adjustment.amount,
            description: adjustment.description,
            direction: adjustment.direction,
        },
        note: "Adjustments are stored in-memory only and will reset on server restart",
    });
});

export { router as ledgerRouter };
