import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useWebSocket } from "../lib/ws";
import NewPatientDialog from "../components/NewPatientDialog";
import BillVisitDialog from "../components/BillVisitDialog";

interface DashboardProps {
    user: any;
}

// ─── Local helpers ──────────────────────────────────────────────────

function safeNumber(v: any): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
}

function formatCurrency(v: any): string {
    const n = safeNumber(v);
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatPercent(v: any, digits = 1): string {
    return `${safeNumber(v).toFixed(digits)}%`;
}

function formatDateLabel(iso: string): string {
    try {
        const d = new Date(iso + "T00:00:00");
        return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } catch {
        return iso;
    }
}

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
}

// ─── Mini SVG revenue trend chart ────────────────────────────────────

function RevenueTrendChart({ data }: { data: Array<{ date: string; revenue: number }> }) {
    const width = 600;
    const height = 140;
    const padding = { top: 12, right: 12, bottom: 22, left: 12 };

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                No revenue data available
            </div>
        );
    }

    const values = data.map((d) => safeNumber(d.revenue));
    const max = Math.max(...values, 1);
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;

    const points = data.map((d, i) => {
        const x = padding.left + i * stepX;
        const y = padding.top + innerH - (safeNumber(d.revenue) / max) * innerH;
        return { x, y, ...d };
    });

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const areaPath =
        `M ${points[0].x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} ` +
        points.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
        ` L ${points[points.length - 1].x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} Z`;

    const firstLabel = data[0]?.date?.slice(5);
    const midLabel = data[Math.floor(data.length / 2)]?.date?.slice(5);
    const lastLabel = data[data.length - 1]?.date?.slice(5);

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36" preserveAspectRatio="none">
            <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#trendGradient)" />
            <path d={linePath} fill="none" stroke="#0284c7" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={p.revenue > 0 ? 2.5 : 1.5} fill="#0284c7">
                    <title>{`${p.date}: ${formatCurrency(p.revenue)}`}</title>
                </circle>
            ))}
            <text x={padding.left} y={height - 4} fontSize="10" fill="#9ca3af">{firstLabel}</text>
            <text x={width / 2} y={height - 4} fontSize="10" fill="#9ca3af" textAnchor="middle">{midLabel}</text>
            <text x={width - padding.right} y={height - 4} fontSize="10" fill="#9ca3af" textAnchor="end">{lastLabel}</text>
        </svg>
    );
}

// ─── KPI Card ────────────────────────────────────────────────────────

function KpiCard({
    icon, label, value, helper, accent,
}: {
    icon: string;
    label: string;
    value: string;
    helper?: string;
    accent: string;
}) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-3">
                <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xl ${accent}`}>
                    {icon}
                </span>
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1 truncate">{value}</p>
            {helper && <p className="text-xs text-gray-400 mt-1 truncate">{helper}</p>}
        </div>
    );
}

function KpiSkeleton() {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 animate-pulse">
            <div className="w-10 h-10 bg-gray-200 rounded-xl mb-3"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
            <div className="h-7 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-100 rounded w-1/3"></div>
        </div>
    );
}

// ─── Component ───────────────────────────────────────────────────────

export default function Dashboard({ user }: DashboardProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [showNewPatient, setShowNewPatient] = useState(false);
    const [selectedVisitForBilling, setSelectedVisitForBilling] = useState<string | null>(null);
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const searchInputRef = useRef<HTMLInputElement>(null);

    // ─── Queries ──────────────────────────────────────────────────────

    const {
        data: dashboard,
        isLoading: isLoadingDashboard,
        isError: isDashboardError,
    } = useQuery({
        queryKey: ["dashboard", "summary"],
        queryFn: api.dashboard.summary,
        refetchInterval: 60000,
    });

    const { data: queue = [], refetch: refetchQueue } = useQuery({
        queryKey: ["queue"],
        queryFn: api.visits.queue,
        refetchInterval: 15000,
    });

    const { data: searchResultsRaw = [], isFetching: isSearching } = useQuery({
        queryKey: ["patients", "search", searchQuery],
        queryFn: () => api.patients.search(searchQuery),
        enabled: searchQuery.length >= 1,
    });

    const searchResults = (() => {
        if (searchQuery.length < 1) return [];
        return [...searchResultsRaw].sort((a: any, b: any) => {
            const q = searchQuery.toLowerCase();
            const aFirst = (a.firstName || "").toLowerCase();
            const aLast = (a.lastName || "").toLowerCase();
            const bFirst = (b.firstName || "").toLowerCase();
            const bLast = (b.lastName || "").toLowerCase();

            const aScore = (aFirst.startsWith(q) || aLast.startsWith(q)) ? 0 : 1;
            const bScore = (bFirst.startsWith(q) || bLast.startsWith(q)) ? 0 : 1;

            if (aScore !== bScore) return aScore - bScore;
            return aLast.localeCompare(bLast) || aFirst.localeCompare(bFirst);
        });
    })();

    const { data: recentPatientsData, isFetching: isFetchingRecent } = useQuery({
        queryKey: ["patients", "recent"],
        queryFn: () => api.patients.list(1, 10),
        enabled: isSearchFocused && searchQuery.length === 0,
    });
    const recentPatients = recentPatientsData?.patients || [];

    const { data: overdueFollowUps = [] } = useQuery({
        queryKey: ["followups", "overdue"],
        queryFn: () => api.followUps.overdue(),
    });

    const { data: upcomingFollowUps = [] } = useQuery({
        queryKey: ["followups", "upcoming"],
        queryFn: () => api.followUps.upcoming(),
    });

    // ─── Aging query (Phase 6D2) ─────────────────────────────────────
    const { data: agingData, isLoading: isLoadingAging, isError: isAgingError } = useQuery({
        queryKey: ["ledger", "aging"],
        queryFn: () => api.ledger.aging(),
        refetchInterval: 60000,
    });

    const { data: serverInfo } = useQuery({
        queryKey: ["settings", "server-info"],
        queryFn: () => api.settings.serverInfo(),
        enabled: user?.role === "admin",
    });

    // ─── WebSocket for real-time queue ────────────────────────────────

    useWebSocket("queue:update", () => {
        refetchQueue();
    });

    // ─── Mutations ────────────────────────────────────────────────────

    const queuePatientMutation = useMutation({
        mutationFn: (patientId: string) =>
            api.visits.create({ patientId, visitType: "consultation" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["queue"] });
            setSearchQuery("");
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            api.visits.updateStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["queue"] });
        },
    });

    const deleteVisitMutation = useMutation({
        mutationFn: (id: string) => api.visits.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["queue"] });
        },
    });

    // ─── Derived values ───────────────────────────────────────────────

    const today = dashboard?.today;
    const trend = dashboard?.revenueTrend ?? [];
    const apptsToday = dashboard?.appointmentsToday ?? [];
    const unpaidInvoices = dashboard?.unpaidInvoices ?? [];
    const trendTotal = trend.reduce((s, d) => s + safeNumber(d.revenue), 0);

    const focusSearch = () => {
        searchInputRef.current?.focus();
        searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    // ─── Render ───────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {/* ═══ Hero / Greeting ═══════════════════════════════════════ */}
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-gray-500">{getGreeting()}{user?.displayName ? `, ${user.displayName}` : ""}</p>
                        <h1 className="text-3xl font-extrabold text-gray-900 mt-1">Clinic Overview</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {today ? formatDateLabel(today.date) : new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                        </p>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setShowNewPatient(true)} className="px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 shadow-sm transition">
                            ➕ New Patient
                        </button>
                        <button onClick={() => navigate("/appointments")} className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition">
                            📅 New Appointment
                        </button>
                        <button onClick={focusSearch} className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition">
                            🩺 New Visit
                        </button>
                        <button onClick={() => navigate("/billing")} className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition">
                            💰 Billing
                        </button>
                        <button onClick={() => navigate("/reports")} className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition">
                            📊 Reports
                        </button>
                    </div>
                </div>

                {/* ═══ Error banner (non-blocking) ═══════════════════════════ */}
                {isDashboardError && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800 text-sm">
                        We couldn't load the dashboard summary right now. The rest of your workspace remains available.
                    </div>
                )}

                {/* ═══ KPI Cards ═════════════════════════════════════════════ */}
                {isLoadingDashboard ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)}
                    </div>
                ) : today && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <KpiCard
                            icon="💵"
                            label="Today's Revenue"
                            value={formatCurrency(today.revenue)}
                            helper={`Billed: ${formatCurrency(today.billed)}`}
                            accent="bg-emerald-50 text-emerald-600"
                        />
                        <KpiCard
                            icon="📅"
                            label="Today's Appointments"
                            value={String(today.appointments)}
                            helper={`${today.completedAppointments} completed`}
                            accent="bg-sky-50 text-sky-600"
                        />
                        <KpiCard
                            icon="🧾"
                            label="Outstanding"
                            value={formatCurrency(today.outstanding)}
                            helper="Today's unpaid balance"
                            accent="bg-rose-50 text-rose-600"
                        />
                        <KpiCard
                            icon="👥"
                            label="Active Patients (30d)"
                            value={String(today.activePatients30d)}
                            helper={`${today.visits} visits today`}
                            accent="bg-violet-50 text-violet-600"
                        />
                        <KpiCard
                            icon="📉"
                            label="No-show Rate"
                            value={formatPercent(today.noShowRate)}
                            helper={`${today.noShows} of ${today.appointments} today`}
                            accent="bg-amber-50 text-amber-600"
                        />
                    </div>
                )}

                {/* ═══ Receivables Aging Card (Phase 6D2) ═══════════════════ */}
                {isLoadingAging ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center gap-3 text-gray-500">
                            <div className="animate-spin h-5 w-5 border-b-2 border-gray-600"></div>
                            <span>Loading receivables aging...</span>
                        </div>
                    </div>
                ) : isAgingError ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6 text-red-600">
                        Unable to load receivables aging.
                    </div>
                ) : agingData && agingData.patients.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    ⏰ Receivables Aging
                                </h2>
                                <p className="text-sm text-gray-500">
                                    {agingData.totals.patientCount} patients · {agingData.totals.overduePatientCount} overdue
                                    <span className="mx-2 text-gray-300">|</span>
                                    <button
                                        onClick={() => navigate("/billing")}
                                        className="text-primary-600 hover:text-primary-700 font-medium"
                                    >
                                        View in Billing →
                                    </button>
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-500">Total Outstanding</p>
                                <p className="text-2xl font-extrabold text-rose-600">${agingData.totals.totalBalance.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                                <p className="text-[10px] font-semibold text-emerald-600 uppercase mb-1">0–30 Days</p>
                                <p className="text-lg font-bold text-emerald-700">${agingData.totals.current.toLocaleString()}</p>
                            </div>
                            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                                <p className="text-[10px] font-semibold text-amber-600 uppercase mb-1">31–60 Days</p>
                                <p className="text-lg font-bold text-amber-700">${agingData.totals.days31to60.toLocaleString()}</p>
                            </div>
                            <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
                                <p className="text-[10px] font-semibold text-orange-600 uppercase mb-1">61–90 Days</p>
                                <p className="text-lg font-bold text-orange-700">${agingData.totals.days61to90.toLocaleString()}</p>
                            </div>
                            <div className="bg-rose-50 rounded-xl p-3 border border-rose-200">
                                <p className="text-[10px] font-semibold text-rose-600 uppercase mb-1">90+ Days</p>
                                <p className="text-lg font-bold text-rose-700">${agingData.totals.over90.toLocaleString()}</p>
                            </div>
                        </div>
                        {/* Top Overdue Patients mini list */}
                        {agingData.patients.slice(0, 5).some((p: any) => p.buckets.days31to60 > 0 || p.buckets.days61to90 > 0 || p.buckets.over90 > 0) && (
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    ⚠️ Top Overdue Patients
                                </h3>
                                <div className="space-y-2">
                                    {agingData.patients
                                        .filter((p: any) => p.buckets.days31to60 > 0 || p.buckets.days61to90 > 0 || p.buckets.over90 > 0)
                                        .slice(0, 5)
                                        .map((patient: any) => (
                                            <div
                                                key={patient.patientId}
                                                onClick={() => navigate(`/patient/${patient.patientId}`)}
                                                className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-gray-50 transition cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-8 rounded-full ${
                                                        patient.buckets.over90 > 0 ? 'bg-rose-500' :
                                                        patient.buckets.days61to90 > 0 ? 'bg-orange-500' :
                                                        patient.buckets.days31to60 > 0 ? 'bg-amber-500' :
                                                        'bg-emerald-500'
                                                    }`}></div>
                                                    <div>
                                                        <p className="font-semibold text-gray-800 text-sm">{patient.patientName}</p>
                                                        <p className="text-xs text-gray-500">
                                                            Oldest: {patient.oldestUnpaidDate
                                                                ? new Date(patient.oldestUnpaidDate).toLocaleDateString()
                                                                : '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-rose-600 text-sm">${patient.totalBalance.toLocaleString()}</p>
                                                    {patient.buckets.over90 > 0 && (
                                                        <p className="text-xs text-rose-500">${patient.buckets.over90.toLocaleString()} 90+ days</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ Trend + Unpaid Invoices ═══════════════════════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Trend */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">30-Day Revenue Trend</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Total collected: <span className="font-semibold text-gray-700">{formatCurrency(trendTotal)}</span></p>
                            </div>
                            <button
                                onClick={() => navigate("/reports")}
                                className="text-xs font-semibold text-primary-600 hover:text-primary-700"
                            >
                                View reports →
                            </button>
                        </div>
                        {isLoadingDashboard ? (
                            <div className="h-36 bg-gray-100 rounded-xl animate-pulse" />
                        ) : (
                            <RevenueTrendChart data={trend} />
                        )}
                    </div>

                    {/* Top Unpaid Invoices */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-800">Top Unpaid Invoices</h2>
                            <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                                {unpaidInvoices.length}
                            </span>
                        </div>
                        {isLoadingDashboard ? (
                            <div className="space-y-2">
                                {[0, 1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
                            </div>
                        ) : unpaidInvoices.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 text-sm">No unpaid invoices.</div>
                        ) : (
                            <div className="space-y-2">
                                {unpaidInvoices.map((inv) => (
                                    <div
                                        key={inv.id}
                                        onClick={() => inv.patientId && navigate(`/patient/${inv.patientId}`)}
                                        className={`p-3 rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-gray-50 transition ${inv.patientId ? "cursor-pointer" : ""}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="font-semibold text-gray-800 text-sm truncate">{inv.patientName}</p>
                                            <p className="font-bold text-rose-600 text-sm whitespace-nowrap">{formatCurrency(inv.balance)}</p>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                                            <span>Paid {formatCurrency(inv.paidAmount)} of {formatCurrency(inv.totalAmount)}</span>
                                            <span className="px-2 py-0.5 rounded-full bg-gray-100 capitalize">{inv.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ Today's Appointment Timeline ══════════════════════════ */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-800">Today's Appointments</h2>
                        <button
                            onClick={() => navigate("/appointments")}
                            className="text-xs font-semibold text-primary-600 hover:text-primary-700"
                        >
                            Open calendar →
                        </button>
                    </div>
                    {isLoadingDashboard ? (
                        <div className="space-y-2">
                            {[0, 1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
                        </div>
                    ) : apptsToday.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm">No appointments scheduled today.</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {apptsToday.map((a) => (
                                <div
                                    key={a.id}
                                    onClick={() => a.patientId && navigate(`/patient/${a.patientId}`)}
                                    className={`flex items-center gap-4 py-3 ${a.patientId ? "cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg" : ""} transition`}
                                >
                                    <div className="w-16 flex-shrink-0">
                                        <p className="font-mono font-bold text-gray-800">{a.timeSlot || "—"}</p>
                                        {a.duration && <p className="text-[10px] text-gray-400">{a.duration} min</p>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-800 truncate">{a.patientName}</p>
                                        <p className="text-xs text-gray-500 truncate">{a.doctorName} • {a.type}</p>
                                    </div>
                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize whitespace-nowrap ${a.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                                            a.status === "no_show" ? "bg-rose-50 text-rose-700" :
                                                a.status === "cancelled" ? "bg-gray-100 text-gray-500" :
                                                    a.status === "confirmed" ? "bg-sky-50 text-sky-700" :
                                                        "bg-amber-50 text-amber-700"
                                        }`}>
                                        {a.status?.replace("_", " ") || "scheduled"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ═══ Operational Panels (Search + Queue) — preserved ═════ */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ─── Left Column: Search & Patients ─── */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Server/Mobile Info (Admin Only) */}
                        {user?.role === "admin" && serverInfo && serverInfo.httpsUrls.length > 0 && (
                            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-5 text-white border border-green-400/30">
                                <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                                    📱 Mobile Camera Access
                                </h2>
                                <div className="space-y-3">
                                    {serverInfo.addresses.map((addr, i) => (
                                        <div key={i} className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                                                    {addr.name}
                                                </span>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(serverInfo.httpsUrls[i])}
                                                    className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition"
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                            <p className="font-mono text-sm font-bold truncate">
                                                {serverInfo.httpsUrls[i]}
                                            </p>
                                        </div>
                                    ))}
                                    <p className="text-[10px] opacity-80 leading-tight">
                                        Scan or type this URL on your phone browser to use the camera.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Search */}
                        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                🔎 Search Patient
                            </h2>
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                placeholder="Patient name or phone number..."
                                className="w-full border-2 border-gray-200 rounded-xl px-5 py-4 text-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition outline-none relative z-10"
                            />

                            {/* Search Results */}
                            {(searchQuery.length >= 1 || (isSearchFocused && searchQuery.length === 0)) && (
                                <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                                    {(isSearching || (isSearchFocused && searchQuery.length === 0 && isFetchingRecent)) && (
                                        <p className="text-gray-400 text-center py-4">Searching...</p>
                                    )}
                                    {searchQuery.length >= 1 && !isSearching && searchResults.length === 0 && (
                                        <div className="text-center py-6">
                                            <p className="text-gray-400 mb-3">No results found</p>
                                            <button
                                                onClick={() => setShowNewPatient(true)}
                                                className="px-6 py-3 bg-primary-600 text-white rounded-xl text-lg font-semibold hover:bg-primary-700 transition"
                                            >
                                                ➕ New Patient
                                            </button>
                                        </div>
                                    )}
                                    {searchQuery.length === 0 && !isFetchingRecent && recentPatients.length > 0 && (
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2 mb-2 mt-2">Recent Patients</p>
                                    )}
                                    {(searchQuery.length >= 1 ? searchResults : recentPatients).map((patient: any) => (
                                        <div
                                            key={patient.id}
                                            className="flex items-center justify-between p-4 bg-gray-50 hover:bg-primary-50 rounded-xl cursor-pointer transition group"
                                        >
                                            <div
                                                className="flex-1"
                                                onClick={() => navigate(`/patient/${patient.id}`)}
                                            >
                                                <p className="text-lg font-bold text-gray-800 group-hover:text-primary-700">
                                                    {patient.firstName} {patient.fatherName ? `${patient.fatherName} ` : ""}{patient.lastName}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    #{patient.fileNumber} • {patient.city || "—"} • {patient.phone || "—"}
                                                </p>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    queuePatientMutation.mutate(patient.id);
                                                    setIsSearchFocused(false);
                                                }}
                                                className="px-4 py-2 bg-accent-500 text-white rounded-lg font-semibold hover:bg-accent-600 transition text-sm"
                                                title="Add to queue"
                                            >
                                                📋 Queue
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Follow-up Reminders */}
                        {(overdueFollowUps.length > 0 || upcomingFollowUps.length > 0) && (
                            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-700 mb-4">📅 Follow-up Reminders</h3>

                                {overdueFollowUps.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-sm font-bold text-red-600 mb-2 uppercase tracking-wide">⚠️ Overdue</p>
                                        <div className="space-y-2">
                                            {overdueFollowUps.slice(0, 5).map((fu: any) => (
                                                <div
                                                    key={fu.id}
                                                    onClick={() => navigate(`/patient/${fu.patientId}`)}
                                                    className="flex items-center gap-3 p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition border border-red-200"
                                                >
                                                    <span className="text-red-500 font-mono text-sm">{fu.scheduledDate}</span>
                                                    <span className="font-semibold text-gray-800 text-sm">
                                                        {fu.patientName} {fu.patientLastName}
                                                    </span>
                                                    <span className="text-gray-400 text-xs ml-auto">#{fu.patientFileNumber}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {upcomingFollowUps.length > 0 && (
                                    <div>
                                        <p className="text-sm font-bold text-teal-600 mb-2 uppercase tracking-wide">📅 Upcoming</p>
                                        <div className="space-y-2">
                                            {upcomingFollowUps.slice(0, 5).map((fu: any) => (
                                                <div
                                                    key={fu.id}
                                                    onClick={() => navigate(`/patient/${fu.patientId}`)}
                                                    className="flex items-center gap-3 p-3 bg-teal-50 rounded-lg cursor-pointer hover:bg-teal-100 transition border border-teal-200"
                                                >
                                                    <span className="text-teal-600 font-mono text-sm">{fu.scheduledDate}</span>
                                                    <span className="font-semibold text-gray-800 text-sm">
                                                        {fu.patientName} {fu.patientLastName}
                                                    </span>
                                                    <span className="text-gray-400 text-xs ml-auto">#{fu.patientFileNumber}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ─── Right Column: Today's Queue ─── */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                                📋 Today's Queue
                                <span className="text-sm bg-primary-100 text-primary-700 px-3 py-1 rounded-full font-semibold">
                                    {queue.length} patients
                                </span>
                            </h2>

                            {queue.length === 0 ? (
                                <div className="text-center py-16 text-gray-400">
                                    <p className="text-6xl mb-4">📭</p>
                                    <p className="text-xl">No patients in today's queue</p>
                                    <p className="text-lg mt-2">Search for a patient to add them</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {queue.map((item: any, idx: number) => (
                                        <div
                                            key={item.id}
                                            className={`flex items-center gap-4 p-5 rounded-xl border-2 transition cursor-pointer hover:shadow-md ${item.status === "in_progress"
                                                ? "border-primary-300 bg-primary-50"
                                                : item.status === "completed"
                                                    ? "border-accent-200 bg-accent-50"
                                                    : "border-gray-100 bg-gray-50 hover:border-gray-200"
                                                }`}
                                            onClick={() => navigate(`/patient/${item.patientId}`)}
                                        >
                                            {/* Number */}
                                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-600">
                                                {idx + 1}
                                            </div>

                                            {/* Patient Info */}
                                            <div className="flex-1">
                                                <p className="text-xl font-bold text-gray-800">
                                                    {item.patientName}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    File #{item.patientFileNumber} • Visit #{item.visitNumber}
                                                </p>
                                            </div>

                                            {/* Status Badge */}
                                            <div className={`px-4 py-2 rounded-full text-sm font-bold status-${item.status}`}>
                                                {item.status === "queued" && "⏳ Waiting"}
                                                {item.status === "in_progress" && "🔵 In Progress"}
                                                {item.status === "completed" && "✅ Completed"}
                                                {item.status === "billed" && "💰 Billed"}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2">
                                                {item.status === "queued" && ["doctor", "admin"].includes(user.role) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateStatusMutation.mutate({
                                                                id: item.id,
                                                                status: "in_progress",
                                                            });
                                                        }}
                                                        className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition"
                                                    >
                                                        ▶ Start
                                                    </button>
                                                )}

                                                {item.status === "queued" && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (confirm("Remove this patient from the queue?")) {
                                                                deleteVisitMutation.mutate(item.id);
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition"
                                                        title="Remove from queue"
                                                    >
                                                        ❌ Remove
                                                    </button>
                                                )}

                                                {item.status === "completed" && ["reception", "admin"].includes(user.role) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedVisitForBilling(item.id);
                                                        }}
                                                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition flex items-center gap-1"
                                                    >
                                                        💰 Pay / Close
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── New Patient Dialog ─── */}
            {showNewPatient && (
                <NewPatientDialog
                    onClose={() => setShowNewPatient(false)}
                    onCreated={(patient: any) => {
                        setShowNewPatient(false);
                        navigate(`/patient/${patient.id}`);
                    }}
                />
            )}

            {/* ─── Billing Dialog ─── */}
            {selectedVisitForBilling && (
                <BillVisitDialog
                    visitId={selectedVisitForBilling}
                    onClose={() => setSelectedVisitForBilling(null)}
                />
            )}
        </div>
    );
}
