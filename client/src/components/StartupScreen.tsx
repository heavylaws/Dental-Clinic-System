import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

interface StartupScreenProps {
    onReady: () => void;
}

const STEPS = [
    { label: "Connecting to server", icon: "🔌" },
    { label: "Loading database", icon: "🗄️" },
    { label: "Starting services", icon: "⚙️" },
    { label: "Almost ready", icon: "✨" },
];

export default function StartupScreen({ onReady }: StartupScreenProps) {
    const [elapsed, setElapsed] = useState(0);
    const [attempts, setAttempts] = useState(0);
    const [currentStep, setCurrentStep] = useState(0);
    const [statusMessage, setStatusMessage] = useState("Waiting for server...");
    const [fadeOut, setFadeOut] = useState(false);
    const [branding, setBranding] = useState({
        clinicName: "DentalClinic",
        clinicIcon: "🦷",
        clinicSubtitle: "Dental Practice Management System",
    });

    useEffect(() => {
        api.public.branding().then(setBranding).catch(() => {});
    }, []);

    // Advance visual steps based on elapsed time
    useEffect(() => {
        if (elapsed < 5) setCurrentStep(0);
        else if (elapsed < 10) setCurrentStep(1);
        else if (elapsed < 15) setCurrentStep(2);
        else setCurrentStep(3);
    }, [elapsed]);

    // Update status messages
    useEffect(() => {
        if (elapsed < 3) setStatusMessage("Initializing system...");
        else if (elapsed < 8) setStatusMessage("Starting backend server...");
        else if (elapsed < 15) setStatusMessage("Loading database and services...");
        else if (elapsed < 25) setStatusMessage("Almost there, please wait...");
        else setStatusMessage("Taking longer than usual...");
    }, [elapsed]);

    // Timer
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed((prev) => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Health check polling
    const checkHealth = useCallback(async () => {
        try {
            const res = await fetch("/api/health", {
                signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
                setStatusMessage("System is ready!");
                setCurrentStep(STEPS.length);
                setFadeOut(true);
                setTimeout(() => onReady(), 800);
                return true;
            }
        } catch {
            // Server not ready yet
        }
        setAttempts((prev) => prev + 1);
        return false;
    }, [onReady]);

    useEffect(() => {
        // Check immediately
        checkHealth();
        const interval = setInterval(checkHealth, 2000);
        return () => clearInterval(interval);
    }, [checkHealth]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m > 0
            ? `${m}:${s.toString().padStart(2, "0")}`
            : `${s}s`;
    };

    const progressPercent = Math.min(
        95,
        (currentStep / STEPS.length) * 80 + (elapsed % 5) * 3
    );

    return (
        <div
            className={`startup-screen ${fadeOut ? "startup-fade-out" : ""}`}
        >
            {/* Animated background */}
            <div className="startup-bg">
                <div className="startup-orb startup-orb-1" />
                <div className="startup-orb startup-orb-2" />
                <div className="startup-orb startup-orb-3" />
            </div>

            <div className="startup-content">
                {/* Logo */}
                <div className="startup-logo">
                    <div className="startup-logo-icon">
                        <span className="startup-logo-emoji">{branding.clinicIcon}</span>
                        <div className="startup-logo-ring" />
                    </div>
                    <h1 className="startup-title">{branding.clinicName}</h1>
                    <p className="startup-subtitle">{branding.clinicSubtitle}</p>
                </div>

                {/* Progress bar */}
                <div className="startup-progress-container">
                    <div className="startup-progress-track">
                        <div
                            className="startup-progress-fill"
                            style={{ width: `${fadeOut ? 100 : progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Steps */}
                <div className="startup-steps">
                    {STEPS.map((step, i) => (
                        <div
                            key={i}
                            className={`startup-step ${
                                i < currentStep
                                    ? "startup-step-done"
                                    : i === currentStep
                                    ? "startup-step-active"
                                    : "startup-step-pending"
                            }`}
                        >
                            <span className="startup-step-icon">
                                {i < currentStep ? "✓" : step.icon}
                            </span>
                            <span className="startup-step-label">{step.label}</span>
                        </div>
                    ))}
                </div>

                {/* Status */}
                <div className="startup-status">
                    <div className="startup-status-text">
                        {!fadeOut && (
                            <span className="startup-spinner" />
                        )}
                        {statusMessage}
                    </div>
                    <div className="startup-timer">
                        Elapsed: {formatTime(elapsed)}
                    </div>
                </div>

                {/* Help text after 30 seconds */}
                {elapsed > 30 && !fadeOut && (
                    <div className="startup-help">
                        <p>⚠️ The server is taking longer than expected.</p>
                        <p>Check if the system service is running, or try refreshing the page.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
