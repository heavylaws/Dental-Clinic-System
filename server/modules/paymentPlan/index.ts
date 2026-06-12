import { Router } from "express";
import { requireAuth, requireRole } from "../auth/index.js";
import { logAuditEvent } from "../../audit.js";
import { demoPatients } from "../../demo-store.js";
import { createLedgerCreditEntry } from "../ledger/index.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();
router.use(requireAuth);

// ─── Types ─────────────────────────────────────────────────────────────────

interface PaymentPlan {
    id: string;
    patientId: string;
    title: string;
    description?: string;
    totalAmount: number;
    downPayment: number;
    installmentCount: number;
    installmentAmount: number;
    startDate: string;
    frequency: "weekly" | "biweekly" | "monthly";
    status: "active" | "completed" | "cancelled";
    createdAt: string;
    updatedAt: string;
}

interface PaymentInstallment {
    id: string;
    planId: string;
    patientId: string;
    installmentNumber: number;
    dueDate: string;
    amount: number;
    paidAmount: number;
    status: "pending" | "partial" | "paid" | "overdue" | "cancelled";
    paidAt?: string | null;
}

interface InstallmentPaymentRecord {
    id: string;
    installmentId: string;
    planId: string;
    patientId: string;
    amount: number;
    note?: string;
    createdAt: string;
}

// ─── In-Memory Storage (Demo Mode) ─────────────────────────────────────────

const demoPaymentPlans: PaymentPlan[] = [];
const demoInstallments: PaymentInstallment[] = [];
const demoInstallmentPayments: InstallmentPaymentRecord[] = [];

// ─── Helper Functions ──────────────────────────────────────────────────────

function safeParseFloat(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
}

function parseMoney(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return roundToTwoDecimals(parsed);
}

function roundToTwoDecimals(num: number): number {
    return Math.round(num * 100) / 100;
}

function calculateInstallmentAmounts(
    totalAmount: number,
    downPayment: number,
    installmentCount: number
): number[] {
    const remaining = roundToTwoDecimals(totalAmount - downPayment);
    const baseAmount = Math.floor((remaining / installmentCount) * 100) / 100;
    const amounts: number[] = [];

    let total = 0;
    for (let i = 0; i < installmentCount - 1; i++) {
        amounts.push(baseAmount);
        total = roundToTwoDecimals(total + baseAmount);
    }

    // Last installment absorbs rounding difference
    const lastAmount = roundToTwoDecimals(remaining - total);
    amounts.push(lastAmount);

    return amounts;
}

function calculateDueDate(startDate: string, installmentNumber: number, frequency: string): string {
    const start = new Date(startDate);
    const due = new Date(start);

    switch (frequency) {
        case "weekly":
            due.setDate(start.getDate() + (installmentNumber - 1) * 7);
            break;
        case "biweekly":
            due.setDate(start.getDate() + (installmentNumber - 1) * 14);
            break;
        case "monthly":
        default:
            due.setMonth(start.getMonth() + (installmentNumber - 1));
            break;
    }

    return due.toISOString();
}

function getInstallmentStatus(
    installment: PaymentInstallment,
    planStatus: string
): PaymentInstallment["status"] {
    if (planStatus === "cancelled") return "cancelled";
    if (installment.paidAmount >= installment.amount) return "paid";
    if (installment.paidAmount > 0) return "partial";

    const today = new Date();
    const dueDate = new Date(installment.dueDate);
    if (dueDate < today) return "overdue";

    return "pending";
}

function getPlanSummary(plan: PaymentPlan, installments: PaymentInstallment[]) {
    const paidAmount = roundToTwoDecimals(
        installments.reduce((sum, inst) => sum + inst.paidAmount, 0)
    );
    const scheduledAmount = roundToTwoDecimals(
        installments
            .filter((inst) => inst.status !== "cancelled")
            .reduce((sum, inst) => sum + inst.amount, 0)
    );
    const remainingAmount = roundToTwoDecimals(scheduledAmount - paidAmount);

    const pendingInstallments = installments.filter(
        (inst) => inst.status === "pending" || inst.status === "partial" || inst.status === "overdue"
    );
    const nextDueInstallment = pendingInstallments.sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    )[0];

    const overdueInstallments = installments.filter((inst) => inst.status === "overdue");
    const overdueAmount = roundToTwoDecimals(
        overdueInstallments.reduce((sum, inst) => sum + (inst.amount - inst.paidAmount), 0)
    );

    return {
        totalAmount: plan.totalAmount,
        downPayment: plan.downPayment,
        scheduledAmount,
        paidAmount,
        remainingAmount,
        nextDueDate: nextDueInstallment?.dueDate || null,
        overdueAmount,
        overdueCount: overdueInstallments.length,
    };
}

// ─── Routes ────────────────────────────────────────────────────────────────

// GET /api/payment-plans/patient/:patientId - Get patient's payment plans (admin/reception only)
router.get("/patient/:patientId", requireRole("admin", "reception"), (req, res) => {
    const patientId = req.params.patientId as string;

    // Validate patient exists
    const patient = demoPatients.find((p) => p.id === patientId);
    if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
    }

    const plans = demoPaymentPlans.filter((p) => p.patientId === patientId);

    const plansWithDetails = plans.map((plan) => {
        const installments = demoInstallments.filter((i) => i.planId === plan.id);

        // Update installment statuses
        const updatedInstallments = installments.map((inst) => ({
            ...inst,
            status: getInstallmentStatus(inst, plan.status),
        }));

        const summary = getPlanSummary(plan, updatedInstallments);

        return {
            plan,
            installments: updatedInstallments,
            summary,
        };
    });

    res.json({
        patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        plans: plansWithDetails,
    });
});

// POST /api/payment-plans/patient/:patientId - Create payment plan (admin/reception only)
router.post("/patient/:patientId", requireRole("admin", "reception"), (req, res) => {
    const patientId = req.params.patientId as string;
    const {
        title,
        description,
        totalAmount,
        downPayment = 0,
        installmentCount,
        startDate,
        frequency,
    } = req.body;

    // Validate patient exists
    const patient = demoPatients.find((p) => p.id === patientId);
    if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
    }

    // Validate required fields
    if (!title || typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json({ error: "Title is required" });
    }

    const numTotalAmount = parseMoney(totalAmount);
    if (numTotalAmount === null || numTotalAmount <= 0) {
        return res.status(400).json({ error: "Total amount must be greater than 0" });
    }

    const parsedDownPayment = downPayment === undefined ? 0 : parseMoney(downPayment);
    if (parsedDownPayment === null) {
        return res.status(400).json({ error: "Down payment must be a valid number" });
    }
    const numDownPayment = parsedDownPayment;
    if (numDownPayment < 0) {
        return res.status(400).json({ error: "Down payment cannot be negative" });
    }
    if (numDownPayment > numTotalAmount) {
        return res.status(400).json({ error: "Down payment cannot exceed total amount" });
    }

    const numInstallmentCount = parseInt(String(installmentCount), 10);
    if (isNaN(numInstallmentCount) || numInstallmentCount < 1) {
        return res.status(400).json({ error: "Installment count must be at least 1" });
    }

    if (!startDate || isNaN(new Date(startDate).getTime())) {
        return res.status(400).json({ error: "Valid start date is required" });
    }

    const validFrequencies = ["weekly", "biweekly", "monthly"];
    if (!frequency || !validFrequencies.includes(frequency)) {
        return res.status(400).json({ error: "Frequency must be weekly, biweekly, or monthly" });
    }

    const now = new Date().toISOString();

    // Create payment plan
    const plan: PaymentPlan = {
        id: uuidv4(),
        patientId,
        title: title.trim(),
        description: description?.trim(),
        totalAmount: roundToTwoDecimals(numTotalAmount),
        downPayment: roundToTwoDecimals(numDownPayment),
        installmentCount: numInstallmentCount,
        installmentAmount: 0, // Will be calculated
        startDate: new Date(startDate).toISOString(),
        frequency,
        status: "active",
        createdAt: now,
        updatedAt: now,
    };

    // Calculate installment amounts
    const installmentAmounts = calculateInstallmentAmounts(
        plan.totalAmount,
        plan.downPayment,
        plan.installmentCount
    );
    plan.installmentAmount = installmentAmounts[0]; // Store base amount

    // Create installments
    const installments: PaymentInstallment[] = [];
    for (let i = 0; i < plan.installmentCount; i++) {
        const installment: PaymentInstallment = {
            id: uuidv4(),
            planId: plan.id,
            patientId,
            installmentNumber: i + 1,
            dueDate: calculateDueDate(plan.startDate, i + 1, frequency),
            amount: installmentAmounts[i],
            paidAmount: 0,
            status: "pending",
            paidAt: null,
        };
        installments.push(installment);
    }

    // Save to storage
    demoPaymentPlans.push(plan);
    demoInstallments.push(...installments);

    // Return with summary
    const summary = getPlanSummary(plan, installments);

    logAuditEvent({
        req,
        action: "PAYMENT_PLAN_CREATE",
        entityType: "PaymentPlan",
        entityId: plan.id,
        patientId,
        summary: `Payment plan "${plan.title}" created for patient ${patientId} — $${plan.totalAmount} over ${plan.installmentCount} installments`,
        metadata: { totalAmount: plan.totalAmount, installmentCount: plan.installmentCount, frequency: plan.frequency },
    });

    res.status(201).json({
        success: true,
        plan,
        installments,
        summary,
        note: "Payment plans are stored in-memory only and will reset on server restart",
    });
});

// PUT /api/payment-plans/:planId/status - Update plan status (admin/reception only)
router.put("/:planId/status", requireRole("admin", "reception"), (req, res) => {
    const planId = req.params.planId as string;
    const { status } = req.body;

    const validStatuses = ["active", "completed", "cancelled"];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: "Status must be active, completed, or cancelled" });
    }

    const plan = demoPaymentPlans.find((p) => p.id === planId);
    if (!plan) {
        return res.status(404).json({ error: "Payment plan not found" });
    }

    // Update plan status
    plan.status = status;
    plan.updatedAt = new Date().toISOString();

    // If cancelling, mark unpaid installments as cancelled
    if (status === "cancelled") {
        const planInstallments = demoInstallments.filter((i) => i.planId === planId);
        for (const inst of planInstallments) {
            if (inst.status !== "paid") {
                inst.status = "cancelled";
            }
        }
    }

    const installments = demoInstallments.filter((i) => i.planId === planId);
    const summary = getPlanSummary(plan, installments);

    logAuditEvent({
        req,
        action: "PAYMENT_PLAN_STATUS_UPDATE",
        entityType: "PaymentPlan",
        entityId: planId,
        patientId: plan.patientId,
        summary: `Payment plan "${plan.title}" status changed to ${status}`,
        metadata: { status },
    });

    res.json({
        success: true,
        plan,
        installments,
        summary,
    });
});

// POST /api/payment-plans/installments/:installmentId/payment - Pay installment (admin/reception only)
router.post("/installments/:installmentId/payment", requireRole("admin", "reception"), (req, res) => {
    const installmentId = req.params.installmentId as string;
    const { amount, note } = req.body;

    // Validate amount
    const numAmount = parseMoney(amount);
    if (numAmount === null || numAmount <= 0) {
        return res.status(400).json({ error: "Payment amount must be greater than 0" });
    }

    // Find installment
    const installment = demoInstallments.find((i) => i.id === installmentId);
    if (!installment) {
        return res.status(404).json({ error: "Installment not found" });
    }

    // Find plan
    const plan = demoPaymentPlans.find((p) => p.id === installment.planId);
    if (!plan) {
        return res.status(404).json({ error: "Payment plan not found" });
    }

    if (plan.status !== "active") {
        return res.status(400).json({ error: "Only active plans can accept installment payments" });
    }

    // Check for overpayment
    const remainingOnInstallment = roundToTwoDecimals(installment.amount - installment.paidAmount);
    if (numAmount > remainingOnInstallment) {
        return res.status(400).json({
            error: `Payment amount exceeds remaining installment balance. Maximum: ${remainingOnInstallment}`,
        });
    }

    const paymentTimestamp = new Date().toISOString();
    const paymentRecord: InstallmentPaymentRecord = {
        id: uuidv4(),
        installmentId,
        planId: plan.id,
        patientId: plan.patientId,
        amount: numAmount,
        note: note?.trim(),
        createdAt: paymentTimestamp,
    };

    // Update installment
    const previousPaidAmount = installment.paidAmount;
    const previousPaidAt = installment.paidAt ?? null;
    const previousStatus = installment.status;
    const previousPlanUpdatedAt = plan.updatedAt;

    installment.paidAmount = roundToTwoDecimals(installment.paidAmount + numAmount);
    installment.status = getInstallmentStatus(installment, plan.status);
    installment.paidAt = installment.status === "paid" ? paymentTimestamp : previousPaidAt;

    // Update plan timestamp
    plan.updatedAt = paymentTimestamp;

    // Ledger integration - create real credit entry consumed by Phase 6A ledger endpoints
    let ledgerEntry;
    try {
        ledgerEntry = createLedgerCreditEntry({
            patientId: plan.patientId,
            amount: numAmount,
            description: `Payment plan installment #${installment.installmentNumber} - ${plan.title}`,
            sourceId: paymentRecord.id,
            sourceType: "payment",
            date: paymentRecord.createdAt,
        });
    } catch (_e) {
        installment.paidAmount = previousPaidAmount;
        installment.paidAt = previousPaidAt;
        installment.status = previousStatus;
        plan.updatedAt = previousPlanUpdatedAt;
        return res.status(500).json({ error: "Failed to create ledger entry for installment payment" });
    }

    demoInstallmentPayments.push(paymentRecord);

    logAuditEvent({
        req,
        action: "INSTALLMENT_PAYMENT",
        entityType: "PaymentInstallment",
        entityId: installmentId,
        patientId: plan.patientId,
        summary: `Installment #${installment.installmentNumber} payment of $${numAmount} for plan "${plan.title}"`,
        metadata: { amount: numAmount, planId: plan.id, installmentNumber: installment.installmentNumber },
    });

    const installments = demoInstallments.filter((i) => i.planId === plan.id);
    const summary = getPlanSummary(plan, installments);

    res.json({
        success: true,
        payment: paymentRecord,
        installment,
        summary,
        ledgerEntry,
        note: "Payment recorded and ledger credit created",
    });
});

// ─── Export for Statement Integration (Phase 6C1) ─────────────────────────

export function getPatientPaymentPlanSummaries(patientId: string): Array<{
    planId: string;
    title: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    nextDueDate: string | null;
    overdueAmount: number;
    overdueCount: number;
}> {
    const plans = demoPaymentPlans.filter((p) => p.patientId === patientId);

    return plans.map((plan) => {
        const installments = demoInstallments.filter((i) => i.planId === plan.id);

        // Update installment statuses
        const updatedInstallments = installments.map((inst) => ({
            ...inst,
            status: getInstallmentStatus(inst, plan.status),
        }));

        const summary = getPlanSummary(plan, updatedInstallments);

        return {
            planId: plan.id,
            title: plan.title,
            status: plan.status,
            totalAmount: plan.totalAmount,
            paidAmount: summary.paidAmount,
            remainingAmount: summary.remainingAmount,
            nextDueDate: summary.nextDueDate,
            overdueAmount: summary.overdueAmount,
            overdueCount: summary.overdueCount,
        };
    });
}

export { router as paymentPlanRouter };
