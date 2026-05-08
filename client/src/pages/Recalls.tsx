import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

const RECALL_TYPES = ["cleaning", "ortho", "post_op", "x_ray", "consultation", "other"];
const STATUS_OPTIONS = ["pending", "contacted", "scheduled", "completed", "no_response"];

const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    contacted: "bg-blue-100 text-blue-800",
    scheduled: "bg-purple-100 text-purple-800",
    completed: "bg-green-100 text-green-800",
    no_response: "bg-red-100 text-red-800",
};

export default function Recalls() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<"all" | "pending" | "overdue">("pending");
    const [showAddRecall, setShowAddRecall] = useState(false);
    const [addForm, setAddForm] = useState({ patientId: "", recallType: "cleaning", dueDate: "", notes: "" });
    const [patientSearch, setPatientSearch] = useState("");

    const { data: recalls = [], isLoading } = useQuery({
        queryKey: ["recalls"],
        queryFn: () => api.recalls.list(),
        refetchInterval: 30000,
    });

    const { data: patientSearchResults = [] } = useQuery({
        queryKey: ["patients", "search", patientSearch],
        queryFn: () => api.patients.search(patientSearch),
        enabled: patientSearch.length >= 2,
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.recalls.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recalls"] }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.recalls.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recalls"] }),
    });

    const waMutation = useMutation({
        mutationFn: (recall: any) =>
            api.whatsapp.sendRecallReminder({
                patientName: recall.patientName || recall.patient?.firstName + " " + recall.patient?.lastName || "Patient",
                phone: recall.patientPhone || recall.patient?.phone || "",
                recallType: recall.recallType,
                dueDate: recall.dueDate,
            }),
        onSuccess: () => alert("WhatsApp recall reminder sent!"),
        onError: (e: any) => alert("Failed: " + (e.message || "WhatsApp not connected")),
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => api.recalls.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["recalls"] });
            setShowAddRecall(false);
            setAddForm({ patientId: "", recallType: "cleaning", dueDate: "", notes: "" });
            setPatientSearch("");
        },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filteredRecalls = recalls.filter((r: any) => {
        const due = new Date(r.dueDate);
        if (filter === "pending") return r.status === "pending" || r.status === "contacted";
        if (filter === "overdue") return due < today && r.status !== "completed";
        return true;
    }).sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const overdueCount = recalls.filter((r: any) => {
        const due = new Date(r.dueDate);
        return due < today && r.status !== "completed";
    }).length;

    const pendingCount = recalls.filter((r: any) =>
        r.status === "pending" || r.status === "contacted"
    ).length;

    return (
        <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900">🔔 Patient Recalls</h1>
                    <p className="text-gray-500 mt-1">Track patients due for follow-up appointments</p>
                </div>
                <button
                    onClick={() => setShowAddRecall(true)}
                    className="px-5 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition shadow"
                >
                    ➕ Add Recall
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
                    <p className="text-3xl font-extrabold text-gray-800">{recalls.length}</p>
                    <p className="text-sm text-gray-500 mt-1">Total Recalls</p>
                </div>
                <div className="bg-yellow-50 rounded-2xl shadow-sm border border-yellow-100 p-5 text-center">
                    <p className="text-3xl font-extrabold text-yellow-700">{pendingCount}</p>
                    <p className="text-sm text-yellow-600 mt-1">Pending / Contacted</p>
                </div>
                <div className="bg-red-50 rounded-2xl shadow-sm border border-red-100 p-5 text-center">
                    <p className="text-3xl font-extrabold text-red-700">{overdueCount}</p>
                    <p className="text-sm text-red-500 mt-1">Overdue</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6">
                {(["pending", "overdue", "all"] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-5 py-2 rounded-xl font-semibold text-sm transition ${filter === f
                            ? "bg-primary-600 text-white shadow"
                            : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                            }`}
                    >
                        {f === "pending" ? "⏳ Active" : f === "overdue" ? "⚠️ Overdue" : "📋 All"}
                    </button>
                ))}
            </div>

            {/* Recalls List */}
            {isLoading ? (
                <div className="text-center py-16 text-gray-400 animate-pulse">Loading recalls...</div>
            ) : filteredRecalls.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center text-gray-400">
                    <p className="text-5xl mb-4">✅</p>
                    <p className="text-xl font-semibold">No recalls in this category</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredRecalls.map((recall: any) => {
                        const dueDate = new Date(recall.dueDate);
                        const isOverdue = dueDate < today && recall.status !== "completed";
                        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);

                        return (
                            <div
                                key={recall.id}
                                className={`bg-white rounded-2xl shadow-sm border p-5 flex items-center gap-4 transition hover:shadow-md ${isOverdue ? "border-red-200 bg-red-50/30" : "border-gray-100"}`}
                            >
                                {/* Date indicator */}
                                <div className={`flex-shrink-0 text-center w-16 rounded-xl p-2 ${isOverdue ? "bg-red-100" : daysUntilDue <= 7 ? "bg-yellow-100" : "bg-blue-50"}`}>
                                    <p className={`text-xs font-bold uppercase ${isOverdue ? "text-red-600" : daysUntilDue <= 7 ? "text-yellow-700" : "text-blue-600"}`}>
                                        {dueDate.toLocaleDateString("en-US", { month: "short" })}
                                    </p>
                                    <p className={`text-2xl font-extrabold leading-none ${isOverdue ? "text-red-700" : "text-gray-800"}`}>
                                        {dueDate.getDate()}
                                    </p>
                                    <p className={`text-[10px] font-medium ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
                                        {isOverdue ? "OVERDUE" : daysUntilDue === 0 ? "TODAY" : daysUntilDue === 1 ? "1 DAY" : `${daysUntilDue}d`}
                                    </p>
                                </div>

                                {/* Patient info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <button
                                            onClick={() => navigate(`/patient/${recall.patientId}`)}
                                            className="text-lg font-bold text-primary-700 hover:underline truncate"
                                        >
                                            {recall.patientName}
                                        </button>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[recall.status] || "bg-gray-100 text-gray-600"}`}>
                                            {recall.status?.replace("_", " ").toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-gray-500">
                                        <span className="capitalize bg-gray-100 px-2 py-0.5 rounded font-medium">{recall.recallType?.replace("_", " ")}</span>
                                        {recall.patientPhone && <span>📞 {recall.patientPhone}</span>}
                                        {recall.notes && <span className="italic truncate">"{recall.notes}"</span>}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex-shrink-0 flex items-center gap-2">
                                    <select
                                        value={recall.status}
                                        onChange={(e) => updateMutation.mutate({ id: recall.id, data: { status: e.target.value } })}
                                        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-primary-300 outline-none"
                                    >
                                        {STATUS_OPTIONS.map((s) => (
                                            <option key={s} value={s}>{s.replace("_", " ")}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => {
                                            if (confirm("Delete this recall?")) deleteMutation.mutate(recall.id);
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                        title="Delete"
                                    >
                                        🗑️
                                    </button>
                                    <button
                                        onClick={() => waMutation.mutate(recall)}
                                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                                        title="Send WhatsApp Reminder"
                                    >
                                        📱
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add Recall Dialog */}
            {showAddRecall && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAddRecall(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-gray-800 mb-5">➕ Add Patient Recall</h3>
                        <div className="space-y-4">
                            {/* Patient search */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Patient</label>
                                <input
                                    type="text"
                                    value={patientSearch}
                                    onChange={(e) => setPatientSearch(e.target.value)}
                                    placeholder="Search patient name..."
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-300"
                                />
                                {patientSearchResults.length > 0 && !addForm.patientId && (
                                    <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden shadow">
                                        {patientSearchResults.slice(0, 5).map((pt: any) => (
                                            <button
                                                key={pt.id}
                                                onClick={() => {
                                                    setAddForm((f) => ({ ...f, patientId: pt.id }));
                                                    setPatientSearch(`${pt.firstName} ${pt.lastName}`);
                                                }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-primary-50 transition text-sm border-b border-gray-100 last:border-0"
                                            >
                                                <span className="font-semibold">{pt.firstName} {pt.lastName}</span>
                                                <span className="text-gray-400 ml-2">#{pt.fileNumber}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Recall type */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Recall Type</label>
                                <select
                                    value={addForm.recallType}
                                    onChange={(e) => setAddForm((f) => ({ ...f, recallType: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-300"
                                >
                                    {RECALL_TYPES.map((t) => (
                                        <option key={t} value={t}>{t.replace("_", " ")}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Due date */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Due Date</label>
                                <input
                                    type="date"
                                    value={addForm.dueDate}
                                    onChange={(e) => setAddForm((f) => ({ ...f, dueDate: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-300"
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (optional)</label>
                                <input
                                    type="text"
                                    value={addForm.notes}
                                    onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                                    placeholder="e.g. 6-month cleaning due"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-300"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddRecall(false)}
                                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={!addForm.patientId || !addForm.dueDate}
                                onClick={() => createMutation.mutate({ ...addForm, dueDate: new Date(addForm.dueDate).toISOString() })}
                                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {createMutation.isPending ? "Saving..." : "Add Recall"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
