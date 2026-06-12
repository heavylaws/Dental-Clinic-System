import { Routes, Route, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { canManageFinancials, canViewGeneralReports } from "../lib/permissions";
import MobileLayout from "./components/MobileLayout";
import MobileDashboard from "./pages/MobileDashboard";
import MobilePatientFile from "./pages/MobilePatientFile";
import MobilePatientSearch from "./pages/MobilePatientSearch";
import MobileVisitForm from "./pages/MobileVisitForm";
import MobileAppointments from "./pages/MobileAppointments";
import MobileBilling from "./pages/MobileBilling";
import MobileSettings from "./pages/MobileSettings";
import MobileReports from "./pages/MobileReports";
import "./mobile.css";

export default function MobileApp() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: api.auth.me,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="mobile-root" style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, #0a0e27 0%, #101847 40%, #1a237e 70%, #0d47a1 100%)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "18px", margin: "0 auto 16px",
            background: "linear-gradient(135deg, #3b8af4, #1d57d6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 12px 40px rgba(29, 87, 214, 0.5)",
            animation: "pulse 2s ease-in-out infinite",
          }}>
            <span style={{ fontSize: "32px" }}>🩺</span>
          </div>
          <p style={{ color: "#64748b", fontWeight: 600 }}>Loading...</p>
        </div>
        <style>{`@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }`}</style>
      </div>
    );
  }

  // Not logged in — redirect to main login (which has the device chooser)
  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route path="/m" element={<MobileLayout user={user} />}>
        <Route index element={<MobileDashboard user={user} />} />
        <Route path="patients" element={<MobilePatientSearch />} />
        <Route path="patient/:id" element={<MobilePatientFile user={user} />} />
        <Route path="visit/:visitId" element={<MobileVisitForm user={user} />} />
        <Route path="appointments" element={<MobileAppointments />} />
        <Route path="billing" element={canManageFinancials(user) ? <MobileBilling /> : <Navigate to="/m" replace />} />
        <Route path="settings" element={<MobileSettings user={user} />} />
        <Route path="reports" element={canViewGeneralReports(user) ? <MobileReports /> : <Navigate to="/m" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/m" replace />} />
    </Routes>
  );
}
