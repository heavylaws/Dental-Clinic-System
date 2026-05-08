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

    let pvs = [...getLiveDemoVisits()];
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
        ? getLiveDemoVisits().flatMap((v: any) => v.prescriptions || []).filter((rx: any) => rx.medicationName?.toLowerCase().includes(medication)).length
        : 0;

    res.json({
        rows,
        totalInRange: rows.length,
        totalAllTime: allTimeMedCount,
        medication: medication || null,
        uniquePatients: new Set(rows.map((r) => r.patientFileNumber)).size,
    });
});

// ─── Owner summary (Phase 3) ─────────────────────────────────────────

const DOCTOR_NAMES: Record<string, string> = {
    "2": "Dr. Mohammed Al-Mansouri",
    "4": "Dr. Layla Boujdaria",
};

function safeNum(v: any): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
}

function utcDate(d: Date): string {
    return d.toISOString().split("T")[0];
}

function startOfWeekUTC(d: Date): Date {
    // Monday-based ISO week start
    const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dow = out.getUTCDay(); // 0=Sun..6=Sat
    const diff = (dow === 0 ? -6 : 1 - dow);
    out.setUTCDate(out.getUTCDate() + diff);
    return out;
}

function periodKey(d: Date, groupBy: "daily" | "weekly" | "monthly"): string {
    if (groupBy === "weekly") return utcDate(startOfWeekUTC(d));
    if (groupBy === "monthly") {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    return utcDate(d);
}

function enumeratePeriods(from: Date, to: Date, groupBy: "daily" | "weekly" | "monthly"): string[] {
    const keys: string[] = [];
    const seen = new Set<string>();
    if (groupBy === "monthly") {
        const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
        const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
        while (cur <= end) {
            const k = periodKey(cur, "monthly");
            if (!seen.has(k)) { keys.push(k); seen.add(k); }
            cur.setUTCMonth(cur.getUTCMonth() + 1);
        }
    } else if (groupBy === "weekly") {
        const cur = startOfWeekUTC(from);
        const end = startOfWeekUTC(to);
        while (cur <= end) {
            const k = utcDate(cur);
            if (!seen.has(k)) { keys.push(k); seen.add(k); }
            cur.setUTCDate(cur.getUTCDate() + 7);
        }
    } else {
        const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
        const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
        while (cur <= end) {
            const k = utcDate(cur);
            if (!seen.has(k)) { keys.push(k); seen.add(k); }
            cur.setUTCDate(cur.getUTCDate() + 1);
        }
    }
    return keys;
}

router.get("/owner-summary", (req, res) => {
    try {
        const fromStr = (req.query.from as string) || utcDate(new Date(Date.now() - 29 * 86400000));
        const toStr = (req.query.to as string) || utcDate(new Date());
        const groupByRaw = (req.query.groupBy as string) || "daily";
        const groupBy: "daily" | "weekly" | "monthly" =
            groupByRaw === "weekly" || groupByRaw === "monthly" ? groupByRaw : "daily";

        const start = new Date(fromStr + "T00:00:00.000Z");
        const end = new Date(toStr + "T23:59:59.999Z");

        const visits = getLiveDemoVisits() || [];
        const billings = getLiveDemoBillings() || [];
        const patients = demoPatients || [];

        const inRange = (iso: string | undefined | null): boolean => {
            if (!iso) return false;
            const t = new Date(iso).getTime();
            return t >= start.getTime() && t <= end.getTime();
        };

        const rangeVisits = visits.filter((v: any) => inRange(v?.startedAt));
        const rangeBillings = billings.filter((b: any) => inRange(b?.createdAt));

        // ─── Totals ───────────────────────────────────────────────────
        const billed = rangeBillings.reduce((s: number, b: any) => s + safeNum(b.totalAmount), 0);
        const collected = rangeBillings.reduce((s: number, b: any) => s + safeNum(b.paidAmount), 0);
        const outstanding = Math.max(0, billed - collected);
        const visitCount = rangeVisits.length;
        const procedureCount = rangeVisits.reduce(
            (s: number, v: any) => s + (Array.isArray(v?.dentalProcedures) ? v.dentalProcedures.length : 0),
            0
        );
        const patientCount = new Set(rangeVisits.map((v: any) => v.patientId).filter(Boolean)).size;
        const averageTicket = visitCount > 0 ? Math.round((collected / visitCount) * 100) / 100 : 0;
        const collectionRate = billed > 0 ? Math.round((collected / billed) * 1000) / 10 : 0;

        // ─── Revenue trend ────────────────────────────────────────────
        const periodKeys = enumeratePeriods(start, end, groupBy);
        const trendMap: Record<string, { billed: number; collected: number; visits: number }> = {};
        for (const k of periodKeys) trendMap[k] = { billed: 0, collected: 0, visits: 0 };
        for (const b of rangeBillings) {
            const k = periodKey(new Date(b.createdAt), groupBy);
            if (trendMap[k]) {
                trendMap[k].billed += safeNum(b.totalAmount);
                trendMap[k].collected += safeNum(b.paidAmount);
            }
        }
        for (const v of rangeVisits) {
            const k = periodKey(new Date(v.startedAt), groupBy);
            if (trendMap[k]) trendMap[k].visits += 1;
        }
        const revenueTrend = periodKeys.map((k) => ({
            period: k,
            billed: Math.round(trendMap[k].billed * 100) / 100,
            collected: Math.round(trendMap[k].collected * 100) / 100,
            visits: trendMap[k].visits,
        }));

        // ─── Doctor production ────────────────────────────────────────
        const doctorBuckets: Record<string, {
            doctorId: string;
            doctorName: string;
            billed: number;
            collected: number;
            visits: any[];
            procedureCount: number;
            patients: Set<string>;
        }> = {};

        for (const v of rangeVisits) {
            const docId = (v?.doctorId && String(v.doctorId)) || "unassigned";
            const docName = docId === "unassigned" ? "Unassigned / Clinic" : (DOCTOR_NAMES[docId] || `Doctor ${docId}`);
            if (!doctorBuckets[docId]) {
                doctorBuckets[docId] = {
                    doctorId: docId,
                    doctorName: docName,
                    billed: 0,
                    collected: 0,
                    visits: [],
                    procedureCount: 0,
                    patients: new Set<string>(),
                };
            }
            const bucket = doctorBuckets[docId];
            bucket.visits.push(v);
            if (v.patientId) bucket.patients.add(v.patientId);
            bucket.procedureCount += Array.isArray(v.dentalProcedures) ? v.dentalProcedures.length : 0;

            // Find billing tied to this visit (within range)
            const b = rangeBillings.find((x: any) => x.visitId === v.id);
            if (b) {
                bucket.billed += safeNum(b.totalAmount);
                bucket.collected += safeNum(b.paidAmount);
            }
        }

        const doctorProduction = Object.values(doctorBuckets).map((b) => {
            const visitCt = b.visits.length;
            const out = Math.max(0, b.billed - b.collected);
            return {
                doctorId: b.doctorId,
                doctorName: b.doctorName,
                billed: Math.round(b.billed * 100) / 100,
                collected: Math.round(b.collected * 100) / 100,
                outstanding: Math.round(out * 100) / 100,
                visitCount: visitCt,
                procedureCount: b.procedureCount,
                patientCount: b.patients.size,
                averageTicket: visitCt > 0 ? Math.round((b.collected / visitCt) * 100) / 100 : 0,
            };
        }).sort((a, b) => b.collected - a.collected);

        if (doctorProduction.length === 0) {
            doctorProduction.push({
                doctorId: "unassigned",
                doctorName: "Unassigned / Clinic",
                billed: 0,
                collected: 0,
                outstanding: 0,
                visitCount: 0,
                procedureCount: 0,
                patientCount: 0,
                averageTicket: 0,
            });
        }

        // ─── Top procedures ───────────────────────────────────────────
        const procMap: Record<string, { name: string; category: string; revenue: number; count: number }> = {};
        for (const v of rangeVisits) {
            for (const p of (v?.dentalProcedures || [])) {
                const name = (p?.procedureName || p?.category || p?.type || "Procedure").toString();
                const category = (p?.category || "other").toString();
                const key = `${name}__${category}`;
                if (!procMap[key]) procMap[key] = { name, category, revenue: 0, count: 0 };
                procMap[key].revenue += safeNum(p?.cost);
                procMap[key].count += 1;
            }
        }
        const topProcedures = Object.values(procMap)
            .map((p) => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        // ─── Patient growth ───────────────────────────────────────────
        // First-visit-ever map computed from full visit history (all time)
        const firstVisitByPatient: Record<string, Date> = {};
        for (const v of visits) {
            if (!v?.patientId || !v?.startedAt) continue;
            const d = new Date(v.startedAt);
            if (!firstVisitByPatient[v.patientId] || d < firstVisitByPatient[v.patientId]) {
                firstVisitByPatient[v.patientId] = d;
            }
        }

        const growthMap: Record<string, { newSet: Set<string>; activeSet: Set<string> }> = {};
        for (const k of periodKeys) growthMap[k] = { newSet: new Set(), activeSet: new Set() };

        for (const v of rangeVisits) {
            if (!v?.patientId || !v?.startedAt) continue;
            const k = periodKey(new Date(v.startedAt), groupBy);
            if (!growthMap[k]) continue;
            growthMap[k].activeSet.add(v.patientId);
        }
        for (const [pid, firstDate] of Object.entries(firstVisitByPatient)) {
            if (firstDate < start || firstDate > end) continue;
            const k = periodKey(firstDate, groupBy);
            if (growthMap[k]) growthMap[k].newSet.add(pid);
        }

        const patientGrowth = periodKeys.map((k) => ({
            period: k,
            newPatients: growthMap[k].newSet.size,
            activePatients: growthMap[k].activeSet.size,
        }));

        // unused but documented for future patient-list consumers
        void patients;

        res.json({
            range: { from: fromStr, to: toStr, groupBy },
            totals: {
                billed: Math.round(billed * 100) / 100,
                collected: Math.round(collected * 100) / 100,
                outstanding: Math.round(outstanding * 100) / 100,
                visitCount,
                procedureCount,
                patientCount,
                averageTicket,
                collectionRate,
            },
            revenueTrend,
            doctorProduction,
            topProcedures,
            patientGrowth,
        });
    } catch (err: any) {
        console.error("[reports] owner-summary failed:", err);
        res.status(500).json({ error: "Failed to build owner summary" });
    }
});

export { router as reportRouter };
