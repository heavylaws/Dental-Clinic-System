import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useWebSocket } from "../../lib/ws";
import MobileHeader from "../components/MobileHeader";
import MobileSearchBar from "../components/MobileSearchBar";
import SwipeableCard from "../components/SwipeableCard";
import FloatingActionButton from "../components/FloatingActionButton";
import MobileDialog from "../components/MobileDialog";
import { useHapticFeedback } from "../hooks/useHapticFeedback";

interface MobileDashboardProps {
  user: any;
}

export default function MobileDashboard({ user }: MobileDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const haptic = useHapticFeedback();

  const { data: queue = [], refetch: refetchQueue } = useQuery({
    queryKey: ["queue"],
    queryFn: api.visits.queue,
    refetchInterval: 15000,
  });

  const { data: searchResults = [], isFetching: searchFetching } = useQuery({
    queryKey: ["patients", "search", searchQuery],
    queryFn: () => api.patients.search(searchQuery),
    enabled: searchQuery.length >= 1,
  });

  const { data: dailySummary } = useQuery({
    queryKey: ["reports", "daily"],
    queryFn: () => api.reports.daily(),
  });

  useWebSocket("queue:update", () => refetchQueue());

  const queueMutation = useMutation({
    mutationFn: (patientId: string) =>
      api.visits.create({ patientId, visitType: "consultation" }),
    onSuccess: () => {
      haptic.success();
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      setSearchQuery("");
      setIsSearching(false);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.visits.updateStatus(id, status),
    onSuccess: () => {
      haptic.medium();
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const deleteVisitMutation = useMutation({
    mutationFn: (id: string) => api.visits.delete(id),
    onSuccess: () => {
      haptic.warning();
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const statusConfig: Record<string, { label: string; icon: string; color: string; glow: string }> = {
    queued: { label: "Waiting", icon: "⏳", color: "#fbbf24", glow: "rgba(251,191,36,0.15)" },
    in_progress: { label: "In Progress", icon: "🔵", color: "#60a5fa", glow: "rgba(96,165,250,0.15)" },
    completed: { label: "Done", icon: "✅", color: "#4ade80", glow: "rgba(74,222,128,0.15)" },
    billed: { label: "Billed", icon: "💰", color: "#94a3b8", glow: "rgba(148,163,184,0.1)" },
  };

  return (
    <div className="mobile-animate-in">
      <MobileHeader
        title="Today's Queue"
        subtitle={`${queue.length} patient${queue.length !== 1 ? "s" : ""} • ${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`}
      />

      <div style={{ padding: "14px 16px" }}>
        {/* Search */}
        <MobileSearchBar
          placeholder="Search patient name or phone..."
          value={searchQuery}
          onChange={setSearchQuery}
          onFocus={() => setIsSearching(true)}
        />

        {/* Search Results */}
        {searchQuery.length >= 1 && (
          <div style={{ marginTop: "12px" }}>
            {searchFetching ? (
              <div style={{ padding: "20px" }}>
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton" style={{ height: "60px", marginBottom: "8px", borderRadius: "16px" }} />
                ))}
              </div>
            ) : searchResults.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px" }}>
                <p style={{ color: "#475569", marginBottom: "14px", fontSize: "0.95rem" }}>No patients found</p>
                <button onClick={() => setShowNewPatient(true)}
                  className="mobile-btn mobile-btn-primary" style={{ maxWidth: "220px", margin: "0 auto" }}>
                  ➕ Register New
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {searchResults.map((p: any) => (
                  <div key={p.id} className="mobile-card touch-button"
                    style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px" }}>
                    <div style={{ flex: 1, minWidth: 0 }} onClick={() => navigate(`/m/patient/${p.id}`)}>
                      <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f1f5f9", margin: 0 }}>
                        {p.firstName} {p.fatherName ? `${p.fatherName} ` : ""}{p.lastName}
                      </p>
                      <p style={{ fontSize: "0.78rem", color: "#475569", margin: 0 }}>
                        #{p.fileNumber} • {p.phone || "—"}
                      </p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); queueMutation.mutate(p.id); }}
                      className="touch-button" style={{
                        padding: "10px 16px", borderRadius: "12px", fontWeight: 700, fontSize: "0.82rem",
                        background: "linear-gradient(135deg, #10b981, #059669)", color: "white",
                        border: "none", flexShrink: 0, boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
                      }}>
                      + Queue
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Daily Stats */}
        {!isSearching && dailySummary && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
            marginTop: "16px", marginBottom: "16px",
          }}>
            {[
              { value: dailySummary.visitCount, label: "Visits", color: "#3b8af4", icon: "🏥" },
              { value: dailySummary.uniquePatients, label: "Patients", color: "#10b981", icon: "👥" },
              { value: `$${dailySummary.totalPaid}`, label: "Collected", color: "#fbbf24", icon: "💰" },
              { value: `$${dailySummary.outstanding}`, label: "Outstanding", color: "#f43f5e", icon: "📊" },
            ].map((stat, i) => (
              <div key={i} className="mobile-card" style={{
                textAlign: "center", padding: "16px 12px", position: "relative", overflow: "hidden",
              }}>
                {/* Subtle glow */}
                <div style={{
                  position: "absolute", top: "-20px", right: "-20px", width: "60px", height: "60px",
                  borderRadius: "50%", background: `radial-gradient(circle, ${stat.color}15 0%, transparent 70%)`,
                  pointerEvents: "none",
                }} />
                <p style={{ fontSize: "0.7rem", marginBottom: "4px", opacity: 0.5 }}>{stat.icon}</p>
                <p style={{ fontSize: "1.5rem", fontWeight: 800, color: stat.color, margin: "0 0 2px", letterSpacing: "-0.02em" }}>
                  {stat.value}
                </p>
                <p style={{ fontSize: "0.72rem", color: "#64748b", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Queue */}
        {!isSearching && (
          <>
            {queue.length > 0 && (
              <p className="mobile-section-label" style={{ marginTop: "4px" }}>
                Active Queue
              </p>
            )}
            {queue.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 16px" }}>
                <div style={{
                  width: "80px", height: "80px", borderRadius: "24px", margin: "0 auto 16px",
                  background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "36px",
                }}>📭</div>
                <p style={{ color: "#64748b", fontWeight: 700, fontSize: "1rem", marginBottom: "4px" }}>
                  No patients in queue
                </p>
                <p style={{ color: "#475569", fontSize: "0.85rem" }}>
                  Search above to add a patient
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                {queue.map((item: any, idx: number) => {
                  const sc = statusConfig[item.status] || statusConfig.queued;
                  return (
                    <SwipeableCard key={item.id}
                      onSwipeRight={
                        item.status === "queued" && ["doctor", "admin"].includes(user.role)
                          ? () => updateStatusMutation.mutate({ id: item.id, status: "in_progress" })
                          : undefined
                      }
                      onSwipeLeft={
                        item.status === "queued"
                          ? () => deleteVisitMutation.mutate(item.id)
                          : undefined
                      }
                      rightLabel="▶ Start"
                      leftLabel="✕ Remove"
                    >
                      <div className="mobile-card"
                        style={{
                          display: "flex", alignItems: "center", gap: "14px",
                          borderLeft: `3px solid ${sc.color}`,
                          position: "relative", overflow: "hidden",
                        }}
                        onClick={() => navigate(`/m/patient/${item.patientId}`)}
                      >
                        {/* Background glow accent */}
                        <div style={{
                          position: "absolute", left: "-10px", top: "50%", transform: "translateY(-50%)",
                          width: "30px", height: "30px", borderRadius: "50%",
                          background: `radial-gradient(circle, ${sc.color}20 0%, transparent 70%)`,
                          pointerEvents: "none",
                        }} />

                        {/* Position */}
                        <div style={{
                          width: "38px", height: "38px", borderRadius: "12px",
                          background: sc.glow,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, fontSize: "0.95rem", color: sc.color, flexShrink: 0,
                          border: `1px solid ${sc.color}20`,
                        }}>
                          {idx + 1}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontWeight: 700, fontSize: "0.95rem", color: "#f1f5f9", margin: 0,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {item.patientName}
                          </p>
                          <p style={{ fontSize: "0.75rem", color: "#475569", margin: 0, fontWeight: 500 }}>
                            File #{item.patientFileNumber}
                          </p>
                        </div>

                        {/* Status */}
                        <span className={`mobile-status-${item.status}`}
                          style={{
                            padding: "5px 12px", borderRadius: "20px", fontSize: "0.72rem",
                            fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap",
                          }}>
                          {sc.icon} {sc.label}
                        </span>
                      </div>
                    </SwipeableCard>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <FloatingActionButton icon="➕" onClick={() => setShowNewPatient(true)} variant="primary" label="Register" />

      {/* New Patient Dialog */}
      <MobileDialog open={showNewPatient} onClose={() => setShowNewPatient(false)} title="New Patient" fullScreen>
        <MobileNewPatientForm onCreated={(patient: any) => {
          setShowNewPatient(false);
          navigate(`/m/patient/${patient.id}`);
        }} />
      </MobileDialog>
    </div>
  );
}

function MobileNewPatientForm({ onCreated }: { onCreated: (p: any) => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [fatherName, setFatherName] = useState("");
  const [city, setCity] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      api.patients.create({
        firstName, lastName,
        fatherName: fatherName || undefined,
        phone: phone || undefined,
        gender: gender || undefined,
        city: city || undefined,
      }),
    onSuccess: (patient: any) => onCreated(patient),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (firstName && lastName) createMutation.mutate(); }}
      style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {[
        { label: "First Name *", value: firstName, set: setFirstName, ph: "First name", auto: true, req: true },
        { label: "Last Name *", value: lastName, set: setLastName, ph: "Last name", req: true },
      ].map((f, i) => (
        <div key={i}>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8", marginBottom: "6px" }}>{f.label}</label>
          <input type="text" value={f.value} onChange={(e) => f.set(e.target.value)}
            className="mobile-input" placeholder={f.ph} autoFocus={f.auto} required={f.req} />
        </div>
      ))}

      <div>
        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8", marginBottom: "6px" }}>Phone</label>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          className="mobile-input" placeholder="Phone number" inputMode="tel" />
      </div>

      <div>
        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8", marginBottom: "6px" }}>Gender</label>
        <div style={{ display: "flex", gap: "10px" }}>
          {["Male", "Female"].map((g) => (
            <button key={g} type="button" onClick={() => setGender(g)} className="touch-button"
              style={{
                flex: 1, padding: "13px", borderRadius: "14px", fontWeight: 700, fontSize: "0.95rem",
                border: `1px solid ${gender === g ? "rgba(59,138,244,0.4)" : "rgba(255,255,255,0.08)"}`,
                background: gender === g ? "rgba(59,138,244,0.12)" : "rgba(255,255,255,0.04)",
                color: gender === g ? "#60a5fa" : "#64748b",
              }}>
              {g === "Male" ? "♂ Male" : "♀ Female"}
            </button>
          ))}
        </div>
      </div>

      {!showMore && (
        <button type="button" onClick={() => setShowMore(true)}
          style={{ background: "transparent", border: "none", color: "#3b8af4", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer", padding: "8px 0" }}>
          + More Details
        </button>
      )}

      {showMore && (
        <>
          <div>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8", marginBottom: "6px" }}>Father's Name</label>
            <input type="text" value={fatherName} onChange={(e) => setFatherName(e.target.value)} className="mobile-input" placeholder="Father's name" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8", marginBottom: "6px" }}>City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="mobile-input" placeholder="City" />
          </div>
        </>
      )}

      <button type="submit" disabled={!firstName || !lastName || createMutation.isPending}
        className="mobile-btn mobile-btn-primary"
        style={{ marginTop: "8px", opacity: (!firstName || !lastName) ? 0.4 : 1 }}>
        {createMutation.isPending ? "Creating..." : "Register Patient"}
      </button>
    </form>
  );
}
