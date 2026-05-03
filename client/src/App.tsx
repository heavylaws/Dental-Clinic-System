import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import MobileApp from "./mobile/MobileApp";
import { useQuery } from "@tanstack/react-query";
import { api } from "./lib/api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PatientFile from "./pages/PatientFile";
import Layout from "./components/Layout";
import Reports from "./pages/Reports";
import Billing from "./pages/Billing";
import Patients from "./pages/Patients";
import Appointments from "./pages/Appointments";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import StartupScreen from "./components/StartupScreen";

export default function App() {
    const [backendReady, setBackendReady] = useState<boolean | null>(null);

    // Check backend health on initial mount
    const checkBackend = useCallback(async () => {
        try {
            const res = await fetch("/api/health", {
                signal: AbortSignal.timeout(2000),
            });
            if (res.ok) {
                setBackendReady(true);
                return;
            }
        } catch {
            // Backend not ready
        }
        setBackendReady(false);
    }, []);

    useEffect(() => {
        checkBackend();
    }, [checkBackend]);

    // Still checking...
    if (backendReady === null) {
        return null;
    }

    // Backend not ready — show startup screen
    if (!backendReady) {
        return <StartupScreen onReady={() => setBackendReady(true)} />;
    }

    // Backend is ready — render normal app
    return <AppRouter />;
}

function AppRouter() {
    const location = useLocation();

    // Route to mobile app for /m/* paths
    if (location.pathname.startsWith("/m")) {
        return <MobileApp />;
    }

    return <DesktopApp />;
}

function DesktopApp() {
    const { data: user, isLoading } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: api.auth.me,
        retry: false,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-2xl text-gray-400 animate-pulse">🩺 DermClinic</div>
            </div>
        );
    }

    if (!user) {
        return <Login />;
    }

    return (
        <Routes>
            <Route element={<Layout user={user} />}>
                <Route path="/" element={<Dashboard user={user} />} />
                <Route path="/room/:id" element={<PatientFile user={user} />} /> {/* Keep backend room logic if needed, but patient file is main */}
                <Route path="/patient/:id" element={<PatientFile user={user} />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/patients" element={<Patients />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/appointments" element={<Appointments />} />
                <Route path="/users" element={<Users />} />
                <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

