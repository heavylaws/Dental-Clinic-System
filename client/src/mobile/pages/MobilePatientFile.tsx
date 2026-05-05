import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import MobileHeader from "../components/MobileHeader";
import MobileDialog from "../components/MobileDialog";
import FloatingActionButton from "../components/FloatingActionButton";

interface MobilePatientFileProps {
  user: any;
}

export default function MobilePatientFile({ user }: MobilePatientFileProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<"visits" | "diagnostics" | "medications" | "photos">("visits");
  const [showEditPatient, setShowEditPatient] = useState(false);
  const [showPrint, setShowPrint] = useState<{ type: string; visit: any } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const { data: images = [], refetch: refetchImages } = useQuery({
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

  const uploadImageMutation = useMutation({
    mutationFn: (file: File) => api.images.upload(id!, file),
    onSuccess: () => refetchImages(),
  });

  const deleteImageMutation = useMutation({
    mutationFn: (imgId: string) => api.images.delete(imgId),
    onSuccess: () => refetchImages(),
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(f => uploadImageMutation.mutate(f));
    }
    e.target.value = "";
  };

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

  const sections: { key: typeof activeSection; label: string; count?: number }[] = [
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

  const handlePrint = (type: string, visit: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    let content = "";
    const header = `<div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:10px">
      <h1 style="margin:0;font-size:22px">DermClinic</h1>
      <p style="margin:4px 0;color:#666">Patient: <b>${patient.firstName} ${patient.lastName}</b> | File: #${patient.fileNumber}</p>
      <p style="margin:0;color:#666;font-size:12px">Visit #${visit.visitNumber} — ${new Date(visit.startedAt).toLocaleDateString()}</p></div>`;

    if (type === "rx") {
      content = `<h2>Prescription</h2>${(visit.prescriptions || []).map((rx: any) =>
        `<div style="padding:8px 0;border-bottom:1px solid #eee"><b>${rx.medicationName}</b>${rx.dosage ? ` — ${rx.dosage}` : ""}${rx.frequency ? ` | ${rx.frequency}` : ""}${rx.duration ? ` | ${rx.duration}` : ""}</div>`
      ).join("")}`;
    } else if (type === "lab") {
      content = `<h2>Lab Test Order</h2>${(visit.labOrders || []).map((l: any) =>
        `<div style="padding:8px 0;border-bottom:1px solid #eee">🧪 ${l.testName}</div>`
      ).join("")}`;
    } else if (type === "notes") {
      content = `<h2>Clinical Notes</h2>
        ${visit.chiefComplaint ? `<p><b>Chief Complaint:</b> ${visit.chiefComplaint}</p>` : ""}
        ${visit.clinicalNotes ? `<p><b>Notes:</b> ${visit.clinicalNotes}</p>` : ""}
        ${(visit.diagnoses || []).length > 0 ? `<p><b>Diagnoses:</b> ${visit.diagnoses.map((d: any) => d.name).join(", ")}</p>` : ""}`;
    }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Print</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto}h2{color:#333;border-bottom:1px solid #ddd;padding-bottom:8px}</style>
      </head><body>${header}${content}</body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="mobile-animate-in">
      <MobileHeader
        title={`${patient.firstName} ${patient.lastName}`}
        subtitle={`#${patient.fileNumber} • ${patient.phone || "No phone"}`}
        showBack
        rightAction={
          <div style={{ display: "flex", gap: "6px" }}>
            {/* Edit Patient Button */}
            <button onClick={() => setShowEditPatient(true)} className="touch-target"
              style={{
                fontSize: "16px", background: "rgba(59,138,244,0.12)", borderRadius: "12px",
                width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid rgba(59,138,244,0.15)", cursor: "pointer",
              }}>✏️</button>
            {/* Call Button */}
            {patient.phone && (
              <a href={`tel:${patient.phone}`} className="touch-target"
                style={{
                  fontSize: "18px", textDecoration: "none",
                  background: "rgba(16,185,129,0.12)", borderRadius: "12px",
                  width: "40px", height: "40px", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  border: "1px solid rgba(16,185,129,0.15)",
                }}>📞</a>
            )}
          </div>
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
              <p style={{ fontSize: "0.82rem", color: "#fda4af", margin: "0 0 2px" }}><strong>Allergies:</strong> {patient.allergies}</p>
            )}
            {patient.chronicConditions && (
              <p style={{ fontSize: "0.82rem", color: "#fda4af", margin: 0 }}><strong>Chronic:</strong> {patient.chronicConditions}</p>
            )}
          </div>
        )}

        {/* Quick Info */}
        <div className="scroll-horizontal" style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          {[
            { label: "Gender", value: patient.gender || "—" },
            { label: "DOB", value: patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—" },
            { label: "City", value: patient.city || "—" },
            { label: "Visits", value: patient.visitCount?.toString() || "0" },
            patient.insurance ? { label: "Insurance", value: patient.insurance } : null,
          ].filter(Boolean).map((item, i) => (
            <div key={i} className="mobile-card" style={{ padding: "10px 14px", flexShrink: 0, minWidth: "80px" }}>
              <p style={{ fontSize: "0.6rem", color: "#475569", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item!.label}</p>
              <p style={{ fontSize: "0.92rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>{item!.value}</p>
            </div>
          ))}
        </div>

        {/* Section Tabs */}
        <div className="mobile-pill-tabs" style={{ marginBottom: "14px" }}>
          {sections.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
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
            ) : visitHistory.map((visit: any) => {
              const statusColors: Record<string, string> = {
                in_progress: "#60a5fa", completed: "#4ade80", queued: "#fbbf24",
              };
              return (
                <div key={visit.id} className="mobile-card"
                  style={{ borderLeft: `3px solid ${statusColors[visit.status] || "#fbbf24"}` }}>
                  {/* Visit Header — Clickable */}
                  <div className="touch-button" onClick={() => {
                    if (["doctor", "admin"].includes(user.role)) navigate(`/m/visit/${visit.id}?patientId=${id}`);
                  }}
                    style={{ marginBottom: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f1f5f9" }}>Visit #{visit.visitNumber}</span>
                      <span style={{ fontSize: "0.76rem", color: "#475569" }}>
                        {new Date(visit.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    {visit.chiefComplaint && <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: "0 0 6px" }}>{visit.chiefComplaint}</p>}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {visit.diagnoses?.map((d: any) => (
                        <span key={d.id} style={{ background: "rgba(59,138,244,0.12)", color: "#60a5fa", padding: "3px 10px", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid rgba(59,138,244,0.15)" }}>{d.name}</span>
                      ))}
                      {visit.prescriptions?.map((rx: any) => (
                        <span key={rx.id} style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", padding: "3px 10px", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid rgba(16,185,129,0.15)" }}>{rx.medicationName}</span>
                      ))}
                      {visit.labOrders?.map((lab: any) => (
                        <span key={lab.id} style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", padding: "3px 10px", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid rgba(251,191,36,0.15)" }}>{lab.testName}</span>
                      ))}
                      {visit.procedures?.map((proc: any) => (
                        <span key={proc.id} style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", padding: "3px 10px", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid rgba(167,139,250,0.15)" }}>{proc.procedureName}</span>
                      ))}
                    </div>
                  </div>

                  {/* Print + Billing bar */}
                  <div style={{
                    display: "flex", gap: "6px", alignItems: "center", paddingTop: "8px",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    {visit.prescriptions?.length > 0 && (
                      <button onClick={() => handlePrint("rx", visit)} className="touch-button"
                        style={{ padding: "4px 10px", borderRadius: "10px", border: "1px solid rgba(16,185,129,0.15)", background: "rgba(16,185,129,0.08)", color: "#34d399", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}>
                        🖨️ Rx
                      </button>
                    )}
                    {visit.labOrders?.length > 0 && (
                      <button onClick={() => handlePrint("lab", visit)} className="touch-button"
                        style={{ padding: "4px 10px", borderRadius: "10px", border: "1px solid rgba(251,191,36,0.15)", background: "rgba(251,191,36,0.08)", color: "#fbbf24", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}>
                        🖨️ Lab
                      </button>
                    )}
                    <button onClick={() => handlePrint("notes", visit)} className="touch-button"
                      style={{ padding: "4px 10px", borderRadius: "10px", border: "1px solid rgba(59,138,244,0.15)", background: "rgba(59,138,244,0.08)", color: "#60a5fa", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}>
                      🖨️ Notes
                    </button>
                    <div style={{ flex: 1 }} />
                    {visit.billing && (
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: visit.billing.status === "paid" ? "#4ade80" : "#fb7185" }}>
                        💰 ${visit.billing.totalAmount} {visit.billing.status === "paid" ? "✅" : ""}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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
            {/* Upload Button */}
            <input type="file" ref={fileInputRef} onChange={handleImageUpload}
              accept="image/*" capture="environment" multiple style={{ display: "none" }} />
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              <button onClick={() => fileInputRef.current?.click()} className="mobile-btn mobile-btn-primary"
                style={{ flex: 1 }}>
                {uploadImageMutation.isPending ? "Uploading..." : "📸 Take Photo / Upload"}
              </button>
            </div>

            {images.length === 0 ? (
              <p style={{ textAlign: "center", color: "#475569", padding: "40px" }}>No photos yet — tap above to add</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                {images.map((img: any) => (
                  <div key={img.id} style={{ borderRadius: "12px", overflow: "hidden", aspectRatio: "1", position: "relative" }}>
                    <img src={img.url || `/uploads/${img.filename}`}
                      alt={img.caption || "Patient photo"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button onClick={() => {
                      if (confirm("Delete this photo?")) deleteImageMutation.mutate(img.id);
                    }}
                      style={{
                        position: "absolute", top: "4px", right: "4px",
                        background: "rgba(0,0,0,0.6)", color: "#fb7185", border: "none",
                        borderRadius: "8px", width: "26px", height: "26px", fontSize: "14px",
                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                      }}>✕</button>
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

      {/* Edit Patient Dialog */}
      <MobileDialog open={showEditPatient} onClose={() => setShowEditPatient(false)} title="Edit Patient">
        <EditPatientForm patient={patient} onDone={() => {
          setShowEditPatient(false);
          queryClient.invalidateQueries({ queryKey: ["patient", id] });
        }} />
      </MobileDialog>
    </div>
  );
}

// ─── Edit Patient Form ──────────────────────────────────────────────
function EditPatientForm({ patient, onDone }: { patient: any; onDone: () => void }) {
  const [form, setForm] = useState({
    firstName: patient.firstName || "",
    fatherName: patient.fatherName || "",
    lastName: patient.lastName || "",
    phone: patient.phone || "",
    gender: patient.gender || "Male",
    dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.split("T")[0] : "",
    city: patient.city || "",
    insurance: patient.insurance || "",
    allergies: patient.allergies || "",
    chronicConditions: patient.chronicConditions || "",
    notes: patient.notes || "",
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patients.update(patient.id, form),
    onSuccess: onDone,
  });

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <div><label style={labelStyle}>First Name</label>
          <input value={form.firstName} onChange={e => set("firstName", e.target.value)} className="mobile-input" /></div>
        <div><label style={labelStyle}>Father Name</label>
          <input value={form.fatherName} onChange={e => set("fatherName", e.target.value)} className="mobile-input" /></div>
      </div>
      <div><label style={labelStyle}>Last Name</label>
        <input value={form.lastName} onChange={e => set("lastName", e.target.value)} className="mobile-input" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <div><label style={labelStyle}>Phone</label>
          <input value={form.phone} onChange={e => set("phone", e.target.value)} className="mobile-input" type="tel" /></div>
        <div><label style={labelStyle}>Gender</label>
          <select value={form.gender} onChange={e => set("gender", e.target.value)} className="mobile-input">
            <option value="Male">Male</option><option value="Female">Female</option>
          </select></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <div><label style={labelStyle}>Date of Birth</label>
          <input type="date" value={form.dateOfBirth} onChange={e => set("dateOfBirth", e.target.value)} className="mobile-input" /></div>
        <div><label style={labelStyle}>City</label>
          <input value={form.city} onChange={e => set("city", e.target.value)} className="mobile-input" /></div>
      </div>
      <div><label style={labelStyle}>Insurance</label>
        <input value={form.insurance} onChange={e => set("insurance", e.target.value)} className="mobile-input" /></div>
      <div><label style={labelStyle}>⚠️ Allergies</label>
        <input value={form.allergies} onChange={e => set("allergies", e.target.value)} className="mobile-input" placeholder="e.g., Penicillin, NSAIDs" /></div>
      <div><label style={labelStyle}>🏥 Chronic Conditions</label>
        <input value={form.chronicConditions} onChange={e => set("chronicConditions", e.target.value)} className="mobile-input" placeholder="e.g., Diabetes, Hypertension" /></div>
      <div><label style={labelStyle}>Notes</label>
        <textarea value={form.notes} onChange={e => set("notes", e.target.value)} className="mobile-input" rows={3} /></div>
      <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}
        className="mobile-btn mobile-btn-primary" style={{ marginTop: "8px" }}>
        {updateMutation.isPending ? "Saving..." : "💾 Save Changes"}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8",
  marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.03em",
};
