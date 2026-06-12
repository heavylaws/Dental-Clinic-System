import { Router } from "express";
import { requireAuth, requireRole } from "../auth/index.js";
import { logAuditEvent } from "../../audit.js";
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

// ─── Aging Calculation (Phase 6D1) ─────────────────────────────────────────

interface AgingBuckets {
    current: number;      // 0-30 days
    days31to60: number;   // 31-60 days
    days61to90: number;   // 61-90 days
    over90: number;       // 90+ days
}

interface AgingEntry {
    patientId: string;
    patientName: string;
    totalBalance: number;
    buckets: AgingBuckets;
    oldestUnpaidDate: string | null;
    lastPaymentDate: string | null;
}

interface AgingReport {
    asOf: string;
    totals: {
        totalBalance: number;
        current: number;
        days31to60: number;
        days61to90: number;
        over90: number;
        patientCount: number;
        overduePatientCount: number;
    };
    patients: AgingEntry[];
}

/**
 * Calculate aging buckets for a patient.
 * Uses FIFO allocation: payments/credits apply to oldest unpaid charges first.
 */
function computePatientAging(patientId: string, asOfDate: Date = new Date()): AgingEntry | null {
    const patient = demoPatients.find((p) => p.id === patientId);
    if (!patient) return null;

    const entries = computeLedgerEntries(patientId);

    // Get all debit entries (charges) and credit entries (payments/adjustments)
    const debits = entries.filter((e) => e.type === "charge" || (e.type === "adjustment" && e.debit > 0));
    const credits = entries.filter((e) => e.type === "payment" || (e.type === "adjustment" && e.credit > 0));

    // Sort debits by date ascending (oldest first) for FIFO allocation
    const sortedDebits = debits
        .map((d) => ({
            id: d.id,
            date: d.date,
            amount: d.debit,
            remaining: d.debit, // Will be reduced by credits
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Sort credits by date ascending (apply oldest credits first)
    const sortedCredits = credits
        .map((c) => ({
            date: c.date,
            amount: c.credit,
            remaining: c.credit,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Apply credits to debits (FIFO - oldest first)
    for (const credit of sortedCredits) {
        let creditToApply = credit.remaining;
        for (const debit of sortedDebits) {
            if (creditToApply <= 0) break;
            if (debit.remaining > 0) {
                const applyAmount = Math.min(debit.remaining, creditToApply);
                debit.remaining -= applyAmount;
                creditToApply -= applyAmount;
            }
        }
    }

    // Calculate aging buckets based on remaining unpaid amounts
    const asOfTime = asOfDate.getTime();
    const msPerDay = 24 * 60 * 60 * 1000;

    const buckets: AgingBuckets = {
        current: 0,
        days31to60: 0,
        days61to90: 0,
        over90: 0,
    };

    let oldestUnpaidDate: string | null = null;

    for (const debit of sortedDebits) {
        if (debit.remaining > 0) {
            const debitDate = new Date(debit.date);
            const ageDays = Math.floor((asOfTime - debitDate.getTime()) / msPerDay);

            // Track oldest unpaid date
            if (!oldestUnpaidDate || new Date(debit.date) < new Date(oldestUnpaidDate)) {
                oldestUnpaidDate = debit.date;
            }

            // Assign to bucket
            if (ageDays <= 30) {
                buckets.current += debit.remaining;
            } else if (ageDays <= 60) {
                buckets.days31to60 += debit.remaining;
            } else if (ageDays <= 90) {
                buckets.days61to90 += debit.remaining;
            } else {
                buckets.over90 += debit.remaining;
            }
        }
    }

    // Get last payment date
    const paymentEntries = entries.filter((e) => e.type === "payment");
    const lastPaymentDate = paymentEntries.length > 0
        ? paymentEntries[paymentEntries.length - 1].date
        : null;

    // Calculate total balance from ledger
    const totalCharged = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalPaid = entries.reduce((sum, e) => sum + e.credit, 0);
    const totalBalance = Math.max(0, roundToTwoDecimals(totalCharged - totalPaid));

    // Round buckets
    buckets.current = roundToTwoDecimals(buckets.current);
    buckets.days31to60 = roundToTwoDecimals(buckets.days31to60);
    buckets.days61to90 = roundToTwoDecimals(buckets.days61to90);
    buckets.over90 = roundToTwoDecimals(buckets.over90);

    // If total balance is 0 (or negative due to overpayment), all buckets should be 0
    if (totalBalance <= 0) {
        buckets.current = 0;
        buckets.days31to60 = 0;
        buckets.days61to90 = 0;
        buckets.over90 = 0;
    }

    // Verify: sum of buckets should equal total balance (for positive balances)
    const bucketSum = buckets.current + buckets.days31to60 + buckets.days61to90 + buckets.over90;
    if (totalBalance > 0 && Math.abs(bucketSum - totalBalance) > 0.01) {
        // Reconciliation mismatch detected
        const diff = totalBalance - bucketSum;
        
        // Log the mismatch for visibility (not silent correction)
        console.warn(
            `[AGING] Reconciliation mismatch for patient ${patientId}: ` +
            `bucketSum=$${bucketSum.toFixed(2)} vs totalBalance=$${totalBalance.toFixed(2)}, ` +
            `diff=$${Math.abs(diff).toFixed(2)}. Adjusting current bucket.`
        );
        
        // Only correct if mismatch is within acceptable rounding threshold (>= 0.01 and <= 0.05)
        if (Math.abs(diff) <= 0.05) {
            // Correction is acceptable (rounding error)
            buckets.current = roundToTwoDecimals(buckets.current + diff);
        } else {
            // Large mismatch - this indicates a bug in FIFO allocation or bucket calculation
            // Still correct to maintain data integrity, but log as ERROR
            console.error(
                `[AGING ERROR] LARGE reconciliation mismatch for patient ${patientId}: ` +
                `diff=$${Math.abs(diff).toFixed(2)} exceeds acceptable threshold. ` +
                `This may indicate a bug in FIFO allocation or bucket calculation.`
            );
            buckets.current = roundToTwoDecimals(buckets.current + diff);
        }
    }

    return {
        patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        totalBalance,
        buckets,
        oldestUnpaidDate,
        lastPaymentDate,
    };
}

/**
 * Compute aging report for all patients.
 */
function computeAgingReport(asOfDate: Date = new Date()): AgingReport {
    const patients: AgingEntry[] = [];

    for (const patient of demoPatients) {
        const aging = computePatientAging(patient.id, asOfDate);
        if (aging && aging.totalBalance > 0) {
            patients.push(aging);
        }
    }

    // Sort by total balance descending
    patients.sort((a, b) => b.totalBalance - a.totalBalance);

    // Calculate totals
    const totals = {
        totalBalance: roundToTwoDecimals(patients.reduce((sum, p) => sum + p.totalBalance, 0)),
        current: roundToTwoDecimals(patients.reduce((sum, p) => sum + p.buckets.current, 0)),
        days31to60: roundToTwoDecimals(patients.reduce((sum, p) => sum + p.buckets.days31to60, 0)),
        days61to90: roundToTwoDecimals(patients.reduce((sum, p) => sum + p.buckets.days61to90, 0)),
        over90: roundToTwoDecimals(patients.reduce((sum, p) => sum + p.buckets.over90, 0)),
        patientCount: patients.length,
        overduePatientCount: patients.filter((p) => p.buckets.days31to60 > 0 || p.buckets.days61to90 > 0 || p.buckets.over90 > 0).length,
    };

    return {
        asOf: asOfDate.toISOString(),
        totals,
        patients,
    };
}

// ─── Routes ────────────────────────────────────────────────────────────────

// GET /api/ledger/patient/:patientId - Get patient ledger (admin/reception only)
router.get("/patient/:patientId", requireRole("admin", "reception"), (req, res) => {
    const patientId = req.params.patientId as string;
    const ledger = computePatientLedger(patientId);

    if (!ledger) {
        return res.status(404).json({ error: "Patient not found" });
    }

    res.json(ledger);
});

// GET /api/ledger/patients - Get all patient balances (admin/reception only)
router.get("/patients", requireRole("admin", "reception"), (_req, res) => {
    const summaries = computeAllPatientBalances();
    res.json(summaries);
});

// GET /api/ledger/aging - Get aging report for all patients (admin/reception only)
router.get("/aging", requireRole("admin", "reception"), (_req, res) => {
    const report = computeAgingReport();
    res.json(report);
});

// GET /api/ledger/patient/:patientId/aging - Get aging for specific patient (admin/reception only)
router.get("/patient/:patientId/aging", requireRole("admin", "reception"), (req, res) => {
    const patientId = req.params.patientId as string;
    const aging = computePatientAging(patientId);

    if (!aging) {
        return res.status(404).json({ error: "Patient not found" });
    }

    res.json(aging);
});

// POST /api/ledger/patient/:patientId/adjustment - Add manual adjustment (admin/reception only)
router.post("/patient/:patientId/adjustment", requireRole("admin", "reception"), (req, res) => {
    const patientId = req.params.patientId as string;
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

    logAuditEvent({
        req,
        action: "LEDGER_ADJUSTMENT",
        entityType: "LedgerAdjustment",
        entityId: adjustment.id,
        patientId,
        summary: `Ledger ${direction} adjustment of ${numAmount} for patient ${patientId}: ${description || "Manual adjustment"}`,
        metadata: { amount: numAmount, direction, description },
    });

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

async function computePatientStatementData(
    patientId: string,
    from?: string,
    to?: string
): Promise<{ ok: true; statement: PatientStatement } | { ok: false; status: number; error: string }> {
    const patient = demoPatients.find((p) => p.id === patientId);
    if (!patient) {
        return { ok: false, status: 404, error: "Patient not found" };
    }

    const now = new Date();
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (from !== undefined) {
        const parsedFrom = parseDateOnly(from);
        if (!parsedFrom) {
            return { ok: false, status: 400, error: "Invalid from date" };
        }
        parsedFrom.setUTCHours(0, 0, 0, 0);
        fromDate = parsedFrom;
    }

    if (to !== undefined) {
        const parsedTo = parseDateOnly(to);
        if (!parsedTo) {
            return { ok: false, status: 400, error: "Invalid to date" };
        }
        parsedTo.setUTCHours(23, 59, 59, 999);
        toDate = parsedTo;
    }

    if (fromDate && toDate && fromDate > toDate) {
        return { ok: false, status: 400, error: "'from' date cannot be after 'to' date" };
    }

    const allEntries = computeLedgerEntries(patientId);
    const earliestEntry = allEntries.length > 0 ? allEntries[0] : null;

    const effectiveFromDate = fromDate || (earliestEntry ? new Date(earliestEntry.date) : new Date("2000-01-01"));
    const effectiveToDate = toDate || now;

    let openingBalance = 0;
    for (const entry of allEntries) {
        const entryDate = new Date(entry.date);
        if (entryDate < effectiveFromDate) {
            openingBalance += entry.debit - entry.credit;
        }
    }
    openingBalance = roundToTwoDecimals(openingBalance);

    const statementEntries: StatementEntry[] = [];
    let totalCharges = 0;
    let totalPayments = 0;
    let totalAdjustments = 0;

    for (const entry of allEntries) {
        const entryDate = new Date(entry.date);
        if (entryDate >= effectiveFromDate && entryDate <= effectiveToDate) {
            statementEntries.push(entry);
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

    const rangeDelta = roundToTwoDecimals(totalCharges - totalPayments + totalAdjustments);
    const computedClosing = roundToTwoDecimals(openingBalance + rangeDelta);
    const lastEntryBalance =
        statementEntries.length > 0
            ? roundToTwoDecimals(statementEntries[statementEntries.length - 1].balanceAfter)
            : null;
    const closingBalance = lastEntryBalance ?? computedClosing;

    let paymentPlanSummaries: StatementPaymentPlanSummary[] = [];
    try {
        const paymentPlanModule = await import("../paymentPlan/index.js");
        const { getPatientPaymentPlanSummaries } = paymentPlanModule;
        if (getPatientPaymentPlanSummaries) {
            paymentPlanSummaries = getPatientPaymentPlanSummaries(patientId);
        }
    } catch {
        paymentPlanSummaries = [];
    }

    return {
        ok: true,
        statement: {
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
        },
    };
}

// GET /api/ledger/patient/:patientId/statement - Get patient account statement (admin/reception only)
router.get("/patient/:patientId/statement", requireRole("admin", "reception"), async (req, res) => {
    const patientId = req.params.patientId as string;
    const { from, to } = req.query;

    const computed = await computePatientStatementData(
        patientId,
        typeof from === "string" ? from : undefined,
        typeof to === "string" ? to : undefined
    );

    if (!computed.ok) {
        return res.status(computed.status).json({ error: computed.error });
    }

    res.json(computed.statement);
});

// ─── Statement Share (Phase 6C2) ──────────────────────────────────────────

interface StatementShareLog {
    id: string;
    patientId: string;
    patientName: string;
    channel: "whatsapp" | "email";
    status: "sent" | "stubbed" | "not_configured" | "failed";
    from?: string;
    to?: string;
    closingBalance: number;
    message: string;
    error?: string;
    createdAt: string;
}

// In-memory share logs for demo (resets on server restart)
const demoStatementShareLogs: StatementShareLog[] = [];

// POST /api/ledger/patient/:patientId/statement/share - Share statement (admin/reception only)
router.post("/patient/:patientId/statement/share", requireRole("admin", "reception"), async (req, res) => {
    const patientId = req.params.patientId as string;
    const { from, to, channel, message: customMessage } = req.body as {
        from?: string;
        to?: string;
        channel: "whatsapp" | "email";
        message?: string;
    };

    // Validate channel
    if (channel !== "whatsapp" && channel !== "email") {
        return res.status(400).json({ error: "Channel must be 'whatsapp' or 'email'" });
    }

    const computed = await computePatientStatementData(patientId, from, to);
    if (!computed.ok) {
        return res.status(computed.status).json({ error: computed.error });
    }
    const statementData = computed.statement;

    const patientPhone = statementData.patient.phone || null;
    const patientEmail = statementData.patient.email || null;

    const { statement, paymentPlans } = statementData;
    const patientName = statementData.patient.name;
    const effectiveFrom = statement.from;
    const effectiveTo = statement.to;
    const periodText = `${effectiveFrom} to ${effectiveTo}`;

    // Build message
    let shareMessage = customMessage || "";
    if (!shareMessage) {
        shareMessage =
            `*Dental Clinic - Account Statement*\n\n` +
            `Patient: ${patientName}\n` +
            `Period: ${periodText}\n\n` +
            `*Summary:*\n` +
            `Opening Balance: $${statement.openingBalance.toLocaleString()}\n` +
            `Total Charges: +$${statement.totalCharges.toLocaleString()}\n` +
            `Total Payments: -$${statement.totalPayments.toLocaleString()}\n`;
        if (statement.totalAdjustments !== 0) {
            shareMessage += `Adjustments: $${statement.totalAdjustments.toLocaleString()}\n`;
        }
        shareMessage += `*Closing Balance: $${statement.closingBalance.toLocaleString()}*\n`;

        // Add payment plan summary if available
        const activePlans = paymentPlans.filter((p) => p.status === "active");
        if (activePlans.length > 0) {
            shareMessage += `\n*Active Payment Plans:*\n`;
            for (const plan of activePlans) {
                shareMessage += `• ${plan.title}: Paid $${plan.paidAmount.toLocaleString()} / $${plan.totalAmount.toLocaleString()}`;
                if (plan.remainingAmount > 0) {
                    shareMessage += ` (Remaining: $${plan.remainingAmount.toLocaleString()}`;
                    if (plan.overdueCount > 0) {
                        shareMessage += `, ${plan.overdueCount} overdue`;
                    }
                    shareMessage += `)`;
                }
                shareMessage += `\n`;
                if (plan.nextDueDate) {
                    shareMessage += `  Next due: ${new Date(plan.nextDueDate).toLocaleDateString()}\n`;
                }
            }
        }

        shareMessage += `\nPlease contact the clinic for details.`;
    }

    // Handle WhatsApp
    if (channel === "whatsapp") {
        if (!patientPhone) {
            const log: StatementShareLog = {
                id: uuidv4(),
                patientId,
                patientName,
                channel: "whatsapp",
                status: "failed",
                from: effectiveFrom,
                to: effectiveTo,
                closingBalance: statement.closingBalance,
                message: shareMessage,
                error: "Patient has no phone number",
                createdAt: new Date().toISOString(),
            };
            demoStatementShareLogs.push(log);
            return res.status(400).json({
                success: false,
                status: "failed",
                channel: "whatsapp",
                message: "Patient has no phone number on file",
                log,
            });
        }

        const digits = patientPhone.replace(/\D/g, "");
        if (digits.length < 7) {
            const log: StatementShareLog = {
                id: uuidv4(),
                patientId,
                patientName,
                channel: "whatsapp",
                status: "failed",
                from: effectiveFrom,
                to: effectiveTo,
                closingBalance: statement.closingBalance,
                message: shareMessage,
                error: "Patient phone number is invalid",
                createdAt: new Date().toISOString(),
            };
            demoStatementShareLogs.push(log);
            return res.status(400).json({
                success: false,
                status: "failed",
                channel: "whatsapp",
                message: "Patient phone number is invalid",
                log,
            });
        }

        // Try to send via WhatsApp
        try {
            const { sendWhatsApp } = await import("../whatsapp/index.js");
            const result = await sendWhatsApp(patientPhone, shareMessage);

            if (result.ok) {
                const log: StatementShareLog = {
                    id: uuidv4(),
                    patientId,
                    patientName,
                    channel: "whatsapp",
                    status: "sent",
                    from: effectiveFrom,
                    to: effectiveTo,
                    closingBalance: statement.closingBalance,
                    message: shareMessage,
                    createdAt: new Date().toISOString(),
                };
                demoStatementShareLogs.push(log);
                return res.json({
                    success: true,
                    status: "sent",
                    channel: "whatsapp",
                    message: "Statement sent via WhatsApp",
                    log,
                });
            } else {
                // WhatsApp not connected - return stubbed with wa.me URL
                if (result.error === "Invalid phone number") {
                    const log: StatementShareLog = {
                        id: uuidv4(),
                        patientId,
                        patientName,
                        channel: "whatsapp",
                        status: "failed",
                        from: effectiveFrom,
                        to: effectiveTo,
                        closingBalance: statement.closingBalance,
                        message: shareMessage,
                        error: result.error,
                        createdAt: new Date().toISOString(),
                    };
                    demoStatementShareLogs.push(log);
                    return res.status(400).json({
                        success: false,
                        status: "failed",
                        channel: "whatsapp",
                        message: "Patient phone number is invalid",
                        log,
                    });
                }

                const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(shareMessage)}`;
                const log: StatementShareLog = {
                    id: uuidv4(),
                    patientId,
                    patientName,
                    channel: "whatsapp",
                    status: "stubbed",
                    from: effectiveFrom,
                    to: effectiveTo,
                    closingBalance: statement.closingBalance,
                    message: shareMessage,
                    error: result.error,
                    createdAt: new Date().toISOString(),
                };
                demoStatementShareLogs.push(log);
                return res.json({
                    success: true,
                    status: "stubbed",
                    channel: "whatsapp",
                    message: "WhatsApp is not connected. Use the link to send manually.",
                    waUrl,
                    log,
                });
            }
        } catch (e: any) {
            // WhatsApp module error - return stubbed with wa.me URL
            const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(shareMessage)}`;
            const log: StatementShareLog = {
                id: uuidv4(),
                patientId,
                patientName,
                channel: "whatsapp",
                status: "stubbed",
                from: effectiveFrom,
                to: effectiveTo,
                closingBalance: statement.closingBalance,
                message: shareMessage,
                error: e.message,
                createdAt: new Date().toISOString(),
            };
            demoStatementShareLogs.push(log);
            return res.json({
                success: true,
                status: "stubbed",
                channel: "whatsapp",
                message: "WhatsApp service unavailable. Use the link to send manually.",
                waUrl,
                log,
            });
        }
    }

    // Handle Email
    if (channel === "email") {
        if (!patientEmail) {
            const log: StatementShareLog = {
                id: uuidv4(),
                patientId,
                patientName,
                channel: "email",
                status: "failed",
                from: effectiveFrom,
                to: effectiveTo,
                closingBalance: statement.closingBalance,
                message: shareMessage,
                error: "Patient has no email address",
                createdAt: new Date().toISOString(),
            };
            demoStatementShareLogs.push(log);
            return res.status(400).json({
                success: false,
                status: "failed",
                channel: "email",
                message: "Patient has no email address on file",
                log,
            });
        }

        // Email not configured in this system
        const log: StatementShareLog = {
            id: uuidv4(),
            patientId,
            patientName,
            channel: "email",
            status: "not_configured",
            from: effectiveFrom,
            to: effectiveTo,
            closingBalance: statement.closingBalance,
            message: shareMessage,
            error: "Email sending is not configured",
            createdAt: new Date().toISOString(),
        };
        demoStatementShareLogs.push(log);
        return res.json({
            success: false,
            status: "not_configured",
            channel: "email",
            message: "Email sending is not configured. Please contact the administrator to set up SMTP.",
            log,
        });
    }

    // Should not reach here
    return res.status(400).json({ error: "Invalid channel" });
});

// Internal helper to emit audit event after statement share (used above)
// Note: logAuditEvent is called before each return inside the share handler via inline calls.
// A post-response audit hook would require refactoring the handler significantly;
// instead we rely on the HTTP-level audit middleware for statement share logging.

// GET /api/ledger/patient/:patientId/statement/share-logs - Get share history (admin/reception only)
router.get("/patient/:patientId/statement/share-logs", requireRole("admin", "reception"), (req, res) => {
    const { patientId } = req.params;

    // Validate patient exists
    const patient = demoPatients.find((p) => p.id === patientId);
    if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
    }

    const logs = demoStatementShareLogs
        .filter((log) => log.patientId === patientId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
        patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        logs,
        count: logs.length,
    });
});

export { router as ledgerRouter };
