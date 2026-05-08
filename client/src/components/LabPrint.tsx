import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface LabPrintProps {
    patient: any;
    visit: any;
    labOrders: any[];
    diagnoses: any[];
    onClose: () => void;
}

export default function LabPrint({ patient, visit, labOrders, diagnoses, onClose }: LabPrintProps) {
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
    const labTitle = settings?.lab_request_title || "Laboratory Examination Request";
    const signatureLabel = settings?.lab_signature_label || "Medical Practitioner";

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        printWindow.document.write(`
            <html><head>
            <title>Lab Request - ${patient.firstName} ${patient.lastName}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                @page { size: A5; margin: 10mm; }
                body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 10pt; color: #0f172a; background: #fff; }
                .header { text-align: center; border-bottom: 2px double #0891b2; padding-bottom: 8px; margin-bottom: 10px; }
                .clinic-name { font-size: 15pt; font-weight: 800; color: #0e7490; }
                .clinic-sub { font-size: 8pt; color: #64748b; margin-top: 2px; }
                .doc-type { font-size: 9pt; font-weight: 800; color: #0891b2; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 5px; }
                .patient-bar { display: flex; justify-content: space-between; background: #f0f9ff; border-radius: 5px; padding: 7px 10px; margin-bottom: 10px; border: 1px solid #e0f2fe; }
                .lbl { color: #94a3b8; font-weight: 600; font-size: 7pt; text-transform: uppercase; display: block; }
                .val { font-weight: 700; color: #0f172a; font-size: 9pt; }
                .diag-row { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
                .diag-tag { background: #f0f9ff; color: #0e7490; padding: 2px 9px; border-radius: 999px; font-size: 8pt; font-weight: 600; border: 1px solid #bae6fd; }
                .sec-title { font-size: 8.5pt; font-weight: 800; color: #0891b2; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 3px; border-bottom: 1px solid #bae6fd; margin-bottom: 8px; }
                .lab-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; margin-bottom: 16px; }
                .lab-chip { display: flex; align-items: center; gap: 7px; padding: 7px 10px; border: 1.5px solid #bae6fd; border-radius: 6px; background: #f0f9ff; page-break-inside: avoid; }
                .lab-num { font-size: 11pt; font-weight: 800; color: #38bdf8; min-width: 18px; }
                .lab-name { font-size: 9pt; font-weight: 700; color: #0f172a; line-height: 1.3; }
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
                    <h3 className="font-bold text-gray-700 text-sm">🧪 Lab Request Preview (A5)</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="px-4 py-1.5 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 transition text-sm">🖨️ Print</button>
                        <button onClick={onClose} className="px-2 py-1.5 text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                </div>

                <div ref={printRef} className="p-6 text-sm">
                    {/* Header */}
                    <div className="header" style={{ textAlign: "center", borderBottom: "2px double #0891b2", paddingBottom: "8px", marginBottom: "10px" }}>
                        <div style={{ fontSize: "15pt", fontWeight: 800, color: "#0e7490" }}>{clinicIcon} {clinicName}</div>
                        <div style={{ fontSize: "8pt", color: "#64748b", marginTop: "2px" }}>
                            {clinicSubtitle}{clinicPhone ? ` • ${clinicPhone}` : ""}
                        </div>
                        <div style={{ fontSize: "9pt", fontWeight: 800, color: "#0891b2", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "5px" }}>
                            {labTitle}
                        </div>
                    </div>

                    {/* Patient Bar */}
                    <div style={{ display: "flex", justifyContent: "space-between", background: "#f0f9ff", borderRadius: "5px", padding: "7px 10px", marginBottom: "10px", border: "1px solid #e0f2fe" }}>
                        <div>
                            <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: "7pt", textTransform: "uppercase", display: "block" }}>Patient</span>
                            <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "9pt" }}>{patient.firstName} {patient.lastName}</span>
                        </div>
                        <div>
                            <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: "7pt", textTransform: "uppercase", display: "block" }}>File #</span>
                            <span style={{ fontWeight: 700, fontSize: "9pt" }}>{patient.fileNumber}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: "7pt", textTransform: "uppercase", display: "block" }}>Date</span>
                            <span style={{ fontWeight: 700, fontSize: "9pt" }}>{visitDate.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                    </div>

                    {/* Diagnosis */}
                    {diagnoses.length > 0 && (
                        <div style={{ marginBottom: "10px" }}>
                            <div style={{ fontSize: "8.5pt", fontWeight: 800, color: "#0891b2", textTransform: "uppercase", paddingBottom: "3px", borderBottom: "1px solid #bae6fd", marginBottom: "6px" }}>Clinical Diagnosis</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                {diagnoses.map((d: any, i: number) => (
                                    <span key={i} style={{ background: "#f0f9ff", color: "#0e7490", padding: "2px 9px", borderRadius: "999px", fontSize: "8pt", fontWeight: 600, border: "1px solid #bae6fd" }}>{d.name}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Lab Tests Grid */}
                    <div style={{ fontSize: "8.5pt", fontWeight: 800, color: "#0891b2", textTransform: "uppercase", paddingBottom: "3px", borderBottom: "1px solid #bae6fd", marginBottom: "8px" }}>Requested Tests</div>
                    {labOrders.length === 0 ? (
                        <p style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "8pt", padding: "8px 0" }}>No lab tests ordered.</p>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "5px", marginBottom: "16px" }}>
                            {labOrders.map((lab: any, idx: number) => (
                                <div key={lab.id || idx} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "7px 10px", border: "1.5px solid #bae6fd", borderRadius: "6px", background: "#f0f9ff" }}>
                                    <span style={{ fontSize: "11pt", fontWeight: 800, color: "#38bdf8", minWidth: "18px" }}>{idx + 1}</span>
                                    <span style={{ fontSize: "9pt", fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{lab.testName}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Signature */}
                    <div style={{ marginTop: "22px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                        <div style={{ fontSize: "7pt", color: "#cbd5e1" }}>Visit #{visit?.visitNumber}</div>
                        <div style={{ width: "130px", borderTop: "1px solid #94a3b8", paddingTop: "4px", fontSize: "7.5pt", color: "#64748b", textAlign: "center" }}>{signatureLabel}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
