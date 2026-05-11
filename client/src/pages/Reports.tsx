import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import AutocompleteInput from "../components/AutocompleteInput";

type GroupBy = "daily" | "weekly" | "monthly";
type DocSortKey = "collected" | "billed" | "visitCount" | "averageTicket" | "patientCount";
type RxSortKey = "visitDate" | "patientName" | "patientFileNumber" | "medicationName" | "dosage" | "frequency" | "duration";
type SortDir = "asc" | "desc";

const todayIso = () => new Date().toISOString().split("T")[0];
const isoNDaysAgo = (n: number) =>
    new Date(Date.now() - n * 86400000).toISOString().split("T")[0];

// ─── Helpers ─────────────────────────────────────────────────────────

function safeNum(v: any): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
}

function fmtCurrency(v: any): string {
    const n = safeNum(v);
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtPercent(v: any, digits = 1): string {
    return `${safeNum(v).toFixed(digits)}%`;
}

function csvEscape(v: any): string {
    const s = v === null || v === undefined ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function downloadFile(content: string, filename: string, mime = "text/csv;charset=utf-8") {
    const blob = new Blob(["\uFEFF" + content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Custom SVG Charts ──────────────────────────────────────────────

function TrendChart({ data }: { data: Array<{ period: string; billed: number; collected: number }> }) {
    const width = 720;
    const height = 200;
    const padding = { top: 16, right: 16, bottom: 28, left: 50 };

    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data in selected range</div>;
    }

    const max = Math.max(1, ...data.flatMap((d) => [safeNum(d.billed), safeNum(d.collected)]));
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;

    const proj = (i: number, val: number) => ({
        x: padding.left + i * stepX,
        y: padding.top + innerH - (val / max) * innerH,
    });

    const billedPts = data.map((d, i) => proj(i, safeNum(d.billed)));
    const collectedPts = data.map((d, i) => proj(i, safeNum(d.collected)));

    const linePath = (pts: { x: number; y: number }[]) =>
        pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

    const areaPath = (pts: { x: number; y: number }[]) =>
        `M ${pts[0].x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} ` +
        pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
        ` L ${pts[pts.length - 1].x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} Z`;

    // Y-axis ticks
    const ticks = [0, 0.5, 1].map((t) => ({
        v: max * t,
        y: padding.top + innerH - t * innerH,
    }));

    return (
        <div className="w-full">
            <div className="flex gap-4 text-xs mb-2 text-gray-600">
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Collected
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-sky-400"></span> Billed
                </span>
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-52">
                <defs>
                    <linearGradient id="rptCollected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                </defs>
                {ticks.map((t, i) => (
                    <g key={i}>
                        <line x1={padding.left} x2={width - padding.right} y1={t.y} y2={t.y} stroke="#e5e7eb" strokeDasharray="2 4" />
                        <text x={padding.left - 6} y={t.y + 3} textAnchor="end" fontSize="10" fill="#9ca3af">
                            ${Math.round(t.v).toLocaleString()}
                        </text>
                    </g>
                ))}
                <path d={areaPath(collectedPts)} fill="url(#rptCollected)" />
                <path d={linePath(billedPts)} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 3" />
                <path d={linePath(collectedPts)} fill="none" stroke="#10b981" strokeWidth="2.5" />
                {collectedPts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#10b981">
                        <title>{`${data[i].period}: collected ${fmtCurrency(data[i].collected)} / billed ${fmtCurrency(data[i].billed)}`}</title>
                    </circle>
                ))}
                {data.length > 1 && (
                    <>
                        <text x={padding.left} y={height - 8} fontSize="10" fill="#9ca3af">{data[0].period}</text>
                        <text x={width / 2} y={height - 8} fontSize="10" fill="#9ca3af" textAnchor="middle">
                            {data[Math.floor(data.length / 2)].period}
                        </text>
                        <text x={width - padding.right} y={height - 8} fontSize="10" fill="#9ca3af" textAnchor="end">
                            {data[data.length - 1].period}
                        </text>
                    </>
                )}
            </svg>
        </div>
    );
}

function PatientGrowthChart({ data }: { data: Array<{ period: string; newPatients: number; activePatients: number }> }) {
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-32 text-gray-400 text-sm">No patient activity in range</div>;
    }
    const max = Math.max(1, ...data.map((d) => Math.max(d.activePatients, d.newPatients)));
    const ROW_PX = 128; // matches h-32
    const px = (n: number) => {
        if (n <= 0) return 0;
        return Math.max(2, Math.round((n / max) * ROW_PX));
    };
    return (
        <div>
            <div className="flex gap-4 text-xs mb-2 text-gray-600">
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-violet-500"></span> Active
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-violet-300"></span> New
                </span>
            </div>
            <div className="overflow-x-auto">
                <div
                    className="flex items-end gap-1 min-w-full"
                    style={{ minWidth: `${data.length * 24}px`, height: `${ROW_PX}px` }}
                >
                    {data.map((d, i) => (
                        <div
                            key={i}
                            className="flex flex-col items-center justify-end flex-1 group gap-0.5"
                            title={`${d.period}: ${d.newPatients} new / ${d.activePatients} active`}
                        >
                            <div
                                className="w-3/5 bg-violet-500 rounded-t group-hover:bg-violet-600 transition"
                                style={{ height: `${px(d.activePatients)}px` }}
                            />
                            <div
                                className="w-3/5 bg-violet-300 rounded-t group-hover:bg-violet-400 transition"
                                style={{ height: `${px(d.newPatients)}px` }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function TopProceduresChart({ data }: { data: Array<{ name: string; category: string; revenue: number; count: number }> }) {
    if (!data || data.length === 0) {
        return <div className="text-center py-10 text-gray-400 text-sm">No procedure revenue in selected range.</div>;
    }
    const max = Math.max(1, ...data.map((d) => safeNum(d.revenue)));
    return (
        <div className="space-y-2">
            {data.map((p, i) => (
                <div key={i} className="group">
                    <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-semibold text-gray-700 truncate flex-1 min-w-0 pr-2">
                            {i + 1}. {p.name}
                            <span className="text-xs text-gray-400 ml-2 capitalize">{p.category}</span>
                        </span>
                        <span className="font-bold text-emerald-700 whitespace-nowrap">{fmtCurrency(p.revenue)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 group-hover:from-emerald-500 group-hover:to-emerald-700 transition"
                            style={{ width: `${(safeNum(p.revenue) / max) * 100}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{p.count} {p.count === 1 ? "procedure" : "procedures"}</p>
                </div>
            ))}
        </div>
    );
}

// ─── KPI tile ────────────────────────────────────────────────────────

function Kpi({ icon, label, value, accent }: { icon: string; label: string; value: string; accent: string }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xl mb-3 ${accent}`}>{icon}</div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1 truncate">{value}</p>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function Reports() {
    const [tab, setTab] = useState<"owner" | "prescription">("owner");

    // ── Owner Analytics filters ─
    const [from, setFrom] = useState(isoNDaysAgo(29));
    const [to, setTo] = useState(todayIso());
    const [groupBy, setGroupBy] = useState<GroupBy>("daily");
    const [docSortKey, setDocSortKey] = useState<DocSortKey>("collected");
    const [docSortDir, setDocSortDir] = useState<SortDir>("desc");

    const {
        data: owner,
        isLoading: ownerLoading,
        isError: ownerError,
        refetch: refetchOwner,
        isFetching: ownerFetching,
    } = useQuery({
        queryKey: ["reports", "owner-summary", from, to, groupBy],
        queryFn: () => api.reports.ownerSummary(from, to, groupBy),
    });

    // ── Aging data (Phase 6D2) ─
    const { data: agingData, isLoading: agingLoading, isError: agingError } = useQuery({
        queryKey: ["ledger", "aging"],
        queryFn: () => api.ledger.aging(),
        refetchInterval: 60000,
    });

    // ── Prescription tab state ─
    const [rxStart, setRxStart] = useState(isoNDaysAgo(30));
    const [rxEnd, setRxEnd] = useState(todayIso());
    const [medicationFilter, setMedicationFilter] = useState("");
    const [showRxReport, setShowRxReport] = useState(false);
    const [rxSortKey, setRxSortKey] = useState<RxSortKey>("visitDate");
    const [rxSortDir, setRxSortDir] = useState<SortDir>("desc");

    const { data: rxReport, refetch: refetchRx, isFetching: rxLoading } = useQuery({
        queryKey: ["reports", "prescriptions", rxStart, rxEnd, medicationFilter],
        queryFn: () => api.reports.prescriptions(rxStart, rxEnd, medicationFilter),
        enabled: false,
    });

    const { data: user } = useQuery({ queryKey: ["auth", "me"], queryFn: api.auth.me });

    // ── Sorted doctor production ─
    const sortedDoctors = useMemo(() => {
        if (!owner?.doctorProduction) return [];
        const arr = [...owner.doctorProduction];
        arr.sort((a, b) => {
            const av = safeNum((a as any)[docSortKey]);
            const bv = safeNum((b as any)[docSortKey]);
            return docSortDir === "asc" ? av - bv : bv - av;
        });
        return arr;
    }, [owner?.doctorProduction, docSortKey, docSortDir]);

    const handleDocSort = (key: DocSortKey) => {
        if (docSortKey === key) setDocSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setDocSortKey(key); setDocSortDir("desc"); }
    };

    // ── Sorted Rx rows ─
    const sortedRxRows = useMemo(() => {
        if (!rxReport?.rows) return [];
        const rows = [...rxReport.rows];
        rows.sort((a: any, b: any) => {
            let av = a[rxSortKey];
            let bv = b[rxSortKey];
            if (!av && !bv) return 0;
            if (!av) return 1;
            if (!bv) return -1;
            if (rxSortKey === "visitDate") {
                const diff = new Date(av).getTime() - new Date(bv).getTime();
                return rxSortDir === "asc" ? diff : -diff;
            }
            if (rxSortKey === "patientFileNumber") {
                const diff = Number(av) - Number(bv);
                return rxSortDir === "asc" ? diff : -diff;
            }
            av = String(av).toLowerCase(); bv = String(bv).toLowerCase();
            const cmp = av.localeCompare(bv);
            return rxSortDir === "asc" ? cmp : -cmp;
        });
        return rows;
    }, [rxReport?.rows, rxSortKey, rxSortDir]);

    const handleRxSort = (key: RxSortKey) => {
        if (rxSortKey === key) setRxSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setRxSortKey(key); setRxSortDir(key === "visitDate" ? "desc" : "asc"); }
    };

    // ── Exports ─
    const handleExportCsv = () => {
        if (!owner) return;
        const lines: string[] = [];
        lines.push(`Clinic Owner Report,${owner.range.from} to ${owner.range.to},${owner.range.groupBy}`);
        lines.push("");
        lines.push("# Totals");
        lines.push("Metric,Value");
        const t = owner.totals;
        lines.push(`Total Billed,${t.billed}`);
        lines.push(`Total Collected,${t.collected}`);
        lines.push(`Outstanding,${t.outstanding}`);
        lines.push(`Visit Count,${t.visitCount}`);
        lines.push(`Procedure Count,${t.procedureCount}`);
        lines.push(`Patient Count,${t.patientCount}`);
        lines.push(`Average Ticket,${t.averageTicket}`);
        lines.push(`Collection Rate %,${t.collectionRate}`);
        lines.push("");
        lines.push("# Revenue Trend");
        lines.push("Period,Billed,Collected,Visits");
        owner.revenueTrend.forEach((r) => lines.push([r.period, r.billed, r.collected, r.visits].map(csvEscape).join(",")));
        lines.push("");
        lines.push("# Doctor Production");
        lines.push("Doctor ID,Doctor,Billed,Collected,Outstanding,Visits,Procedures,Patients,Average Ticket");
        owner.doctorProduction.forEach((d) =>
            lines.push([d.doctorId, d.doctorName, d.billed, d.collected, d.outstanding, d.visitCount, d.procedureCount, d.patientCount, d.averageTicket].map(csvEscape).join(","))
        );
        lines.push("");
        lines.push("# Top Procedures");
        lines.push("Name,Category,Revenue,Count");
        owner.topProcedures.forEach((p) => lines.push([p.name, p.category, p.revenue, p.count].map(csvEscape).join(",")));
        lines.push("");
        lines.push("# Patient Growth");
        lines.push("Period,New Patients,Active Patients");
        owner.patientGrowth.forEach((g) => lines.push([g.period, g.newPatients, g.activePatients].map(csvEscape).join(",")));

        downloadFile(lines.join("\n"), `clinic-owner-report-${owner.range.from}-to-${owner.range.to}.csv`);
    };

    const handlePrint = () => {
        if (!owner) return;
        const t = owner.totals;
        const win = window.open("", "_blank", "width=900,height=700");
        if (!win) {
            alert("Pop-up blocked. Please allow pop-ups for this site to print the report.");
            return;
        }
        const rows = (arr: string[][]) => arr.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
        const docRows = owner.doctorProduction.map((d) => [
            d.doctorName, fmtCurrency(d.collected), fmtCurrency(d.billed), fmtCurrency(d.outstanding),
            String(d.visitCount), String(d.procedureCount), String(d.patientCount), fmtCurrency(d.averageTicket),
        ]);
        const procRows = owner.topProcedures.map((p) => [p.name, p.category, fmtCurrency(p.revenue), String(p.count)]);
        const trendRows = owner.revenueTrend.map((r) => [r.period, fmtCurrency(r.billed), fmtCurrency(r.collected), String(r.visits)]);
        const growthRows = owner.patientGrowth.map((g) => [g.period, String(g.newPatients), String(g.activePatients)]);

        win.document.write(`<!doctype html><html><head><title>Clinic Owner Report</title>
<style>
body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; padding: 32px; color: #111827; }
h1 { font-size: 24px; margin: 0 0 4px; }
.sub { color: #6b7280; margin-bottom: 24px; font-size: 13px; }
h2 { font-size: 15px; margin: 24px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
th { background: #f9fafb; font-weight: 600; color: #374151; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; }
.kpi label { display:block; color: #6b7280; font-size: 11px; text-transform: uppercase; }
.kpi .v { font-size: 18px; font-weight: 700; margin-top: 4px; }
@media print { body { padding: 12px; } button { display: none; } }
</style></head><body>
<button onclick="window.print()" style="float:right;padding:8px 14px;border-radius:6px;border:1px solid #d1d5db;background:#f9fafb;cursor:pointer;">Print / Save as PDF</button>
<h1>Clinic Owner Report</h1>
<div class="sub">${owner.range.from} → ${owner.range.to} • grouped ${owner.range.groupBy}</div>
<div class="kpi-grid">
<div class="kpi"><label>Collected</label><div class="v">${fmtCurrency(t.collected)}</div></div>
<div class="kpi"><label>Billed</label><div class="v">${fmtCurrency(t.billed)}</div></div>
<div class="kpi"><label>Outstanding</label><div class="v">${fmtCurrency(t.outstanding)}</div></div>
<div class="kpi"><label>Collection Rate</label><div class="v">${fmtPercent(t.collectionRate)}</div></div>
<div class="kpi"><label>Visits</label><div class="v">${t.visitCount}</div></div>
<div class="kpi"><label>Procedures</label><div class="v">${t.procedureCount}</div></div>
<div class="kpi"><label>Patients</label><div class="v">${t.patientCount}</div></div>
<div class="kpi"><label>Avg Ticket</label><div class="v">${fmtCurrency(t.averageTicket)}</div></div>
</div>
<h2>Doctor Production</h2>
<table><thead><tr><th>Doctor</th><th>Collected</th><th>Billed</th><th>Outstanding</th><th>Visits</th><th>Procedures</th><th>Patients</th><th>Avg Ticket</th></tr></thead>
<tbody>${rows(docRows)}</tbody></table>
<h2>Top Procedures</h2>
<table><thead><tr><th>Procedure</th><th>Category</th><th>Revenue</th><th>Count</th></tr></thead>
<tbody>${rows(procRows)}</tbody></table>
<h2>Revenue Trend</h2>
<table><thead><tr><th>Period</th><th>Billed</th><th>Collected</th><th>Visits</th></tr></thead>
<tbody>${rows(trendRows)}</tbody></table>
<h2>Patient Growth</h2>
<table><thead><tr><th>Period</th><th>New Patients</th><th>Active Patients</th></tr></thead>
<tbody>${rows(growthRows)}</tbody></table>
</body></html>`);
        win.document.close();
        win.focus();
    };

    // ── Sortable header for doctor table ─
    const DocHead = ({ label, k }: { label: string; k: DocSortKey }) => {
        const active = docSortKey === k;
        return (
            <th onClick={() => handleDocSort(k)} className="py-3 px-4 cursor-pointer select-none hover:bg-gray-100 transition text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                <span className="inline-flex items-center gap-1.5">
                    {label}
                    <span className={`text-[9px] ${active ? "text-primary-600" : "text-gray-300"}`}>
                        {active ? (docSortDir === "asc" ? "▲" : "▼") : "▾"}
                    </span>
                </span>
            </th>
        );
    };

    const RxHead = ({ label, k }: { label: string; k: RxSortKey }) => {
        const active = rxSortKey === k;
        return (
            <th onClick={() => handleRxSort(k)} className="py-3 px-4 font-semibold cursor-pointer select-none hover:bg-gray-100 transition group">
                <span className="inline-flex items-center gap-1.5">
                    {label}
                    <span className={`text-[10px] ${active ? "text-primary-600" : "text-gray-300 group-hover:text-gray-400"}`}>
                        {active ? (rxSortDir === "asc" ? "▲" : "▼") : "▾"}
                    </span>
                </span>
            </th>
        );
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            {/* ─── Header ─── */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900">Reports & Analytics</h1>
                    <p className="text-sm text-gray-500 mt-1">Track revenue, doctor production, top procedures, and patient growth.</p>
                </div>
            </div>

            {/* ─── Tabs ─── */}
            <div className="flex gap-1 border-b border-gray-200 mb-6">
                {[
                    { id: "owner", label: "📊 Owner Analytics" },
                    { id: "prescription", label: "💊 Prescription Report" },
                ].map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id as any)}
                        className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition ${tab === t.id ? "bg-white border border-gray-200 border-b-white text-primary-700 -mb-px" : "text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ─── Owner Analytics Tab ─── */}
            {tab === "owner" && (
                <div className="space-y-6">
                    {/* Filter bar */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-wrap items-end gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">From</label>
                            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">To</label>
                            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Group by</label>
                            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none bg-white">
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>
                        <div className="ml-auto flex gap-2">
                            <button onClick={() => refetchOwner()} disabled={ownerFetching}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                                {ownerFetching ? "Refreshing…" : "🔄 Refresh"}
                            </button>
                            <button onClick={handleExportCsv} disabled={!owner}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                                ⬇ Export CSV
                            </button>
                            <button onClick={handlePrint} disabled={!owner}
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
                                🖨 Print / PDF
                            </button>
                        </div>
                    </div>

                    {/* Loading / error */}
                    {ownerLoading && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 animate-pulse">
                                    <div className="w-10 h-10 bg-gray-200 rounded-xl mb-3"></div>
                                    <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                                    <div className="h-7 bg-gray-200 rounded w-1/2"></div>
                                </div>
                            ))}
                        </div>
                    )}

                    {ownerError && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800 text-sm">
                            Couldn't load owner analytics. Try refreshing.
                        </div>
                    )}

                    {owner && (
                        <>
                            {/* KPI Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                <Kpi icon="💵" label="Collected" value={fmtCurrency(owner.totals.collected)} accent="bg-emerald-50 text-emerald-600" />
                                <Kpi icon="🧾" label="Billed" value={fmtCurrency(owner.totals.billed)} accent="bg-sky-50 text-sky-600" />
                                <Kpi icon="📌" label="Outstanding" value={fmtCurrency(owner.totals.outstanding)} accent="bg-rose-50 text-rose-600" />
                                <Kpi icon="📈" label="Collection Rate" value={fmtPercent(owner.totals.collectionRate)} accent="bg-violet-50 text-violet-600" />
                                <Kpi icon="🏥" label="Visits" value={String(owner.totals.visitCount)} accent="bg-amber-50 text-amber-600" />
                                <Kpi icon="🎟" label="Avg Ticket" value={fmtCurrency(owner.totals.averageTicket)} accent="bg-teal-50 text-teal-600" />
                            </div>

                            {/* ── Aging / Receivables (Phase 6D2) ─ */}
                            {agingLoading ? (
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                    <div className="flex items-center gap-3 text-gray-500">
                                        <div className="animate-spin h-5 w-5 border-b-2 border-gray-600"></div>
                                        <span>Loading aging data...</span>
                                    </div>
                                </div>
                            ) : agingError ? (
                                <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6 text-red-600">
                                    Unable to load aging data.
                                </div>
                            ) : agingData && agingData.patients.length > 0 && (
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                ⏰ Aging / Receivables
                                            </h2>
                                            <p className="text-sm text-gray-500">
                                                {agingData.totals.patientCount} patients · {agingData.totals.overduePatientCount} overdue
                                                <span className="mx-2 text-gray-300">|</span>
                                                <button
                                                    onClick={() => window.location.href = "/billing"}
                                                    className="text-primary-600 hover:text-primary-700 font-medium"
                                                >
                                                    Full aging table →
                                                </button>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-500">Total Outstanding</p>
                                            <p className="text-2xl font-extrabold text-rose-600">${agingData.totals.totalBalance.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {/* Bucket summary bars */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                                            <p className="text-xs font-semibold text-emerald-600 uppercase mb-1">0–30 Days</p>
                                            <p className="text-xl font-bold text-emerald-700">${agingData.totals.current.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                            <p className="text-xs font-semibold text-amber-600 uppercase mb-1">31–60 Days</p>
                                            <p className="text-xl font-bold text-amber-700">${agingData.totals.days31to60.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                                            <p className="text-xs font-semibold text-orange-600 uppercase mb-1">61–90 Days</p>
                                            <p className="text-xl font-bold text-orange-700">${agingData.totals.days61to90.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-rose-50 rounded-xl p-4 border border-rose-200">
                                            <p className="text-xs font-semibold text-rose-600 uppercase mb-1">90+ Days</p>
                                            <p className="text-xl font-bold text-rose-700">${agingData.totals.over90.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {/* Top Overdue Patients table */}
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                            ⚠️ Top Overdue Patients
                                        </h3>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        <th className="py-3 px-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Patient</th>
                                                        <th className="py-3 px-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Total Balance</th>
                                                        <th className="py-3 px-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">0–30</th>
                                                        <th className="py-3 px-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">31–60</th>
                                                        <th className="py-3 px-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">61–90</th>
                                                        <th className="py-3 px-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">90+</th>
                                                        <th className="py-3 px-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Oldest Unpaid</th>
                                                        <th className="py-3 px-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Last Payment</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {agingData.patients.slice(0, 10).map((patient: any) => (
                                                        <tr
                                                            key={patient.patientId}
                                                            className="border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer"
                                                            onClick={() => window.location.href = `/patient/${patient.patientId}`}
                                                        >
                                                            <td className="py-3 px-4 font-semibold text-gray-800">{patient.patientName}</td>
                                                            <td className="py-3 px-4 text-right font-bold text-rose-600">${patient.totalBalance.toLocaleString()}</td>
                                                            <td className="py-3 px-4 text-right text-emerald-600">
                                                                {patient.buckets.current > 0 ? `$${patient.buckets.current.toLocaleString()}` : '—'}
                                                            </td>
                                                            <td className="py-3 px-4 text-right text-amber-600">
                                                                {patient.buckets.days31to60 > 0 ? `$${patient.buckets.days31to60.toLocaleString()}` : '—'}
                                                            </td>
                                                            <td className="py-3 px-4 text-right text-orange-600">
                                                                {patient.buckets.days61to90 > 0 ? `$${patient.buckets.days61to90.toLocaleString()}` : '—'}
                                                            </td>
                                                            <td className={`py-3 px-4 text-right font-medium ${patient.buckets.over90 > 0 ? 'text-rose-600 bg-rose-50' : ''}`}>
                                                                {patient.buckets.over90 > 0 ? `$${patient.buckets.over90.toLocaleString()}` : '—'}
                                                            </td>
                                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                                {patient.oldestUnpaidDate ? new Date(patient.oldestUnpaidDate).toLocaleDateString() : '—'}
                                                            </td>
                                                            <td className="py-3 px-4 text-sm text-gray-500">
                                                                {patient.lastPaymentDate ? new Date(patient.lastPaymentDate).toLocaleDateString() : '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Revenue Trend */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <h2 className="text-lg font-bold text-gray-800 mb-1">Revenue Trend</h2>
                                <p className="text-xs text-gray-500 mb-4">Billed vs collected, grouped {owner.range.groupBy}.</p>
                                <TrendChart data={owner.revenueTrend} />
                            </div>

                            {/* Doctor Production */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <h2 className="text-lg font-bold text-gray-800 mb-1">Doctor Production</h2>
                                <p className="text-xs text-gray-500 mb-4">Sorted by {docSortKey} ({docSortDir}). Click a column to sort.</p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="py-3 px-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Doctor</th>
                                                <DocHead label="Collected" k="collected" />
                                                <DocHead label="Billed" k="billed" />
                                                <th className="py-3 px-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Outstanding</th>
                                                <DocHead label="Visits" k="visitCount" />
                                                <th className="py-3 px-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Procedures</th>
                                                <DocHead label="Patients" k="patientCount" />
                                                <DocHead label="Avg Ticket" k="averageTicket" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedDoctors.map((d) => (
                                                <tr key={d.doctorId} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                                    <td className="py-3 px-4 font-semibold text-gray-800">{d.doctorName}</td>
                                                    <td className="py-3 px-4 font-bold text-emerald-700">{fmtCurrency(d.collected)}</td>
                                                    <td className="py-3 px-4 text-gray-700">{fmtCurrency(d.billed)}</td>
                                                    <td className="py-3 px-4 text-rose-600">{fmtCurrency(d.outstanding)}</td>
                                                    <td className="py-3 px-4 text-gray-700">{d.visitCount}</td>
                                                    <td className="py-3 px-4 text-gray-700">{d.procedureCount}</td>
                                                    <td className="py-3 px-4 text-gray-700">{d.patientCount}</td>
                                                    <td className="py-3 px-4 text-gray-700">{fmtCurrency(d.averageTicket)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Top Procedures + Patient Growth */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                    <h2 className="text-lg font-bold text-gray-800 mb-1">Top Procedures</h2>
                                    <p className="text-xs text-gray-500 mb-4">By revenue (max 10).</p>
                                    <TopProceduresChart data={owner.topProcedures} />
                                </div>
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                    <h2 className="text-lg font-bold text-gray-800 mb-1">Patient Growth</h2>
                                    <p className="text-xs text-gray-500 mb-4">New vs active patients per period.</p>
                                    <PatientGrowthChart data={owner.patientGrowth} />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ─── Prescription Report Tab ─── */}
            {tab === "prescription" && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">🔍 Custom Prescription Report</h2>

                    <div className="flex flex-wrap gap-4 items-end mb-8">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
                            <input type="date" value={rxStart} onChange={(e) => setRxStart(e.target.value)}
                                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">End Date</label>
                            <input type="date" value={rxEnd} onChange={(e) => setRxEnd(e.target.value)}
                                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Medication (Optional)</label>
                            <AutocompleteInput
                                category="medication"
                                value={medicationFilter}
                                onChange={setMedicationFilter}
                                placeholder="Filter by medication name..."
                                className="px-4 py-2 text-base border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                        <button
                            onClick={() => { setShowRxReport(true); refetchRx(); }}
                            className="px-6 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition"
                        >
                            Generate Report
                        </button>
                    </div>

                    {showRxReport && (
                        <div>
                            {rxLoading ? (
                                <div className="py-12 text-center text-gray-500">Loading data...</div>
                            ) : !rxReport || rxReport.rows?.length === 0 ? (
                                <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-lg">
                                    No prescriptions found for this criteria.
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                        <div className="bg-primary-50 border border-primary-200 rounded-xl p-5 text-center">
                                            <p className="text-3xl font-extrabold text-primary-700">{rxReport.totalInRange}</p>
                                            <p className="text-sm text-primary-500 mt-1">Prescriptions in range</p>
                                        </div>
                                        {rxReport.medication && (
                                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
                                                <p className="text-3xl font-extrabold text-amber-700">{rxReport.totalAllTime}</p>
                                                <p className="text-sm text-amber-600 mt-1">Total all-time for "{rxReport.medication}"</p>
                                            </div>
                                        )}
                                        <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 text-center">
                                            <p className="text-3xl font-extrabold text-teal-700">{rxReport.uniquePatients}</p>
                                            <p className="text-sm text-teal-500 mt-1">Unique patients</p>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50 text-gray-700 border-b border-gray-200">
                                                    <RxHead label="Date" k="visitDate" />
                                                    <RxHead label="Patient" k="patientName" />
                                                    <RxHead label="File #" k="patientFileNumber" />
                                                    <RxHead label="Medication" k="medicationName" />
                                                    <RxHead label="Dosage" k="dosage" />
                                                    <RxHead label="Frequency" k="frequency" />
                                                    <RxHead label="Duration" k="duration" />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedRxRows.map((rx: any) => (
                                                    <tr key={rx.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                        <td className="py-3 px-4">{new Date(rx.visitDate).toLocaleDateString()}</td>
                                                        <td className="py-3 px-4 font-medium text-primary-700">{rx.patientName}</td>
                                                        <td className="py-3 px-4 text-gray-500">#{rx.patientFileNumber}</td>
                                                        <td className="py-3 px-4 font-semibold text-gray-800">{rx.medicationName}</td>
                                                        <td className="py-3 px-4 text-gray-600">{rx.dosage || "—"}</td>
                                                        <td className="py-3 px-4 text-gray-600">{rx.frequency || "—"}</td>
                                                        <td className="py-3 px-4 text-gray-600">{rx.duration || "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ─── Admin Data Export (preserved) ─── */}
            {user?.role === "admin" && tab === "prescription" && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mt-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">📤 Bulk Data Export</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <a href="/api/reports/export/patients"
                            className="flex items-center gap-3 p-5 bg-primary-50 rounded-xl hover:bg-primary-100 transition border border-primary-200">
                            <span className="text-3xl">👥</span>
                            <div>
                                <p className="font-bold text-primary-700">Export Patients</p>
                                <p className="text-sm text-primary-500">Download all patient records as CSV</p>
                            </div>
                        </a>
                        <a href={`/api/reports/export/billing?startDate=${rxStart}&endDate=${rxEnd}`}
                            className="flex items-center gap-3 p-5 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition border border-emerald-200">
                            <span className="text-3xl">💰</span>
                            <div>
                                <p className="font-bold text-emerald-700">Export Billing</p>
                                <p className="text-sm text-emerald-500">Download billing records as CSV ({rxStart} — {rxEnd})</p>
                            </div>
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
