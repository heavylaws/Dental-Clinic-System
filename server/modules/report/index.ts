import { Router } from "express";
import { requireAuth, requireRole } from "../auth/index.js";
import { getLiveDemoBillings, getLiveDemoVisits, demoPatients } from "../../demo-store.js";

const router = Router();
router.use(requireAuth);

function filterByDateRange(items: any[], field: string, start: Date, end: Date) {
    return items.filter((item) => {
        const d = new Date(item[field]);
        return d >= start && d <= end;
    });
}

// Daily summary
router.get("/daily", (req, res) => {
    const dateStr = (req.query.date as string) || new Date().toISOString().split("T")[0];
    const start = new Date(dateStr); start.setHours(0, 0, 0, 0);
    const end = new Date(dateStr); end.setHours(23, 59, 59, 999);

    const dayVisits = filterByDateRange(getLiveDemoVisits(), "startedAt", start, end);
    const dayBillings = filterByDateRange(getLiveDemoBillings(), "createdAt", start, end);
    const uniquePatients = new Set(dayVisits.map((v) => v.patientId)).size;
    const totalBilled = dayBillings.reduce((s, b) => s + parseFloat(b.totalAmount || "0"), 0);
    const totalPaid = dayBillings.reduce((s, b) => s + parseFloat(b.paidAmount || "0"), 0);

    res.json({
        date: dateStr,
        visitCount: dayVisits.length,
        uniquePatients,
        totalBilled,
        totalPaid,
        outstanding: totalBilled - totalPaid,
    });
});

// Monthly overview
router.get("/monthly", (req, res) => {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const monthVisits = filterByDateRange(getLiveDemoVisits(), "startedAt", start, end);
    const monthBillings = filterByDateRange(getLiveDemoBillings(), "createdAt", start, end);

    // Visits per day
    const dailyCounts: Record<string, number> = {};
    for (const v of monthVisits) {
        const d = new Date(v.startedAt).toISOString().split("T")[0];
        dailyCounts[d] = (dailyCounts[d] || 0) + 1;
    }
    const dailyVisits = Object.entries(dailyCounts).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

    const totalBilled = monthBillings.reduce((s, b) => s + parseFloat(b.totalAmount || "0"), 0);
    const totalPaid = monthBillings.reduce((s, b) => s + parseFloat(b.paidAmount || "0"), 0);

    // Top diagnoses from dental findings
    const findingCounts: Record<string, number> = {};
    for (const v of monthVisits) {
        for (const f of (v.dentalFindings || [])) {
            findingCounts[f.findingType] = (findingCounts[f.findingType] || 0) + 1;
        }
    }
    const topDiagnoses = Object.entries(findingCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    res.json({
        month, year,
        totalVisits: monthVisits.length,
        totalBilled,
        totalPaid,
        outstanding: totalBilled - totalPaid,
        dailyVisits,
        topDiagnoses,
    });
});

// Patient statistics
router.get("/patients", (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;

    let pvs = [...demoVisits];
    if (from || to) {
        const start = from ? new Date(from) : new Date(0);
        const end = to ? new Date(to + "T23:59:59") : new Date();
        pvs = filterByDateRange(pvs, "startedAt", start, end);
    }

    const newPatientIds = new Set(pvs.filter((v) => v.visitNumber === 1).map((v) => v.patientId));
    const genderCounts: Record<string, number> = {};
    for (const id of newPatientIds) {
        const pt = demoPatients.find((p) => p.id === id);
        if (pt) genderCounts[pt.gender] = (genderCounts[pt.gender] || 0) + 1;
    }

    res.json({
        totalNewPatients: newPatientIds.size,
        genderBreakdown: genderCounts,
        totalVisits: pvs.length,
    });
});

// Financial breakdown by procedure category
router.get("/financial", (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;

    const start = from ? new Date(from + "T00:00:00") : new Date(new Date().setDate(1));
    const end = to ? new Date(to + "T23:59:59") : new Date();

    const rangeVisits = filterByDateRange(getLiveDemoVisits(), "startedAt", start, end);
    const rangeBillings = filterByDateRange(getLiveDemoBillings(), "createdAt", start, end);

    // Revenue by visit type
    const revenueByType: Record<string, { billed: number; paid: number; count: number }> = {};
    for (const b of rangeBillings) {
        const visit = getLiveDemoVisits().find((v) => v.id === b.visitId);
        const type = visit?.visitType || "other";
        if (!revenueByType[type]) revenueByType[type] = { billed: 0, paid: 0, count: 0 };
        revenueByType[type].billed += parseFloat(b.totalAmount || "0");
        revenueByType[type].paid += parseFloat(b.paidAmount || "0");
        revenueByType[type].count++;
    }

    // Revenue by procedure category
    const revenueByProcedure: Record<string, { total: number; count: number }> = {};
    for (const v of rangeVisits) {
        for (const proc of (v.dentalProcedures || [])) {
            const cat = proc.category || "other";
            if (!revenueByProcedure[cat]) revenueByProcedure[cat] = { total: 0, count: 0 };
            revenueByProcedure[cat].total += parseFloat(proc.cost || "0");
            revenueByProcedure[cat].count++;
        }
    }

    // Daily revenue trend within range
    const dailyRevenue: Record<string, { billed: number; paid: number }> = {};
    for (const b of rangeBillings) {
        const d = new Date(b.createdAt).toISOString().split("T")[0];
        if (!dailyRevenue[d]) dailyRevenue[d] = { billed: 0, paid: 0 };
        dailyRevenue[d].billed += parseFloat(b.totalAmount || "0");
        dailyRevenue[d].paid += parseFloat(b.paidAmount || "0");
    }
    const dailyTrend = Object.entries(dailyRevenue)
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));

    const totalBilled = rangeBillings.reduce((s, b) => s + parseFloat(b.totalAmount || "0"), 0);
    const totalPaid = rangeBillings.reduce((s, b) => s + parseFloat(b.paidAmount || "0"), 0);
    const paidCount = rangeBillings.filter((b) => b.status === "paid").length;
    const partialCount = rangeBillings.filter((b) => b.status === "partial").length;
    const unpaidCount = rangeBillings.filter((b) => b.status === "unpaid").length;

    res.json({
        from: start.toISOString().split("T")[0],
        to: end.toISOString().split("T")[0],
        totalBilled,
        totalPaid,
        outstanding: totalBilled - totalPaid,
        collectionRate: totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0,
        paidCount, partialCount, unpaidCount,
        revenueByType: Object.entries(revenueByType).map(([type, v]) => ({ type, ...v })).sort((a, b) => b.paid - a.paid),
        revenueByProcedure: Object.entries(revenueByProcedure).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total),
        dailyTrend,
        totalVisits: rangeVisits.length,
    });
});

// Prescriptions report
router.get("/prescriptions", (req, res) => {
    const from = req.query.from as string;
    const to = req.query.to as string;
    const medication = (req.query.medication as string || "").toLowerCase().trim();

    const start = from ? new Date(from + "T00:00:00") : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = to ? new Date(to + "T23:59:59") : new Date();

    const rangeVisits = filterByDateRange(getLiveDemoVisits(), "startedAt", start, end);
    const rows: any[] = [];
    for (const v of rangeVisits) {
        const pt = demoPatients.find((p) => p.id === v.patientId);
        for (const rx of (v.prescriptions || [])) {
            if (medication && !rx.medicationName?.toLowerCase().includes(medication)) continue;
            rows.push({
                id: rx.id,
                visitDate: v.startedAt,
                patientName: pt ? `${pt.firstName} ${pt.lastName}` : "Unknown",
                patientFileNumber: pt?.fileNumber,
                medicationName: rx.medicationName,
                dosage: rx.dosage,
                frequency: rx.frequency,
                duration: rx.duration,
            });
        }
    }

    const allTimeMedCount = medication
        ? demoVisits.flatMap((v) => v.prescriptions || []).filter((rx: any) => rx.medicationName?.toLowerCase().includes(medication)).length
        : 0;

    res.json({
        rows,
        totalInRange: rows.length,
        totalAllTime: allTimeMedCount,
        medication: medication || null,
        uniquePatients: new Set(rows.map((r) => r.patientFileNumber)).size,
    });
});

export { router as reportRouter };
