import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import MobileHeader from "../components/MobileHeader";
import MobileSearchBar from "../components/MobileSearchBar";

export default function MobilePatientSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["patients", "search", query],
    queryFn: () => api.patients.search(query),
    enabled: query.length >= 1,
  });

  const { data: listData, isFetching: listing } = useQuery({
    queryKey: ["patients", "list", page],
    queryFn: () => api.patients.list(page, 20, "lastVisit", "desc"),
    enabled: query.length === 0,
  });

  const patients = query.length >= 1 ? searchResults : (listData?.patients || []);
  const isLoading = query.length >= 1 ? searching : listing;
  const totalPages = listData?.total ? Math.ceil(listData.total / 20) : 0;

  return (
    <div className="mobile-animate-in">
      <MobileHeader title="Patients" />

      <div style={{ padding: "12px 16px" }}>
        <MobileSearchBar placeholder="Search by name or phone..." value={query}
          onChange={(v) => { setQuery(v); setPage(1); }} />
      </div>

      <div style={{ padding: "0 16px 100px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="skeleton" style={{ height: "68px", borderRadius: "18px" }} />
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 16px" }}>
            <div style={{
              width: "70px", height: "70px", borderRadius: "20px", margin: "0 auto 14px",
              background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "28px",
            }}>🔍</div>
            <p style={{ fontWeight: 700, color: "#64748b" }}>No patients found</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
            {patients.map((p: any) => (
              <div key={p.id} className="mobile-card touch-button"
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px" }}
                onClick={() => navigate(`/m/patient/${p.id}`)}>
                {/* Avatar */}
                <div style={{
                  width: "42px", height: "42px", borderRadius: "14px",
                  background: p.gender === "Female"
                    ? "linear-gradient(135deg, rgba(244,114,182,0.2), rgba(244,114,182,0.1))"
                    : "linear-gradient(135deg, rgba(59,138,244,0.2), rgba(59,138,244,0.1))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px", flexShrink: 0,
                  border: `1px solid ${p.gender === "Female" ? "rgba(244,114,182,0.15)" : "rgba(59,138,244,0.15)"}`,
                }}>
                  {p.gender === "Female" ? "👩" : "👨"}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontWeight: 700, fontSize: "0.95rem", color: "#f1f5f9", margin: 0,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {p.firstName} {p.fatherName ? `${p.fatherName} ` : ""}{p.lastName}
                  </p>
                  <p style={{ fontSize: "0.76rem", color: "#475569", margin: 0 }}>
                    #{p.fileNumber} • {p.phone || "—"} • {p.city || "—"}
                  </p>
                </div>

                <div style={{
                  background: "rgba(255,255,255,0.06)", padding: "4px 10px", borderRadius: "20px",
                  fontSize: "0.72rem", fontWeight: 700, color: "#64748b", flexShrink: 0,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  {p.visitCount ?? 0}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {query.length === 0 && totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "20px" }}>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="mobile-btn mobile-btn-outline"
              style={{ width: "auto", padding: "10px 20px", opacity: page === 1 ? 0.3 : 1 }}>
              ← Prev
            </button>
            <span style={{ display: "flex", alignItems: "center", fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>
              {page} / {totalPages}
            </span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
              className="mobile-btn mobile-btn-outline"
              style={{ width: "auto", padding: "10px 20px", opacity: page === totalPages ? 0.3 : 1 }}>
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
