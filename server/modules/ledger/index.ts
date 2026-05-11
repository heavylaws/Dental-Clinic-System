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

function roundToTwoDecimals(num: number): number {
    return Math.round(num * 100) / 100;
}

function parseDateOnly(input: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        return null;
    }

    return parsed;
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

// ─── Statement Types ────────────────────────────────────────────────────────

interface StatementEntry extends LedgerEntry {
    // Same as LedgerEntry for statement
}

interface StatementPaymentPlanSummary {
    planId: string;
    title: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    nextDueDate: string | null;
    overdueAmount: number;
    overdueCount: number;
}

interface PatientStatement {
    patient: {
        id: string;
        name: string;
        phone?: string | null;
        email?: string | null;
    };
    statement: {
        from: string;
        to: string;
        generatedAt: string;
        openingBalance: number;
        totalCharges: number;
        totalPayments: number;
        totalAdjustments: number;
        closingBalance: number;
    };
    entries: StatementEntry[];
    paymentPlans: StatementPaymentPlanSummary[];
}

// GET /api/ledger/patient/:patientId/statement - Get patient account statement
router.get("/patient/:patientId/statement", async (req, res) => {
    const { patientId } = req.params;
    const { from, to } = req.query;

    // Validate patient exists
    const patient = demoPatients.find((p) => p.id === patientId);
    if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
    }

    // Parse and validate dates
    const now = new Date();
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (from && typeof from === "string") {
        const parsedFrom = parseDateOnly(from);
        if (!parsedFrom) {
            return res.status(400).json({ error: "Invalid from date" });
        }
        parsedFrom.setUTCHours(0, 0, 0, 0);
        fromDate = parsedFrom;
    }

    if (to && typeof to === "string") {
        const parsedTo = parseDateOnly(to);
        if (!parsedTo) {
            return res.status(400).json({ error: "Invalid to date" });
        }
        // Set to end of day (UTC) for inclusive filtering.
        parsedTo.setUTCHours(23, 59, 59, 999);
        toDate = parsedTo;
    }

    if (fromDate && toDate && fromDate > toDate) {
        return res.status(400).json({ error: "'from' date cannot be after 'to' date" });
    }

    // Get all ledger entries
    const allEntries = computeLedgerEntries(patientId);

    // Determine date range
    const earliestEntry = allEntries.length > 0 ? allEntries[0] : null;

    const effectiveFromDate = fromDate || (earliestEntry ? new Date(earliestEntry.date) : new Date("2000-01-01"));
    const effectiveToDate = toDate || now;

    // Calculate opening balance (balance before from date)
    let openingBalance = 0;
    for (const entry of allEntries) {
        const entryDate = new Date(entry.date);
        if (entryDate < effectiveFromDate) {
            openingBalance += entry.debit - entry.credit;
        }
    }
    openingBalance = roundToTwoDecimals(openingBalance);

    // Filter entries within date range
    const statementEntries: StatementEntry[] = [];
    let totalCharges = 0;
    let totalPayments = 0;
    let totalAdjustments = 0;

    for (const entry of allEntries) {
        const entryDate = new Date(entry.date);
        if (entryDate >= effectiveFromDate && entryDate <= effectiveToDate) {
            statementEntries.push(entry);

            // Categorize amounts
            if (entry.type === "charge") {
                totalCharges += entry.debit;
            } else if (entry.type === "payment") {
                totalPayments += entry.credit;
            } else if (entry.type === "adjustment") {
                totalAdjustments += entry.debit - entry.credit;
            }
        }
    }

    totalCharges = roundToTwoDecimals(totalCharges);
    totalPayments = roundToTwoDecimals(totalPayments);
    totalAdjustments = roundToTwoDecimals(totalAdjustments);

    // Calculate closing balance. Prefer ledger running balance for exact reconciliation when entries exist.
    const rangeDelta = roundToTwoDecimals(totalCharges - totalPayments + totalAdjustments);
    const computedClosing = roundToTwoDecimals(openingBalance + rangeDelta);
    const lastEntryBalance =
        statementEntries.length > 0
            ? roundToTwoDecimals(statementEntries[statementEntries.length - 1].balanceAfter)
            : null;
    const closingBalance = lastEntryBalance ?? computedClosing;

    // Get payment plan summaries
    // Import payment plan data dynamically to avoid circular dependency
    let paymentPlanSummaries: StatementPaymentPlanSummary[] = [];
    try {
        const paymentPlanModule = await import("../paymentPlan/index.js");
        const { getPatientPaymentPlanSummaries } = paymentPlanModule;
        if (getPatientPaymentPlanSummaries) {
            paymentPlanSummaries = getPatientPaymentPlanSummaries(patientId);
        }
    } catch {
        // Payment plans module not available or no data
        paymentPlanSummaries = [];
    }

    const statement: PatientStatement = {
        patient: {
            id: patient.id,
            name: `${patient.firstName} ${patient.lastName}`,
            phone: patient.phone || null,
            email: patient.email || null,
        },
        statement: {
            from: effectiveFromDate.toISOString().split("T")[0],
            to: effectiveToDate.toISOString().split("T")[0],
            generatedAt: now.toISOString(),
            openingBalance: Number.isFinite(openingBalance) ? openingBalance : 0,
            totalCharges: Number.isFinite(totalCharges) ? totalCharges : 0,
            totalPayments: Number.isFinite(totalPayments) ? totalPayments : 0,
            totalAdjustments: Number.isFinite(totalAdjustments) ? totalAdjustments : 0,
            closingBalance: Number.isFinite(closingBalance) ? closingBalance : 0,
        },
        entries: statementEntries,
        paymentPlans: paymentPlanSummaries,
    };

    res.json(statement);
});

export { router as ledgerRouter };
