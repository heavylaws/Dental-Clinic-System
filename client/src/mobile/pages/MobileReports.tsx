import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import MobileHeader from "../components/MobileHeader";

export default function MobileReports() {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [medicationFilter, setMedicationFilter] = useState("");

  const { data: report, isLoading } = useQuery({
    queryKey: ["reports", "prescriptions", startDate, endDate, medicationFilter],
    queryFn: () => api.reports.prescriptions(startDate, endDate, medicationFilter),
  });

  const { data: daily } = useQuery({
    queryKey: ["reports", "daily"],
    queryFn: () => api.reports.daily(),
  });

  return (
    <div className="mobile-animate-in">
      <MobileHeader title="Reports" showBack />

      <div style={{ padding: "16px 16px 100px" }}>
        {/* Today's Summary */}
        {daily && (
          <div className="mobile-card" style={{ padding: "16px", marginBottom: "16px" }}>
            <p className="mobile-section-label">📊 Today's Summary</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: "8px" }}>
              {[
                { label: "Visits", value: daily.visitCount, color: "#3b8af4" },
                { label: "Collected", value: `$${daily.totalPaid}`, color: "#10b981" },
                { label: "Outstanding", value: `$${daily.outstanding}`, color: "#f43f5e" },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "1.3rem", fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
                  <p style={{ fontSize: "0.68rem", color: "#475569", margin: 0, fontWeight: 600, textTransform: "uppercase" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Date Filters */}
        <p className="mobile-section-label">📋 Prescription Report</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
          <div><label style={labelStyle}>From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mobile-input" /></div>
          <div><label style={labelStyle}>To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mobile-input" /></div>
        </div>
        <input value={medicationFilter} onChange={e => setMedicationFilter(e.target.value)}
          className="mobile-input" placeholder="Filter by medication name..."
          style={{ marginBottom: "14px" }} />

        {/* Results */}
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "60px", borderRadius: "18px" }} />)}
          </div>
        ) : !report?.length ? (
          <div style={{ textAlign: "center", padding: "40px 16px" }}>
            <div style={{
              width: "60px", height: "60px", borderRadius: "18px", margin: "0 auto 12px",
              background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "26px",
            }}>📊</div>
            <p style={{ fontWeight: 700, color: "#64748b" }}>No prescriptions in this range</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {/* Summary counts */}
            <div className="mobile-card" style={{ padding: "12px 16px", marginBottom: "6px" }}>
              <p style={{ fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
                {report.length} prescriptions found
              </p>
            </div>
            {report.map((rx: any, i: number) => (
              <div key={i} className="mobile-card" style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{rx.medicationName}</span>
                  <span style={{ fontSize: "0.76rem", color: "#475569" }}>
                    {new Date(rx.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
                  {rx.patientName} {rx.dosage ? `• ${rx.dosage}` : ""} {rx.frequency ? `• ${rx.frequency}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8",
  marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.03em",
};
