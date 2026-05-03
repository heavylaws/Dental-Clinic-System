import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { format, addDays } from "date-fns";
import MobileHeader from "../components/MobileHeader";
import MobileDialog from "../components/MobileDialog";
import FloatingActionButton from "../components/FloatingActionButton";
import MobileSearchBar from "../components/MobileSearchBar";

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  scheduled: { bg: "rgba(59,138,244,0.12)", color: "#60a5fa", border: "rgba(59,138,244,0.2)" },
  confirmed: { bg: "rgba(16,185,129,0.12)", color: "#34d399", border: "rgba(16,185,129,0.2)" },
  cancelled: { bg: "rgba(244,63,94,0.12)", color: "#fb7185", border: "rgba(244,63,94,0.2)" },
  completed: { bg: "rgba(148,163,184,0.1)", color: "#94a3b8", border: "rgba(148,163,184,0.15)" },
};

export default function MobileAppointments() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const dateStr = format(currentDate, "yyyy-MM-dd");

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", "day", dateStr],
    queryFn: () => api.appointments.list(dateStr),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.appointments.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const days = Array.from({ length: 7 }, (_, i) => addDays(currentDate, i - 3));

  return (
    <div className="mobile-animate-in">
      <MobileHeader title="Appointments" subtitle={format(currentDate, "EEEE, MMMM d")} />

      {/* Date Strip */}
      <div className="scroll-horizontal" style={{ display: "flex", gap: "8px", padding: "12px 16px" }}>
        {days.map((day) => {
          const d = format(day, "yyyy-MM-dd");
          const isActive = d === dateStr;
          const isToday = d === format(new Date(), "yyyy-MM-dd");
          return (
            <button key={d} onClick={() => setCurrentDate(day)} className="touch-button"
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "10px 14px", borderRadius: "16px", minWidth: "52px",
                background: isActive
                  ? "linear-gradient(135deg, #3b8af4, #2563eb)"
                  : isToday ? "rgba(59,138,244,0.1)" : "rgba(255,255,255,0.04)",
                color: isActive ? "white" : "#e2e8f0",
                boxShadow: isActive ? "0 6px 24px rgba(59,138,244,0.35)" : "none",
                flexShrink: 0,
                border: isActive ? "none" : `1px solid ${isToday ? "rgba(59,138,244,0.2)" : "rgba(255,255,255,0.06)"}`,
              }}>
              <span style={{ fontSize: "0.62rem", fontWeight: 600, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                {format(day, "EEE")}
              </span>
              <span style={{ fontSize: "1.2rem", fontWeight: 800 }}>{format(day, "d")}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ padding: "8px 16px 100px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "70px", borderRadius: "18px" }} />)}
          </div>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 16px" }}>
            <div style={{
              width: "70px", height: "70px", borderRadius: "20px", margin: "0 auto 14px",
              background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "28px",
            }}>📅</div>
            <p style={{ fontWeight: 700, color: "#64748b" }}>No appointments</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {appointments
              .sort((a: any, b: any) => a.timeSlot.localeCompare(b.timeSlot))
              .map((appt: any) => {
                const colors = STATUS_COLORS[appt.status] || STATUS_COLORS.scheduled;
                return (
                  <div key={appt.id} className="mobile-card"
                    style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                    {/* Time */}
                    <div style={{
                      fontSize: "0.95rem", fontWeight: 800, color: "#60a5fa",
                      minWidth: "48px", textAlign: "center", flexShrink: 0,
                    }}>{appt.timeSlot}</div>

                    <div style={{ width: "3px", height: "36px", borderRadius: "2px", background: colors.bg, flexShrink: 0 }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: "0.92rem", color: "#f1f5f9", margin: 0 }}>
                        {appt.patientName}
                      </p>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "3px" }}>
                        <span style={{
                          padding: "2px 10px", borderRadius: "20px", fontSize: "0.68rem",
                          fontWeight: 700, background: colors.bg, color: colors.color,
                          border: `1px solid ${colors.border}`,
                        }}>{appt.status}</span>
                        <span style={{ fontSize: "0.76rem", color: "#475569" }}>{appt.type}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                      {appt.status === "scheduled" && (
                        <button onClick={() => statusMutation.mutate({ id: appt.id, status: "confirmed" })}
                          className="touch-button" style={{
                            width: "36px", height: "36px", borderRadius: "10px",
                            background: "rgba(16,185,129,0.12)", color: "#34d399",
                            border: "1px solid rgba(16,185,129,0.2)", fontWeight: 700, fontSize: "15px",
                          }}>✓</button>
                      )}
                      {appt.status !== "cancelled" && appt.status !== "completed" && (
                        <button onClick={() => statusMutation.mutate({ id: appt.id, status: "cancelled" })}
                          className="touch-button" style={{
                            width: "36px", height: "36px", borderRadius: "10px",
                            background: "rgba(244,63,94,0.12)", color: "#fb7185",
                            border: "1px solid rgba(244,63,94,0.2)", fontWeight: 700, fontSize: "15px",
                          }}>✕</button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <FloatingActionButton icon="➕" onClick={() => setShowCreate(true)} label="New Appointment" />

      <MobileDialog open={showCreate} onClose={() => setShowCreate(false)} title="New Appointment">
        <CreateAppointmentForm date={dateStr} onDone={() => {
          setShowCreate(false);
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
        }} />
      </MobileDialog>
    </div>
  );
}

function CreateAppointmentForm({ date, onDone }: { date: string; onDone: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState("consultation");

  const { data: results = [] } = useQuery({
    queryKey: ["patients", "search", searchQuery],
    queryFn: () => api.patients.search(searchQuery),
    enabled: searchQuery.length >= 1,
  });

  const createMutation = useMutation({
    mutationFn: () => api.appointments.create({
      patientId: selectedPatient.id, appointmentDate: date, timeSlot: time, duration: 30, type,
    }),
    onSuccess: onDone,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {selectedPatient ? (
        <div style={{
          display: "flex", alignItems: "center", gap: "8px", padding: "12px 14px",
          background: "rgba(59,138,244,0.1)", borderRadius: "14px",
          border: "1px solid rgba(59,138,244,0.2)",
        }}>
          <span style={{ fontWeight: 700, color: "#60a5fa", flex: 1 }}>
            {selectedPatient.firstName} {selectedPatient.lastName}
          </span>
          <button onClick={() => setSelectedPatient(null)}
            style={{ background: "transparent", border: "none", color: "#475569", fontSize: "16px", cursor: "pointer" }}>✕</button>
        </div>
      ) : (
        <div>
          <MobileSearchBar placeholder="Search patient..." value={searchQuery} onChange={setSearchQuery} autoFocus />
          {results.length > 0 && (
            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px", maxHeight: "180px", overflowY: "auto" }}>
              {results.slice(0, 6).map((p: any) => (
                <button key={p.id}
                  onClick={() => { setSelectedPatient(p); setSearchQuery(""); }}
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
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8", marginBottom: "6px" }}>Time</label>
          <select value={time} onChange={(e) => setTime(e.target.value)} className="mobile-input">
            {Array.from({ length: 24 }, (_, i) => {
              const h = Math.floor(i / 2) + 8;
              const m = i % 2 === 0 ? "00" : "30";
              return `${h.toString().padStart(2, "0")}:${m}`;
            }).filter(t => t >= "08:00" && t <= "19:30").map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8", marginBottom: "6px" }}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="mobile-input">
            <option value="consultation">Consultation</option>
            <option value="follow-up">Follow-up</option>
            <option value="procedure">Procedure</option>
          </select>
        </div>
      </div>

      <button onClick={() => selectedPatient && createMutation.mutate()}
        disabled={!selectedPatient || createMutation.isPending}
        className="mobile-btn mobile-btn-primary"
        style={{ opacity: selectedPatient ? 1 : 0.3, marginTop: "8px" }}>
        {createMutation.isPending ? "Booking..." : "Book Appointment"}
      </button>
    </div>
  );
}
