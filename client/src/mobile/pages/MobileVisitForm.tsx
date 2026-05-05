import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import MobileHeader from "../components/MobileHeader";
import { useHapticFeedback } from "../hooks/useHapticFeedback";

const STEPS = ["Complaint", "Notes", "Diagnosis", "Rx", "Labs", "Procedures", "Follow-up", "Review"];

export default function MobileVisitForm({ user }: { user: any }) {
  const { visitId } = useParams<{ visitId: string }>();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId") || "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const haptic = useHapticFeedback();
  const [step, setStep] = useState(0);

  // Form state
  const [complaint, setComplaint] = useState("");
  const [notes, setNotes] = useState("");
  const [diagInput, setDiagInput] = useState("");
  const [addedDiagnoses, setAddedDiagnoses] = useState<any[]>([]);
  const [medInput, setMedInput] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medFrequency, setMedFrequency] = useState("");
  const [medDuration, setMedDuration] = useState("");
  const [addedMeds, setAddedMeds] = useState<any[]>([]);
  const [labInput, setLabInput] = useState("");
  const [addedLabs, setAddedLabs] = useState<any[]>([]);
  const [procInput, setProcInput] = useState("");
  const [addedProcs, setAddedProcs] = useState<any[]>([]);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");
  const [addedFollowUps, setAddedFollowUps] = useState<any[]>([]);
  const [referredTo, setReferredTo] = useState("");
  const [referralSpecialty, setReferralSpecialty] = useState("");
  const [referralReason, setReferralReason] = useState("");
  const [addedReferrals, setAddedReferrals] = useState<any[]>([]);
  const [billingAmount, setBillingAmount] = useState("");

  // Autocomplete
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

  // Load existing visit
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
      if (existingVisit.procedures) setAddedProcs(existingVisit.procedures);
      if (existingVisit.billing) setBillingAmount(existingVisit.billing.totalAmount || "");
    }
  }, [existingVisit]);

  // Mutations
  const saveNotes = useMutation({
    mutationFn: () => api.visits.updateNotes(visitId!, { chiefComplaint: complaint, clinicalNotes: notes }),
  });

  const addDiag = useMutation({
    mutationFn: (name: string) => api.visits.addDiagnosis(visitId!, { name }),
    onSuccess: (diag) => { setAddedDiagnoses(p => [...p, diag]); setDiagInput(""); haptic.light(); },
  });

  const addMed = useMutation({
    mutationFn: (name: string) => api.visits.addPrescription(visitId!, {
      medicationName: name, dosage: medDosage, frequency: medFrequency, duration: medDuration,
    }),
    onSuccess: (rx) => {
      setAddedMeds(p => [...p, rx]); setMedInput(""); setMedDosage(""); setMedFrequency(""); setMedDuration("");
      haptic.light();
    },
  });

  const addLab = useMutation({
    mutationFn: (name: string) => api.visits.addLabOrder(visitId!, { testName: name }),
    onSuccess: (lab) => { setAddedLabs(p => [...p, lab]); setLabInput(""); haptic.light(); },
  });

  const addProc = useMutation({
    mutationFn: (name: string) => api.visits.addProcedure(visitId!, { procedureName: name }),
    onSuccess: (proc) => { setAddedProcs(p => [...p, proc]); setProcInput(""); haptic.light(); },
  });

  const addFollowUp = useMutation({
    mutationFn: () => api.followUps.create({
      visitId: visitId!, patientId, scheduledDate: followUpDate, reason: followUpReason,
    }),
    onSuccess: (fu) => { setAddedFollowUps(p => [...p, fu]); setFollowUpDate(""); setFollowUpReason(""); haptic.light(); },
  });

  const addReferral = useMutation({
    mutationFn: () => api.referrals.create({
      visitId: visitId!, patientId, referredTo, specialty: referralSpecialty, reason: referralReason,
    }),
    onSuccess: (ref) => { setAddedReferrals(p => [...p, ref]); setReferredTo(""); setReferralSpecialty(""); setReferralReason(""); haptic.light(); },
  });

  const deleteItem = async (type: string, id: string) => {
    if (type === "diag") { await api.visits.deleteDiagnosis(id); setAddedDiagnoses(p => p.filter(x => x.id !== id)); }
    if (type === "med") { await api.visits.deletePrescription(id); setAddedMeds(p => p.filter(x => x.id !== id)); }
    if (type === "lab") { await api.visits.deleteLabOrder(id); setAddedLabs(p => p.filter(x => x.id !== id)); }
    if (type === "proc") { await api.visits.deleteProcedure(id); setAddedProcs(p => p.filter(x => x.id !== id)); }
    if (type === "fu") { await api.followUps.delete(id); setAddedFollowUps(p => p.filter(x => x.id !== id)); }
    if (type === "ref") { await api.referrals.delete(id); setAddedReferrals(p => p.filter(x => x.id !== id)); }
    haptic.warning();
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

  const chipStyle = (color: string): React.CSSProperties => ({
    padding: "8px 14px", borderRadius: "20px",
    border: `1px solid ${color}30`, background: `${color}15`,
    color, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
  });

  const delBtnStyle: React.CSSProperties = { color: "#fb7185", background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", padding: "4px 8px" };

  return (
    <div className="mobile-animate-in">
      <MobileHeader title={existingVisit ? `Visit #${existingVisit.visitNumber}` : "New Visit"} showBack />

      {/* Step Indicator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", padding: "10px 16px" }}>
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => goStep(i)} title={s}
            style={{
              border: "none", cursor: "pointer", borderRadius: i === step ? "6px" : "50%",
              transition: "all 0.3s ease",
              width: i === step ? "28px" : "7px", height: "7px",
              background: i === step ? "linear-gradient(90deg, #3b8af4, #60a5fa)"
                : i < step ? "#10b981" : "rgba(255,255,255,0.1)",
              boxShadow: i === step ? "0 0 12px rgba(59,138,244,0.4)" : i < step ? "0 0 6px rgba(16,185,129,0.3)" : "none",
            }} />
        ))}
      </div>

      <div style={{ padding: "4px 16px 130px" }}>
        <h2 style={{
          fontSize: "1.05rem", fontWeight: 800, marginBottom: "14px",
          background: "linear-gradient(135deg, #f1f5f9, #93c5fd)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>{STEPS[step]}</h2>

        {/* Step 0: Complaint */}
        {step === 0 && (
          <textarea value={complaint} onChange={e => setComplaint(e.target.value)}
            className="mobile-input" style={{ minHeight: "160px", resize: "vertical" }}
            placeholder="Chief complaint..." autoFocus />
        )}

        {/* Step 1: Notes */}
        {step === 1 && (
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            className="mobile-input" style={{ minHeight: "220px", resize: "vertical" }}
            placeholder="Clinical notes, examination findings..." autoFocus />
        )}

        {/* Step 2: Diagnoses */}
        {step === 2 && (
          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <input value={diagInput} onChange={e => setDiagInput(e.target.value)}
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
            {addedDiagnoses.map(d => (
              <div key={d.id} className="mobile-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", marginBottom: "6px" }}>
                <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{d.name}</span>
                <button onClick={() => deleteItem("diag", d.id)} style={delBtnStyle}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Prescriptions */}
        {step === 3 && (
          <div>
            <input value={medInput} onChange={e => setMedInput(e.target.value)}
              className="mobile-input" placeholder="Medication name..." autoFocus style={{ marginBottom: "8px" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
              <input value={medDosage} onChange={e => setMedDosage(e.target.value)}
                className="mobile-input" placeholder="Dosage" />
              <input value={medFrequency} onChange={e => setMedFrequency(e.target.value)}
                className="mobile-input" placeholder="Frequency" />
            </div>
            <input value={medDuration} onChange={e => setMedDuration(e.target.value)}
              className="mobile-input" placeholder="Duration (e.g., 7 days)" style={{ marginBottom: "8px" }} />
            <button onClick={() => medInput && addMed.mutate(medInput)} disabled={!medInput}
              className="mobile-btn mobile-btn-primary" style={{ opacity: medInput ? 1 : 0.3, marginBottom: "12px" }}>+ Add Medication</button>
            {medSuggestions.length > 0 && medInput && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                {medSuggestions.slice(0, 6).map((s: any) => (
                  <button key={s.id || s.term} onClick={() => addMed.mutate(s.term)}
                    className="touch-button" style={chipStyle("#34d399")}>{s.term}</button>
                ))}
              </div>
            )}
            {addedMeds.map(rx => (
              <div key={rx.id} className="mobile-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", marginBottom: "6px" }}>
                <div>
                  <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{rx.medicationName}</span>
                  {(rx.dosage || rx.frequency || rx.duration) && (
                    <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "2px 0 0" }}>
                      {[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" • ")}
                    </p>
                  )}
                </div>
                <button onClick={() => deleteItem("med", rx.id)} style={delBtnStyle}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Labs */}
        {step === 4 && (
          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <input value={labInput} onChange={e => setLabInput(e.target.value)}
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
            {addedLabs.map(lab => (
              <div key={lab.id} className="mobile-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", marginBottom: "6px" }}>
                <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{lab.testName}</span>
                <button onClick={() => deleteItem("lab", lab.id)} style={delBtnStyle}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Step 5: Procedures */}
        {step === 5 && (
          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <input value={procInput} onChange={e => setProcInput(e.target.value)}
                className="mobile-input" placeholder="Procedure name..." style={{ flex: 1 }} autoFocus />
              <button onClick={() => procInput && addProc.mutate(procInput)} disabled={!procInput}
                className="mobile-btn mobile-btn-primary"
                style={{ width: "auto", padding: "12px 20px", opacity: procInput ? 1 : 0.3 }}>+</button>
            </div>
            {addedProcs.map(proc => (
              <div key={proc.id} className="mobile-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", marginBottom: "6px" }}>
                <span style={{ fontWeight: 600, color: "#e2e8f0" }}>⚕️ {proc.procedureName}</span>
                <button onClick={() => deleteItem("proc", proc.id)} style={delBtnStyle}>✕</button>
              </div>
            ))}
            {addedProcs.length === 0 && (
              <p style={{ textAlign: "center", color: "#475569", padding: "20px", fontSize: "0.88rem" }}>
                No procedures — skip to next step if none needed
              </p>
            )}
          </div>
        )}

        {/* Step 6: Follow-up & Referral */}
        {step === 6 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Follow-up Section */}
            <div className="mobile-card" style={{ padding: "16px" }}>
              <p className="mobile-section-label">📅 Follow-up</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                  className="mobile-input" />
                <input value={followUpReason} onChange={e => setFollowUpReason(e.target.value)}
                  className="mobile-input" placeholder="Reason" />
              </div>
              <button onClick={() => followUpDate && addFollowUp.mutate()} disabled={!followUpDate || addFollowUp.isPending}
                className="mobile-btn mobile-btn-outline" style={{ opacity: followUpDate ? 1 : 0.3, padding: "10px" }}>
                + Add Follow-up
              </button>
              {addedFollowUps.map(fu => (
                <div key={fu.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <span style={{ fontSize: "0.88rem", color: "#e2e8f0" }}>
                    📅 {new Date(fu.scheduledDate).toLocaleDateString()} {fu.reason && `— ${fu.reason}`}
                  </span>
                  <button onClick={() => deleteItem("fu", fu.id)} style={delBtnStyle}>✕</button>
                </div>
              ))}
            </div>

            {/* Referral Section */}
            <div className="mobile-card" style={{ padding: "16px" }}>
              <p className="mobile-section-label">📤 Referral</p>
              <input value={referredTo} onChange={e => setReferredTo(e.target.value)}
                className="mobile-input" placeholder="Referred to (doctor/hospital)" style={{ marginBottom: "8px" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                <input value={referralSpecialty} onChange={e => setReferralSpecialty(e.target.value)}
                  className="mobile-input" placeholder="Specialty" />
                <input value={referralReason} onChange={e => setReferralReason(e.target.value)}
                  className="mobile-input" placeholder="Reason" />
              </div>
              <button onClick={() => referredTo && addReferral.mutate()} disabled={!referredTo || addReferral.isPending}
                className="mobile-btn mobile-btn-outline" style={{ opacity: referredTo ? 1 : 0.3, padding: "10px" }}>
                + Add Referral
              </button>
              {addedReferrals.map(ref => (
                <div key={ref.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <span style={{ fontSize: "0.88rem", color: "#e2e8f0" }}>
                    📤 {ref.referredTo} {ref.specialty && `(${ref.specialty})`}
                  </span>
                  <button onClick={() => deleteItem("ref", ref.id)} style={delBtnStyle}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 7: Review */}
        {step === 7 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {complaint && (
              <div className="mobile-card"><p className="mobile-section-label">Complaint</p>
                <p style={{ margin: 0, color: "#e2e8f0", fontSize: "0.9rem" }}>{complaint}</p></div>
            )}
            {addedDiagnoses.length > 0 && (
              <div className="mobile-card"><p className="mobile-section-label">Diagnoses</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {addedDiagnoses.map(d => <span key={d.id} style={chipStyle("#60a5fa")}>{d.name}</span>)}
                </div></div>
            )}
            {addedMeds.length > 0 && (
              <div className="mobile-card"><p className="mobile-section-label">Medications</p>
                {addedMeds.map(rx => (
                  <p key={rx.id} style={{ margin: "0 0 2px", color: "#e2e8f0", fontSize: "0.88rem" }}>
                    💊 {rx.medicationName} {rx.dosage ? `— ${rx.dosage}` : ""} {rx.frequency || ""} {rx.duration || ""}
                  </p>
                ))}</div>
            )}
            {addedLabs.length > 0 && (
              <div className="mobile-card"><p className="mobile-section-label">Lab Tests</p>
                {addedLabs.map(l => <p key={l.id} style={{ margin: "0 0 2px", color: "#e2e8f0", fontSize: "0.88rem" }}>🧪 {l.testName}</p>)}</div>
            )}
            {addedProcs.length > 0 && (
              <div className="mobile-card"><p className="mobile-section-label">Procedures</p>
                {addedProcs.map(p => <p key={p.id} style={{ margin: "0 0 2px", color: "#e2e8f0", fontSize: "0.88rem" }}>⚕️ {p.procedureName}</p>)}</div>
            )}
            {addedFollowUps.length > 0 && (
              <div className="mobile-card"><p className="mobile-section-label">Follow-ups</p>
                {addedFollowUps.map(f => <p key={f.id} style={{ margin: "0 0 2px", color: "#e2e8f0", fontSize: "0.88rem" }}>📅 {new Date(f.scheduledDate).toLocaleDateString()} — {f.reason}</p>)}</div>
            )}
            {addedReferrals.length > 0 && (
              <div className="mobile-card"><p className="mobile-section-label">Referrals</p>
                {addedReferrals.map(r => <p key={r.id} style={{ margin: "0 0 2px", color: "#e2e8f0", fontSize: "0.88rem" }}>📤 {r.referredTo} ({r.specialty})</p>)}</div>
            )}
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8", marginBottom: "6px" }}>
                💰 Billing Amount (USD)
              </label>
              <input type="number" value={billingAmount} onChange={e => setBillingAmount(e.target.value)}
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
          <button onClick={() => goStep(step - 1)} className="mobile-btn mobile-btn-outline" style={{ flex: 1 }}>← Back</button>
        )}
        {step < STEPS.length - 1 && (
          <button onClick={() => goStep(step + 1)} className="mobile-btn mobile-btn-primary" style={{ flex: step === 0 ? 1 : 2 }}>Next →</button>
        )}
      </div>
    </div>
  );
}
