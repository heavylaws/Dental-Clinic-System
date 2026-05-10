import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
    format,
    addDays,
    addMonths,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    isSameMonth,
} from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────

interface Appointment {
    id: string;
    patientId: string;
    patientName: string;
    patientPhone?: string;
    doctorId?: string;
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
}).filter((t) => t >= "08:00" && t <= "17:30");

function isSundayDate(dateStr: string): boolean {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).getDay() === 0;
}

// ─── Status & type metadata ─────────────────────────────────────────

const STATUS_META: Record<string, { label: string; chip: string; dot: string; badge: string }> = {
    scheduled: {
        label: "Scheduled",
        chip: "bg-blue-50 text-blue-700 border-blue-200",
        dot: "bg-blue-500",
        badge: "bg-blue-100 text-blue-700",
    },
    confirmed: {
        label: "Confirmed",
        chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
        badge: "bg-emerald-100 text-emerald-700",
    },
    completed: {
        label: "Completed",
        chip: "bg-gray-50 text-gray-500 border-gray-200",
        dot: "bg-gray-400",
        badge: "bg-gray-100 text-gray-500",
    },
    cancelled: {
        label: "Cancelled",
        chip: "bg-rose-50 text-rose-500 border-rose-200 line-through opacity-70",
        dot: "bg-rose-400",
        badge: "bg-rose-100 text-rose-500",
    },
    no_show: {
        label: "No-show",
        chip: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
        badge: "bg-amber-100 text-amber-700",
    },
};
function statusKey(s: string): keyof typeof STATUS_META {
    const k = String(s || "").toLowerCase().replace("-", "_");
    return (k in STATUS_META ? k : "scheduled") as keyof typeof STATUS_META;
}
function statusMeta(s: string) {
    return STATUS_META[statusKey(s)];
}

const TYPE_META: Record<string, { label: string; tint: string }> = {
    consultation: { label: "Consultation", tint: "bg-sky-50 text-sky-700" },
    "follow-up": { label: "Follow-up", tint: "bg-violet-50 text-violet-700" },
    procedure: { label: "Procedure", tint: "bg-teal-50 text-teal-700" },
    emergency: { label: "Emergency", tint: "bg-rose-50 text-rose-700" },
};
function typeMeta(t: string) {
    const key = String(t || "").toLowerCase();
    return TYPE_META[key] || { label: t || "—", tint: "bg-gray-100 text-gray-600" };
}

const DOCTOR_ACCENT: Record<string, string> = {
    "2": "border-l-4 border-l-blue-500",
    "4": "border-l-4 border-l-purple-500",
};
function doctorAccent(id?: string) {
    return (id && DOCTOR_ACCENT[id]) || "border-l-4 border-l-gray-300";
}

const VIEWS = ["day", "week", "month"] as const;
type ViewMode = (typeof VIEWS)[number];

// ─── Main Component ─────────────────────────────────────────────────

export default function Appointments() {
    const queryClient = useQueryClient();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<ViewMode>("day");
    const [showDialog, setShowDialog] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
    const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

    // Filters (client-side; do not mutate server data)
    const [doctorFilter, setDoctorFilter] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [typeFilter, setTypeFilter] = useState<string>("");

    // Search state for patient picker
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPatient, setSelectedPatient] = useState<any>(null);

    // Form state
    const [formDate, setFormDate] = useState("");
    const [formTime, setFormTime] = useState("09:00");
    const [formDuration, setFormDuration] = useState(30);
    const [formType, setFormType] = useState("consultation");
    const [formNotes, setFormNotes] = useState("");
    const [formDoctorId, setFormDoctorId] = useState<string>("2");

    // Range derivation per view
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const weekStart = format(startOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekEnd = format(endOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const monthGridStart = format(startOfWeek(monthStart, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const monthGridEnd = format(endOfWeek(monthEnd, { weekStartsOn: 1 }), "yyyy-MM-dd");

    const [rangeFrom, rangeTo] =
        view === "day" ? [dateStr, dateStr]
            : view === "week" ? [weekStart, weekEnd]
                : [monthGridStart, monthGridEnd];

    const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
        queryKey: ["appointments", rangeFrom, rangeTo],
        queryFn: () => api.appointments.range(rangeFrom, rangeTo),
    });

    const { data: doctorList = [] } = useQuery({
        queryKey: ["appointment-doctors"],
        queryFn: () => api.appointments.doctors(),
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

    // Friendly error display in the appointment dialog
    const [formError, setFormError] = useState<{
        kind: "doctor_conflict" | "patient_conflict" | "working-hours" | "generic";
        message: string;
        conflictType?: string;
        conflict?: {
            patientName?: string | null;
            doctorName?: string | null;
            appointmentDate?: string;
            timeSlot?: string;
            duration?: number;
        };
    } | null>(null);

    function handleMutationError(e: any) {
        const body = e?.body;
        const message: string = e?.message || "Failed to save appointment.";
        if (e?.status === 409 && body?.conflict) {
            const conflictType = body.type || "doctor_conflict";
            const kind = (conflictType === "patient_conflict" ? "patient_conflict" : "doctor_conflict") as "doctor_conflict" | "patient_conflict";
            setFormError({ kind, message, conflictType, conflict: body.conflict });
        } else if (e?.status === 400 && /working hours/i.test(message)) {
            setFormError({ kind: "working-hours", message });
        } else {
            setFormError({ kind: "generic", message });
        }
    }

    const createMutation = useMutation({
        mutationFn: (data: any) => api.appointments.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
            closeDialog();
        },
        onError: handleMutationError,
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }: any) => api.appointments.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
            closeDialog();
        },
        onError: handleMutationError,
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            api.appointments.updateStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
            setSelectedAppt(null);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.appointments.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
            setSelectedAppt(null);
        },
        onError: (e: any) => {
            alert(e?.message || "Failed to delete appointment.");
        },
    });

    // ─── Helpers ─────────────────────────────────────────────────────

    function openCreate(date?: string, time?: string) {
        setEditingAppointment(null);
        setFormDate(date || dateStr);
        setFormTime(time || "09:00");
        setFormDuration(30);
        setFormType("consultation");
        setFormNotes("");
        setFormDoctorId(doctorFilter || doctorList[0]?.id || "2");
        setSelectedPatient(null);
        setSearchQuery("");
        setFormError(null);
        setShowDialog(true);
    }

    function openEdit(appt: Appointment) {
        setEditingAppointment(appt);
        setFormDate(appt.appointmentDate);
        setFormTime(appt.timeSlot);
        setFormDuration(appt.duration);
        setFormType(appt.type);
        setFormNotes(appt.notes || "");
        setFormDoctorId(appt.doctorId || doctorFilter || doctorList[0]?.id || "2");
        setSelectedPatient({
            id: appt.patientId,
            firstName: (appt.patientName || "").split(" ")[0],
            lastName: (appt.patientName || "").split(" ").slice(1).join(" "),
        });
        setSearchQuery("");
        setFormError(null);
        setSelectedAppt(null);
        setShowDialog(true);
    }

    function closeDialog() {
        setShowDialog(false);
        setEditingAppointment(null);
        setSelectedPatient(null);
        setSearchQuery("");
        setFormError(null);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedPatient) return;
        setFormError(null);

        const data = {
            patientId: selectedPatient.id,
            appointmentDate: formDate,
            timeSlot: formTime,
            duration: formDuration,
            type: formType,
            notes: formNotes || undefined,
            doctorId: formDoctorId,
        };

        if (editingAppointment) {
            updateMutation.mutate({ id: editingAppointment.id, ...data });
        } else {
            createMutation.mutate(data);
        }
    }

    function navigateDate(delta: number) {
        setCurrentDate((d) => {
            if (view === "month") return addMonths(d, delta);
            if (view === "week") return addDays(d, delta * 7);
            return addDays(d, delta);
        });
    }

    function handleCancelAppt(appt: Appointment) {
        if (!window.confirm(`Cancel appointment for ${appt.patientName}?`)) return;
        statusMutation.mutate({ id: appt.id, status: "cancelled" });
    }
    function handleDeleteAppt(appt: Appointment) {
        if (!window.confirm(`Delete this appointment permanently? This cannot be undone.`)) return;
        deleteMutation.mutate(appt.id);
    }
    function handleConfirmAppt(appt: Appointment) {
        statusMutation.mutate({ id: appt.id, status: "confirmed" });
    }
    function handleCompleteAppt(appt: Appointment) {
        statusMutation.mutate({ id: appt.id, status: "completed" });
    }

    const waMutation = useMutation({
        mutationFn: (appt: Appointment) =>
            api.whatsapp.sendAppointmentReminder({
                patientName: appt.patientName,
                phone: appt.patientPhone!,
                doctorName: appt.doctorName,
                date: appt.appointmentDate,
                time: appt.timeSlot,
            }),
        onSuccess: () => alert("WhatsApp reminder sent!"),
        onError: (e: any) => alert("Failed to send WhatsApp: " + (e.message || "Not connected")),
    });

    function sendWaReminder(appt: Appointment) {
        if (!appt.patientPhone) {
            alert("No phone number on file");
            return;
        }
        waMutation.mutate(appt);
    }

    // ─── Filter options ─────────────────────────────────────────────

    const typeOptions = useMemo(() => {
        const set = new Set<string>();
        for (const a of appointments) if (a.type) set.add(a.type);
        return Array.from(set).sort();
    }, [appointments]);

    const filteredAppointments = useMemo(() => {
        return appointments.filter((a) => {
            if (doctorFilter && a.doctorId !== doctorFilter) return false;
            if (statusFilter && statusKey(a.status) !== statusFilter) return false;
            if (typeFilter && a.type !== typeFilter) return false;
            return true;
        });
    }, [appointments, doctorFilter, statusFilter, typeFilter]);

    const anyFilterActive = !!(doctorFilter || statusFilter || typeFilter);
    function clearFilters() {
        setDoctorFilter("");
        setStatusFilter("");
        setTypeFilter("");
    }

    // ─── Week days ──────────────────────────────────────────────────

    const weekDays = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }, [currentDate]);

    // ─── Render ─────────────────────────────────────────────────────

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            {/* ─── Header ─── */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900">📅 Appointments</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Day, week & month scheduling — color-coded by status, drag-free for now.
                    </p>
                </div>
                <button
                    onClick={() => openCreate()}
                    className="px-5 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition shadow-sm"
                >
                    + New Appointment
                </button>
            </div>

            {/* ─── Toolbar ─── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex flex-wrap items-center gap-3">
                {/* View switcher */}
                <div className="flex bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    {VIEWS.map((v) => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-4 py-2 text-sm font-semibold capitalize transition ${view === v
                                ? "bg-primary-600 text-white shadow-inner"
                                : "text-gray-600 hover:bg-white"
                                }`}
                        >
                            {v}
                        </button>
                    ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => navigateDate(-1)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition text-lg font-bold text-gray-600"
                        title="Previous"
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
                        title="Next"
                    >
                        ›
                    </button>
                </div>

                {/* Date picker */}
                <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => {
                        if (e.target.value) {
                            const [y, m, d] = e.target.value.split("-").map(Number);
                            setCurrentDate(new Date(y, m - 1, d));
                        }
                    }}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-primary-300 outline-none bg-white"
                />

                <h2 className="text-lg font-bold text-gray-700 ml-2">
                    {view === "day"
                        ? format(currentDate, "EEEE, MMMM d, yyyy")
                        : view === "week"
                            ? `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d, yyyy")}`
                            : format(currentDate, "MMMM yyyy")}
                </h2>

                {/* Filters (right side) */}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <select
                        value={doctorFilter}
                        onChange={(e) => setDoctorFilter(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                        title="Filter by doctor"
                    >
                        <option value="">All doctors</option>
                        {doctorList.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                        title="Filter by status"
                    >
                        <option value="">All statuses</option>
                        {(Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>).map((s) => (
                            <option key={s} value={s}>{STATUS_META[s].label}</option>
                        ))}
                    </select>

                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                        title="Filter by type"
                    >
                        <option value="">All types</option>
                        {typeOptions.map((t) => (
                            <option key={t} value={t}>{typeMeta(t).label}</option>
                        ))}
                    </select>

                    {anyFilterActive && (
                        <button
                            onClick={clearFilters}
                            className="px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Legend ─── */}
            <Legend />

            {/* ─── View ─── */}
            {isLoading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
                </div>
            ) : view === "day" ? (
                <DayView
                    date={dateStr}
                    appointments={filteredAppointments}
                    onSlotClick={(time: string) => openCreate(dateStr, time)}
                    onApptClick={setSelectedAppt}
                    onCreateAny={() => openCreate()}
                    anyFilterActive={anyFilterActive}
                />
            ) : view === "week" ? (
                <WeekView
                    weekDays={weekDays}
                    appointments={filteredAppointments}
                    onSlotClick={(date: string, time: string) => openCreate(date, time)}
                    onApptClick={setSelectedAppt}
                    onCreateAny={() => openCreate()}
                    anyFilterActive={anyFilterActive}
                />
            ) : (
                <MonthView
                    currentDate={currentDate}
                    monthGridStart={monthGridStart}
                    monthGridEnd={monthGridEnd}
                    appointments={filteredAppointments}
                    onDayClick={(d: string) => {
                        const [y, m, dd] = d.split("-").map(Number);
                        setCurrentDate(new Date(y, m - 1, dd));
                        setView("day");
                    }}
                    onApptClick={setSelectedAppt}
                    onCreateAny={() => openCreate()}
                    anyFilterActive={anyFilterActive}
                />
            )}

            {/* ─── Details panel (modal) ─── */}
            {selectedAppt && (
                <DetailsPanel
                    appt={selectedAppt}
                    onClose={() => setSelectedAppt(null)}
                    onEdit={openEdit}
                    onConfirm={handleConfirmAppt}
                    onComplete={handleCompleteAppt}
                    onCancel={handleCancelAppt}
                    onDelete={handleDeleteAppt}
                    onWhatsApp={sendWaReminder}
                    pending={statusMutation.isPending || deleteMutation.isPending}
                />
            )}

            {/* ─── Create/Edit Dialog ─── */}
            {showDialog && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeDialog}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                            {editingAppointment ? "Edit Appointment" : "New Appointment"}
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">
                            Tip: click empty slots in day/week views to create at a specific time.
                        </p>

                        {/* Error banner */}
                        {formError && (
                            <div
                                role="alert"
                                className={`mb-4 rounded-xl border px-4 py-3 text-sm ${formError.kind === "doctor_conflict" || formError.kind === "patient_conflict"
                                    ? "bg-rose-50 border-rose-200 text-rose-800"
                                    : formError.kind === "working-hours"
                                        ? "bg-amber-50 border-amber-200 text-amber-800"
                                        : "bg-gray-50 border-gray-200 text-gray-700"
                                    }`}
                            >
                                <p className="font-semibold mb-0.5">
                                    {formError.kind === "doctor_conflict" && "⚠ Time conflict"}
                                    {formError.kind === "patient_conflict" && "⚠ Patient already has appointment"}
                                    {formError.kind === "working-hours" && "⚠ Outside working hours"}
                                    {formError.kind === "generic" && "Could not save appointment"}
                                </p>
                                <p>{formError.message}</p>
                                {(formError.kind === "doctor_conflict" || formError.kind === "patient_conflict") && formError.conflict && (
                                    <p className="mt-1 text-xs opacity-90">
                                        {formError.kind === "patient_conflict"
                                            ? "This patient already has another appointment at this time: "
                                            : "Conflicts with "}
                                        <span className="font-semibold">
                                            {formError.conflict.patientName || "another appointment"}
                                        </span>{" "}
                                        — {formError.conflict.doctorName || "same doctor"} on{" "}
                                        {formError.conflict.appointmentDate} at {formError.conflict.timeSlot}
                                        {formError.conflict.duration ? ` (${formError.conflict.duration}m)` : ""}.
                                        Pick a different time, doctor, or duration.
                                    </p>
                                )}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Patient picker */}
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
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Doctor</label>
                                <select
                                    value={formDoctorId}
                                    onChange={(e) => setFormDoctorId(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    required
                                >
                                    {doctorList.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
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

// ─── Legend ─────────────────────────────────────────────────────────

function Legend() {
    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 px-4 py-2.5 bg-white rounded-xl border border-gray-100 shadow-sm text-xs">
            <span className="font-semibold text-gray-500 mr-1">Status:</span>
            {(Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5 text-gray-600">
                    <span className={`w-2.5 h-2.5 rounded-full ${STATUS_META[s].dot}`} />
                    {STATUS_META[s].label}
                </span>
            ))}
            <span className="hidden sm:inline mx-2 h-4 w-px bg-gray-200" />
            <span className="font-semibold text-gray-500 mr-1">Doctor:</span>
            <span className="inline-flex items-center gap-1.5 text-gray-600">
                <span className="w-1 h-3.5 rounded bg-blue-500" /> Dr. Mohammed
            </span>
            <span className="inline-flex items-center gap-1.5 text-gray-600">
                <span className="w-1 h-3.5 rounded bg-purple-500" /> Dr. Layla
            </span>
        </div>
    );
}

// ─── Empty State ────────────────────────────────────────────────────

function EmptyState({
    title,
    body,
    onCreate,
    showFilters,
}: {
    title: string;
    body?: string;
    onCreate: () => void;
    showFilters?: boolean;
}) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="text-5xl mb-3">📅</div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">{title}</h3>
            {body && <p className="text-sm text-gray-500 mb-4">{body}</p>}
            {showFilters && (
                <p className="text-xs text-gray-400 mb-3">
                    Some appointments may be hidden by your active filters.
                </p>
            )}
            <button
                onClick={onCreate}
                className="px-5 py-2 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition shadow-sm"
            >
                + Create appointment
            </button>
        </div>
    );
}

// ─── Appointment Card (used in day/week) ────────────────────────────

function AppointmentCard({
    appt,
    onClick,
    compact = false,
}: {
    appt: Appointment;
    onClick: () => void;
    compact?: boolean;
}) {
    const sm = statusMeta(appt.status);
    const tm = typeMeta(appt.type);
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className={`group w-full text-left rounded-lg border ${sm.chip} ${doctorAccent(appt.doctorId)} px-2.5 py-1.5 text-sm hover:shadow-md hover:-translate-y-0.5 transition`}
            title={`${appt.patientName} • ${appt.timeSlot} • ${tm.label} • ${sm.label}`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="font-bold truncate">{appt.patientName || "—"}</span>
                {!compact && (
                    <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${sm.badge}`}>
                        {sm.label}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2 text-[11px] mt-0.5 opacity-80">
                <span className="font-mono">{appt.timeSlot}</span>
                {appt.duration ? <span className="opacity-75">{appt.duration}m</span> : null}
                {!compact && <span className={`px-1.5 py-0.5 rounded ${tm.tint}`}>{tm.label}</span>}
            </div>
            {!compact && appt.doctorName && (
                <div className="text-[11px] mt-0.5 opacity-70 italic truncate">{appt.doctorName}</div>
            )}
        </button>
    );
}

// ─── Day View ───────────────────────────────────────────────────────

function DayView({
    date,
    appointments,
    onSlotClick,
    onApptClick,
    onCreateAny,
    anyFilterActive,
}: {
    date: string;
    appointments: Appointment[];
    onSlotClick: (time: string) => void;
    onApptClick: (appt: Appointment) => void;
    onCreateAny: () => void;
    anyFilterActive: boolean;
}) {
    const dayAppts = appointments.filter((a) => a.appointmentDate === date);
    const isSunday = isSundayDate(date);

    if (!isSunday && dayAppts.length === 0 && !anyFilterActive) {
        return (
            <EmptyState
                title="No appointments scheduled"
                body="Click any time slot below to add a new appointment, or use the button to start fresh."
                onCreate={onCreateAny}
            />
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {isSunday && (
                <div className="px-4 py-3 text-sm text-gray-600 bg-gray-50 border-b border-gray-200 font-semibold">
                    Sunday is closed. New appointments cannot be created for this day.
                </div>
            )}
            {anyFilterActive && dayAppts.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500 bg-amber-50 border-b border-amber-100">
                    No appointments match your filters for this day.
                </div>
            )}
            {TIME_SLOTS.map((time) => {
                const slotAppts = dayAppts.filter((a) => a.timeSlot === time);
                return (
                    <div
                        key={time}
                        className={`flex border-b border-gray-100 last:border-b-0 transition min-h-[56px] ${isSunday ? "bg-gray-50/60 cursor-not-allowed" : "hover:bg-gray-50/50 cursor-pointer"}`}
                        onClick={() => !isSunday && slotAppts.length === 0 && onSlotClick(time)}
                    >
                        <div className="w-20 sm:w-24 flex-shrink-0 px-3 py-2 text-sm font-semibold text-gray-400 border-r border-gray-100 flex items-center justify-between gap-1">
                            <span className="font-mono">{time}</span>
                            <button
                                type="button"
                                disabled={isSunday}
                                className={`w-5 h-5 rounded text-xs font-bold ${isSunday ? "bg-gray-100 text-gray-300 cursor-not-allowed" : "bg-primary-50 text-primary-600 hover:bg-primary-100 opacity-60 hover:opacity-100"}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isSunday) return;
                                    onSlotClick(time);
                                }}
                                title="Add appointment at this time"
                            >
                                +
                            </button>
                        </div>
                        <div className="flex-1 px-2 py-1.5 flex flex-wrap gap-2">
                            {slotAppts.length === 0 ? (
                                <span className="text-xs text-gray-300 self-center">{isSunday ? "clinic closed" : "click to book"}</span>
                            ) : (
                                slotAppts.map((appt) => (
                                    <div key={appt.id} className="min-w-[180px] max-w-[260px]">
                                        <AppointmentCard appt={appt} onClick={() => onApptClick(appt)} />
                                    </div>
                                ))
                            )}
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
    onApptClick,
    onCreateAny,
    anyFilterActive,
}: {
    weekDays: Date[];
    appointments: Appointment[];
    onSlotClick: (date: string, time: string) => void;
    onApptClick: (appt: Appointment) => void;
    onCreateAny: () => void;
    anyFilterActive: boolean;
}) {
    const today = format(new Date(), "yyyy-MM-dd");
    const HOUR_SLOTS = TIME_SLOTS.filter((_, i) => i % 2 === 0);

    if (appointments.length === 0 && !anyFilterActive) {
        return (
            <EmptyState
                title="No appointments this week"
                body="Click any cell below to add a new appointment, or jump straight to creation."
                onCreate={onCreateAny}
            />
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {anyFilterActive && appointments.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500 bg-amber-50 border-b border-amber-100">
                    No appointments match your filters this week.
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[760px]">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="w-20 p-3 text-xs text-gray-400 font-medium border-b border-r border-gray-200 sticky left-0 bg-gray-50 z-10">
                                Time
                            </th>
                            {weekDays.map((day) => {
                                const d = format(day, "yyyy-MM-dd");
                                const isToday = d === today;
                                const isSunday = day.getDay() === 0;
                                return (
                                    <th
                                        key={d}
                                        className={`p-2 text-center border-b border-gray-200 ${isToday ? "bg-primary-50" : ""} ${isSunday ? "bg-gray-100/60" : ""}`}
                                    >
                                        <div className={`text-[11px] font-semibold ${isToday ? "text-primary-600" : "text-gray-400"}`}>
                                            {format(day, "EEE")}
                                        </div>
                                        <div className={`text-base font-bold ${isToday ? "text-primary-700" : "text-gray-700"}`}>
                                            {format(day, "d")}
                                        </div>
                                        {isSunday && (
                                            <div className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">closed</div>
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {HOUR_SLOTS.map((time) => (
                            <tr key={time} className="hover:bg-gray-50/30">
                                <td className="px-2 py-1.5 text-[11px] font-mono font-semibold text-gray-400 border-r border-b border-gray-100 text-center whitespace-nowrap sticky left-0 bg-white z-10">
                                    {time}
                                </td>
                                {weekDays.map((day) => {
                                    const d = format(day, "yyyy-MM-dd");
                                    const isToday = d === today;
                                    const isSunday = day.getDay() === 0;
                                    const dayAppts = appointments.filter(
                                        (a) =>
                                            a.appointmentDate === d &&
                                            (a.timeSlot === time || a.timeSlot === `${time.split(":")[0]}:30`)
                                    );
                                    return (
                                        <td
                                            key={d}
                                            className={`border-b border-gray-100 px-1 py-1 align-top min-w-[110px] ${isToday ? "bg-primary-50/30" : ""} ${isSunday ? "bg-gray-100/70 cursor-not-allowed" : "cursor-pointer"}`}
                                            onClick={() => !isSunday && dayAppts.length === 0 && onSlotClick(d, time)}
                                        >
                                            {dayAppts.map((appt) => (
                                                <div key={appt.id} className="mb-1 last:mb-0">
                                                    <AppointmentCard appt={appt} onClick={() => onApptClick(appt)} compact />
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
        </div>
    );
}

// ─── Month View ─────────────────────────────────────────────────────

function MonthView({
    currentDate,
    monthGridStart,
    monthGridEnd,
    appointments,
    onDayClick,
    onApptClick,
    onCreateAny,
    anyFilterActive,
}: {
    currentDate: Date;
    monthGridStart: string;
    monthGridEnd: string;
    appointments: Appointment[];
    onDayClick: (d: string) => void;
    onApptClick: (appt: Appointment) => void;
    onCreateAny: () => void;
    anyFilterActive: boolean;
}) {
    const today = format(new Date(), "yyyy-MM-dd");

    // Build the grid of date cells (Mon-Sun)
    const days: Date[] = [];
    {
        const [sy, sm, sd] = monthGridStart.split("-").map(Number);
        const [ey, em, ed] = monthGridEnd.split("-").map(Number);
        let cur = new Date(sy, sm - 1, sd);
        const end = new Date(ey, em - 1, ed);
        while (cur <= end) {
            days.push(new Date(cur));
            cur = addDays(cur, 1);
        }
    }

    if (appointments.length === 0 && !anyFilterActive) {
        return (
            <EmptyState
                title={`No appointments in ${format(currentDate, "MMMM yyyy")}`}
                body="Pick a day in the month grid to start scheduling."
                onCreate={onCreateAny}
            />
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {anyFilterActive && appointments.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500 bg-amber-50 border-b border-amber-100">
                    No appointments match your filters this month.
                </div>
            )}
            {/* Weekday header */}
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => (
                    <div
                        key={label}
                        className={`p-2.5 text-center text-[11px] font-bold uppercase tracking-wide ${i === 6 ? "text-gray-400" : "text-gray-500"}`}
                    >
                        {label}
                    </div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
                {days.map((day) => {
                    const d = format(day, "yyyy-MM-dd");
                    const isToday = d === today;
                    const isSunday = day.getDay() === 0;
                    const inMonth = isSameMonth(day, currentDate);
                    const dayAppts = appointments.filter((a) => a.appointmentDate === d);
                    const visibleAppts = dayAppts.slice(0, 3);
                    const moreCount = dayAppts.length - visibleAppts.length;

                    return (
                        <div
                            key={d}
                            onClick={() => onDayClick(d)}
                            className={`min-h-[110px] border-b border-r border-gray-100 last:border-r-0 p-1.5 cursor-pointer transition flex flex-col gap-1 ${inMonth ? "bg-white" : "bg-gray-50/40"} ${isToday ? "ring-2 ring-inset ring-primary-300" : ""} ${isSunday ? "bg-gray-50" : ""} hover:bg-primary-50/30`}
                            title={`${dayAppts.length} appointment${dayAppts.length === 1 ? "" : "s"} — click to view day`}
                        >
                            <div className="flex items-center justify-between">
                                <span
                                    className={`text-sm font-bold ${isToday
                                        ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white"
                                        : inMonth
                                            ? "text-gray-700"
                                            : "text-gray-300"
                                        }`}
                                >
                                    {format(day, "d")}
                                </span>
                                {isSunday ? (
                                    <span className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">closed</span>
                                ) : dayAppts.length > 0 ? (
                                    <span className="text-[10px] font-semibold text-gray-400">
                                        {dayAppts.length}
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex flex-col gap-0.5 overflow-hidden">
                                {visibleAppts.map((appt) => {
                                    const sm = statusMeta(appt.status);
                                    return (
                                        <button
                                            key={appt.id}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onApptClick(appt);
                                            }}
                                            className={`text-left text-[11px] truncate rounded px-1.5 py-0.5 border ${sm.chip} ${doctorAccent(appt.doctorId)} hover:brightness-95`}
                                            title={`${appt.timeSlot} ${appt.patientName} (${sm.label})`}
                                        >
                                            <span className="font-mono opacity-70 mr-1">{appt.timeSlot}</span>
                                            <span className="font-semibold">{appt.patientName || "—"}</span>
                                        </button>
                                    );
                                })}
                                {moreCount > 0 && (
                                    <span className="text-[10px] text-primary-600 font-semibold pl-1">
                                        +{moreCount} more
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Details Panel (modal) ──────────────────────────────────────────

function DetailsPanel({
    appt,
    onClose,
    onEdit,
    onConfirm,
    onComplete,
    onCancel,
    onDelete,
    onWhatsApp,
    pending,
}: {
    appt: Appointment;
    onClose: () => void;
    onEdit: (appt: Appointment) => void;
    onConfirm: (appt: Appointment) => void;
    onComplete: (appt: Appointment) => void;
    onCancel: (appt: Appointment) => void;
    onDelete: (appt: Appointment) => void;
    onWhatsApp: (appt: Appointment) => void;
    pending: boolean;
}) {
    const sm = statusMeta(appt.status);
    const tm = typeMeta(appt.type);
    const sk = statusKey(appt.status);
    const isClosed = sk === "cancelled" || sk === "completed";

    return (
        <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                        <h3 className="text-xl font-extrabold text-gray-900 leading-tight">
                            {appt.patientName || "—"}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5 font-mono">
                            {appt.appointmentDate} • {appt.timeSlot}
                            {appt.duration ? ` • ${appt.duration}m` : ""}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                        title="Close"
                    >
                        ×
                    </button>
                </div>

                {/* Status + type */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${sm.badge}`}>
                        <span className={`w-2 h-2 rounded-full ${sm.dot}`} />
                        {sm.label}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${tm.tint}`}>
                        {tm.label}
                    </span>
                </div>

                {/* Detail rows */}
                <div className="space-y-2 text-sm bg-gray-50 rounded-xl p-3 mb-4">
                    <Row label="Doctor" value={appt.doctorName || "—"} />
                    <Row label="Phone" value={appt.patientPhone || "—"} mono />
                    {appt.notes && <Row label="Notes" value={appt.notes} />}
                </div>

                {/* Quick status actions */}
                {!isClosed && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {sk === "scheduled" && (
                            <button
                                onClick={() => onConfirm(appt)}
                                disabled={pending}
                                className="flex-1 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                            >
                                ✓ Confirm
                            </button>
                        )}
                        {(sk === "scheduled" || sk === "confirmed") && (
                            <button
                                onClick={() => onComplete(appt)}
                                disabled={pending}
                                className="flex-1 px-3 py-2 bg-gray-700 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                            >
                                ✓ Complete
                            </button>
                        )}
                        <button
                            onClick={() => onCancel(appt)}
                            disabled={pending}
                            className="flex-1 px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 text-sm font-semibold rounded-lg hover:bg-rose-100 transition disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {/* Tools */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => onEdit(appt)}
                        className="flex-1 px-3 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg hover:bg-primary-700 transition"
                    >
                        ✎ Edit
                    </button>
                    {appt.patientPhone && (
                        <button
                            onClick={() => onWhatsApp(appt)}
                            className="px-3 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 transition"
                            title="Send WhatsApp reminder"
                        >
                            📱 WhatsApp
                        </button>
                    )}
                    <button
                        onClick={() => onDelete(appt)}
                        disabled={pending}
                        className="px-3 py-2 bg-white border border-rose-200 text-rose-600 text-sm font-semibold rounded-lg hover:bg-rose-50 transition disabled:opacity-50"
                        title="Delete permanently"
                    >
                        🗑 Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-baseline gap-3">
            <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {label}
            </span>
            <span className={`text-gray-700 break-words ${mono ? "font-mono" : ""}`}>{value}</span>
        </div>
    );
}
