import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { format, addDays, startOfWeek, endOfWeek, isSameDay, parseISO } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────

interface Appointment {
    id: string;
    patientId: string;
    patientName: string;
    patientPhone?: string;
    doctorName?: string;
    appointmentDate: string;
    timeSlot: string;
    duration: number;
    type: string;
    status: string;
    notes?: string;
}

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
    const h = Math.floor(i / 2) + 8;
    const m = i % 2 === 0 ? "00" : "30";
    return `${h.toString().padStart(2, "0")}:${m}`;
}).filter((t) => t >= "08:00" && t <= "19:30");

const STATUS_COLORS: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700 border-blue-200",
    confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    cancelled: "bg-red-100 text-red-500 border-red-200 line-through opacity-60",
    completed: "bg-gray-100 text-gray-500 border-gray-200",
};

const VIEWS = ["day", "week"] as const;
type ViewMode = (typeof VIEWS)[number];

// ─── Main Component ─────────────────────────────────────────────────

export default function Appointments() {
    const queryClient = useQueryClient();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<ViewMode>("day");
    const [showDialog, setShowDialog] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

    // Search state for patient picker
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPatient, setSelectedPatient] = useState<any>(null);

    // Form state
    const [formDate, setFormDate] = useState("");
    const [formTime, setFormTime] = useState("09:00");
    const [formDuration, setFormDuration] = useState(30);
    const [formType, setFormType] = useState("consultation");
    const [formNotes, setFormNotes] = useState("");

    // Query dates
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const weekStart = format(startOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekEnd = format(endOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd");

    const { data: appointments = [], isLoading } = useQuery({
        queryKey: ["appointments", view, view === "day" ? dateStr : weekStart],
        queryFn: () =>
            view === "day"
                ? api.appointments.list(dateStr)
                : api.appointments.range(weekStart, weekEnd),
    });

    const { data: searchResults = [] } = useQuery({
        queryKey: ["patients", "search", { q: searchQuery }],
        queryFn: async () => {
            if (searchQuery.trim().length > 0) {
                return api.patients.search(searchQuery);
            }
            const res = await api.patients.list(1, 10);
            return res.patients;
        },
        enabled: showDialog,
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => api.appointments.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
            closeDialog();
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }: any) => api.appointments.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
            closeDialog();
        },
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            api.appointments.updateStatus(id, status),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.appointments.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
    });

    // ─── Helpers ─────────────────────────────────────────────────────

    function openCreate(date?: string, time?: string) {
        setEditingAppointment(null);
        setFormDate(date || dateStr);
        setFormTime(time || "09:00");
        setFormDuration(30);
        setFormType("consultation");
        setFormNotes("");
        setSelectedPatient(null);
        setSearchQuery("");
        setShowDialog(true);
    }

    function openEdit(appt: Appointment) {
        setEditingAppointment(appt);
        setFormDate(appt.appointmentDate);
        setFormTime(appt.timeSlot);
        setFormDuration(appt.duration);
        setFormType(appt.type);
        setFormNotes(appt.notes || "");
        setSelectedPatient({ id: appt.patientId, firstName: appt.patientName.split(" ")[0], lastName: appt.patientName.split(" ").slice(1).join(" ") });
        setSearchQuery("");
        setShowDialog(true);
    }

    function closeDialog() {
        setShowDialog(false);
        setEditingAppointment(null);
        setSelectedPatient(null);
        setSearchQuery("");
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedPatient) return;

        const data = {
            patientId: selectedPatient.id,
            appointmentDate: formDate,
            timeSlot: formTime,
            duration: formDuration,
            type: formType,
            notes: formNotes || undefined,
        };

        if (editingAppointment) {
            updateMutation.mutate({ id: editingAppointment.id, ...data });
        } else {
            createMutation.mutate(data);
        }
    }

    function navigateDate(delta: number) {
        setCurrentDate((d) => addDays(d, view === "week" ? delta * 7 : delta));
    }

    // ─── Week days ──────────────────────────────────────────────────

    const weekDays = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }, [currentDate]);

    // ─── Render ─────────────────────────────────────────────────────

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900">📅 Appointments</h1>
                <button
                    onClick={() => openCreate()}
                    className="px-5 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition shadow-sm"
                >
                    + New Appointment
                </button>
            </div>

            {/* ─── Controls ─── */}
            <div className="flex items-center gap-4 mb-6">
                <div className="flex bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    {VIEWS.map((v) => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-4 py-2 text-sm font-semibold capitalize transition ${view === v
                                ? "bg-primary-600 text-white"
                                : "text-gray-600 hover:bg-gray-50"
                                }`}
                        >
                            {v}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigateDate(-1)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition text-lg font-bold text-gray-600"
                    >
                        ‹
                    </button>
                    <button
                        onClick={() => setCurrentDate(new Date())}
                        className="px-3 py-1.5 text-sm font-semibold bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-primary-600"
                    >
                        Today
                    </button>
                    <button
                        onClick={() => navigateDate(1)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition text-lg font-bold text-gray-600"
                    >
                        ›
                    </button>
                </div>

                <h2 className="text-lg font-bold text-gray-700">
                    {view === "day"
                        ? format(currentDate, "EEEE, MMMM d, yyyy")
                        : `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d, yyyy")}`}
                </h2>
            </div>

            {/* ─── Calendar Grid ─── */}
            {isLoading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
                </div>
            ) : view === "day" ? (
                <DayView
                    date={dateStr}
                    appointments={appointments}
                    onSlotClick={(time: string) => openCreate(dateStr, time)}
                    onEdit={openEdit}
                    onStatusChange={(id: string, status: string) => statusMutation.mutate({ id, status })}
                    onDelete={(id: string) => deleteMutation.mutate(id)}
                />
            ) : (
                <WeekView
                    weekDays={weekDays}
                    appointments={appointments}
                    onSlotClick={(date: string, time: string) => openCreate(date, time)}
                    onEdit={openEdit}
                    onStatusChange={(id: string, status: string) => statusMutation.mutate({ id, status })}
                />
            )}

            {/* ─── Dialog ─── */}
            {showDialog && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={closeDialog}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-gray-900 mb-4">
                            {editingAppointment ? "Edit Appointment" : "New Appointment"}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Patient Picker */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Patient</label>
                                {selectedPatient ? (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg">
                                        <span className="font-semibold text-primary-700">
                                            {selectedPatient.firstName} {selectedPatient.lastName}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedPatient(null);
                                                setSearchQuery("");
                                            }}
                                            className="ml-auto text-primary-400 hover:text-primary-600"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search existing patient by name or phone..."
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                                            autoFocus
                                        />
                                        {searchResults.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                                                {searchResults.map((p: any) => {
                                                    const cleanFatherName = p.fatherName && p.fatherName !== "." && p.fatherName !== "—" ? `${p.fatherName} ` : "";
                                                    const cleanLastName = p.lastName && p.lastName !== "." && p.lastName !== "—" ? p.lastName : "";
                                                    return (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedPatient(p);
                                                                setSearchQuery("");
                                                            }}
                                                            className="w-full text-left px-3 py-2 hover:bg-primary-50 transition text-sm flex items-center justify-between"
                                                        >
                                                            <span className="font-semibold">
                                                                {p.firstName} {cleanFatherName}{cleanLastName}
                                                            </span>
                                                            <div className="text-right">
                                                                {p.phone && p.phone !== "0" && <span className="text-gray-500 font-mono text-xs">{p.phone}</span>}
                                                                {!p.phone || p.phone === "0" ? <span className="text-gray-300 italic text-xs">No phone</span> : null}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={formDate}
                                        onChange={(e) => setFormDate(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Time</label>
                                    <select
                                        value={formTime}
                                        onChange={(e) => setFormTime(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    >
                                        {TIME_SLOTS.map((t) => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Duration (min)</label>
                                    <select
                                        value={formDuration}
                                        onChange={(e) => setFormDuration(Number(e.target.value))}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    >
                                        {[15, 30, 45, 60, 90, 120].map((d) => (
                                            <option key={d} value={d}>{d} min</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
                                    <select
                                        value={formType}
                                        onChange={(e) => setFormType(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    >
                                        <option value="consultation">Consultation</option>
                                        <option value="follow-up">Follow-up</option>
                                        <option value="procedure">Procedure</option>
                                        <option value="emergency">Emergency</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
                                <textarea
                                    value={formNotes}
                                    onChange={(e) => setFormNotes(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                                    placeholder="Optional notes..."
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeDialog}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!selectedPatient || createMutation.isPending || updateMutation.isPending}
                                    className="flex-1 px-4 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                                >
                                    {editingAppointment ? "Update" : "Book"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Day View ───────────────────────────────────────────────────────

function DayView({
    date,
    appointments,
    onSlotClick,
    onEdit,
    onStatusChange,
    onDelete,
}: {
    date: string;
    appointments: Appointment[];
    onSlotClick: (time: string) => void;
    onEdit: (appt: Appointment) => void;
    onStatusChange: (id: string, status: string) => void;
    onDelete: (id: string) => void;
}) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {TIME_SLOTS.map((time) => {
                const slotAppts = appointments.filter((a) => a.timeSlot === time);
                return (
                    <div
                        key={time}
                        className="flex border-b border-gray-100 hover:bg-gray-50/50 transition cursor-pointer min-h-[52px]"
                        onClick={() => slotAppts.length === 0 && onSlotClick(time)}
                    >
                        <div className="w-20 flex-shrink-0 px-4 py-3 text-sm font-semibold text-gray-400 border-r border-gray-100 flex items-start">
                            {time}
                        </div>
                        <div className="flex-1 px-3 py-2 flex flex-wrap gap-2">
                            {slotAppts.map((appt) => (
                                <div
                                    key={appt.id}
                                    className={`rounded-lg px-3 py-1.5 border text-sm font-medium flex items-center gap-2 ${STATUS_COLORS[appt.status] || STATUS_COLORS.scheduled}`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <span className="font-bold">{appt.patientName}</span>
                                    <span className="text-xs opacity-70">{appt.type}</span>
                                    {appt.duration !== 30 && (
                                        <span className="text-xs opacity-50">{appt.duration}m</span>
                                    )}
                                    <div className="flex items-center gap-1 ml-2">
                                        {appt.status === "scheduled" && (
                                            <button
                                                onClick={() => onStatusChange(appt.id, "confirmed")}
                                                className="text-xs px-1.5 py-0.5 rounded bg-emerald-500 text-white hover:bg-emerald-600"
                                                title="Confirm"
                                            >
                                                ✓
                                            </button>
                                        )}
                                        {appt.status !== "cancelled" && appt.status !== "completed" && (
                                            <button
                                                onClick={() => onStatusChange(appt.id, "cancelled")}
                                                className="text-xs px-1.5 py-0.5 rounded bg-red-500 text-white hover:bg-red-600"
                                                title="Cancel"
                                            >
                                                ✕
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onEdit(appt)}
                                            className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                                            title="Edit"
                                        >
                                            ✎
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Week View ──────────────────────────────────────────────────────

function WeekView({
    weekDays,
    appointments,
    onSlotClick,
    onEdit,
    onStatusChange,
}: {
    weekDays: Date[];
    appointments: Appointment[];
    onSlotClick: (date: string, time: string) => void;
    onEdit: (appt: Appointment) => void;
    onStatusChange: (id: string, status: string) => void;
}) {
    const today = format(new Date(), "yyyy-MM-dd");

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-50">
                        <th className="w-20 p-3 text-xs text-gray-400 font-medium border-b border-r border-gray-200">
                            Time
                        </th>
                        {weekDays.map((day) => {
                            const d = format(day, "yyyy-MM-dd");
                            const isToday = d === today;
                            return (
                                <th
                                    key={d}
                                    className={`p-3 text-center border-b border-gray-200 ${isToday ? "bg-primary-50" : ""}`}
                                >
                                    <div className={`text-xs font-medium ${isToday ? "text-primary-600" : "text-gray-400"}`}>
                                        {format(day, "EEE")}
                                    </div>
                                    <div className={`text-lg font-bold ${isToday ? "text-primary-700" : "text-gray-700"}`}>
                                        {format(day, "d")}
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {TIME_SLOTS.filter((_, i) => i % 2 === 0).map((time) => (
                        <tr key={time} className="hover:bg-gray-50/30">
                            <td className="px-3 py-2 text-xs font-semibold text-gray-400 border-r border-b border-gray-100 text-center whitespace-nowrap">
                                {time}
                            </td>
                            {weekDays.map((day) => {
                                const d = format(day, "yyyy-MM-dd");
                                const isToday = d === today;
                                const dayAppts = appointments.filter(
                                    (a) => a.appointmentDate === d && (a.timeSlot === time || a.timeSlot === `${time.split(":")[0]}:30`)
                                );
                                return (
                                    <td
                                        key={d}
                                        className={`border-b border-gray-100 px-1 py-1 align-top cursor-pointer min-w-[120px] ${isToday ? "bg-primary-50/30" : ""}`}
                                        onClick={() => dayAppts.length === 0 && onSlotClick(d, time)}
                                    >
                                        {dayAppts.map((appt) => (
                                            <div
                                                key={appt.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEdit(appt);
                                                }}
                                                className={`rounded px-1.5 py-1 text-xs font-medium mb-1 border cursor-pointer truncate ${STATUS_COLORS[appt.status] || STATUS_COLORS.scheduled}`}
                                                title={`${appt.patientName} - ${appt.type} (${appt.timeSlot})`}
                                            >
                                                <div className="font-bold truncate">{appt.patientName}</div>
                                                <div className="opacity-60">{appt.timeSlot}</div>
                                            </div>
                                        ))}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
