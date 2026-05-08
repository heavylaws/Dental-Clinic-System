import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface PrescriptionPrintProps {
    patient: any;
    visit: any;
    prescriptions: any[];
    diagnoses: any[];
    onClose: () => void;
}

export default function PrescriptionPrint({ patient, visit, prescriptions, diagnoses, onClose }: PrescriptionPrintProps) {
    const printRef = useRef<HTMLDivElement>(null);

    const { data: settings } = useQuery({
        queryKey: ["settings"],
        queryFn: () => api.settings.get(),
        staleTime: 60000,
    });

    const clinicName = settings?.clinic_name || settings?.clinicName || "DentalClinic";
    const clinicIcon = settings?.clinic_icon || "🦷";
    const clinicSubtitle = settings?.clinic_subtitle || settings?.clinicSubtitle || "Dental Practice Management System";
    const clinicPhone = settings?.clinic_phone || "";
    const prescriptionTitle = settings?.prescription_title || "Prescription";
    const signatureLabel = settings?.prescription_signature_label || "Doctor's Signature";

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        printWindow.document.write(`
            <html><head>
            <title>Rx - ${patient.firstName} ${patient.lastName}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                @page { size: A5; margin: 10mm; }
                body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 10pt; color: #1e293b; background: #fff; }
                .header { text-align: center; border-bottom: 2px double #2563eb; padding-bottom: 8px; margin-bottom: 10px; }
                .clinic-name { font-size: 15pt; font-weight: 800; color: #1e40af; }
                .clinic-sub { font-size: 8pt; color: #64748b; margin-top: 2px; }
                .patient-bar { display: flex; justify-content: space-between; background: #f1f5f9; border-radius: 5px; padding: 7px 10px; margin-bottom: 10px; font-size: 8.5pt; }
                .patient-bar .lbl { color: #94a3b8; font-weight: 600; font-size: 7pt; text-transform: uppercase; display: block; }
                .patient-bar .val { font-weight: 700; color: #0f172a; }
                .diag-row { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
                .diag-tag { background: #eff6ff; color: #1d4ed8; padding: 2px 9px; border-radius: 999px; font-size: 8pt; font-weight: 600; border: 1px solid #bfdbfe; }
                .sec-title { font-size: 8.5pt; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 3px; border-bottom: 1px solid #dbeafe; margin-bottom: 7px; }
                .rx-item { display: flex; gap: 8px; padding: 7px 9px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 6px; background: #fafbff; page-break-inside: avoid; }
                .rx-num { font-size: 14pt; font-weight: 800; color: #bfdbfe; min-width: 20px; line-height: 1; }
                .rx-name { font-size: 11pt; font-weight: 800; color: #0f172a; margin-bottom: 3px; }
                .rx-meta { display: flex; flex-wrap: wrap; gap: 10px; }
                .rx-meta span { font-size: 8pt; color: #475569; }
                .rx-meta b { color: #94a3b8; font-size: 7pt; text-transform: uppercase; display: block; }
                .sig { margin-top: 22px; display: flex; justify-content: flex-end; }
                .sig-line { width: 130px; border-top: 1px solid #94a3b8; padding-top: 4px; font-size: 7.5pt; color: #64748b; text-align: center; }
                .footer-meta { font-size: 7pt; color: #cbd5e1; text-align: right; margin-top: 4px; }
            </style>
            </head><body>${content.innerHTML}</body></html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
    };

    const visitDate = visit?.startedAt ? new Date(visit.startedAt) : new Date();

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-2xl">
                    <h3 className="font-bold text-gray-700 text-sm">💊 Prescription Preview (A5)</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition text-sm">🖨️ Print</button>
                        <button onClick={onClose} className="px-2 py-1.5 text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                </div>

                <div ref={printRef} className="p-6 text-sm">
                    {/* Header */}
                    <div className="header" style={{ textAlign: "center", borderBottom: "2px double #2563eb", paddingBottom: "8px", marginBottom: "10px" }}>
                        <div className="clinic-name" style={{ fontSize: "15pt", fontWeight: 800, color: "#1e40af" }}>{clinicIcon} {clinicName}</div>
                        <div className="clinic-sub" style={{ fontSize: "8pt", color: "#64748b", marginTop: "2px" }}>
                            {clinicSubtitle}{clinicPhone ? ` • ${clinicPhone}` : ""}
                        </div>
                    </div>

                    {/* Patient Bar */}
                    <div style={{ display: "flex", justifyContent: "space-between", background: "#f1f5f9", borderRadius: "5px", padding: "7px 10px", marginBottom: "10px" }}>
                        <div>
                            <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: "7pt", textTransform: "uppercase", display: "block" }}>Patient</span>
                            <span style={{ fontWeight: 700, color: "#0f172a" }}>{patient.firstName} {patient.lastName}</span>
                        </div>
                        <div>
                            <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: "7pt", textTransform: "uppercase", display: "block" }}>File #</span>
                            <span style={{ fontWeight: 700 }}>{patient.fileNumber}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: "7pt", textTransform: "uppercase", display: "block" }}>Date</span>
                            <span style={{ fontWeight: 700 }}>{visitDate.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                    </div>

                    {/* Diagnosis */}
                    {diagnoses.length > 0 && (
                        <div style={{ marginBottom: "10px" }}>
                            <div style={{ fontSize: "8.5pt", fontWeight: 800, color: "#1e40af", textTransform: "uppercase", paddingBottom: "3px", borderBottom: "1px solid #dbeafe", marginBottom: "6px" }}>Diagnosis</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                {diagnoses.map((d: any, i: number) => (
                                    <span key={i} style={{ background: "#eff6ff", color: "#1d4ed8", padding: "2px 9px", borderRadius: "999px", fontSize: "8pt", fontWeight: 600, border: "1px solid #bfdbfe" }}>{d.name}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Prescriptions */}
                    <div style={{ fontSize: "8.5pt", fontWeight: 800, color: "#1e40af", textTransform: "uppercase", paddingBottom: "3px", borderBottom: "1px solid #dbeafe", marginBottom: "7px" }}>{prescriptionTitle}</div>
                    {prescriptions.map((rx: any, idx: number) => (
                        <div key={rx.id || idx} style={{ display: "flex", gap: "8px", padding: "7px 9px", border: "1px solid #e2e8f0", borderRadius: "6px", marginBottom: "6px", background: idx % 2 === 0 ? "#fafbff" : "#fff", pageBreakInside: "avoid" }}>
                            <div style={{ fontSize: "14pt", fontWeight: 800, color: "#bfdbfe", minWidth: "20px", lineHeight: 1 }}>{idx + 1}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "11pt", fontWeight: 800, color: "#0f172a", marginBottom: "3px" }}>{rx.medicationName}</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                                    {rx.dosage && <div><b style={{ color: "#94a3b8", fontSize: "7pt", textTransform: "uppercase", display: "block" }}>Dosage</b><span style={{ fontSize: "8pt", color: "#475569" }}>{rx.dosage}</span></div>}
                                    {rx.frequency && <div><b style={{ color: "#94a3b8", fontSize: "7pt", textTransform: "uppercase", display: "block" }}>Frequency</b><span style={{ fontSize: "8pt", color: "#475569" }}>{rx.frequency}</span></div>}
                                    {rx.duration && <div><b style={{ color: "#94a3b8", fontSize: "7pt", textTransform: "uppercase", display: "block" }}>Duration</b><span style={{ fontSize: "8pt", color: "#475569" }}>{rx.duration}</span></div>}
                                    {rx.instructions && <div><b style={{ color: "#94a3b8", fontSize: "7pt", textTransform: "uppercase", display: "block" }}>Instructions</b><span style={{ fontSize: "8pt", color: "#475569" }}>{rx.instructions}</span></div>}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Signature */}
                    <div style={{ marginTop: "22px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                        <div style={{ fontSize: "7.5pt", color: "#cbd5e1" }}>Visit #{visit?.visitNumber}</div>
                        <div style={{ width: "130px", borderTop: "1px solid #94a3b8", paddingTop: "4px", fontSize: "7.5pt", color: "#64748b", textAlign: "center" }}>{signatureLabel}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
