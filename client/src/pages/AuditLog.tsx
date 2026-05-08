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

const ACTION_ICONS: Record<string, string> = {
    CREATE: "✅",
    UPDATE: "✏️",
    DELETE: "🗑️",
    ADD_FINDINGS: "🦷",
    ADD_PRESCRIPTIONS: "💊",
    ADD_LAB_ORDERS: "🧪",
    ADD_PROCEDURES: "⚕️",
    ADD_PAYMENTS: "💰",
    VIEW: "👁️",
};

const RESOURCES = ["", "Patient", "Visit", "Billing", "Appointment", "Recall", "Referral", "User", "Settings"];

export default function AuditLog() {
    const [resourceFilter, setResourceFilter] = useState("");
    const [limit, setLimit] = useState(100);

    const { data: entries = [], isLoading, refetch } = useQuery({
        queryKey: ["audit-log", limit, resourceFilter],
        queryFn: () => api.auditLog.list(limit, resourceFilter || undefined),
        refetchInterval: 15000,
    });

    return (
        <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900">🔍 Audit Log</h1>
                    <p className="text-gray-500 mt-1">All write operations performed in the system</p>
                </div>
                <div className="flex gap-3 items-center">
                    <select
                        value={resourceFilter}
                        onChange={(e) => setResourceFilter(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300"
                    >
                        {RESOURCES.map((r) => (
                            <option key={r} value={r}>{r || "All Resources"}</option>
                        ))}
                    </select>
                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300"
                    >
                        {[50, 100, 200, 500].map((n) => (
                            <option key={n} value={n}>Last {n}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => refetch()}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition text-sm font-semibold"
                    >
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-16 text-gray-400 animate-pulse">Loading audit log...</div>
            ) : entries.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center text-gray-400">
                    <p className="text-5xl mb-4">📋</p>
                    <p className="text-xl font-semibold">No audit entries yet</p>
                    <p className="text-sm mt-2">Entries are recorded for all create, update, and delete operations</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                                    <th className="px-4 py-3 font-semibold text-gray-600">Time</th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">User</th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">Method</th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">Action</th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">Resource</th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">Path</th>
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
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${METHOD_COLORS[entry.method] || "bg-gray-100 text-gray-600"}`}>
                                                {entry.method}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="flex items-center gap-1.5">
                                                <span>{ACTION_ICONS[entry.action] || "•"}</span>
                                                <span className="font-medium text-gray-700">{entry.action?.replace(/_/g, " ")}</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-semibold text-primary-700">{entry.resourceType}</span>
                                            {entry.resourceId && (
                                                <span className="text-xs text-gray-400 ml-1">#{entry.resourceId}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-[180px] truncate">
                                            {entry.path}
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
                        Showing {entries.length} entries • Auto-refreshes every 15 seconds • Max stored: 500 entries
                    </div>
                </div>
            )}
        </div>
    );
}
