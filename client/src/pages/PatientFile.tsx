import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import AutocompleteInput from "../components/AutocompleteInput";
import BillVisitDialog from "../components/BillVisitDialog";
import { Pencil, Banknote, Printer, Camera as CameraIcon, Beaker, Pill, Check, X } from "lucide-react";
import PrescriptionPrint from "../components/PrescriptionPrint";
import LabPrint from "../components/LabPrint";
import ClinicalNotesPrint from "../components/ClinicalNotesPrint";
import CameraCapture from "../components/CameraCapture";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { DentalChart } from "../components/patient/DentalChart";
import { TreatmentPlanBuilder } from "../components/patient/TreatmentPlanBuilder";
import PrescriptionsTable from "../components/patient/PrescriptionsTable";
import MultiSelectComboBox from "../components/MultiSelectComboBox";

interface PatientFileProps {
    user: any;
}

export default function PatientFile({ user }: PatientFileProps) {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("visits");
    const [showNewVisit, setShowNewVisit] = useState(false);
    const [activeVisitId, setActiveVisitId] = useState<string | null>(null);
    const [billingVisitId, setBillingVisitId] = useState<string | null>(null);
    const [printVisit, setPrintVisit] = useState<any>(null);
    const [printLabVisit, setPrintLabVisit] = useState<any>(null);
    const [printNotesVisit, setPrintNotesVisit] = useState<any>(null);
    const [showEditPatient, setShowEditPatient] = useState(false);

    // ─── Queries ──────────────────────────────────────────────────────

    const { data: patient, isLoading: patientLoading } = useQuery({
        queryKey: ["patient", id],
        queryFn: () => api.patients.get(id!),
        enabled: !!id,
    });

    const { data: visitHistory = [], isLoading: visitsLoading } = useQuery({
        queryKey: ["visits", "patient", id],
        queryFn: () => api.visits.forPatient(id!),
        enabled: !!id,
    });

    const { data: dentalChart, refetch: refetchChart } = useQuery({
        queryKey: ["dentalChart", "patient", id],
        queryFn: () => api.dentalCharts.activeForPatient(id!),
        enabled: !!id,
    });

    // ─── Create Visit ────────────────────────────────────────────────

    const createVisitMutation = useMutation({
        mutationFn: () =>
            api.visits.create({ patientId: id!, visitType: "consultation" }),
        onSuccess: (visit) => {
            // Optimistically add to cache to prevent flicker
            queryClient.setQueryData(["visits", "patient", id], (old: any) => {
                if (!old) return [visit];
                return [visit, ...old];
            });
            queryClient.invalidateQueries({ queryKey: ["queue"] });
            setActiveVisitId(visit.id);
            setShowNewVisit(true);
            setActiveTab("visits");
        },
    });

    if (patientLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-2xl text-gray-400 animate-pulse">Loading...</p>
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-2xl text-gray-500">Patient not found</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b-2 border-primary-100 shadow-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-6">
                    <button
                        onClick={() => navigate("/")}
                        className="text-3xl text-gray-400 hover:text-primary-600 transition"
                    >
                        ←
                    </button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-extrabold text-primary-900">
                            {patient.firstName} {patient.lastName}
                        </h1>
                        <p className="text-lg text-gray-500">
                            File #{patient.fileNumber} •{" "}
                            {patient.gender || "—"} •{" "}
                            {patient.city || "—"} • {patient.phone || "—"}
                        </p>
                    </div>
                    {["doctor", "admin"].includes(user.role) && (
                        <button
                            onClick={() => createVisitMutation.mutate()}
                            className="px-6 py-3 bg-gradient-to-r from-accent-500 to-accent-600 text-white text-xl font-bold rounded-xl shadow-lg hover:shadow-xl hover:from-accent-600 hover:to-accent-700 transition-all cursor-pointer"
                        >
                            ➕ New Visit
                        </button>
                    )}
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ─── Patient Info Card ─── */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-gray-800">👤 Patient Information</h3>
                                <button
                                    onClick={() => setShowEditPatient(true)}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition"
                                >
                                    ✏️ Edit
                                </button>
                            </div>
                            <dl className="space-y-3">
                                <InfoRow label="Name" value={`${patient.firstName} ${patient.lastName}`} />
                                <InfoRow label="Father" value={patient.fatherName} />
                                <InfoRow label="Gender" value={patient.gender} />
                                <InfoRow label="Phone" value={patient.phone} />
                                <InfoRow label="City" value={patient.city} />
                                <InfoRow label="Marital Status" value={patient.maritalStatus} />
                                <InfoRow label="Total Visits" value={patient.visitCount?.toString()} />
                            </dl>
                            {patient.insurance && (
                                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2">
                                    <span className="text-xl">🛡️</span>
                                    <div>
                                        <p className="text-xs font-semibold text-blue-500 uppercase">Insurance</p>
                                        <p className="text-lg font-bold text-blue-800">{patient.insurance}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Allergies & Chronic Conditions */}
                        {(patient.allergies || patient.chronicConditions) && (
                            <div className="bg-danger-50 rounded-2xl p-6 border border-danger-100">
                                <h3 className="text-xl font-bold text-danger-700 mb-3">⚠️ Alerts</h3>
                                {patient.allergies && (
                                    <div className="mb-3">
                                        <p className="font-semibold text-danger-600">Allergies:</p>
                                        <p className="text-lg">{patient.allergies}</p>
                                    </div>
                                )}
                                {patient.chronicConditions && (
                                    <div>
                                        <p className="font-semibold text-danger-600">Chronic Conditions:</p>
                                        <p className="text-lg">{patient.chronicConditions}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ─── Visit Timeline & History ─── */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <div className="flex items-center justify-between mb-6">
                                    <TabsList className="bg-gray-100 p-1 rounded-xl">
                                        <TabsTrigger
                                            value="visits"
                                            className="px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary-700 data-[state=active]:shadow-sm font-semibold text-gray-500"
                                        >
                                            📅 Visits ({visitHistory.length})
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="odontogram"
                                            className="px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary-700 data-[state=active]:shadow-sm font-semibold text-gray-500"
                                        >
                                            🦷 Odontogram
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="treatment_plans"
                                            className="px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary-700 data-[state=active]:shadow-sm font-semibold text-gray-500"
                                        >
                                            📋 Treatment Plans
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="medications"
                                            className="px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary-700 data-[state=active]:shadow-sm font-semibold text-gray-500"
                                        >
                                            💊 Medications
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="photos"
                                            className="px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary-700 data-[state=active]:shadow-sm font-semibold text-gray-500"
                                        >
                                            📸 Photos
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent value="visits">
                                    {visitsLoading ? (
                                        <p className="text-center py-8 text-gray-400 text-xl">Loading...</p>
                                    ) : visitHistory.length === 0 ? (
                                        <div className="text-center py-16 text-gray-400">
                                            <p className="text-6xl mb-4">📋</p>
                                            <p className="text-xl">No previous visits</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {visitHistory.map((visit: any) => (
                                                <div
                                                    key={visit.id}
                                                    className={`timeline-entry ${visit.status === "in_progress" ? "active" : ""
                                                        }`}
                                                >
                                                    {showNewVisit && activeVisitId === visit.id ? (
                                                        <div className="bg-white rounded-2xl shadow-xl ring-2 ring-primary-500 overflow-hidden mb-4">
                                                            <VisitForm
                                                                visitId={activeVisitId!}
                                                                patientId={id!}
                                                                user={user}
                                                                onPrintRx={(data) => setPrintVisit(data)}
                                                                onPrintLab={(data) => setPrintLabVisit(data)}
                                                                onPrintNotes={(data) => setPrintNotesVisit(data)}
                                                                onClose={() => {
                                                                    setShowNewVisit(false);
                                                                    setActiveVisitId(null);
                                                                    queryClient.invalidateQueries({ queryKey: ["visits", "patient", id] });
                                                                }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className={`bg-gray-50 rounded-xl p-5 transition relative group border border-transparent ${["doctor", "admin"].includes(user.role)
                                                                ? "cursor-pointer hover:bg-primary-50 hover:border-primary-200"
                                                                : ""
                                                                }`}
                                                            onClick={() => {
                                                                if (["doctor", "admin"].includes(user.role)) {
                                                                    setActiveVisitId(visit.id);
                                                                    setShowNewVisit(true);
                                                                }
                                                            }}
                                                        >
                                                            {/* Edit/Pay Actions */}
                                                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {/* Print Rx Button */}
                                                                {visit.prescriptions?.length > 0 && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setPrintVisit(visit); }}
                                                                        className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition"
                                                                        title="Print Prescription"
                                                                    >
                                                                        <Pill size={18} />
                                                                    </button>
                                                                )}

                                                                {/* Print Lab Button */}
                                                                {visit.labOrders?.length > 0 && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setPrintLabVisit(visit); }}
                                                                        className="p-2 bg-cyan-100 text-cyan-600 rounded-lg hover:bg-cyan-200 transition"
                                                                        title="Print Lab Request"
                                                                    >
                                                                        <Beaker size={18} />
                                                                    </button>
                                                                )}

                                                                {/* Print Notes Button */}
                                                                {(visit.clinicalNotes || visit.chiefComplaint) && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setPrintNotesVisit(visit); }}
                                                                        className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition"
                                                                        title="Print Clinical Notes"
                                                                    >
                                                                        <Printer size={18} />
                                                                    </button>
                                                                )}

                                                                {/* Pay Button */}
                                                                {(!visit.billing || visit.billing.status !== "paid") && (
                                                                    <button
                                                                        onClick={() => setBillingVisitId(visit.id)}
                                                                        className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition"
                                                                        title="Collect Payment"
                                                                    >
                                                                        <Banknote size={18} />
                                                                    </button>
                                                                )}

                                                            </div>

                                                            {/* Visit Header */}
                                                            <div className="flex items-center justify-between mb-3">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-lg font-bold text-gray-800">
                                                                        Visit #{visit.visitNumber}
                                                                    </span>
                                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold status-${visit.status}`}>
                                                                        {visit.status === "queued" && "Waiting"}
                                                                        {visit.status === "in_progress" && "In Progress"}
                                                                        {visit.status === "completed" && "Completed"}
                                                                        {visit.status === "billed" && "Billed"}
                                                                    </span>
                                                                </div>
                                                                <span className="text-sm text-gray-500">
                                                                    {new Date(visit.startedAt).toLocaleDateString("en-US", {
                                                                        year: "numeric",
                                                                        month: "long",
                                                                        day: "numeric",
                                                                    })}
                                                                </span>
                                                            </div>

                                                            {/* Chief Complaint */}
                                                            {visit.chiefComplaint && (
                                                                <p className="text-lg text-gray-700 mb-3">
                                                                    <span className="font-semibold">Complaint:</span> {visit.chiefComplaint}
                                                                </p>
                                                            )}

                                                            {/* Clinical Notes */}
                                                            {visit.clinicalNotes && (
                                                                <p className="text-gray-600 mb-3">
                                                                    <span className="font-semibold">Notes:</span> {visit.clinicalNotes}
                                                                </p>
                                                            )}

                                                            {/* Diagnoses */}
                                                            {visit.dentalFindings?.length > 0 && (
                                                                <div className="mb-3">
                                                                    <span className="font-semibold text-gray-700">🦷 Finding: </span>
                                                                    {visit.dentalFindings.map((d: any) => (
                                                                        <span key={d.id} className="inline-block bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-semibold mr-2 mb-1">
                                                                            {d.name}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Prescriptions */}
                                                            {visit.prescriptions?.length > 0 && (
                                                                <div className="mb-3">
                                                                    <span className="font-semibold text-gray-700">💊 Prescription: </span>
                                                                    {visit.prescriptions.map((rx: any) => (
                                                                        <span key={rx.id} className="inline-block bg-accent-100 text-accent-700 px-3 py-1 rounded-full text-sm font-semibold mr-2 mb-1">
                                                                            {rx.medicationName}
                                                                            {rx.dosage ? ` ${rx.dosage}` : ""}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Lab Orders */}
                                                            {visit.labOrders?.length > 0 && (
                                                                <div className="mb-3">
                                                                    <span className="font-semibold text-gray-700">🧪 Lab Tests: </span>
                                                                    {visit.labOrders.map((lab: any) => (
                                                                        <span key={lab.id} className="inline-block bg-warm-100 text-warm-500 px-3 py-1 rounded-full text-sm font-semibold mr-2 mb-1">
                                                                            {lab.testName}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Procedures */}
                                                            {visit.dentalProcedures?.length > 0 && (
                                                                <div className="mb-3">
                                                                    <span className="font-semibold text-gray-700">⚕️ Procedures: </span>
                                                                    {visit.dentalProcedures.map((proc: any) => (
                                                                        <span key={proc.id} className="inline-block bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-semibold mr-2 mb-1">
                                                                            {proc.procedureName}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Billing */}
                                                            {visit.billing && (
                                                                <div className="mt-3 pt-3 border-t border-gray-200">
                                                                    <span className="font-semibold text-gray-700">💰 </span>
                                                                    <span className={`font-bold ${visit.billing.status === "paid"
                                                                        ? "text-accent-600"
                                                                        : "text-danger-600"
                                                                        }`}>
                                                                        ${visit.billing.totalAmount} {visit.billing.currency}
                                                                        {visit.billing.status === "paid" ? " — Paid ✅" : " — Unpaid"}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="odontogram">
                                    <DentalChart
                                        patientId={id!}
                                        chart={dentalChart}
                                        onUpdate={() => refetchChart()}
                                    />
                                </TabsContent>

                                <TabsContent value="treatment_plans">
                                    <TreatmentPlanBuilder patientId={id!} />
                                </TabsContent>
                                <TabsContent value="medications">
                                    <PrescriptionsTable
                                        prescriptions={visitHistory.flatMap((v: any) =>
                                            (v.prescriptions || []).map((p: any) => ({
                                                ...p,
                                                visitId: v.id,
                                                date: v.startedAt
                                            }))
                                        ).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())}
                                        onVisitClick={(visitId) => {
                                            const visit = visitHistory.find((v: any) => v.id === visitId);
                                            if (visit && ["doctor", "admin"].includes(user.role)) {
                                                setActiveVisitId(visitId);
                                                setShowNewVisit(true);
                                            }
                                        }}
                                    />
                                </TabsContent>

                                <TabsContent value="photos">
                                    <PhotoGallery patientId={id!} visitHistory={visitHistory} />
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </div>
            </div>

            {/* Billing Dialog */}
            {
                billingVisitId && (
                    <BillVisitDialog
                        visitId={billingVisitId}
                        onClose={() => {
                            setBillingVisitId(null);
                            queryClient.invalidateQueries({ queryKey: ["visits", "patient", id] });
                        }}
                    />
                )
            }

            {/* Prescription Print Dialog */}
            {
                printVisit && patient && (
                    <PrescriptionPrint
                        patient={patient}
                        visit={printVisit}
                        prescriptions={printVisit.prescriptions || []}
                        diagnoses={printVisit.diagnoses || []}
                        onClose={() => setPrintVisit(null)}
                    />
                )
            }

            {/* Lab Print Dialog */}
            {
                printLabVisit && patient && (
                    <LabPrint
                        patient={patient}
                        visit={printLabVisit}
                        labOrders={printLabVisit.labOrders || []}
                        diagnoses={printLabVisit.diagnoses || []}
                        onClose={() => setPrintLabVisit(null)}
                    />
                )
            }

            {/* Clinical Notes Print Dialog */}
            {
                printNotesVisit && patient && (
                    <ClinicalNotesPrint
                        patient={patient}
                        visit={printNotesVisit}
                        diagnoses={printNotesVisit.diagnoses || []}
                        onClose={() => setPrintNotesVisit(null)}
                    />
                )
            }

            {/* Patient Edit Dialog */}
            {
                showEditPatient && patient && (
                    <PatientEditDialog
                        patient={patient}
                        onClose={() => setShowEditPatient(false)}
                        onSaved={() => {
                            setShowEditPatient(false);
                            queryClient.invalidateQueries({ queryKey: ["patient", id] });
                        }}
                    />
                )
            }
        </div >
    );
}

// ─── Info Row Component ─────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex justify-between items-center py-2 border-b border-gray-50">
            <dt className="text-gray-500 font-medium">{label}</dt>
            <dd className="text-lg font-semibold text-gray-800">{value || "—"}</dd>
        </div>
    );
}

// ─── Visit Form (Inline Clinical Workspace) ─────────────────────────

function VisitForm({
    visitId,
    patientId,
    user,
    onPrintRx,
    onPrintLab,
    onPrintNotes,
    onClose,
}: {
    visitId: string;
    patientId: string;
    user: any;
    onPrintRx: (data: any) => void;
    onPrintLab: (data: any) => void;
    onPrintNotes: (data: any) => void;
    onClose: () => void;
}) {
    const queryClient = useQueryClient();

    // Fetch existing visit data
    const { data: existingVisit, isLoading } = useQuery({
        queryKey: ["visit", visitId],
        queryFn: () => api.visits.get(visitId),
        refetchOnWindowFocus: false,
    });

    // Form state
    const [complaint, setComplaint] = useState("");
    const [notes, setNotes] = useState("");
    const [examination, setExamination] = useState("");
    const [billingAmount, setBillingAmount] = useState("");

    // Item input states
    const [selectedFindings, setSelectedFindings] = useState<string[]>([]);
    const [selectedMedications, setSelectedMedications] = useState<string[]>([]);
    const [medDosage, setMedDosage] = useState("");
    const [medFrequency, setMedFrequency] = useState("");
    const [medDuration, setMedDuration] = useState("");
    const [selectedLabs, setSelectedLabs] = useState<string[]>([]);
    const [selectedProcedures, setSelectedProcedures] = useState<string[]>([]);

    // Follow-up & Referral
    const [followUpDate, setFollowUpDate] = useState("");
    const [followUpReason, setFollowUpReason] = useState("");
    const [referredTo, setReferredTo] = useState("");
    const [referralSpecialty, setReferralSpecialty] = useState("");
    const [referralReason, setReferralReason] = useState("");
    const [addedFollowUps, setAddedFollowUps] = useState<any[]>([]);
    const [addedReferrals, setAddedReferrals] = useState<any[]>([]);

    // Lists of added items
    const [addedFindings, setAddedFindings] = useState<any[]>([]);
    const [editingFindingId, setEditingFindingId] = useState<string | null>(null);
    const [editingFindingValue, setEditingFindingValue] = useState("");
    const [addedMeds, setAddedMeds] = useState<any[]>([]);
    const [addedLabs, setAddedLabs] = useState<any[]>([]);
    const [addedProcs, setAddedProcs] = useState<any[]>([]);
    const [addedImages, setAddedImages] = useState<any[]>([]);
    const [showCamera, setShowCamera] = useState(false);
    const [uploading, setUploading] = useState(false);
    const visitFileInputRef = useRef<HTMLInputElement>(null);

    // Populate form when data is loaded
    useEffect(() => {
        if (existingVisit) {
            setComplaint(existingVisit.chiefComplaint || "");
            setNotes(existingVisit.clinicalNotes || "");
            setExamination(existingVisit.examination || "");

            // Set items if they exist
            if (existingVisit.diagnoses) setAddedFindings(existingVisit.diagnoses);
            if (existingVisit.prescriptions) setAddedMeds(existingVisit.prescriptions);
            if (existingVisit.labOrders) setAddedLabs(existingVisit.labOrders);
            if (existingVisit.procedures) setAddedProcs(existingVisit.procedures);
            if (existingVisit.images) setAddedImages(existingVisit.images);

            // Billing
            if (existingVisit.billing) {
                setBillingAmount(existingVisit.billing.totalAmount || "");
            }
        }
    }, [existingVisit]);

    // ─── Mutations ────────────────────────────────────────────────

    const saveNotesMutation = useMutation({
        mutationFn: () =>
            api.visits.updateNotes(visitId, {
                chiefComplaint: complaint,
                clinicalNotes: notes,
                examination,
            }),
    });

    const addFindingMutation = useMutation({
        mutationFn: async (names: string[]) => {
            // Only add the ones that aren't already in addedFindings
            const newNames = names.filter(name => !addedFindings.some(d => d.name === name));
            const newDiags = [];
            for (const name of newNames) {
                const diag = await api.visits.addFinding(visitId, { name });
                newDiags.push(diag);
            }
            return newDiags;
        },
        onSuccess: (newDiags) => {
            setAddedFindings((prev) => [...prev, ...newDiags]);
            setSelectedFindings([]);
        },
    });

    const updateFindingMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) =>
            api.visits.updateFinding(id, { name }),
        onSuccess: (updatedDiag) => {
            setAddedFindings((prev) =>
                prev.map((d) => (d.id === updatedDiag.id ? updatedDiag : d))
            );
            setEditingFindingId(null);
            setEditingFindingValue("");
        },
    });

    const addPrescriptionMutation = useMutation({
        mutationFn: async () => {
            const newRxs = [];
            for (const medName of selectedMedications) {
                const rx = await api.visits.addPrescription(visitId, {
                    medicationName: medName,
                    dosage: medDosage,
                    frequency: medFrequency,
                    duration: medDuration,
                });
                newRxs.push(rx);
            }
            return newRxs;
        },
        onSuccess: (newRxs) => {
            setAddedMeds((prev) => [...prev, ...newRxs]);
            setSelectedMedications([]);
            setMedDosage("");
            setMedFrequency("");
            setMedDuration("");
        },
    });

    const addLabMutation = useMutation({
        mutationFn: async (testNames: string[]) => {
            const newNames = testNames.filter(name => !addedLabs.some(l => l.testName === name));
            const newLabs = [];
            for (const testName of newNames) {
                const lab = await api.visits.addLabOrder(visitId, { testName });
                newLabs.push(lab);
            }
            return newLabs;
        },
        onSuccess: (newLabs) => {
            setAddedLabs((prev) => [...prev, ...newLabs]);
            setSelectedLabs([]);
        },
    });

    const addProcMutation = useMutation({
        mutationFn: async (procNames: string[]) => {
            const newNames = procNames.filter(name => !addedProcs.some(p => p.procedureName === name));
            const newProcs = [];
            for (const procedureName of newNames) {
                const proc = await api.visits.addProcedure(visitId, { procedureName });
                newProcs.push(proc);
            }
            return newProcs;
        },
        onSuccess: (newProcs) => {
            setAddedProcs((prev) => [...prev, ...newProcs]);
            setSelectedProcedures([]);
        },
    });

    const addFollowUpMutation = useMutation({
        mutationFn: () =>
            api.followUps.create({ visitId, patientId, scheduledDate: followUpDate, reason: followUpReason }),
        onSuccess: (fu) => {
            setAddedFollowUps((prev) => [...prev, fu]);
            setFollowUpDate("");
            setFollowUpReason("");
        },
    });

    const addReferralMutation = useMutation({
        mutationFn: () =>
            api.referrals.create({ visitId, patientId, referredTo, specialty: referralSpecialty, reason: referralReason }),
        onSuccess: (ref) => {
            setAddedReferrals((prev) => [...prev, ref]);
            setReferredTo("");
            setReferralSpecialty("");
            setReferralReason("");
        },
    });

    const completeVisitMutation = useMutation({
        mutationFn: async () => {
            // Save notes first
            await api.visits.updateNotes(visitId, {
                chiefComplaint: complaint,
                clinicalNotes: notes,
                examination,
            });
            // Create or update billing if amount provided
            if (billingAmount) {
                await api.billing.create({
                    visitId,
                    totalAmount: billingAmount,
                    currency: "USD",
                });
            }
            // Mark completed
            await api.visits.updateStatus(visitId, "completed");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["visits", "patient", patientId] });
            queryClient.invalidateQueries({ queryKey: ["queue"] });
            onClose();
        },
    });

    // ─── Delete handlers ──────────────────────────────────────────

    const deleteFinding = async (diagId: string) => {
        await api.visits.deleteFinding(diagId);
        setAddedFindings((prev) => prev.filter((d) => d.id !== diagId));
    };

    const deleteMed = async (rxId: string) => {
        await api.visits.deletePrescription(rxId);
        setAddedMeds((prev) => prev.filter((m) => m.id !== rxId));
    };

    const deleteLab = async (labId: string) => {
        await api.visits.deleteLabOrder(labId);
        setAddedLabs((prev) => prev.filter((l) => l.id !== labId));
    };

    const deleteProc = async (procId: string) => {
        await api.visits.deleteProcedure(procId);
        setAddedProcs((prev) => prev.filter((p) => p.id !== procId));
    };

    const handleUploadImage = async (files: FileList | File | null) => {
        if (!files) return;
        setUploading(true);
        try {
            const fileList = files instanceof FileList ? Array.from(files) : [files];
            for (const file of fileList) {
                const img = await api.images.upload(patientId, file, visitId);
                setAddedImages((prev) => [img, ...prev]);
            }
            queryClient.invalidateQueries({ queryKey: ["images", patientId] });
        } catch (e: any) {
            alert(e.message || "Upload failed");
        } finally {
            setUploading(false);
            setShowCamera(false);
        }
    };

    const deleteImage = async (id: string) => {
        if (!confirm("Delete this image?")) return;
        await api.images.delete(id);
        setAddedImages((prev) => prev.filter((img) => img.id !== id));
        queryClient.invalidateQueries({ queryKey: ["images", patientId] });
    };

    if (isLoading && !existingVisit) {
        return (
            <div className="p-8 text-center text-gray-400">Loading visit details...</div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-primary-50 to-white rounded-2xl border-2 border-primary-200 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-extrabold text-primary-800">
                    📝 {existingVisit ? `Edit Visit #${existingVisit.visitNumber}` : "New Visit"}
                </h3>
                <button
                    onClick={onClose}
                    className="text-2xl text-gray-400 hover:text-gray-600 transition"
                >
                    ✕
                </button>
            </div>

            <div className="space-y-6">
                {/* Chief Complaint */}
                <div>
                    <label className="block text-lg font-bold text-gray-700 mb-2">Chief Complaint</label>
                    <AutocompleteInput
                        category="complaint"
                        value={complaint}
                        onChange={setComplaint}
                        placeholder="Main complaint..."
                    />
                </div>

                {/* Clinical Notes */}
                <div>
                    <label className="block text-lg font-bold text-gray-700 mb-2">Clinical Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-lg focus:border-primary-500 outline-none min-h-[100px] resize-y"
                        placeholder="Examination notes..."
                    />
                </div>

                {/* ─── Diagnoses ─── */}
                <div>
                    <label className="block text-lg font-bold text-gray-700 mb-2">🦷 Finding</label>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <MultiSelectComboBox
                                category="dental_finding"
                                selectedItems={selectedFindings}
                                onChange={setSelectedFindings}
                                placeholder="Select finding..."
                            />
                        </div>
                        <button
                            onClick={() => selectedFindings.length > 0 && addFindingMutation.mutate(selectedFindings)}
                            disabled={selectedFindings.length === 0}
                            className="px-5 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition disabled:opacity-30"
                        >
                            + Add
                        </button>
                    </div>
                    {addedFindings.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {addedFindings.map((d) => (
                                <span
                                    key={d.id}
                                    className={`inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-lg font-semibold ${editingFindingId === d.id ? "ring-2 ring-primary-500 bg-white" : ""
                                        }`}
                                >
                                    {editingFindingId === d.id ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                autoFocus
                                                value={editingFindingValue}
                                                onChange={(e) => setEditingFindingValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        updateFindingMutation.mutate({ id: d.id, name: editingFindingValue });
                                                    } else if (e.key === "Escape") {
                                                        setEditingFindingId(null);
                                                    }
                                                }}
                                                className="bg-transparent border-none outline-none text-primary-900 w-32 md:w-48"
                                            />
                                            <button
                                                onClick={() => updateFindingMutation.mutate({ id: d.id, name: editingFindingValue })}
                                                className="text-green-600 hover:text-green-700"
                                            >
                                                <Check size={18} />
                                            </button>
                                            <button
                                                onClick={() => setEditingFindingId(null)}
                                                className="text-gray-400 hover:text-gray-600"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {d.name}
                                            <div className="flex items-center gap-1.5 ml-1">
                                                <button
                                                    onClick={() => {
                                                        setEditingFindingId(d.id);
                                                        setEditingFindingValue(d.name);
                                                    }}
                                                    className="text-primary-400 hover:text-primary-600 transition"
                                                    title="Edit name"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={() => deleteFinding(d.id)}
                                                    className="text-primary-400 hover:text-danger-500 transition"
                                                    title="Delete"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Medications ─── */}
                <div>
                    <label className="block text-lg font-bold text-gray-700 mb-2">💊 Prescription</label>
                    <div className="flex gap-3 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                            <MultiSelectComboBox
                                category="medication"
                                selectedItems={selectedMedications}
                                onChange={setSelectedMedications}
                                placeholder="Select medications..."
                            />
                        </div>
                        <input
                            type="text"
                            value={medDosage}
                            onChange={(e) => setMedDosage(e.target.value)}
                            placeholder="Dosage"
                            className="w-32 border-2 border-gray-200 rounded-lg px-3 py-3 text-lg focus:border-primary-500 outline-none"
                        />
                        <input
                            type="text"
                            value={medFrequency}
                            onChange={(e) => setMedFrequency(e.target.value)}
                            placeholder="Duration"
                            className="w-32 border-2 border-gray-200 rounded-lg px-3 py-3 text-lg focus:border-primary-500 outline-none"
                        />
                        <button
                            onClick={() => selectedMedications.length > 0 && addPrescriptionMutation.mutate()}
                            disabled={selectedMedications.length === 0}
                            className="px-5 py-3 bg-accent-600 text-white rounded-lg font-bold hover:bg-accent-700 transition disabled:opacity-30"
                        >
                            + Add
                        </button>
                    </div>
                    {addedMeds.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {addedMeds.map((rx) => (
                                <span
                                    key={rx.id}
                                    className="inline-flex items-center gap-2 bg-accent-100 text-accent-700 px-4 py-2 rounded-full text-lg font-semibold"
                                >
                                    {rx.medicationName} {rx.dosage && `— ${rx.dosage}`}
                                    <button
                                        onClick={() => deleteMed(rx.id)}
                                        className="text-accent-400 hover:text-danger-500 text-xl"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Lab Orders ─── */}
                <div>
                    <label className="block text-lg font-bold text-gray-700 mb-2">🧪 Lab Tests</label>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <MultiSelectComboBox
                                category="lab_test"
                                selectedItems={selectedLabs}
                                onChange={setSelectedLabs}
                                placeholder="Select tests..."
                            />
                        </div>
                        <button
                            onClick={() => selectedLabs.length > 0 && addLabMutation.mutate(selectedLabs)}
                            disabled={selectedLabs.length === 0}
                            className="px-5 py-3 bg-warm-500 text-white rounded-lg font-bold hover:bg-warm-400 transition disabled:opacity-30"
                        >
                            + Add
                        </button>
                    </div>
                    {addedLabs.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {addedLabs.map((lab) => (
                                <span
                                    key={lab.id}
                                    className="inline-flex items-center gap-2 bg-warm-100 text-warm-500 px-4 py-2 rounded-full text-lg font-semibold"
                                >
                                    {lab.testName}
                                    <button
                                        onClick={() => deleteLab(lab.id)}
                                        className="text-warm-400 hover:text-danger-500 text-xl"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Procedures ─── */}
                <div>
                    <label className="block text-lg font-bold text-gray-700 mb-2">⚕️ Procedures</label>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <MultiSelectComboBox
                                category="procedure"
                                selectedItems={selectedProcedures}
                                onChange={setSelectedProcedures}
                                placeholder="Select procedures..."
                            />
                        </div>
                        <button
                            onClick={() => selectedProcedures.length > 0 && addProcMutation.mutate(selectedProcedures)}
                            disabled={selectedProcedures.length === 0}
                            className="px-5 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition disabled:opacity-30"
                        >
                            + Add
                        </button>
                    </div>
                    {addedProcs.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {addedProcs.map((proc) => (
                                <span
                                    key={proc.id}
                                    className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-lg font-semibold"
                                >
                                    {proc.procedureName}
                                    <button
                                        onClick={() => deleteProc(proc.id)}
                                        className="text-purple-400 hover:text-danger-500 text-xl"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Follow-up ─── */}
                <div>
                    <label className="block text-lg font-bold text-gray-700 mb-2">📅 Schedule Follow-up</label>
                    <div className="flex gap-3 items-end">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Date</label>
                            <input
                                type="date"
                                value={followUpDate}
                                onChange={(e) => setFollowUpDate(e.target.value)}
                                className="border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-primary-500 outline-none"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Reason</label>
                            <input
                                type="text"
                                value={followUpReason}
                                onChange={(e) => setFollowUpReason(e.target.value)}
                                placeholder="e.g. Check treatment progress"
                                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-primary-500 outline-none"
                            />
                        </div>
                        <button
                            onClick={() => followUpDate && addFollowUpMutation.mutate()}
                            disabled={!followUpDate || addFollowUpMutation.isPending}
                            className="px-5 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 transition disabled:opacity-30"
                        >
                            + Follow-up
                        </button>
                    </div>
                    {addedFollowUps.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {addedFollowUps.map((fu) => (
                                <span key={fu.id} className="inline-flex items-center gap-2 bg-teal-100 text-teal-700 px-4 py-2 rounded-full text-sm font-semibold">
                                    📅 {fu.scheduledDate} — {fu.reason || "Follow-up"}
                                    <button
                                        onClick={async () => { await api.followUps.delete(fu.id); setAddedFollowUps((prev) => prev.filter((f) => f.id !== fu.id)); }}
                                        className="text-teal-400 hover:text-danger-500 text-lg"
                                    >×</button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Referral ─── */}
                <div>
                    <label className="block text-lg font-bold text-gray-700 mb-2">🔄 Referral</label>
                    <div className="flex gap-3 items-end flex-wrap">
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Referred To</label>
                            <input
                                type="text"
                                value={referredTo}
                                onChange={(e) => setReferredTo(e.target.value)}
                                placeholder="Doctor or clinic name"
                                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-primary-500 outline-none"
                            />
                        </div>
                        <div className="w-40">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Specialty</label>
                            <input
                                type="text"
                                value={referralSpecialty}
                                onChange={(e) => setReferralSpecialty(e.target.value)}
                                placeholder="e.g. Cardiology"
                                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-primary-500 outline-none"
                            />
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Reason</label>
                            <input
                                type="text"
                                value={referralReason}
                                onChange={(e) => setReferralReason(e.target.value)}
                                placeholder="Reason for referral"
                                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:border-primary-500 outline-none"
                            />
                        </div>
                        <button
                            onClick={() => referredTo && addReferralMutation.mutate()}
                            disabled={!referredTo || addReferralMutation.isPending}
                            className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition disabled:opacity-30"
                        >
                            + Referral
                        </button>
                    </div>
                    {addedReferrals.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {addedReferrals.map((ref) => (
                                <span key={ref.id} className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-semibold">
                                    🔄 {ref.referredTo} {ref.specialty ? `(${ref.specialty})` : ""}
                                    <button
                                        onClick={async () => { await api.referrals.delete(ref.id); setAddedReferrals((prev) => prev.filter((r) => r.id !== ref.id)); }}
                                        className="text-indigo-400 hover:text-danger-500 text-lg"
                                    >×</button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Images ─── */}
                <div>
                    <label className="block text-lg font-bold text-gray-700 mb-2">📸 Visit Photos</label>
                    <div className="flex gap-4 mb-3">
                        <button
                            onClick={(e) => { e.preventDefault(); visitFileInputRef.current?.click(); }}
                            className="flex-1 border-2 border-dashed border-gray-300 bg-gray-50 rounded-xl p-4 text-center hover:border-primary-400 hover:bg-primary-100 transition font-medium text-gray-600 flex items-center justify-center cursor-pointer"
                        >
                            <input
                                ref={visitFileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => handleUploadImage(e.target.files)}
                            />
                            {uploading ? "Uploading..." : "📁 Upload Photos"}
                        </button>
                        <button
                            onClick={(e) => { e.preventDefault(); setShowCamera(true); }}
                            className="px-8 border-2 border-gray-300 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-primary-400 transition text-gray-700 font-bold bg-white"
                        >
                            <CameraIcon size={24} />
                            Take Photo
                        </button>
                    </div>

                    {addedImages.length > 0 && (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mt-4">
                            {addedImages.map((img) => (
                                <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                                    <img src={img.filePath} alt="Visit Photo" className="w-full h-full object-cover" />
                                    <button
                                        onClick={(e) => { e.preventDefault(); deleteImage(img.id); }}
                                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                                    >×</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Billing ─── */}
                <div>
                    <label className="block text-lg font-bold text-gray-700 mb-2">💰 Amount (USD)</label>
                    <input
                        type="number"
                        value={billingAmount}
                        onChange={(e) => setBillingAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-48 border-2 border-gray-200 rounded-lg px-4 py-3 text-xl focus:border-primary-500 outline-none"
                        step="0.01"
                    />
                </div>

                {/* ─── Actions ─── */}
                <div className="flex flex-wrap gap-4 pt-6 border-t border-primary-100 items-center justify-between">
                    <div className="flex gap-3">
                        {addedMeds.length > 0 && (
                            <button
                                onClick={() => onPrintRx({ ...existingVisit, prescriptions: addedMeds, diagnoses: addedFindings })}
                                className="px-5 py-3 bg-purple-100 text-purple-700 font-bold rounded-xl hover:bg-purple-200 transition flex items-center gap-2"
                            >
                                <Pill size={20} />
                                Print Rx
                            </button>
                        )}
                        {addedLabs.length > 0 && (
                            <button
                                onClick={() => onPrintLab({ ...existingVisit, labOrders: addedLabs, diagnoses: addedFindings })}
                                className="px-5 py-3 bg-cyan-100 text-cyan-700 font-bold rounded-xl hover:bg-cyan-200 transition flex items-center gap-2"
                            >
                                <Beaker size={20} />
                                Print Lab
                            </button>
                        )}
                        {(notes || complaint) && (
                            <button
                                onClick={() => onPrintNotes({ ...existingVisit, chiefComplaint: complaint, clinicalNotes: notes, diagnoses: addedFindings })}
                                className="px-5 py-3 bg-emerald-100 text-emerald-700 font-bold rounded-xl hover:bg-emerald-200 transition flex items-center gap-2"
                            >
                                <Printer size={20} />
                                Print Notes
                            </button>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => saveNotesMutation.mutate()}
                            className="px-8 py-4 bg-gray-100 text-gray-700 text-lg font-semibold rounded-xl hover:bg-gray-200 transition"
                        >
                            💾 Save Draft
                        </button>
                        <button
                            onClick={() => completeVisitMutation.mutate()}
                            disabled={completeVisitMutation.isPending}
                            className="px-10 py-4 bg-gradient-to-r from-accent-500 to-accent-600 text-white text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                        >
                            {completeVisitMutation.isPending
                                ? "Saving..."
                                : "✅ Save & Complete Visit"}
                        </button>
                    </div>
                </div>
            </div>
            {showCamera && (
                <CameraCapture
                    onCapture={(file) => handleUploadImage(file)}
                    onCancel={() => setShowCamera(false)}
                />
            )}
        </div>
    );
}

// ─── Photo Gallery ──────────────────────────────────────────────────

function PhotoGallery({ patientId, visitHistory }: { patientId: string, visitHistory: any[] }) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [lightboxImg, setLightboxImg] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [showCamera, setShowCamera] = useState(false);

    const { data: images = [] } = useQuery({
        queryKey: ["images", patientId],
        queryFn: () => api.images.forPatient(patientId),
    });

    const handleUpload = async (files: FileList | File | null) => {
        if (!files) return;
        const fileList = files instanceof FileList ? Array.from(files) : [files];
        if (fileList.length === 0) return;

        setUploading(true);
        try {
            for (const file of fileList) {
                await api.images.upload(patientId, file);
            }
            queryClient.invalidateQueries({ queryKey: ["images", patientId] });
        } catch (e: any) {
            alert(e.message || "Upload failed");
        } finally {
            setUploading(false);
            setShowCamera(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this image?")) return;
        await api.images.delete(id);
        queryClient.invalidateQueries({ queryKey: ["images", patientId] });
    };

    return (
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📸 Photos</h3>

            {/* Upload Area */}
            <div className="flex gap-4 mb-6">
                <div
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary-400", "bg-primary-50"); }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary-400", "bg-primary-50"); }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove("border-primary-400", "bg-primary-50");
                        handleUpload(e.dataTransfer.files);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition flex flex-col items-center justify-center"
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleUpload(e.target.files)}
                    />
                    {uploading ? (
                        <p className="text-primary-600 font-bold text-lg">Uploading...</p>
                    ) : (
                        <p className="text-gray-500 font-medium text-lg">📁 Drop images here or click to upload</p>
                    )}
                </div>

                <button
                    onClick={() => setShowCamera(true)}
                    className="px-8 border-2 border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-gray-50 hover:border-primary-400 transition text-gray-700 font-bold"
                >
                    <CameraIcon size={32} />
                    <span>Take Photo</span>
                </button>
            </div>

            {showCamera && (
                <CameraCapture
                    onCapture={handleUpload}
                    onCancel={() => setShowCamera(false)}
                />
            )}

            {/* Image Grid */}
            {images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {images.map((img: any) => {
                        const v = visitHistory.find((visit: any) => visit.id === img.visitId);
                        return (
                            <div key={img.id} className="relative group rounded-xl overflow-hidden aspect-square border border-gray-200 shadow-sm">
                                <img
                                    src={img.filePath}
                                    alt={img.caption || "Patient photo"}
                                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition duration-300"
                                    onClick={() => setLightboxImg(img.filePath)}
                                />
                                {/* Visit Badge */}
                                {v && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs font-semibold px-2 py-1 text-center backdrop-blur-sm">
                                        Visit #{v.visitNumber} <br /><span className="text-[10px] text-gray-300">{new Date(v.startedAt).toLocaleDateString()}</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => handleDelete(img.id)}
                                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white text-sm rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center shadow-lg hover:bg-red-600 hover:scale-110"
                                    title="Delete Photo"
                                >
                                    ✕
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {images.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">No photos yet</p>
            )}

            {/* Lightbox */}
            {lightboxImg && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-pointer"
                    onClick={() => setLightboxImg(null)}
                >
                    <img
                        src={lightboxImg}
                        alt="Full size"
                        className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl"
                    />
                </div>
            )}
        </div>
    );
}

// ─── Patient Edit Dialog ────────────────────────────────────────────

function PatientEditDialog({
    patient,
    onClose,
    onSaved,
}: {
    patient: any;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [firstName, setFirstName] = useState(patient.firstName);
    const [lastName, setLastName] = useState(patient.lastName);
    const [fatherName, setFatherName] = useState(patient.fatherName || "");
    const [phone, setPhone] = useState(patient.phone || "");
    const [city, setCity] = useState(patient.city || "");
    const [address, setAddress] = useState(patient.region || "");
    const [maritalStatus, setMaritalStatus] = useState(patient.maritalStatus || "");
    const [allergies, setAllergies] = useState(patient.allergies || "");
    const [chronicConditions, setChronicConditions] = useState(
        patient.chronicConditions || ""
    );
    const [insurance, setInsurance] = useState(patient.insurance || "");
    const [insuranceSuggestions, setInsuranceSuggestions] = useState<string[]>([]);
    const [showInsuranceSuggestions, setShowInsuranceSuggestions] = useState(false);

    const fetchInsuranceSuggestions = async (q: string) => {
        if (q.length < 1) { setInsuranceSuggestions([]); return; }
        try {
            const results = await api.patients.insuranceSuggestions(q);
            setInsuranceSuggestions(results);
            setShowInsuranceSuggestions(results.length > 0);
        } catch { setInsuranceSuggestions([]); }
    };

    const updatePatientMutation = useMutation({
        mutationFn: async () => {
            await api.patients.update(patient.id, {
                firstName,
                lastName,
                fatherName,
                phone,
                city,
                region: address,
                maritalStatus,
                allergies,
                chronicConditions,
                insurance,
            });
        },
        onSuccess: onSaved,
    });

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-gray-800 mb-4">✏️ Edit Patient</h2>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">
                                First Name
                            </label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">
                                Last Name
                            </label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">
                            Father Name
                        </label>
                        <input
                            type="text"
                            value={fatherName}
                            onChange={(e) => setFatherName(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">
                                Phone
                            </label>
                            <input
                                type="text"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">
                                City
                            </label>
                            <input
                                type="text"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">
                            Address / Region
                        </label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">
                            Marital Status
                        </label>
                        <select
                            value={maritalStatus}
                            onChange={(e) => setMaritalStatus(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">Select...</option>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Divorced">Divorced</option>
                            <option value="Widowed">Widowed</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-red-600 mb-1">
                            Allergies
                        </label>
                        <input
                            type="text"
                            value={allergies}
                            onChange={(e) => setAllergies(e.target.value)}
                            className="w-full border-red-200 bg-red-50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-red-600 mb-1">
                            Chronic Conditions
                        </label>
                        <input
                            type="text"
                            value={chronicConditions}
                            onChange={(e) => setChronicConditions(e.target.value)}
                            className="w-full border-red-200 bg-red-50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <div className="relative">
                        <label className="block text-sm font-semibold text-blue-600 mb-1">
                            🛡️ Insurance / Assurance
                        </label>
                        <input
                            type="text"
                            value={insurance}
                            onChange={(e) => {
                                setInsurance(e.target.value);
                                fetchInsuranceSuggestions(e.target.value);
                            }}
                            onFocus={() => insurance && fetchInsuranceSuggestions(insurance)}
                            onBlur={() => setTimeout(() => setShowInsuranceSuggestions(false), 200)}
                            placeholder="e.g. daman, taawniye, moasaset shahid..."
                            className="w-full border-blue-200 bg-blue-50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {showInsuranceSuggestions && insuranceSuggestions.length > 0 && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {insuranceSuggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm font-medium text-gray-700 transition"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            setInsurance(s);
                                            setShowInsuranceSuggestions(false);
                                        }}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => updatePatientMutation.mutate()}
                        disabled={updatePatientMutation.isPending}
                        className="px-6 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                    >
                        {updatePatientMutation.isPending ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}
