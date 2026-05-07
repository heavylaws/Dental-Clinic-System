import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface ClinicalNotesPrintProps {
    patient: any;
    visit: any;
    diagnoses: any[];
    onClose: () => void;
}

export default function ClinicalNotesPrint({ patient, visit, diagnoses, onClose }: ClinicalNotesPrintProps) {
    const printRef = useRef<HTMLDivElement>(null);

    const { data: settings } = useQuery({
        queryKey: ["settings"],
        queryFn: () => api.settings.get(),
        staleTime: 60000,
    });

    const clinicName = settings?.clinic_name || "DentalClinic";
    const clinicSubtitle = settings?.clinic_subtitle || "Dermatology & Skin Care Center";
    const clinicPhone = settings?.clinic_phone || "";

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        printWindow.document.write(`
            <html><head>
            <title>Notes - ${patient.firstName} ${patient.lastName}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                @page { size: A5; margin: 10mm; }
                body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 10pt; color: #0f172a; background: #fff; }
                .header { text-align: center; border-bottom: 2px double #059669; padding-bottom: 8px; margin-bottom: 10px; }
                .clinic-name { font-size: 15pt; font-weight: 800; color: #047857; }
                .clinic-sub { font-size: 8pt; color: #64748b; margin-top: 2px; }
                .doc-type { font-size: 9pt; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 5px; }
                .patient-bar { display: flex; justify-content: space-between; background: #f0fdf4; border-radius: 5px; padding: 7px 10px; margin-bottom: 10px; border: 1px solid #bbf7d0; }
                .lbl { color: #94a3b8; font-weight: 600; font-size: 7pt; text-transform: uppercase; display: block; }
                .val { font-weight: 700; color: #0f172a; font-size: 9pt; }
                .diag-row { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
                .diag-tag { background: #d1fae5; color: #065f46; padding: 2px 9px; border-radius: 999px; font-size: 8pt; font-weight: 600; border: 1px solid #6ee7b7; }
                .sec-title { font-size: 8.5pt; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 3px; border-bottom: 1px solid #d1fae5; margin-bottom: 6px; }
                .sec-body { font-size: 9.5pt; color: #334155; line-height: 1.65; white-space: pre-wrap; background: #f8fafc; padding: 9px 11px; border-radius: 5px; border-left: 3px solid #6ee7b7; margin-bottom: 10px; }
                .sig { margin-top: 22px; display: flex; justify-content: space-between; align-items: flex-end; }
                .sig-line { width: 130px; border-top: 1px solid #94a3b8; padding-top: 4px; font-size: 7.5pt; color: #64748b; text-align: center; }
                .footer-meta { font-size: 7pt; color: #cbd5e1; }
            </style>
            </head><body>${content.innerHTML}</body></html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
    };

    const visitDate = visit?.startedAt ? new Date(visit.startedAt) : new Date();

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-2xl">
                    <h3 className="font-bold text-gray-700 text-sm">📋 Clinical Notes Preview (A5)</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition text-sm">🖨️ Print</button>
                        <button onClick={onClose} className="px-2 py-1.5 text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                </div>

                <div ref={printRef} className="p-6 text-sm">
                    {/* Header */}
                    <div className="header" style={{ textAlign: "center", borderBottom: "2px double #059669", paddingBottom: "8px", marginBottom: "10px" }}>
                        <div style={{ fontSize: "15pt", fontWeight: 800, color: "#047857" }}>🩺 {clinicName}</div>
                        <div style={{ fontSize: "8pt", color: "#64748b", marginTop: "2px" }}>
                            {clinicSubtitle}{clinicPhone ? ` • ${clinicPhone}` : ""}
                        </div>
                        <div style={{ fontSize: "9pt", fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "5px" }}>
                            Clinical Notes
                        </div>
                    </div>

                    {/* Patient Bar */}
                    <div style={{ display: "flex", justifyContent: "space-between", background: "#f0fdf4", borderRadius: "5px", padding: "7px 10px", marginBottom: "10px", border: "1px solid #bbf7d0" }}>
                        <div>
                            <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: "7pt", textTransform: "uppercase", display: "block" }}>Patient</span>
                            <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "9pt" }}>{patient.firstName} {patient.lastName}</span>
                            {patient.fatherName && <span style={{ fontSize: "7.5pt", color: "#64748b", display: "block" }}>f. {patient.fatherName}</span>}
                        </div>
                        <div>
                            <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: "7pt", textTransform: "uppercase", display: "block" }}>File #</span>
                            <span style={{ fontWeight: 700, fontSize: "9pt" }}>{patient.fileNumber}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: "7pt", textTransform: "uppercase", display: "block" }}>Date</span>
                            <span style={{ fontWeight: 700, fontSize: "9pt" }}>{visitDate.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>
                            <span style={{ fontSize: "7.5pt", color: "#64748b", display: "block" }}>Visit #{visit?.visitNumber}</span>
                        </div>
                    </div>

                    {/* Diagnosis */}
                    {diagnoses.length > 0 && (
                        <div style={{ marginBottom: "10px" }}>
                            <div style={{ fontSize: "8.5pt", fontWeight: 800, color: "#059669", textTransform: "uppercase", paddingBottom: "3px", borderBottom: "1px solid #d1fae5", marginBottom: "6px" }}>Diagnosis</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                {diagnoses.map((d: any, i: number) => (
                                    <span key={i} style={{ background: "#d1fae5", color: "#065f46", padding: "2px 9px", borderRadius: "999px", fontSize: "8pt", fontWeight: 600, border: "1px solid #6ee7b7" }}>{d.name}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Chief Complaint */}
                    {visit?.chiefComplaint && (
                        <div style={{ marginBottom: "10px" }}>
                            <div style={{ fontSize: "8.5pt", fontWeight: 800, color: "#059669", textTransform: "uppercase", paddingBottom: "3px", borderBottom: "1px solid #d1fae5", marginBottom: "6px" }}>Chief Complaint</div>
                            <div style={{ fontSize: "9.5pt", color: "#334155", lineHeight: 1.65, background: "#f8fafc", padding: "9px 11px", borderRadius: "5px", borderLeft: "3px solid #6ee7b7" }}>
                                {visit.chiefComplaint}
                            </div>
                        </div>
                    )}

                    {/* Clinical Notes */}
                    {visit?.clinicalNotes && (
                        <div style={{ marginBottom: "10px" }}>
                            <div style={{ fontSize: "8.5pt", fontWeight: 800, color: "#059669", textTransform: "uppercase", paddingBottom: "3px", borderBottom: "1px solid #d1fae5", marginBottom: "6px" }}>Clinical Notes</div>
                            <div style={{ fontSize: "9.5pt", color: "#334155", lineHeight: 1.65, whiteSpace: "pre-wrap", background: "#f8fafc", padding: "9px 11px", borderRadius: "5px", borderLeft: "3px solid #6ee7b7" }}>
                                {visit.clinicalNotes}
                            </div>
                        </div>
                    )}

                    {/* Examination */}
                    {visit?.examination && (
                        <div style={{ marginBottom: "10px" }}>
                            <div style={{ fontSize: "8.5pt", fontWeight: 800, color: "#059669", textTransform: "uppercase", paddingBottom: "3px", borderBottom: "1px solid #d1fae5", marginBottom: "6px" }}>Examination</div>
                            <div style={{ fontSize: "9.5pt", color: "#334155", lineHeight: 1.65, whiteSpace: "pre-wrap", background: "#f8fafc", padding: "9px 11px", borderRadius: "5px", borderLeft: "3px solid #6ee7b7" }}>
                                {visit.examination}
                            </div>
                        </div>
                    )}

                    {/* Signature */}
                    <div style={{ marginTop: "22px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                        <div style={{ fontSize: "7pt", color: "#cbd5e1" }}>Generated: {new Date().toLocaleDateString()}</div>
                        <div style={{ width: "130px", borderTop: "1px solid #94a3b8", paddingTop: "4px", fontSize: "7.5pt", color: "#64748b", textAlign: "center" }}>Medical Practitioner</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
