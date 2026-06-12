import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { canViewGeneralReports } from "../../lib/permissions";
import MobileHeader from "../components/MobileHeader";

export default function MobileBilling() {
  const today = new Date().toISOString().split("T")[0];
  const [dateRange] = useState({ start: today, end: today });

  const { data: user } = useQuery({ queryKey: ["auth", "me"], queryFn: api.auth.me, retry: false });

  const { data: billing, isLoading } = useQuery({
    queryKey: ["billing", dateRange],
    queryFn: () => api.billing.get(dateRange.start, dateRange.end),
  });

  // Daily report backend is requireRole("admin", "doctor") — skip for reception
  const { data: daily } = useQuery({
    queryKey: ["reports", "daily"],
    queryFn: () => api.reports.daily(),
    enabled: canViewGeneralReports(user as any),
  });

  return (
    <div className="mobile-animate-in">
      <MobileHeader title="Billing" subtitle="Today's Overview" />

      <div style={{ padding: "16px" }}>
        {/* Summary Cards */}
        {daily && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
            {[
              { value: `$${daily.totalPaid}`, label: "Collected", color: "#10b981", icon: "💰", glowColor: "rgba(16,185,129,0.1)" },
              { value: `$${daily.outstanding}`, label: "Outstanding", color: "#f43f5e", icon: "📊", glowColor: "rgba(244,63,94,0.1)" },
              { value: daily.visitCount, label: "Visits", color: "#3b8af4", icon: "🏥", glowColor: "rgba(59,138,244,0.1)" },
              { value: daily.uniquePatients, label: "Patients", color: "#a78bfa", icon: "👥", glowColor: "rgba(167,139,250,0.1)" },
            ].map((stat, i) => (
              <div key={i} className="mobile-card" style={{
                textAlign: "center", padding: "18px 14px", position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", top: "-15px", right: "-15px", width: "50px", height: "50px",
                  borderRadius: "50%", background: `radial-gradient(circle, ${stat.glowColor} 0%, transparent 70%)`,
                  pointerEvents: "none",
                }} />
                <p style={{ fontSize: "0.65rem", marginBottom: "6px", opacity: 0.5 }}>{stat.icon}</p>
                <p style={{ fontSize: "1.6rem", fontWeight: 800, color: stat.color, margin: "0 0 2px", letterSpacing: "-0.02em" }}>
                  {stat.value}
                </p>
                <p style={{ fontSize: "0.7rem", color: "#475569", margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Transactions */}
        <p className="mobile-section-label">💰 Transactions</p>

        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "60px", borderRadius: "18px" }} />)}
          </div>
        ) : !billing?.entries?.length ? (
          <div style={{ textAlign: "center", padding: "40px 16px" }}>
            <div style={{
              width: "60px", height: "60px", borderRadius: "18px", margin: "0 auto 12px",
              background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "26px",
            }}>💰</div>
            <p style={{ fontWeight: 700, color: "#64748b" }}>No billing entries today</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {billing.entries.map((entry: any) => (
              <div key={entry.id} className="mobile-card" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: "0.92rem", color: "#f1f5f9", margin: 0 }}>{entry.patientName}</p>
                  <p style={{ fontSize: "0.76rem", color: "#475569", margin: 0 }}>#{entry.fileNumber}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{
                    fontWeight: 800, fontSize: "1rem", margin: 0,
                    color: entry.status === "paid" ? "#4ade80" : "#fb7185",
                  }}>${entry.totalAmount}</p>
                  <p style={{ fontSize: "0.68rem", color: "#475569", margin: 0, fontWeight: 600 }}>
                    {entry.status === "paid" ? "✅ Paid" : "Pending"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
