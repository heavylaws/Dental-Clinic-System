import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface ReferralPrintProps {
    patient: any;
    referral: any;
    onClose: () => void;
}

export default function ReferralPrint({ patient, referral, onClose }: ReferralPrintProps) {
    const printRef = useRef<HTMLDivElement>(null);

    const { data: settings } = useQuery({
        queryKey: ["settings"],
        queryFn: () => api.settings.get(),
        staleTime: 60000,
    });

    const clinicName = settings?.clinic_name || settings?.clinicName || "DentalClinic";
    const clinicIcon = settings?.clinic_icon || "🦷";
    const clinicPhone = settings?.clinic_phone || settings?.phone || "";
    const clinicAddress = settings?.clinic_address || settings?.address || "";
    const doctorName = settings?.doctor_name || settings?.doctorName || "";
    const licenseNumber = settings?.licenseNumber || settings?.license_number || "";

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;
        printWindow.document.write(`
            <html><head>
            <title>Referral - ${patient.firstName} ${patient.lastName}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                @page { size: A4; margin: 20mm; }
                body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 11pt; color: #1e293b; background: #fff; line-height: 1.6; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e40af; padding-bottom: 14px; margin-bottom: 20px; }
                .clinic-name { font-size: 18pt; font-weight: 800; color: #1e40af; }
                .clinic-info { font-size: 9pt; color: #64748b; margin-top: 4px; line-height: 1.5; }
                .ref-label { font-size: 22pt; font-weight: 800; color: #1e40af; letter-spacing: 1px; }
                .date-line { font-size: 9pt; color: #64748b; text-align: right; }
                .to-section { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 12px 16px; margin-bottom: 16px; border-radius: 4px; }
                .to-label { font-size: 8.5pt; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
                .to-name { font-size: 13pt; font-weight: 700; color: #0c4a6e; }
                .patient-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
                .box-title { font-size: 8.5pt; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 10pt; }
                .info-item { display: flex; gap: 6px; }
                .info-lbl { color: #64748b; min-width: 80px; }
                .info-val { font-weight: 600; color: #0f172a; }
                .body-section { margin-bottom: 16px; }
                .section-title { font-size: 9pt; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; margin-bottom: 6px; }
                .section-content { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; font-size: 10.5pt; color: #0f172a; min-height: 40px; }
                .footer { margin-top: 40px; display: flex; justify-content: flex-end; }
                .sig-block { text-align: center; }
                .sig-blank { width: 180px; border-bottom: 1px solid #1e293b; margin-bottom: 6px; height: 40px; }
                .sig-name { font-size: 10pt; font-weight: 700; color: #1e293b; }
                .sig-title { font-size: 8pt; color: #64748b; }
                .page-footer { margin-top: 30px; padding-top: 10px; border-top: 1px dashed #e2e8f0; font-size: 7.5pt; color: #94a3b8; text-align: center; }
            </style>
            </head><body>${content.innerHTML}</body></html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
    };

    const today = new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
    const dob = patient.dateOfBirth
        ? new Date(patient.dateOfBirth).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
        : "—";
    const age = patient.dateOfBirth
        ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
        : null;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-2xl">
                    <h3 className="font-bold text-gray-700 text-sm">📋 Referral Letter Preview (A4)</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition text-sm">🖨️ Print</button>
                        <button onClick={onClose} className="px-2 py-1.5 text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                </div>

                <div ref={printRef} className="p-8 text-sm">
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #1e40af", paddingBottom: "14px", marginBottom: "20px" }}>
                        <div>
                            <div style={{ fontSize: "18pt", fontWeight: 800, color: "#1e40af" }}>{clinicIcon} {clinicName}</div>
                            <div style={{ fontSize: "9pt", color: "#64748b", marginTop: "4px", lineHeight: 1.5 }}>
                                {clinicAddress && <div>{clinicAddress}</div>}
                                {clinicPhone && <div>Tel: {clinicPhone}</div>}
                                {licenseNumber && <div>License: {licenseNumber}</div>}
                            </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "22pt", fontWeight: 800, color: "#1e40af" }}>REFERRAL</div>
                            <div style={{ fontSize: "9pt", color: "#64748b" }}>Date: {today}</div>
                        </div>
                    </div>

                    {/* To Section */}
                    <div style={{ background: "#f0f9ff", borderLeft: "4px solid #0ea5e9", padding: "12px 16px", marginBottom: "16px", borderRadius: "4px" }}>
                        <div style={{ fontSize: "8.5pt", fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Referring To</div>
                        <div style={{ fontSize: "13pt", fontWeight: 700, color: "#0c4a6e" }}>{referral.referredTo || "—"}</div>
                        {referral.specialty && <div style={{ fontSize: "10pt", color: "#0369a1", marginTop: "2px" }}>Specialty: {referral.specialty}</div>}
                    </div>

                    {/* Patient Info */}
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px" }}>
                        <div style={{ fontSize: "8.5pt", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", borderBottom: "1px solid #f1f5f9", paddingBottom: "6px" }}>Patient Information</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "10pt" }}>
                            <div><span style={{ color: "#64748b" }}>Full Name: </span><strong>{patient.firstName} {patient.fatherName ? `${patient.fatherName} ` : ""}{patient.lastName}</strong></div>
                            <div><span style={{ color: "#64748b" }}>File #: </span><strong>{patient.fileNumber}</strong></div>
                            <div><span style={{ color: "#64748b" }}>Date of Birth: </span><strong>{dob}{age !== null ? ` (${age} yrs)` : ""}</strong></div>
                            <div><span style={{ color: "#64748b" }}>Gender: </span><strong style={{ textTransform: "capitalize" }}>{patient.gender || "—"}</strong></div>
                            <div><span style={{ color: "#64748b" }}>Phone: </span><strong>{patient.phone || "—"}</strong></div>
                            {patient.insurance && <div><span style={{ color: "#64748b" }}>Insurance: </span><strong>{patient.insurance}</strong></div>}
                        </div>
                        {(patient.allergies || patient.chronicConditions) && (
                            <div style={{ marginTop: "8px", padding: "6px 10px", background: "#fff7ed", borderRadius: "4px", border: "1px solid #fed7aa", fontSize: "9.5pt" }}>
                                ⚠️ {patient.allergies ? `Allergies: ${patient.allergies}. ` : ""}{patient.chronicConditions ? `Conditions: ${patient.chronicConditions}.` : ""}
                            </div>
                        )}
                    </div>

                    {/* Referral Reason */}
                    <div style={{ marginBottom: "16px" }}>
                        <div style={{ fontSize: "9pt", fontWeight: 800, textTransform: "uppercase", color: "#475569", letterSpacing: "0.5px", marginBottom: "6px" }}>Reason for Referral</div>
                        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px 14px", fontSize: "10.5pt", color: "#0f172a", minHeight: "40px" }}>
                            {referral.reason || "—"}
                        </div>
                    </div>

                    {/* Notes */}
                    {referral.notes && (
                        <div style={{ marginBottom: "16px" }}>
                            <div style={{ fontSize: "9pt", fontWeight: 800, textTransform: "uppercase", color: "#475569", letterSpacing: "0.5px", marginBottom: "6px" }}>Additional Notes</div>
                            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px 14px", fontSize: "10.5pt", color: "#0f172a" }}>
                                {referral.notes}
                            </div>
                        </div>
                    )}

                    {/* Signature */}
                    <div style={{ marginTop: "40px", display: "flex", justifyContent: "flex-end" }}>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ width: "180px", borderBottom: "1px solid #1e293b", marginBottom: "6px", height: "40px" }}></div>
                            <div style={{ fontSize: "10pt", fontWeight: 700, color: "#1e293b" }}>{doctorName || "Referring Doctor"}</div>
                            <div style={{ fontSize: "8pt", color: "#64748b" }}>{clinicName}</div>
                        </div>
                    </div>

                    {/* Page footer */}
                    <div style={{ marginTop: "30px", paddingTop: "10px", borderTop: "1px dashed #e2e8f0", fontSize: "7.5pt", color: "#94a3b8", textAlign: "center" }}>
                        This referral was issued by {clinicName}{clinicPhone ? ` • ${clinicPhone}` : ""}
                    </div>
                </div>
            </div>
        </div>
    );
}
