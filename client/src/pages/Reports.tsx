import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import AutocompleteInput from "../components/AutocompleteInput";

type SortKey = "visitDate" | "patientName" | "patientFileNumber" | "medicationName" | "dosage" | "frequency" | "duration";
type SortDir = "asc" | "desc";

const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
const today = new Date().toISOString().split("T")[0];

export default function Reports() {
    // ... existing queries

    // Custom Report State
    const [startDate, setStartDate] = useState(
        new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
    );
    const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
    const [medicationFilter, setMedicationFilter] = useState("");
    const [showCustomReport, setShowCustomReport] = useState(false);

    // Financial report date range
    const [finFrom, setFinFrom] = useState(thisMonthStart);
    const [finTo, setFinTo] = useState(today);

    // Sorting State
    const [sortKey, setSortKey] = useState<SortKey>("visitDate");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    const { data: user } = useQuery({ queryKey: ["auth", "me"], queryFn: api.auth.me });

    const { data: financialReport } = useQuery({
        queryKey: ["reports", "financial", finFrom, finTo],
        queryFn: () => api.reports.financial(finFrom, finTo),
    });

    const { data: prescriptionReport, refetch: generateReport, isFetching: reportLoading } = useQuery({
        queryKey: ["reports", "prescriptions", startDate, endDate, medicationFilter],
        queryFn: () => api.reports.prescriptions(startDate, endDate, medicationFilter),
        enabled: false, // Only run when button clicked
    });

    // ─── Sort Handler ───────────────────────────────────────────────
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir(key === "visitDate" ? "desc" : "asc");
        }
    };

    // ─── Sorted Rows ────────────────────────────────────────────────
    const sortedRows = useMemo(() => {
        if (!prescriptionReport?.rows) return [];
        const rows = [...prescriptionReport.rows];
        rows.sort((a: any, b: any) => {
            let aVal = a[sortKey];
            let bVal = b[sortKey];

            // Handle nulls / "—"
            if (!aVal && !bVal) return 0;
            if (!aVal) return 1;
            if (!bVal) return -1;

            // Date comparison
            if (sortKey === "visitDate") {
                const diff = new Date(aVal).getTime() - new Date(bVal).getTime();
                return sortDir === "asc" ? diff : -diff;
            }

            // Numeric comparison for file numbers
            if (sortKey === "patientFileNumber") {
                const diff = Number(aVal) - Number(bVal);
                return sortDir === "asc" ? diff : -diff;
            }

            // String comparison (case-insensitive)
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();
            const cmp = aVal.localeCompare(bVal);
            return sortDir === "asc" ? cmp : -cmp;
        });
        return rows;
    }, [prescriptionReport?.rows, sortKey, sortDir]);

    // ... existing loading check

    // ─── Sortable Header Component ──────────────────────────────────
    const SortHeader = ({ label, field }: { label: string; field: SortKey }) => {
        const isActive = sortKey === field;
        return (
            <th
                className="py-3 px-4 font-semibold cursor-pointer select-none hover:bg-gray-100 transition-colors group"
                onClick={() => handleSort(field)}
            >
                <span className="inline-flex items-center gap-1.5">
                    {label}
                    <span className={`inline-flex flex-col text-[10px] leading-none ${isActive ? "text-primary-600" : "text-gray-300 group-hover:text-gray-400"}`}>
                        <span className={isActive && sortDir === "asc" ? "text-primary-600" : ""}>▲</span>
                        <span className={isActive && sortDir === "desc" ? "text-primary-600" : ""}>▼</span>
                    </span>
                </span>
            </th>
        );
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-8">📊 Clinic Reports</h1>

            {/* ─── Daily Summary ─── */}
            {/* ... existing summary cards */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                {/* ─── Top Diagnoses ─── */}
                {/* ... existing diagnoses */}

                {/* ─── Top Medications ─── */}
                {/* ... existing medications */}
            </div>

            {/* ─── Financial Report ─── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">💰 Financial Report</h2>
                    <div className="flex gap-3 items-center">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">From</label>
                            <input type="date" value={finFrom} onChange={(e) => setFinFrom(e.target.value)}
                                className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
                            <input type="date" value={finTo} onChange={(e) => setFinTo(e.target.value)}
                                className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none" />
                        </div>
                    </div>
                </div>

                {financialReport && (
                    <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-center">
                                <p className="text-2xl font-extrabold text-blue-700">${financialReport.totalBilled?.toFixed(0)}</p>
                                <p className="text-sm text-blue-500 mt-1">Total Charged</p>
                            </div>
                            <div className="bg-green-50 border border-green-100 rounded-2xl p-5 text-center">
                                <p className="text-2xl font-extrabold text-green-700">${financialReport.totalPaid?.toFixed(0)}</p>
                                <p className="text-sm text-green-500 mt-1">Total Collected</p>
                            </div>
                            <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-center">
                                <p className="text-2xl font-extrabold text-red-700">${financialReport.outstanding?.toFixed(0)}</p>
                                <p className="text-sm text-red-500 mt-1">Outstanding</p>
                            </div>
                            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 text-center">
                                <p className="text-2xl font-extrabold text-purple-700">{financialReport.collectionRate}%</p>
                                <p className="text-sm text-purple-500 mt-1">Collection Rate</p>
                            </div>
                        </div>

                        {/* Payment Status Breakdown + Revenue by Visit Type */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Payment Status */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Payment Status</h3>
                                <div className="space-y-2">
                                    {[
                                        { label: "Paid", count: financialReport.paidCount, color: "bg-green-500" },
                                        { label: "Partial", count: financialReport.partialCount, color: "bg-yellow-400" },
                                        { label: "Unpaid", count: financialReport.unpaidCount, color: "bg-red-400" },
                                    ].map(({ label, count, color }) => {
                                        const total = (financialReport.paidCount || 0) + (financialReport.partialCount || 0) + (financialReport.unpaidCount || 0);
                                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                        return (
                                            <div key={label}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="font-medium text-gray-700">{label}</span>
                                                    <span className="text-gray-500">{count} ({pct}%)</span>
                                                </div>
                                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Revenue by Visit Type */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Revenue by Visit Type</h3>
                                {financialReport.revenueByType?.length === 0 ? (
                                    <p className="text-gray-400 text-sm">No billing data in range</p>
                                ) : (
                                    <div className="space-y-2">
                                        {financialReport.revenueByType?.slice(0, 6).map((row: any) => (
                                            <div key={row.type} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                                                <span className="font-medium text-gray-700 capitalize">{row.type}</span>
                                                <div className="text-right">
                                                    <span className="font-bold text-green-700">${row.paid.toFixed(0)}</span>
                                                    {row.billed > row.paid && (
                                                        <span className="text-xs text-gray-400 ml-1">/ ${row.billed.toFixed(0)}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Revenue by Procedure Category */}
                        {financialReport.revenueByProcedure?.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Revenue by Procedure Category</h3>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    {financialReport.revenueByProcedure.map((row: any) => (
                                        <div key={row.category} className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                                            <p className="text-lg font-extrabold text-gray-800">${row.total.toFixed(0)}</p>
                                            <p className="text-xs text-gray-500 capitalize mt-1">{row.category}</p>
                                            <p className="text-[10px] text-gray-400">{row.count} procedure{row.count !== 1 ? "s" : ""}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ─── Custom Reports ─── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">🔍 Custom Prescription Report</h2>

                <div className="flex flex-wrap gap-4 items-end mb-8">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        />
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
                        onClick={() => {
                            setShowCustomReport(true);
                            generateReport();
                        }}
                        className="px-6 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition"
                    >
                        Generate Report
                    </button>
                </div>

                {showCustomReport && (
                    <div>
                        {reportLoading ? (
                            <div className="py-12 text-center text-gray-500">Loading data...</div>
                        ) : !prescriptionReport || prescriptionReport.rows?.length === 0 ? (
                            <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-lg">
                                No prescriptions found for this criteria.
                            </div>
                        ) : (
                            <>
                                {/* ─── Summary Stats Banner ─── */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                    <div className="bg-primary-50 border border-primary-200 rounded-xl p-5 text-center">
                                        <p className="text-3xl font-extrabold text-primary-700">
                                            {prescriptionReport.totalInRange}
                                        </p>
                                        <p className="text-sm text-primary-500 mt-1">
                                            Prescriptions in range
                                        </p>
                                    </div>
                                    {prescriptionReport.medication && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
                                            <p className="text-3xl font-extrabold text-amber-700">
                                                {prescriptionReport.totalAllTime}
                                            </p>
                                            <p className="text-sm text-amber-600 mt-1">
                                                Total all-time for "{prescriptionReport.medication}"
                                            </p>
                                        </div>
                                    )}
                                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 text-center">
                                        <p className="text-3xl font-extrabold text-teal-700">
                                            {prescriptionReport.uniquePatients}
                                        </p>
                                        <p className="text-sm text-teal-500 mt-1">
                                            Unique patients
                                        </p>
                                    </div>
                                </div>

                                {/* ─── Detail Table ─── */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 text-gray-700 border-b border-gray-200">
                                                <SortHeader label="Date" field="visitDate" />
                                                <SortHeader label="Patient" field="patientName" />
                                                <SortHeader label="File #" field="patientFileNumber" />
                                                <SortHeader label="Medication" field="medicationName" />
                                                <SortHeader label="Dosage" field="dosage" />
                                                <SortHeader label="Frequency" field="frequency" />
                                                <SortHeader label="Duration" field="duration" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedRows.map((rx: any) => (
                                                <tr key={rx.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                    <td className="py-3 px-4">
                                                        {new Date(rx.visitDate).toLocaleDateString()}
                                                    </td>
                                                    <td className="py-3 px-4 font-medium text-primary-700">
                                                        {rx.patientName}
                                                    </td>
                                                    <td className="py-3 px-4 text-gray-500">
                                                        #{rx.patientFileNumber}
                                                    </td>
                                                    <td className="py-3 px-4 font-semibold text-gray-800">
                                                        {rx.medicationName}
                                                    </td>
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

            {/* ─── Data Export ─── */}
            {user?.role === "admin" && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mt-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">📤 Data Export</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <a
                            href="/api/reports/export/patients"
                            className="flex items-center gap-3 p-5 bg-primary-50 rounded-xl hover:bg-primary-100 transition border border-primary-200"
                        >
                            <span className="text-3xl">👥</span>
                            <div>
                                <p className="font-bold text-primary-700">Export Patients</p>
                                <p className="text-sm text-primary-500">Download all patient records as CSV</p>
                            </div>
                        </a>
                        <a
                            href={`/api/reports/export/billing?startDate=${startDate}&endDate=${endDate}`}
                            className="flex items-center gap-3 p-5 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition border border-emerald-200"
                        >
                            <span className="text-3xl">💰</span>
                            <div>
                                <p className="font-bold text-emerald-700">Export Billing</p>
                                <p className="text-sm text-emerald-500">Download billing records as CSV ({startDate} — {endDate})</p>
                            </div>
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}

function SummaryCard({ label, value, sub, color }: any) {
    return (
        <div className={`rounded-2xl p-6 ${color}`}>
            <p className="text-sm font-medium opacity-80 mb-1">{label}</p>
            <p className="text-3xl font-extrabold">{value}</p>
            <p className="text-xs opacity-60 mt-1">{sub}</p>
        </div>
    );
}
