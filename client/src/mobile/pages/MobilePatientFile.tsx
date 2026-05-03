import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import MobileHeader from "../components/MobileHeader";
import FloatingActionButton from "../components/FloatingActionButton";

interface MobilePatientFileProps {
  user: any;
}

export default function MobilePatientFile({ user }: MobilePatientFileProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<"visits" | "diagnostics" | "medications" | "photos">("visits");
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: () => api.patients.get(id!),
    enabled: !!id,
  });

  const { data: visitHistory = [] } = useQuery({
    queryKey: ["visits", "patient", id],
    queryFn: () => api.visits.forPatient(id!),
    enabled: !!id,
  });

  const { data: images = [] } = useQuery({
    queryKey: ["images", id],
    queryFn: () => api.images.forPatient(id!),
    enabled: !!id && activeSection === "photos",
  });

  const createVisitMutation = useMutation({
    mutationFn: () => api.visits.create({ patientId: id!, visitType: "consultation" }),
    onSuccess: (visit) => {
      queryClient.invalidateQueries({ queryKey: ["visits", "patient", id] });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      navigate(`/m/visit/${visit.id}?patientId=${id}`);
    },
  });

  if (isLoading || !patient) {
    return (
      <div style={{ padding: "20px" }}>
        <div className="skeleton" style={{ height: "40px", width: "60%", marginBottom: "12px" }} />
        <div className="skeleton" style={{ height: "20px", width: "40%", marginBottom: "24px" }} />
        <div className="skeleton" style={{ height: "100px", marginBottom: "12px", borderRadius: "18px" }} />
        <div className="skeleton" style={{ height: "100px", borderRadius: "18px" }} />
      </div>
    );
  }

  const sections: { key: "visits" | "diagnostics" | "medications" | "photos"; label: string; count?: number }[] = [
    { key: "visits", label: "📅 Visits", count: visitHistory.length },
    { key: "diagnostics", label: "🏥 Dx" },
    { key: "medications", label: "💊 Rx" },
    { key: "photos", label: "📸 Photos" },
  ];

  const allDiagnoses = visitHistory.flatMap((v: any) =>
    (v.diagnoses || []).map((d: any) => ({ ...d, date: v.startedAt }))
  ).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const allMedications = visitHistory.flatMap((v: any) =>
    (v.prescriptions || []).map((p: any) => ({ ...p, date: v.startedAt }))
  ).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="mobile-animate-in">
      <MobileHeader
        title={`${patient.firstName} ${patient.lastName}`}
        subtitle={`#${patient.fileNumber} • ${patient.phone || "No phone"}`}
        showBack
        rightAction={
          patient.phone ? (
            <a href={`tel:${patient.phone}`} className="touch-target"
              style={{
                fontSize: "18px", textDecoration: "none",
                background: "rgba(16,185,129,0.12)", borderRadius: "12px",
                width: "40px", height: "40px", display: "flex",
                alignItems: "center", justifyContent: "center",
                border: "1px solid rgba(16,185,129,0.15)",
              }}>📞</a>
          ) : undefined
        }
      />

      <div style={{ padding: "12px 16px 0" }}>
        {/* Alerts */}
        {(patient.allergies || patient.chronicConditions) && (
          <div style={{
            background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.15)",
            borderRadius: "16px", padding: "12px 16px", marginBottom: "12px",
          }}>
            <p style={{ fontSize: "0.82rem", fontWeight: 800, color: "#fb7185", margin: "0 0 4px" }}>⚠️ Alerts</p>
            {patient.allergies && (
              <p style={{ fontSize: "0.82rem", color: "#fda4af", margin: "0 0 2px" }}>
                <strong>Allergies:</strong> {patient.allergies}
              </p>
            )}
            {patient.chronicConditions && (
              <p style={{ fontSize: "0.82rem", color: "#fda4af", margin: 0 }}>
                <strong>Chronic:</strong> {patient.chronicConditions}
              </p>
            )}
          </div>
        )}

        {/* Quick Info */}
        <div className="scroll-horizontal" style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          {[
            { label: "Gender", value: patient.gender || "—" },
            { label: "City", value: patient.city || "—" },
            { label: "Visits", value: patient.visitCount?.toString() || "0" },
            patient.insurance ? { label: "Insurance", value: patient.insurance } : null,
          ].filter(Boolean).map((item, i) => (
            <div key={i} className="mobile-card" style={{ padding: "10px 14px", flexShrink: 0, minWidth: "85px" }}>
              <p style={{ fontSize: "0.62rem", color: "#475569", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {item!.label}
              </p>
              <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>{item!.value}</p>
            </div>
          ))}
        </div>

        {/* Section Tabs */}
        <div className="mobile-pill-tabs" style={{ marginBottom: "14px" }}>
          {sections.map((s) => (
            <button key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`mobile-pill-tab ${activeSection === s.key ? "active" : ""}`}>
              {s.label} {s.count !== undefined ? `(${s.count})` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 16px 100px" }}>
        {/* Visits */}
        {activeSection === "visits" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {visitHistory.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 16px" }}>
                <div style={{
                  width: "60px", height: "60px", borderRadius: "18px", margin: "0 auto 12px",
                  background: "rgba(255,255,255,0.04)", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: "26px",
                }}>📋</div>
                <p style={{ fontWeight: 700, color: "#64748b" }}>No visits yet</p>
              </div>
            ) : (
              visitHistory.map((visit: any) => {
                const statusColors: Record<string, string> = {
                  in_progress: "#60a5fa", completed: "#4ade80", queued: "#fbbf24",
                };
                return (
                  <div key={visit.id} className="mobile-card touch-button"
                    style={{ borderLeft: `3px solid ${statusColors[visit.status] || "#fbbf24"}` }}
                    onClick={() => {
                      if (["doctor", "admin"].includes(user.role)) {
                        navigate(`/m/visit/${visit.id}?patientId=${id}`);
                      } else {
                        setExpandedVisit(expandedVisit === visit.id ? null : visit.id);
                      }
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f1f5f9" }}>
                        Visit #{visit.visitNumber}
                      </span>
                      <span style={{ fontSize: "0.76rem", color: "#475569" }}>
                        {new Date(visit.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    {visit.chiefComplaint && (
                      <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: "0 0 6px" }}>{visit.chiefComplaint}</p>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {visit.diagnoses?.map((d: any) => (
                        <span key={d.id} style={{
                          background: "rgba(59,138,244,0.12)", color: "#60a5fa", padding: "3px 10px",
                          borderRadius: "20px", fontSize: "0.7rem", fontWeight: 700,
                          border: "1px solid rgba(59,138,244,0.15)",
                        }}>{d.name}</span>
                      ))}
                      {visit.prescriptions?.map((rx: any) => (
                        <span key={rx.id} style={{
                          background: "rgba(16,185,129,0.12)", color: "#34d399", padding: "3px 10px",
                          borderRadius: "20px", fontSize: "0.7rem", fontWeight: 700,
                          border: "1px solid rgba(16,185,129,0.15)",
                        }}>{rx.medicationName}</span>
                      ))}
                      {visit.labOrders?.map((lab: any) => (
                        <span key={lab.id} style={{
                          background: "rgba(251,191,36,0.12)", color: "#fbbf24", padding: "3px 10px",
                          borderRadius: "20px", fontSize: "0.7rem", fontWeight: 700,
                          border: "1px solid rgba(251,191,36,0.15)",
                        }}>{lab.testName}</span>
                      ))}
                    </div>
                    {visit.billing && (
                      <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <span style={{
                          fontSize: "0.82rem", fontWeight: 700,
                          color: visit.billing.status === "paid" ? "#4ade80" : "#fb7185",
                        }}>
                          💰 ${visit.billing.totalAmount} {visit.billing.status === "paid" ? "✅" : "— Unpaid"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Diagnostics */}
        {activeSection === "diagnostics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {allDiagnoses.length === 0 ? (
              <p style={{ textAlign: "center", color: "#475569", padding: "40px" }}>No diagnostics recorded</p>
            ) : allDiagnoses.map((d: any, i: number) => (
              <div key={`${d.id}-${i}`} className="mobile-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{d.name}</span>
                <span style={{ fontSize: "0.76rem", color: "#475569" }}>
                  {new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Medications */}
        {activeSection === "medications" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {allMedications.length === 0 ? (
              <p style={{ textAlign: "center", color: "#475569", padding: "40px" }}>No medications recorded</p>
            ) : allMedications.map((rx: any, i: number) => (
              <div key={`${rx.id}-${i}`} className="mobile-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{rx.medicationName}</span>
                  <span style={{ fontSize: "0.76rem", color: "#475569" }}>
                    {new Date(rx.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                  </span>
                </div>
                {(rx.dosage || rx.frequency || rx.duration) && (
                  <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "4px 0 0" }}>
                    {[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" • ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Photos */}
        {activeSection === "photos" && (
          <div>
            {images.length === 0 ? (
              <p style={{ textAlign: "center", color: "#475569", padding: "40px" }}>No photos</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                {images.map((img: any) => (
                  <div key={img.id} style={{ borderRadius: "12px", overflow: "hidden", aspectRatio: "1" }}>
                    <img src={img.url || `/uploads/${img.filename}`}
                      alt={img.caption || "Patient photo"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {["doctor", "admin"].includes(user.role) && (
        <FloatingActionButton icon="➕" onClick={() => createVisitMutation.mutate()} variant="success" label="New Visit" />
      )}
    </div>
  );
}
