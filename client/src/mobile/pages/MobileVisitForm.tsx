import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import MobileHeader from "../components/MobileHeader";
import { useHapticFeedback } from "../hooks/useHapticFeedback";

const STEPS = ["Complaint", "Notes", "Diagnosis", "Rx", "Labs", "Review"];

export default function MobileVisitForm({ user }: { user: any }) {
  const { visitId } = useParams<{ visitId: string }>();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId") || "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const haptic = useHapticFeedback();
  const [step, setStep] = useState(0);

  const [complaint, setComplaint] = useState("");
  const [notes, setNotes] = useState("");
  const [diagInput, setDiagInput] = useState("");
  const [addedDiagnoses, setAddedDiagnoses] = useState<any[]>([]);
  const [medInput, setMedInput] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [addedMeds, setAddedMeds] = useState<any[]>([]);
  const [labInput, setLabInput] = useState("");
  const [addedLabs, setAddedLabs] = useState<any[]>([]);
  const [billingAmount, setBillingAmount] = useState("");

  const { data: diagSuggestions = [] } = useQuery({
    queryKey: ["autocomplete", "diagnosis", diagInput],
    queryFn: () => api.autocomplete.search("diagnosis", diagInput),
    enabled: diagInput.length >= 2,
  });

  const { data: medSuggestions = [] } = useQuery({
    queryKey: ["autocomplete", "medication", medInput],
    queryFn: () => api.autocomplete.search("medication", medInput),
    enabled: medInput.length >= 2,
  });

  const { data: labSuggestions = [] } = useQuery({
    queryKey: ["autocomplete", "lab_test", labInput],
    queryFn: () => api.autocomplete.search("lab_test", labInput),
    enabled: labInput.length >= 2,
  });

  const { data: existingVisit } = useQuery({
    queryKey: ["visit", visitId],
    queryFn: () => api.visits.get(visitId!),
    enabled: !!visitId,
  });

  useEffect(() => {
    if (existingVisit) {
      setComplaint(existingVisit.chiefComplaint || "");
      setNotes(existingVisit.clinicalNotes || "");
      if (existingVisit.diagnoses) setAddedDiagnoses(existingVisit.diagnoses);
      if (existingVisit.prescriptions) setAddedMeds(existingVisit.prescriptions);
      if (existingVisit.labOrders) setAddedLabs(existingVisit.labOrders);
      if (existingVisit.billing) setBillingAmount(existingVisit.billing.totalAmount || "");
    }
  }, [existingVisit]);

  const saveNotes = useMutation({
    mutationFn: () => api.visits.updateNotes(visitId!, { chiefComplaint: complaint, clinicalNotes: notes }),
  });

  const addDiag = useMutation({
    mutationFn: (name: string) => api.visits.addDiagnosis(visitId!, { name }),
    onSuccess: (diag) => { setAddedDiagnoses((prev) => [...prev, diag]); setDiagInput(""); haptic.light(); },
  });

  const deleteDiag = async (id: string) => {
    await api.visits.deleteDiagnosis(id);
    setAddedDiagnoses((prev) => prev.filter((d) => d.id !== id));
  };

  const addMed = useMutation({
    mutationFn: (name: string) => api.visits.addPrescription(visitId!, { medicationName: name, dosage: medDosage }),
    onSuccess: (rx) => { setAddedMeds((prev) => [...prev, rx]); setMedInput(""); setMedDosage(""); haptic.light(); },
  });

  const deleteMed = async (id: string) => {
    await api.visits.deletePrescription(id);
    setAddedMeds((prev) => prev.filter((m) => m.id !== id));
  };

  const addLab = useMutation({
    mutationFn: (name: string) => api.visits.addLabOrder(visitId!, { testName: name }),
    onSuccess: (lab) => { setAddedLabs((prev) => [...prev, lab]); setLabInput(""); haptic.light(); },
  });

  const deleteLab = async (id: string) => {
    await api.visits.deleteLabOrder(id);
    setAddedLabs((prev) => prev.filter((l) => l.id !== id));
  };

  const completeVisit = useMutation({
    mutationFn: async () => {
      await api.visits.updateNotes(visitId!, { chiefComplaint: complaint, clinicalNotes: notes });
      if (billingAmount) await api.billing.create({ visitId: visitId!, totalAmount: billingAmount, currency: "USD" });
      await api.visits.updateStatus(visitId!, "completed");
    },
    onSuccess: () => {
      haptic.success();
      queryClient.invalidateQueries({ queryKey: ["visits", "patient", patientId] });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      navigate(`/m/patient/${patientId}`);
    },
  });

  const goStep = (newStep: number) => {
    if (step <= 1 && newStep > 1) saveNotes.mutate();
    setStep(newStep);
  };

  const chipStyle = (color: string) => ({
    padding: "8px 14px", borderRadius: "20px",
    border: `1px solid ${color}30`,
    background: `${color}15`,
    color, fontSize: "0.82rem", fontWeight: 700 as const,
    cursor: "pointer" as const,
  });

  return (
    <div className="mobile-animate-in">
      <MobileHeader title={existingVisit ? `Visit #${existingVisit.visitNumber}` : "New Visit"} showBack />

      {/* Step Indicator */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: "6px", padding: "12px 20px",
      }}>
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => goStep(i)} title={s}
            style={{
              border: "none", cursor: "pointer", borderRadius: i === step ? "6px" : "50%",
              transition: "all 0.3s ease",
              width: i === step ? "32px" : "8px",
              height: "8px",
              background: i === step
                ? "linear-gradient(90deg, #3b8af4, #60a5fa)"
                : i < step ? "#10b981" : "rgba(255,255,255,0.1)",
              boxShadow: i === step ? "0 0 12px rgba(59,138,244,0.4)" : i < step ? "0 0 8px rgba(16,185,129,0.3)" : "none",
            }} />
        ))}
      </div>

      <div style={{ padding: "4px 16px 130px" }}>
        <h2 style={{
          fontSize: "1.05rem", fontWeight: 800, marginBottom: "14px",
          background: "linear-gradient(135deg, #f1f5f9, #93c5fd)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          {STEPS[step]}
        </h2>

        {/* Step 0: Complaint */}
        {step === 0 && (
          <textarea value={complaint} onChange={(e) => setComplaint(e.target.value)}
            className="mobile-input" style={{ minHeight: "160px", resize: "vertical" }}
            placeholder="Chief complaint..." autoFocus />
        )}

        {/* Step 1: Notes */}
        {step === 1 && (
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            className="mobile-input" style={{ minHeight: "220px", resize: "vertical" }}
            placeholder="Clinical notes, examination findings..." autoFocus />
        )}

        {/* Step 2: Diagnoses */}
        {step === 2 && (
          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <input value={diagInput} onChange={(e) => setDiagInput(e.target.value)}
                className="mobile-input" placeholder="Search diagnosis..." style={{ flex: 1 }} autoFocus />
              <button onClick={() => diagInput && addDiag.mutate(diagInput)} disabled={!diagInput}
                className="mobile-btn mobile-btn-primary"
                style={{ width: "auto", padding: "12px 20px", opacity: diagInput ? 1 : 0.3 }}>+</button>
            </div>
            {diagSuggestions.length > 0 && diagInput && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                {diagSuggestions.slice(0, 8).map((s: any) => (
                  <button key={s.id || s.term} onClick={() => addDiag.mutate(s.term)}
                    className="touch-button" style={chipStyle("#60a5fa")}>{s.term}</button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {addedDiagnoses.map((d) => (
                <div key={d.id} className="mobile-card"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
                  <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{d.name}</span>
                  <button onClick={() => deleteDiag(d.id)}
                    style={{ color: "#fb7185", background: "transparent", border: "none", fontSize: "18px", cursor: "pointer" }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Prescriptions */}
        {step === 3 && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              <input value={medInput} onChange={(e) => setMedInput(e.target.value)}
                className="mobile-input" placeholder="Medication name..." autoFocus />
              <input value={medDosage} onChange={(e) => setMedDosage(e.target.value)}
                className="mobile-input" placeholder="Dosage (e.g., 500mg, twice daily)" />
              <button onClick={() => medInput && addMed.mutate(medInput)} disabled={!medInput}
                className="mobile-btn mobile-btn-primary" style={{ opacity: medInput ? 1 : 0.3 }}>+ Add Medication</button>
            </div>
            {medSuggestions.length > 0 && medInput && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                {medSuggestions.slice(0, 6).map((s: any) => (
                  <button key={s.id || s.term} onClick={() => addMed.mutate(s.term)}
                    className="touch-button" style={chipStyle("#34d399")}>{s.term}</button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {addedMeds.map((rx) => (
                <div key={rx.id} className="mobile-card"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
                  <div>
                    <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{rx.medicationName}</span>
                    {rx.dosage && <span style={{ color: "#64748b", fontSize: "0.82rem" }}> — {rx.dosage}</span>}
                  </div>
                  <button onClick={() => deleteMed(rx.id)}
                    style={{ color: "#fb7185", background: "transparent", border: "none", fontSize: "18px", cursor: "pointer" }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Labs */}
        {step === 4 && (
          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <input value={labInput} onChange={(e) => setLabInput(e.target.value)}
                className="mobile-input" placeholder="Lab test name..." style={{ flex: 1 }} autoFocus />
              <button onClick={() => labInput && addLab.mutate(labInput)} disabled={!labInput}
                className="mobile-btn mobile-btn-primary"
                style={{ width: "auto", padding: "12px 20px", opacity: labInput ? 1 : 0.3 }}>+</button>
            </div>
            {labSuggestions.length > 0 && labInput && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                {labSuggestions.slice(0, 6).map((s: any) => (
                  <button key={s.id || s.term} onClick={() => addLab.mutate(s.term)}
                    className="touch-button" style={chipStyle("#fbbf24")}>{s.term}</button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {addedLabs.map((lab) => (
                <div key={lab.id} className="mobile-card"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
                  <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{lab.testName}</span>
                  <button onClick={() => deleteLab(lab.id)}
                    style={{ color: "#fb7185", background: "transparent", border: "none", fontSize: "18px", cursor: "pointer" }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {complaint && (
              <div className="mobile-card">
                <p className="mobile-section-label">Complaint</p>
                <p style={{ margin: 0, color: "#e2e8f0" }}>{complaint}</p>
              </div>
            )}
            {addedDiagnoses.length > 0 && (
              <div className="mobile-card">
                <p className="mobile-section-label">Diagnoses</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {addedDiagnoses.map((d) => (
                    <span key={d.id} style={{ background: "rgba(59,138,244,0.12)", color: "#60a5fa", padding: "4px 12px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600, border: "1px solid rgba(59,138,244,0.15)" }}>
                      {d.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {addedMeds.length > 0 && (
              <div className="mobile-card">
                <p className="mobile-section-label">Medications</p>
                {addedMeds.map((rx) => (
                  <p key={rx.id} style={{ margin: "0 0 2px", color: "#e2e8f0", fontSize: "0.88rem" }}>
                    💊 {rx.medicationName} {rx.dosage ? `— ${rx.dosage}` : ""}
                  </p>
                ))}
              </div>
            )}
            {addedLabs.length > 0 && (
              <div className="mobile-card">
                <p className="mobile-section-label">Lab Tests</p>
                {addedLabs.map((lab) => (
                  <p key={lab.id} style={{ margin: "0 0 2px", color: "#e2e8f0", fontSize: "0.88rem" }}>🧪 {lab.testName}</p>
                ))}
              </div>
            )}
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8", marginBottom: "6px" }}>
                💰 Billing Amount (USD)
              </label>
              <input type="number" value={billingAmount} onChange={(e) => setBillingAmount(e.target.value)}
                className="mobile-input" placeholder="0.00" inputMode="decimal" />
            </div>
            <button onClick={() => completeVisit.mutate()} disabled={completeVisit.isPending}
              className="mobile-btn mobile-btn-success" style={{ marginTop: "8px" }}>
              {completeVisit.isPending ? "Completing..." : "✅ Complete Visit"}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 80,
        background: "rgba(15,23,42,0.95)", backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "12px 16px", paddingBottom: `calc(12px + env(safe-area-inset-bottom))`,
        display: "flex", gap: "10px",
      }}>
        {step > 0 && (
          <button onClick={() => goStep(step - 1)} className="mobile-btn mobile-btn-outline" style={{ flex: 1 }}>
            ← Back
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button onClick={() => goStep(step + 1)} className="mobile-btn mobile-btn-primary" style={{ flex: step === 0 ? 1 : 2 }}>
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
