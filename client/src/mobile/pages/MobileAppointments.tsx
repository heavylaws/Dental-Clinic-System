import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { format, addDays, isSunday } from "date-fns";
import MobileHeader from "../components/MobileHeader";
import MobileDialog from "../components/MobileDialog";
import FloatingActionButton from "../components/FloatingActionButton";
import MobileSearchBar from "../components/MobileSearchBar";

// ─── Helpers ────────────────────────────────────────────────────────

function friendlyError(err: unknown): string {
  const e = err as any;
  const msg: string = e?.body?.message || e?.body?.error || e?.message || "Something went wrong.";
  if (e?.body?.type === "doctor_conflict" || msg.toLowerCase().includes("doctor") && msg.toLowerCase().includes("conflict")) {
    return "Doctor already has an appointment at this time.";
  }
  if (e?.body?.type === "patient_conflict" || msg.toLowerCase().includes("patient") && msg.toLowerCase().includes("overlap")) {
    return "Patient already has another appointment at this time.";
  }
  if (msg.toLowerCase().includes("working hours") || msg.toLowerCase().includes("outside clinic")) {
    return "Appointment is outside clinic working hours.";
  }
  if (msg.toLowerCase().includes("closed that day") || msg.toLowerCase().includes("sunday")) {
    return "The clinic is closed on Sunday.";
  }
  return msg;
}

function formatPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function whatsappUrl(phone: string, patientName: string, date: string, time: string): string {
  const cleaned = formatPhone(phone);
  const text = encodeURIComponent(
    `Hello ${patientName}, this is a reminder for your appointment on ${date} at ${time}.`
  );
  return `https://wa.me/${cleaned}?text=${text}`;
}

// ─── Status colours ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  scheduled: { bg: "rgba(59,138,244,0.12)", color: "#60a5fa", border: "rgba(59,138,244,0.2)", label: "Scheduled" },
  confirmed:  { bg: "rgba(16,185,129,0.12)", color: "#34d399", border: "rgba(16,185,129,0.2)", label: "Confirmed"  },
  completed:  { bg: "rgba(148,163,184,0.1)", color: "#94a3b8", border: "rgba(148,163,184,0.15)", label: "Completed" },
  cancelled:  { bg: "rgba(244,63,94,0.12)",  color: "#fb7185", border: "rgba(244,63,94,0.2)",  label: "Cancelled"  },
  no_show:    { bg: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "rgba(251,191,36,0.2)", label: "No-show"   },
};

const ALL_STATUSES = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];

// ─── Error banner ────────────────────────────────────────────────────

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div style={{
      margin: "0 16px 10px", padding: "12px 14px", borderRadius: "14px",
      background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.25)",
      display: "flex", alignItems: "flex-start", gap: "10px",
    }}>
      <span style={{ fontSize: "16px", flexShrink: 0 }}>⚠️</span>
      <span style={{ flex: 1, fontSize: "0.85rem", color: "#fb7185", fontWeight: 600, lineHeight: 1.4 }}>{message}</span>
      <button onClick={onDismiss} style={{
        background: "transparent", border: "none", color: "#fb7185",
        fontSize: "16px", cursor: "pointer", flexShrink: 0, padding: 0,
      }}>✕</button>
    </div>
  );
}

// ─── Cancel confirm dialog ───────────────────────────────────────────

function CancelConfirmDialog({ appt, onConfirm, onClose }: {
  appt: any; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "4px" }}>
      <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.5, margin: 0 }}>
        Cancel the appointment for <strong style={{ color: "#f1f5f9" }}>{appt.patientName}</strong> on{" "}
        <strong style={{ color: "#f1f5f9" }}>{appt.appointmentDate}</strong> at{" "}
        <strong style={{ color: "#f1f5f9" }}>{appt.timeSlot}</strong>?
      </p>
      <p style={{ color: "#64748b", fontSize: "0.8rem", margin: 0 }}>
        This action cannot be undone. The appointment will be marked as cancelled.
      </p>
      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={onClose} className="touch-button" style={{
          flex: 1, padding: "13px", borderRadius: "14px", fontWeight: 700,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          color: "#94a3b8", cursor: "pointer",
        }}>Keep</button>
        <button onClick={onConfirm} className="touch-button" style={{
          flex: 1, padding: "13px", borderRadius: "14px", fontWeight: 700,
          background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)",
          color: "#fb7185", cursor: "pointer",
        }}>Yes, Cancel</button>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export default function MobileAppointments() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);

  const dateStr = format(currentDate, "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const isSundaySelected = isSunday(currentDate);

  // ── Data fetching ──
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", "day", dateStr],
    queryFn: () => api.appointments.list(dateStr),
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ["appointments", "doctors"],
    queryFn: () => api.appointments.doctors(),
  });

  // ── Status mutation ──
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.appointments.updateStatus(id, status),
    onSuccess: () => {
      setGlobalError(null);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err) => setGlobalError(friendlyError(err)),
  });

  // ── Date navigation ──
  const goToDay = (d: Date) => { setCurrentDate(d); setGlobalError(null); };
  const days = Array.from({ length: 7 }, (_, i) => addDays(currentDate, i - 3));

  // ── Filtered appointments ──
  const filtered = useMemo(() => {
    return (appointments as any[])
      .filter((a) => statusFilter === "all" || a.status === statusFilter)
      .filter((a) => doctorFilter === "all" || a.doctorId === doctorFilter)
      .sort((a, b) => (a.timeSlot || "").localeCompare(b.timeSlot || ""));
  }, [appointments, statusFilter, doctorFilter]);

  const hasActiveFilters = statusFilter !== "all" || doctorFilter !== "all";

  return (
    <div className="mobile-animate-in">
      <MobileHeader title="Appointments" subtitle={format(currentDate, "EEEE, MMMM d")} />

      {/* ── Date strip ── */}
      <div className="scroll-horizontal" style={{ display: "flex", gap: "8px", padding: "12px 16px 6px" }}>
        {/* Today button */}
        <button onClick={() => goToDay(new Date())} className="touch-button" style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "10px 12px", borderRadius: "16px", minWidth: "52px",
          background: dateStr === todayStr
            ? "linear-gradient(135deg, #3b8af4, #2563eb)"
            : "rgba(59,138,244,0.08)",
          color: dateStr === todayStr ? "white" : "#60a5fa",
          border: `1px solid ${dateStr === todayStr ? "transparent" : "rgba(59,138,244,0.2)"}`,
          flexShrink: 0, fontWeight: 700, fontSize: "0.72rem",
          boxShadow: dateStr === todayStr ? "0 6px 24px rgba(59,138,244,0.35)" : "none",
          letterSpacing: "0.03em",
        }}>
          <span style={{ fontSize: "1rem" }}>📅</span>
          <span>Today</span>
        </button>

        {/* Day strip */}
        {days.map((day) => {
          const d = format(day, "yyyy-MM-dd");
          const isActive = d === dateStr;
          const isToday = d === todayStr;
          const isSun = isSunday(day);
          return (
            <button key={d} onClick={() => goToDay(day)} className="touch-button"
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "10px 14px", borderRadius: "16px", minWidth: "52px",
                background: isActive
                  ? "linear-gradient(135deg, #3b8af4, #2563eb)"
                  : isToday ? "rgba(59,138,244,0.1)" : "rgba(255,255,255,0.04)",
                color: isActive ? "white" : isSun ? "#64748b" : "#e2e8f0",
                boxShadow: isActive ? "0 6px 24px rgba(59,138,244,0.35)" : "none",
                flexShrink: 0,
                border: isActive ? "none" : `1px solid ${isToday ? "rgba(59,138,244,0.2)" : "rgba(255,255,255,0.06)"}`,
                opacity: isSun && !isActive ? 0.55 : 1,
              }}>
              <span style={{ fontSize: "0.62rem", fontWeight: 600, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                {format(day, "EEE")}
              </span>
              <span style={{ fontSize: "1.2rem", fontWeight: 800 }}>{format(day, "d")}</span>
            </button>
          );
        })}
      </div>

      {/* ── Prev / Date-picker / Next ── */}
      <div style={{ display: "flex", gap: "8px", padding: "6px 16px 8px", alignItems: "center" }}>
        <button onClick={() => goToDay(addDays(currentDate, -1))} className="touch-button" style={{
          padding: "8px 14px", borderRadius: "12px", fontWeight: 700, fontSize: "0.8rem",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
          color: "#94a3b8", cursor: "pointer",
        }}>‹ Prev</button>

        <input
          type="date"
          value={dateStr}
          onChange={(e) => { if (e.target.value) goToDay(new Date(e.target.value + "T12:00:00")); }}
          style={{
            flex: 1, padding: "8px 12px", borderRadius: "12px", fontSize: "0.82rem",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            color: "#e2e8f0", outline: "none", textAlign: "center",
          }}
        />

        <button onClick={() => goToDay(addDays(currentDate, 1))} className="touch-button" style={{
          padding: "8px 14px", borderRadius: "12px", fontWeight: 700, fontSize: "0.8rem",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
          color: "#94a3b8", cursor: "pointer",
        }}>Next ›</button>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: "8px", padding: "0 16px 10px", overflowX: "auto" }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "7px 10px", borderRadius: "10px", fontSize: "0.78rem", fontWeight: 600,
            background: statusFilter !== "all" ? "rgba(59,138,244,0.12)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${statusFilter !== "all" ? "rgba(59,138,244,0.3)" : "rgba(255,255,255,0.08)"}`,
            color: statusFilter !== "all" ? "#60a5fa" : "#94a3b8", outline: "none", flexShrink: 0,
          }}
        >
          <option value="all">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_COLORS[s]?.label ?? s}</option>
          ))}
        </select>

        {doctors.length > 0 && (
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            style={{
              padding: "7px 10px", borderRadius: "10px", fontSize: "0.78rem", fontWeight: 600,
              background: doctorFilter !== "all" ? "rgba(59,138,244,0.12)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${doctorFilter !== "all" ? "rgba(59,138,244,0.3)" : "rgba(255,255,255,0.08)"}`,
              color: doctorFilter !== "all" ? "#60a5fa" : "#94a3b8", outline: "none", flexShrink: 0,
            }}
          >
            <option value="all">All doctors</option>
            {(doctors as { id: string; name: string }[]).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}

        {hasActiveFilters && (
          <button onClick={() => { setStatusFilter("all"); setDoctorFilter("all"); }}
            className="touch-button" style={{
              padding: "7px 12px", borderRadius: "10px", fontSize: "0.78rem", fontWeight: 700,
              background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)",
              color: "#fb7185", cursor: "pointer", flexShrink: 0,
            }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* ── Global error banner ── */}
      {globalError && (
        <ErrorBanner message={globalError} onDismiss={() => setGlobalError(null)} />
      )}

      {/* ── List ── */}
      <div style={{ padding: "0 16px 100px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: "100px", borderRadius: "18px" }} />
            ))}
          </div>

        ) : isSundaySelected ? (
          /* Sunday closed state */
          <div style={{ textAlign: "center", padding: "56px 16px" }}>
            <div style={{
              width: "72px", height: "72px", borderRadius: "22px", margin: "0 auto 16px",
              background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px",
            }}>🔒</div>
            <p style={{ fontWeight: 800, color: "#fbbf24", fontSize: "1rem", marginBottom: "4px" }}>Clinic Closed</p>
            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>The clinic is closed on Sundays.</p>
          </div>

        ) : (appointments as any[]).length === 0 ? (
          /* No appointments at all */
          <div style={{ textAlign: "center", padding: "56px 16px" }}>
            <div style={{
              width: "72px", height: "72px", borderRadius: "22px", margin: "0 auto 16px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px",
            }}>📅</div>
            <p style={{ fontWeight: 800, color: "#64748b", fontSize: "1rem", marginBottom: "4px" }}>No appointments today</p>
            <p style={{ color: "#475569", fontSize: "0.85rem" }}>Tap ➕ to schedule one.</p>
          </div>

        ) : filtered.length === 0 ? (
          /* Filter empty state */
          <div style={{ textAlign: "center", padding: "48px 16px" }}>
            <div style={{
              width: "72px", height: "72px", borderRadius: "22px", margin: "0 auto 16px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px",
            }}>🔍</div>
            <p style={{ fontWeight: 800, color: "#64748b", fontSize: "1rem", marginBottom: "4px" }}>No appointments match filter</p>
            <button onClick={() => { setStatusFilter("all"); setDoctorFilter("all"); }}
              className="touch-button" style={{
                marginTop: "10px", padding: "10px 20px", borderRadius: "12px", fontWeight: 700,
                fontSize: "0.82rem", background: "rgba(59,138,244,0.12)", border: "1px solid rgba(59,138,244,0.2)",
                color: "#60a5fa", cursor: "pointer",
              }}>Clear Filters</button>
          </div>

        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filtered.map((appt: any) => {
              const colors = STATUS_COLORS[appt.status] || STATUS_COLORS.scheduled;
              const isActive = appt.status !== "cancelled" && appt.status !== "completed";
              const phone: string | undefined = appt.patientPhone;

              return (
                <div key={appt.id} className="mobile-card" style={{
                  display: "flex", flexDirection: "column", gap: "0",
                  borderLeft: `3px solid ${colors.color}`, padding: "14px 14px 12px",
                }}>
                  {/* Row 1: time + patient name + status badge */}
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <div style={{
                      fontSize: "1rem", fontWeight: 800, color: "#60a5fa",
                      minWidth: "52px", fontVariantNumeric: "tabular-nums", flexShrink: 0, paddingTop: "1px",
                    }}>{appt.timeSlot}</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 800, fontSize: "0.95rem", color: "#f1f5f9", margin: 0,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {appt.patientName}
                      </p>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px", flexWrap: "wrap" }}>
                        <span style={{
                          padding: "2px 9px", borderRadius: "20px", fontSize: "0.68rem",
                          fontWeight: 700, background: colors.bg, color: colors.color,
                          border: `1px solid ${colors.border}`,
                        }}>{colors.label}</span>
                        <span style={{
                          padding: "2px 9px", borderRadius: "20px", fontSize: "0.68rem",
                          fontWeight: 600, background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8",
                          textTransform: "capitalize",
                        }}>{appt.type}</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: doctor + duration + phone */}
                  <div style={{ marginTop: "8px", paddingLeft: "62px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    {appt.doctorName && (
                      <span style={{ fontSize: "0.78rem", color: "#60a5fa", fontWeight: 600 }}>
                        {appt.doctorName}
                      </span>
                    )}
                    {appt.duration && (
                      <span style={{ fontSize: "0.78rem", color: "#475569" }}>
                        {appt.duration} min
                      </span>
                    )}
                    {phone && (
                      <span style={{ fontSize: "0.78rem", color: "#475569" }}>
                        {phone}
                      </span>
                    )}
                  </div>

                  {/* Row 3: actions */}
                  <div style={{
                    marginTop: "10px", paddingTop: "10px",
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    display: "flex", gap: "6px", flexWrap: "wrap",
                  }}>
                    {/* Call */}
                    {phone && (
                      <a href={`tel:${phone}`} style={{ textDecoration: "none" }}>
                        <button className="touch-button" style={{
                          padding: "7px 12px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 700,
                          background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
                          color: "#34d399", cursor: "pointer",
                        }}>📞 Call</button>
                      </a>
                    )}

                    {/* WhatsApp */}
                    {phone && (
                      <a
                        href={whatsappUrl(phone, appt.patientName, appt.appointmentDate, appt.timeSlot)}
                        target="_blank" rel="noopener noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        <button className="touch-button" style={{
                          padding: "7px 12px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 700,
                          background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)",
                          color: "#25d366", cursor: "pointer",
                        }}>💬 WhatsApp</button>
                      </a>
                    )}

                    {/* Confirm (scheduled only) */}
                    {appt.status === "scheduled" && (
                      <button
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ id: appt.id, status: "confirmed" })}
                        className="touch-button" style={{
                          padding: "7px 12px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 700,
                          background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)",
                          color: "#34d399", cursor: "pointer",
                        }}>✓ Confirm</button>
                    )}

                    {/* Complete (scheduled or confirmed) */}
                    {(appt.status === "scheduled" || appt.status === "confirmed") && (
                      <button
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ id: appt.id, status: "completed" })}
                        className="touch-button" style={{
                          padding: "7px 12px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 700,
                          background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.15)",
                          color: "#94a3b8", cursor: "pointer",
                        }}>✔ Complete</button>
                    )}

                    {/* Cancel (not already cancelled/completed) */}
                    {isActive && (
                      <button
                        disabled={statusMutation.isPending}
                        onClick={() => setCancelTarget(appt)}
                        className="touch-button" style={{
                          padding: "7px 12px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 700,
                          background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)",
                          color: "#fb7185", cursor: "pointer",
                        }}>✕ Cancel</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── FAB ── */}
      <FloatingActionButton icon="➕" onClick={() => { setShowCreate(true); setGlobalError(null); }} label="New Appointment" />

      {/* ── Create dialog ── */}
      <MobileDialog open={showCreate} onClose={() => setShowCreate(false)} title="New Appointment">
        <CreateAppointmentForm
          date={dateStr}
          doctors={doctors as { id: string; name: string }[]}
          onDone={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
          }}
        />
      </MobileDialog>

      {/* ── Cancel confirmation dialog ── */}
      <MobileDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Appointment"
      >
        {cancelTarget && (
          <CancelConfirmDialog
            appt={cancelTarget}
            onClose={() => setCancelTarget(null)}
            onConfirm={() => {
              statusMutation.mutate({ id: cancelTarget.id, status: "cancelled" });
              setCancelTarget(null);
            }}
          />
        )}
      </MobileDialog>
    </div>
  );
}

// ─── Create appointment form ─────────────────────────────────────────

function CreateAppointmentForm({
  date,
  doctors,
  onDone,
}: {
  date: string;
  doctors: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState("consultation");
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: results = [] } = useQuery({
    queryKey: ["patients", "search", searchQuery],
    queryFn: () => api.patients.search(searchQuery),
    enabled: searchQuery.length >= 1,
  });

  const isSundayDate = isSunday(new Date(date + "T12:00:00"));

  const createMutation = useMutation({
    mutationFn: () => api.appointments.create({
      patientId: selectedPatient.id,
      appointmentDate: date,
      timeSlot: time,
      duration: 30,
      type,
      doctorId: doctorId || undefined,
    }),
    onSuccess: onDone,
    onError: (err) => setFormError(friendlyError(err)),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Sunday warning */}
      {isSundayDate && (
        <div style={{
          padding: "12px 14px", borderRadius: "12px",
          background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)",
          color: "#fbbf24", fontSize: "0.85rem", fontWeight: 600,
        }}>
          ⚠️ Sunday is a clinic closure day. Booking will be rejected by the server.
        </div>
      )}

      {/* Form error */}
      {formError && (
        <div style={{
          padding: "12px 14px", borderRadius: "12px",
          background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)",
          color: "#fb7185", fontSize: "0.85rem", fontWeight: 600, lineHeight: 1.4,
        }}>
          ⚠️ {formError}
        </div>
      )}

      {/* Patient picker */}
      {selectedPatient ? (
        <div style={{
          display: "flex", alignItems: "center", gap: "8px", padding: "12px 14px",
          background: "rgba(59,138,244,0.1)", borderRadius: "14px",
          border: "1px solid rgba(59,138,244,0.2)",
        }}>
          <span style={{ fontWeight: 700, color: "#60a5fa", flex: 1 }}>
            {selectedPatient.firstName} {selectedPatient.lastName}
          </span>
          <button onClick={() => { setSelectedPatient(null); setFormError(null); }}
            style={{ background: "transparent", border: "none", color: "#475569", fontSize: "16px", cursor: "pointer" }}>✕</button>
        </div>
      ) : (
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8", marginBottom: "6px" }}>
            Patient *
          </label>
          <MobileSearchBar placeholder="Search patient..." value={searchQuery} onChange={setSearchQuery} autoFocus />
          {results.length > 0 && (
            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px", maxHeight: "180px", overflowY: "auto" }}>
              {(results as any[]).slice(0, 6).map((p: any) => (
                <button key={p.id}
                  onClick={() => { setSelectedPatient(p); setSearchQuery(""); setFormError(null); }}
                  className="touch-button" style={{
                    textAlign: "left", padding: "10px 14px", borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.04)",
                    color: "#e2e8f0", cursor: "pointer",
                  }}>
                  <span style={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</span>
                  <span style={{ color: "#475569", fontSize: "0.78rem", marginLeft: "8px" }}>#{p.fileNumber}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        {/* Time */}
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8", marginBottom: "6px" }}>Time</label>
          <select value={time} onChange={(e) => { setTime(e.target.value); setFormError(null); }} className="mobile-input">
            {Array.from({ length: 24 }, (_, i) => {
              const h = Math.floor(i / 2) + 8;
              const m = i % 2 === 0 ? "00" : "30";
              return `${h.toString().padStart(2, "0")}:${m}`;
            }).filter(t => t >= "08:00" && t <= "17:30").map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {/* Type */}
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8", marginBottom: "6px" }}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="mobile-input">
            <option value="consultation">Consultation</option>
            <option value="follow-up">Follow-up</option>
            <option value="procedure">Procedure</option>
            <option value="cleaning">Cleaning</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
      </div>

      {/* Doctor */}
      {doctors.length > 0 && (
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8", marginBottom: "6px" }}>Doctor</label>
          <select value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setFormError(null); }} className="mobile-input">
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      <button
        onClick={() => { setFormError(null); if (selectedPatient) createMutation.mutate(); }}
        disabled={!selectedPatient || createMutation.isPending}
        className="mobile-btn mobile-btn-primary"
        style={{ opacity: selectedPatient ? 1 : 0.3, marginTop: "8px" }}>
        {createMutation.isPending ? "Booking..." : "Book Appointment"}
      </button>
    </div>
  );
}
