import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const METHOD_COLORS: Record<string, string> = {
    GET: "bg-blue-100 text-blue-700",
    POST: "bg-green-100 text-green-700",
    PUT: "bg-yellow-100 text-yellow-700",
    PATCH: "bg-amber-100 text-amber-700",
    DELETE: "bg-red-100 text-red-700",
};

const ACTION_COLORS: Record<string, string> = {
    APPOINTMENT_CREATE: "bg-green-100 text-green-700",
    APPOINTMENT_UPDATE: "bg-yellow-100 text-yellow-700",
    APPOINTMENT_DELETE: "bg-red-100 text-red-700",
    LEDGER_ADJUSTMENT: "bg-orange-100 text-orange-700",
    PAYMENT_PLAN_CREATE: "bg-blue-100 text-blue-700",
    PAYMENT_PLAN_STATUS_UPDATE: "bg-amber-100 text-amber-700",
    INSTALLMENT_PAYMENT: "bg-emerald-100 text-emerald-700",
    TREATMENT_PLAN_CREATE: "bg-violet-100 text-violet-700",
    TREATMENT_PLAN_UPDATE: "bg-purple-100 text-purple-700",
    TREATMENT_ITEM_CREATE: "bg-indigo-100 text-indigo-700",
    TREATMENT_ITEM_UPDATE: "bg-indigo-100 text-indigo-700",
    TREATMENT_ITEM_DELETE: "bg-red-100 text-red-700",
    TREATMENT_ITEM_CONVERT: "bg-teal-100 text-teal-700",
    UPDATE_REMINDER_SETTINGS: "bg-yellow-100 text-yellow-700",
    UPDATE_PATIENT_REMINDER_PREFS: "bg-sky-100 text-sky-700",
    CREATE: "bg-green-100 text-green-700",
    UPDATE: "bg-yellow-100 text-yellow-700",
    DELETE: "bg-red-100 text-red-700",
};

const ENTITY_TYPES = ["", "Appointment", "TreatmentPlan", "TreatmentPlanItem", "LedgerAdjustment", "PaymentPlan", "PaymentInstallment", "ReminderSettings", "ReminderPreferences", "Patient", "Visit", "Billing", "User", "Settings"];

export default function AuditLog() {
    const [actionFilter, setActionFilter] = useState("");
    const [entityTypeFilter, setEntityTypeFilter] = useState("");
    const [patientIdFilter, setPatientIdFilter] = useState("");
    const [fromFilter, setFromFilter] = useState("");
    const [toFilter, setToFilter] = useState("");
    const [limit, setLimit] = useState(100);

    const queryParams = {
        action: actionFilter || undefined,
        entityType: entityTypeFilter || undefined,
        patientId: patientIdFilter.trim() || undefined,
        from: fromFilter || undefined,
        to: toFilter || undefined,
        limit,
    };

    const { data: entries = [], isLoading, refetch } = useQuery({
        queryKey: ["audit-logs", queryParams],
        queryFn: () => api.auditLogs.list(queryParams),
        refetchInterval: 15000,
    });

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900">🔍 Audit Log</h1>
                    <p className="text-gray-500 mt-1">Sensitive actions performed in the system — admin only</p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition text-sm font-semibold"
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Entity Type</label>
                    <select
                        value={entityTypeFilter}
                        onChange={(e) => setEntityTypeFilter(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300"
                    >
                        {ENTITY_TYPES.map((r) => (
                            <option key={r} value={r}>{r || "All Entities"}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</label>
                    <input
                        type="text"
                        placeholder="e.g. LEDGER_ADJUSTMENT"
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300 w-52"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Patient ID</label>
                    <input
                        type="text"
                        placeholder="Patient ID"
                        value={patientIdFilter}
                        onChange={(e) => setPatientIdFilter(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300 w-36"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">From</label>
                    <input
                        type="date"
                        value={fromFilter}
                        onChange={(e) => setFromFilter(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">To</label>
                    <input
                        type="date"
                        value={toFilter}
                        onChange={(e) => setToFilter(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Limit</label>
                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300"
                    >
                        {[50, 100, 200, 500].map((n) => (
                            <option key={n} value={n}>Last {n}</option>
                        ))}
                    </select>
                </div>
                {(actionFilter || entityTypeFilter || patientIdFilter || fromFilter || toFilter) && (
                    <button
                        onClick={() => { setActionFilter(""); setEntityTypeFilter(""); setPatientIdFilter(""); setFromFilter(""); setToFilter(""); }}
                        className="px-3 py-2 text-xs text-red-500 hover:text-red-700 font-semibold self-end"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="text-center py-16 text-gray-400 animate-pulse">Loading audit log...</div>
            ) : entries.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center text-gray-400">
                    <p className="text-5xl mb-4">📋</p>
                    <p className="text-xl font-semibold">No audit entries found</p>
                    <p className="text-sm mt-2">Entries are recorded for sensitive mutations. Try clearing filters.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                                    <th className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Time</th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">Actor</th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">Action</th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">Entity</th>
                                    <th className="px-4 py-3 font-semibold text-gray-600 max-w-xs">Summary</th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">Method</th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry: any) => (
                                    <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                                            {new Date(entry.timestamp).toLocaleString("en-US", {
                                                month: "short", day: "numeric",
                                                hour: "2-digit", minute: "2-digit", second: "2-digit",
                                            })}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-gray-800">{entry.username}</div>
                                            <div className="text-xs text-gray-400 capitalize">{entry.role}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${ACTION_COLORS[entry.action] || "bg-gray-100 text-gray-600"}`}>
                                                {entry.action?.replace(/_/g, " ")}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-primary-700 text-xs">
                                                {entry.entityType || entry.resourceType}
                                            </div>
                                            {(entry.entityId || entry.resourceId) && (
                                                <div className="text-xs text-gray-400 font-mono truncate max-w-[100px]">
                                                    {(entry.entityId || entry.resourceId)?.slice(0, 8)}…
                                                </div>
                                            )}
                                            {entry.patientId && (
                                                <div className="text-xs text-blue-400 font-mono">pt:{entry.patientId.slice(0, 6)}…</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 text-xs max-w-xs">
                                            {entry.summary || entry.path || "—"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${METHOD_COLORS[entry.method] || "bg-gray-100 text-gray-600"}`}>
                                                {entry.method}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-gray-400">
                                            {entry.ipAddress}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                        Showing {entries.length} entries • Auto-refreshes every 15 seconds • Max stored: 1000 entries
                    </div>
                </div>
            )}
        </div>
    );
}
