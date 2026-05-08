import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import {
    demoAppointments,
    demoPatients,
    getLiveDemoBillings,
    getLiveDemoVisits,
} from "../../demo-store.js";

const router = Router();
router.use(requireAuth);

const DOCTOR_NAMES: Record<string, string> = {
    "2": "Dr. Mohammed Al-Mansouri",
    "4": "Dr. Layla Boujdaria",
};

function safeNumber(v: any): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
}

function utcDateStr(d: Date): string {
    return d.toISOString().split("T")[0];
}

router.get("/summary", (_req, res) => {
    try {
        const now = new Date();
        const todayStr = utcDateStr(now);

        const billings = getLiveDemoBillings() || [];
        const visits = getLiveDemoVisits() || [];
        const patients = demoPatients || [];
        const appointments = demoAppointments || [];

        // ─── Today's billings ─────────────────────────────────────────
        const todayBillings = billings.filter((b: any) => {
            if (!b?.createdAt) return false;
            const d = new Date(b.createdAt);
            return utcDateStr(d) === todayStr;
        });

        const todayBilled = todayBillings.reduce(
            (s: number, b: any) => s + safeNumber(b.totalAmount),
            0
        );
        const todayRevenue = todayBillings.reduce(
            (s: number, b: any) => s + safeNumber(b.paidAmount),
            0
        );
        const todayOutstanding = Math.max(0, todayBilled - todayRevenue);

        // ─── Today's visits ───────────────────────────────────────────
        const todayVisits = visits.filter((v: any) => {
            if (!v?.startedAt) return false;
            return utcDateStr(new Date(v.startedAt)) === todayStr;
        });

        // ─── Today's appointments ─────────────────────────────────────
        const apptsToday = appointments
            .filter((a: any) => a?.appointmentDate === todayStr)
            .map((a: any) => {
                const pt = patients.find((p: any) => p.id === a.patientId);
                const patientName = pt
                    ? `${pt.firstName ?? ""} ${pt.lastName ?? ""}`.trim() || "Unknown"
                    : "Unknown";
                return {
                    id: a.id,
                    patientId: a.patientId,
                    patientName,
                    patientPhone: pt?.phone ?? null,
                    doctorId: a.doctorId ?? null,
                    doctorName: DOCTOR_NAMES[a.doctorId] || "Unassigned",
                    appointmentDate: a.appointmentDate,
                    timeSlot: a.timeSlot ?? "",
                    duration: a.duration ?? null,
                    type: a.type ?? "consultation",
                    status: a.status ?? "scheduled",
                };
            })
            .sort((a, b) => (a.timeSlot || "").localeCompare(b.timeSlot || ""));

        const completedAppointments = apptsToday.filter(
            (a) => a.status === "completed"
        ).length;
        const noShows = apptsToday.filter((a) => a.status === "no_show").length;
        const noShowRate =
            apptsToday.length > 0
                ? Math.round((noShows / apptsToday.length) * 1000) / 10
                : 0;

        // ─── Active patients (last 30 days) ───────────────────────────
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentPatientIds = new Set<string>();
        for (const v of visits) {
            if (!v?.startedAt) continue;
            const d = new Date(v.startedAt);
            if (d >= thirtyDaysAgo && d <= now) {
                if (v.patientId) recentPatientIds.add(v.patientId);
            }
        }

        // ─── Revenue trend (last 30 days, including zero days) ────────
        const trendMap: Record<string, { revenue: number; billed: number }> = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            trendMap[utcDateStr(d)] = { revenue: 0, billed: 0 };
        }
        for (const b of billings) {
            if (!b?.createdAt) continue;
            const ds = utcDateStr(new Date(b.createdAt));
            if (trendMap[ds]) {
                trendMap[ds].revenue += safeNumber(b.paidAmount);
                trendMap[ds].billed += safeNumber(b.totalAmount);
            }
        }
        const revenueTrend = Object.entries(trendMap)
            .map(([date, v]) => ({
                date,
                revenue: Math.round(v.revenue * 100) / 100,
                billed: Math.round(v.billed * 100) / 100,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // ─── Top 5 unpaid invoices ────────────────────────────────────
        const unpaidInvoices = billings
            .map((b: any) => {
                const total = safeNumber(b.totalAmount);
                const paid = safeNumber(b.paidAmount);
                const balance = total - paid;
                const visit = visits.find((v: any) => v.id === b.visitId);
                const pt = visit
                    ? patients.find((p: any) => p.id === visit.patientId)
                    : null;
                const patientName = pt
                    ? `${pt.firstName ?? ""} ${pt.lastName ?? ""}`.trim() || "Unknown"
                    : "Unknown";
                return {
                    id: b.id,
                    visitId: b.visitId,
                    patientId: pt?.id ?? null,
                    patientName,
                    totalAmount: total,
                    paidAmount: paid,
                    balance,
                    status: b.status ?? (balance > 0 ? "unpaid" : "paid"),
                    createdAt: b.createdAt,
                };
            })
            .filter((b) => b.balance > 0.0001)
            .sort((a, b) => b.balance - a.balance)
            .slice(0, 5);

        res.json({
            today: {
                date: todayStr,
                revenue: Math.round(todayRevenue * 100) / 100,
                billed: Math.round(todayBilled * 100) / 100,
                outstanding: Math.round(todayOutstanding * 100) / 100,
                appointments: apptsToday.length,
                completedAppointments,
                noShows,
                noShowRate,
                activePatients30d: recentPatientIds.size,
                visits: todayVisits.length,
            },
            revenueTrend,
            appointmentsToday: apptsToday,
            unpaidInvoices,
        });
    } catch (err: any) {
        console.error("[dashboard] summary failed:", err);
        res.status(500).json({ error: "Failed to build dashboard summary" });
    }
});

export { router as dashboardRouter };
