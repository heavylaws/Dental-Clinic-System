import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface ReceiptPrintProps {
    patient: any;
    visit: any;
    billing: any;
    onClose: () => void;
}

export default function ReceiptPrint({ patient, visit, billing, onClose }: ReceiptPrintProps) {
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
    const receiptTitle = settings?.receipt_title || "RECEIPT";
    const receiptFooter = settings?.receipt_footer_text || `Thank you for choosing ${clinicName}`;
    const receiptSignatureLabel = settings?.receipt_signature_label || "Authorized Signature";

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;
        printWindow.document.write(`
            <html><head>
            <title>Receipt - ${patient.firstName} ${patient.lastName}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                @page { size: A5; margin: 12mm; }
                body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 10pt; color: #1e293b; background: #fff; }
                .header { text-align: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #1e40af; }
                .clinic-name { font-size: 16pt; font-weight: 800; color: #1e40af; }
                .clinic-info { font-size: 8pt; color: #64748b; margin-top: 3px; }
                .receipt-title { text-align: center; font-size: 13pt; font-weight: 800; letter-spacing: 2px; color: #0f172a; margin: 10px 0; border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; padding: 6px 0; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 12px; font-size: 9pt; }
                .info-row { display: flex; justify-content: space-between; padding: 2px 0; }
                .lbl { color: #64748b; }
                .val { font-weight: 700; color: #0f172a; }
                .table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9pt; }
                .table th { background: #f1f5f9; padding: 6px 8px; text-align: left; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; }
                .table td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
                .table .amount { text-align: right; font-weight: 700; }
                .totals { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; }
                .total-row { display: flex; justify-content: space-between; font-size: 9pt; margin-bottom: 4px; }
                .total-row.grand { font-size: 12pt; font-weight: 800; color: #1e40af; border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 4px; }
                .status-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 8pt; font-weight: 700; }
                .status-paid { background: #dcfce7; color: #166534; }
                .status-partial { background: #fef9c3; color: #854d0e; }
                .status-unpaid { background: #fee2e2; color: #991b1b; }
                .footer { text-align: center; font-size: 7.5pt; color: #94a3b8; margin-top: 16px; border-top: 1px dashed #e2e8f0; padding-top: 8px; }
                .sig-row { display: flex; justify-content: flex-end; margin-top: 20px; }
                .sig-block { text-align: center; width: 120px; }
                .sig-line { border-top: 1px solid #94a3b8; padding-top: 4px; font-size: 7.5pt; color: #64748b; }
            </style>
            </head><body>${content.innerHTML}</body></html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
    };

    const visitDate = visit?.startedAt ? new Date(visit.startedAt) : new Date();
    const receiptDate = billing?.createdAt ? new Date(billing.createdAt) : new Date();
    const totalAmount = parseFloat(billing?.totalAmount || "0");
    const paidAmount = parseFloat(billing?.paidAmount || "0");
    const balance = totalAmount - paidAmount;

    const statusClass = billing?.status === "paid" ? "status-paid"
        : billing?.status === "partial" ? "status-partial"
        : "status-unpaid";

    const statusLabel = billing?.status === "paid" ? "PAID"
        : billing?.status === "partial" ? "PARTIAL"
        : "UNPAID";

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-2xl">
                    <h3 className="font-bold text-gray-700 text-sm">🧾 Receipt Preview (A5)</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition text-sm">🖨️ Print</button>
                        <button onClick={onClose} className="px-2 py-1.5 text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                </div>

                <div ref={printRef} className="p-6 text-sm">
                    {/* Header */}
                    <div className="header" style={{ textAlign: "center", marginBottom: "12px", paddingBottom: "10px", borderBottom: "2px solid #1e40af" }}>
                        <div style={{ fontSize: "16pt", fontWeight: 800, color: "#1e40af" }}>{clinicIcon} {clinicName}</div>
                        <div style={{ fontSize: "8pt", color: "#64748b", marginTop: "3px" }}>
                            {clinicAddress}{clinicPhone ? ` • ${clinicPhone}` : ""}
                        </div>
                    </div>

                    {/* Receipt Title */}
                    <div style={{ textAlign: "center", fontSize: "13pt", fontWeight: 800, letterSpacing: "2px", color: "#0f172a", margin: "10px 0", borderTop: "1px dashed #cbd5e1", borderBottom: "1px dashed #cbd5e1", padding: "6px 0" }}>
                        {receiptTitle}
                    </div>

                    {/* Info Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", marginBottom: "12px", fontSize: "9pt" }}>
                        <div>
                            <span style={{ color: "#64748b" }}>Patient: </span>
                            <strong>{patient.firstName} {patient.lastName}</strong>
                        </div>
                        <div>
                            <span style={{ color: "#64748b" }}>File #: </span>
                            <strong>{patient.fileNumber}</strong>
                        </div>
                        <div>
                            <span style={{ color: "#64748b" }}>Visit Date: </span>
                            <strong>{visitDate.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</strong>
                        </div>
                        <div>
                            <span style={{ color: "#64748b" }}>Receipt Date: </span>
                            <strong>{receiptDate.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</strong>
                        </div>
                        <div>
                            <span style={{ color: "#64748b" }}>Visit Type: </span>
                            <strong style={{ textTransform: "capitalize" }}>{visit?.visitType || "—"}</strong>
                        </div>
                        <div>
                            <span style={{ color: "#64748b" }}>Status: </span>
                            <span className={`status-badge ${statusClass}`} style={{
                                display: "inline-block", padding: "2px 10px", borderRadius: "999px", fontSize: "8pt", fontWeight: 700,
                                background: billing?.status === "paid" ? "#dcfce7" : billing?.status === "partial" ? "#fef9c3" : "#fee2e2",
                                color: billing?.status === "paid" ? "#166534" : billing?.status === "partial" ? "#854d0e" : "#991b1b",
                            }}>
                                {statusLabel}
                            </span>
                        </div>
                    </div>

                    {/* Procedures table */}
                    {visit?.dentalProcedures?.length > 0 && (
                        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px", fontSize: "9pt" }}>
                            <thead>
                                <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #e2e8f0" }}>
                                    <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 700, color: "#475569" }}>Procedure</th>
                                    <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#475569" }}>Amount (USD)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visit.dentalProcedures.map((proc: any) => (
                                    <tr key={proc.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                        <td style={{ padding: "6px 8px" }}>{proc.procedureName}</td>
                                        <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>${parseFloat(proc.cost || "0").toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* Totals */}
                    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 12px", marginBottom: "14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", marginBottom: "4px" }}>
                            <span style={{ color: "#64748b" }}>Total Charged</span>
                            <span style={{ fontWeight: 700 }}>${totalAmount.toFixed(2)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", marginBottom: "4px" }}>
                            <span style={{ color: "#64748b" }}>Amount Paid</span>
                            <span style={{ fontWeight: 700, color: "#166534" }}>${paidAmount.toFixed(2)}</span>
                        </div>
                        {balance > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12pt", fontWeight: 800, color: "#991b1b", borderTop: "1px solid #cbd5e1", paddingTop: "6px", marginTop: "4px" }}>
                                <span>Balance Due</span>
                                <span>${balance.toFixed(2)}</span>
                            </div>
                        )}
                        {balance === 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12pt", fontWeight: 800, color: "#1e40af", borderTop: "1px solid #cbd5e1", paddingTop: "6px", marginTop: "4px" }}>
                                <span>Balance</span>
                                <span>$0.00 ✓</span>
                            </div>
                        )}
                    </div>

                    {/* Payment History */}
                    {billing?.payments?.length > 0 && (
                        <div style={{ marginBottom: "14px", fontSize: "8.5pt" }}>
                            <div style={{ fontWeight: 700, color: "#475569", marginBottom: "4px", textTransform: "uppercase", fontSize: "7.5pt", letterSpacing: "0.5px" }}>Payment History</div>
                            {billing.payments.map((pay: any) => (
                                <div key={pay.id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dotted #e2e8f0" }}>
                                    <span style={{ color: "#64748b" }}>
                                        {new Date(pay.paidAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                                        {pay.method ? ` — ${pay.method}` : ""}
                                    </span>
                                    <span style={{ fontWeight: 700 }}>${parseFloat(pay.amount).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Signature */}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
                        <div style={{ textAlign: "center", width: "130px" }}>
                            <div style={{ borderTop: "1px solid #94a3b8", paddingTop: "4px", fontSize: "7.5pt", color: "#64748b" }}>
                                {doctorName || receiptSignatureLabel}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ textAlign: "center", fontSize: "7.5pt", color: "#94a3b8", marginTop: "16px", borderTop: "1px dashed #e2e8f0", paddingTop: "8px" }}>
                        {receiptFooter}
                    </div>
                </div>
            </div>
        </div>
    );
}
