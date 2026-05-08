import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type DeviceMode = "choose" | "desktop" | "mobile";

export default function Login() {
    const navigate = useNavigate();
    const savedMode = localStorage.getItem("dentalclinic-device") as DeviceMode | null;
    const [mode, setMode] = useState<DeviceMode>(savedMode === "mobile" ? "mobile" : savedMode === "desktop" ? "desktop" : "choose");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [branding, setBranding] = useState({
        clinicName: "DentalClinic",
        clinicIcon: "🦷",
        clinicSubtitle: "Clinic Management System",
    });
    const queryClient = useQueryClient();

    useEffect(() => {
        api.public.branding().then(setBranding).catch(() => {});
    }, []);

    const loginMutation = useMutation({
        mutationFn: () => api.auth.login(username, password),
        onSuccess: () => {
            if (mode === "mobile") {
                navigate("/m");
            }
            queryClient.invalidateQueries({ queryKey: ["auth"] });
        },
        onError: (err: Error) => {
            setError(err.message || "Login failed");
        },
    });

    const bootstrapMutation = useMutation({
        mutationFn: api.auth.bootstrap,
        onSuccess: () => {
            setError("");
            setUsername("admin");
            setPassword("admin123");
        },
        onError: (err: Error) => setError(err.message),
    });

    const pickDevice = (d: "desktop" | "mobile") => {
        setMode(d);
        localStorage.setItem("dentalclinic-device", d);
        if (d === "mobile") {
            // If already logged in, go directly
            api.auth.me().then(() => navigate("/m")).catch(() => {});
        }
    };

    // ─── Device Chooser ──────────────────────────────────────────
    if (mode === "choose") {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{
                background: "linear-gradient(145deg, #0a0e27 0%, #101847 40%, #1a237e 70%, #0d47a1 100%)",
            }}>
                {/* Animated background particles */}
                <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} style={{
                            position: "absolute",
                            borderRadius: "50%",
                            background: `radial-gradient(circle, rgba(59,138,244,${0.08 + i * 0.02}) 0%, transparent 70%)`,
                            width: `${200 + i * 120}px`,
                            height: `${200 + i * 120}px`,
                            left: `${10 + i * 15}%`,
                            top: `${15 + (i % 3) * 25}%`,
                            animation: `float-particle ${6 + i * 2}s ease-in-out infinite alternate`,
                        }} />
                    ))}
                </div>

                <div className="w-full max-w-lg px-6 relative z-10">
                    {/* Logo */}
                    <div className="text-center mb-12" style={{ animation: "fadeSlideDown 0.8s ease" }}>
                        <div style={{
                            width: "90px", height: "90px", borderRadius: "26px", margin: "0 auto 20px",
                            background: "linear-gradient(135deg, #3b8af4 0%, #1d57d6 50%, #0d47a1 100%)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: "0 20px 60px rgba(29, 87, 214, 0.5), 0 0 80px rgba(59, 138, 244, 0.2)",
                        }}>
                            <span style={{ fontSize: "44px" }}>{branding.clinicIcon}</span>
                        </div>
                        <h1 style={{
                            fontSize: "2.4rem", fontWeight: 900, margin: "0 0 6px",
                            background: "linear-gradient(135deg, #ffffff, #93c5fd)",
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                            letterSpacing: "-0.02em",
                        }}>
                            {branding.clinicName}
                        </h1>
                        <p style={{ color: "#64748b", fontSize: "1rem", fontWeight: 500 }}>
                            Select your device to continue
                        </p>
                    </div>

                    {/* Device Cards */}
                    <div style={{ display: "flex", gap: "16px", animation: "fadeSlideUp 0.8s ease 0.2s both" }}>
                        {/* PC Card */}
                        <button
                            onClick={() => pickDevice("desktop")}
                            style={{
                                flex: 1, padding: "32px 20px", borderRadius: "24px",
                                background: "rgba(255,255,255,0.06)",
                                backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                                cursor: "pointer", textAlign: "center",
                                border: "1px solid rgba(255,255,255,0.1)",
                                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                                e.currentTarget.style.transform = "translateY(-6px)";
                                e.currentTarget.style.boxShadow = "0 20px 60px rgba(0,0,0,0.3)";
                                e.currentTarget.style.borderColor = "rgba(59,138,244,0.4)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "none";
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                            }}
                        >
                            <div style={{
                                fontSize: "52px", marginBottom: "16px", lineHeight: 1,
                                filter: "drop-shadow(0 4px 12px rgba(59,138,244,0.3))",
                            }}>🖥️</div>
                            <h3 style={{
                                color: "white", fontSize: "1.2rem", fontWeight: 800,
                                marginBottom: "6px",
                            }}>Desktop</h3>
                            <p style={{
                                color: "#94a3b8", fontSize: "0.82rem", fontWeight: 500,
                                lineHeight: 1.4,
                            }}>
                                Full interface for<br />PC & Laptop
                            </p>
                        </button>

                        {/* Mobile Card */}
                        <button
                            onClick={() => pickDevice("mobile")}
                            style={{
                                flex: 1, padding: "32px 20px", borderRadius: "24px",
                                background: "rgba(255,255,255,0.06)",
                                backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                                cursor: "pointer", textAlign: "center",
                                border: "1px solid rgba(255,255,255,0.1)",
                                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                                e.currentTarget.style.transform = "translateY(-6px)";
                                e.currentTarget.style.boxShadow = "0 20px 60px rgba(0,0,0,0.3)";
                                e.currentTarget.style.borderColor = "rgba(59,138,244,0.4)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "none";
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                            }}
                        >
                            <div style={{
                                fontSize: "52px", marginBottom: "16px", lineHeight: 1,
                                filter: "drop-shadow(0 4px 12px rgba(34,197,94,0.3))",
                            }}>📱</div>
                            <h3 style={{
                                color: "white", fontSize: "1.2rem", fontWeight: 800,
                                marginBottom: "6px",
                            }}>Smartphone</h3>
                            <p style={{
                                color: "#94a3b8", fontSize: "0.82rem", fontWeight: 500,
                                lineHeight: 1.4,
                            }}>
                                Touch-optimized for<br />Phone & Tablet
                            </p>
                        </button>
                    </div>

                    {/* Bootstrap */}
                    <div style={{ textAlign: "center", marginTop: "32px", animation: "fadeSlideUp 0.8s ease 0.4s both" }}>
                        <button
                            onClick={() => bootstrapMutation.mutate()}
                            disabled={bootstrapMutation.isPending}
                            style={{
                                background: "transparent", border: "none", color: "#475569",
                                fontSize: "0.8rem", cursor: "pointer",
                            }}
                        >
                            {bootstrapMutation.isPending ? "Creating users..." : "🔧 Initialize Default Users"}
                        </button>
                    </div>
                </div>

                <style>{`
                    @keyframes float-particle {
                        from { transform: translate(0, 0) scale(1); }
                        to { transform: translate(30px, -40px) scale(1.1); }
                    }
                    @keyframes fadeSlideDown {
                        from { opacity: 0; transform: translateY(-20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes fadeSlideUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </div>
        );
    }

    // ─── Login Form (both modes) ─────────────────────────────────
    const isMobile = mode === "mobile";

    return (
        <>
            {!isMobile ? (
                /* Desktop Login — original design */
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 w-full">
                    <div className="w-full max-w-md">
                        <div className="text-center mb-10">
                            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 shadow-xl mb-6">
                                <span className="text-5xl">{branding.clinicIcon}</span>
                            </div>
                            <h1 className="text-4xl font-extrabold text-primary-900 mb-2">{branding.clinicName}</h1>
                            <p className="text-xl text-gray-500">{branding.clinicSubtitle}</p>
                        </div>

                        <div className="bg-white rounded-2xl shadow-2xl p-10 border border-gray-100">
                            <form onSubmit={(e) => { e.preventDefault(); loginMutation.mutate(); }}>
                                <div className="mb-6">
                                    <label className="block text-lg font-semibold text-gray-700 mb-2">Username</label>
                                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                                        className="w-full border-2 border-gray-200 rounded-xl px-5 py-4 text-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition outline-none"
                                        placeholder="admin" autoFocus autoComplete="username" />
                                </div>
                                <div className="mb-8">
                                    <label className="block text-lg font-semibold text-gray-700 mb-2">Password</label>
                                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                        className="w-full border-2 border-gray-200 rounded-xl px-5 py-4 text-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition outline-none"
                                        placeholder="••••••" autoComplete="current-password" />
                                </div>
                                {error && <div className="mb-6 p-4 bg-danger-50 border border-danger-100 rounded-xl text-danger-700 text-lg">{error}</div>}
                                <button type="submit" disabled={loginMutation.isPending}
                                    className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white text-xl font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50">
                                    {loginMutation.isPending ? "Signing in..." : "Sign In"}
                                </button>
                            </form>
                            <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between">
                                <button onClick={() => { setMode("choose"); localStorage.removeItem("dentalclinic-device"); }}
                                    className="text-sm text-gray-400 hover:text-primary-600 transition">
                                    ← Switch Device
                                </button>
                                <button onClick={() => bootstrapMutation.mutate()} disabled={bootstrapMutation.isPending}
                                    className="text-sm text-gray-400 hover:text-primary-600 transition">
                                    {bootstrapMutation.isPending ? "Creating users..." : "🔧 Initialize"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Mobile Login — premium dark theme */
                <div style={{
                    width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", padding: "24px",
                    background: "linear-gradient(145deg, #0a0e27 0%, #101847 40%, #1a237e 70%, #0d47a1 100%)",
                    position: "relative", overflow: "hidden",
                }}>
                    {/* Background glow */}
                    <div style={{
                        position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)",
                        width: "300px", height: "300px", borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(59,138,244,0.15) 0%, transparent 70%)",
                        pointerEvents: "none",
                    }} />

                    <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "400px" }}>
                        {/* Logo */}
                        <div style={{ textAlign: "center", marginBottom: "36px", animation: "fadeSlideDown 0.6s ease" }}>
                            <div style={{
                                width: "80px", height: "80px", borderRadius: "22px", margin: "0 auto 18px",
                                background: "linear-gradient(135deg, #3b8af4, #1d57d6)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                boxShadow: "0 16px 48px rgba(29, 87, 214, 0.5)",
                            }}>
                            <span style={{ fontSize: "40px" }}>{branding.clinicIcon}</span>
                            </div>
                            <h1 style={{
                                fontSize: "2rem", fontWeight: 900, margin: "0 0 4px",
                                background: "linear-gradient(135deg, #ffffff, #93c5fd)",
                                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                            }}>{branding.clinicName}</h1>
                            <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Smartphone Mode</p>
                        </div>

                        {/* Login Card */}
                        <div style={{
                            background: "rgba(255,255,255,0.07)",
                            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
                            borderRadius: "24px", padding: "28px 24px",
                            border: "1px solid rgba(255,255,255,0.1)",
                            boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
                            animation: "fadeSlideUp 0.6s ease 0.15s both",
                        }}>
                            <form onSubmit={(e) => { e.preventDefault(); loginMutation.mutate(); }}>
                                <div style={{ marginBottom: "18px" }}>
                                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#94a3b8", marginBottom: "8px" }}>Username</label>
                                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                                        style={{
                                            width: "100%", padding: "16px 18px", fontSize: "16px",
                                            borderRadius: "14px", border: "1px solid rgba(255,255,255,0.12)",
                                            background: "rgba(255,255,255,0.06)", color: "white",
                                            outline: "none", WebkitAppearance: "none",
                                        }}
                                        placeholder="admin" autoFocus autoComplete="username" autoCapitalize="off" />
                                </div>
                                <div style={{ marginBottom: "24px" }}>
                                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#94a3b8", marginBottom: "8px" }}>Password</label>
                                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                        style={{
                                            width: "100%", padding: "16px 18px", fontSize: "16px",
                                            borderRadius: "14px", border: "1px solid rgba(255,255,255,0.12)",
                                            background: "rgba(255,255,255,0.06)", color: "white",
                                            outline: "none", WebkitAppearance: "none",
                                        }}
                                        placeholder="••••••" autoComplete="current-password" />
                                </div>
                                {error && (
                                    <div style={{
                                        padding: "12px 16px", marginBottom: "16px", borderRadius: "12px",
                                        background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                                        color: "#fca5a5", fontSize: "0.9rem", fontWeight: 600,
                                    }}>{error}</div>
                                )}
                                <button type="submit" disabled={loginMutation.isPending}
                                    className="mobile-btn"
                                    style={{
                                        background: "linear-gradient(135deg, #3b8af4, #1d57d6)",
                                        color: "white", fontSize: "16px", fontWeight: 800,
                                        padding: "16px", borderRadius: "14px", border: "none",
                                        width: "100%", cursor: "pointer",
                                        boxShadow: "0 8px 32px rgba(29, 87, 214, 0.4)",
                                        opacity: loginMutation.isPending ? 0.6 : 1,
                                    }}>
                                    {loginMutation.isPending ? "Signing in..." : "Sign In"}
                                </button>
                            </form>
                            <div style={{
                                marginTop: "20px", paddingTop: "16px",
                                borderTop: "1px solid rgba(255,255,255,0.08)",
                                display: "flex", justifyContent: "space-between",
                            }}>
                                <button onClick={() => { setMode("choose"); localStorage.removeItem("dentalclinic-device"); }}
                                    style={{ background: "transparent", border: "none", color: "#64748b", fontSize: "0.82rem", cursor: "pointer" }}>
                                    ← Switch Device
                                </button>
                                <button onClick={() => bootstrapMutation.mutate()} disabled={bootstrapMutation.isPending}
                                    style={{ background: "transparent", border: "none", color: "#475569", fontSize: "0.82rem", cursor: "pointer" }}>
                                    {bootstrapMutation.isPending ? "Creating..." : "🔧 Initialize"}
                                </button>
                            </div>
                        </div>
                    </div>

                    <style>{`
                        @keyframes fadeSlideDown {
                            from { opacity: 0; transform: translateY(-20px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                        @keyframes fadeSlideUp {
                            from { opacity: 0; transform: translateY(20px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                    `}</style>
                </div>
            )}
        </>
    );
}
