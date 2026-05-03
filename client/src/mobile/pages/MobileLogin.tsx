import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

export default function MobileLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: () => api.auth.login(username, password),
    onSuccess: () => {
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

  return (
    <div
      className="mobile-root"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "linear-gradient(135deg, #eff8ff 0%, #ffffff 50%, #dbeffe 100%)",
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <div
          style={{
            width: "88px",
            height: "88px",
            borderRadius: "24px",
            background: "linear-gradient(135deg, #3b8af4, #1d57d6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: "0 12px 40px rgba(37, 108, 233, 0.3)",
          }}
        >
          <span style={{ fontSize: "44px" }}>🩺</span>
        </div>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#1e3f88", margin: "0 0 4px" }}>
          DermClinic
        </h1>
        <p style={{ fontSize: "0.95rem", color: "#94a3b8", margin: 0 }}>
          Clinic Management System
        </p>
      </div>

      {/* Login Form */}
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "white",
          borderRadius: "20px",
          padding: "28px 24px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
          border: "1px solid #f1f5f9",
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loginMutation.mutate();
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "#374151",
                marginBottom: "8px",
              }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mobile-input"
              placeholder="admin"
              autoComplete="username"
              autoCapitalize="off"
              autoFocus
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "#374151",
                marginBottom: "8px",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mobile-input"
              placeholder="••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div
              style={{
                padding: "12px 16px",
                background: "#fef2f2",
                border: "1px solid #fee2e2",
                borderRadius: "12px",
                color: "#dc2626",
                fontSize: "0.9rem",
                fontWeight: 600,
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="mobile-btn mobile-btn-primary"
            style={{ opacity: loginMutation.isPending ? 0.6 : 1 }}
          >
            {loginMutation.isPending ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
          <button
            type="button"
            onClick={() => bootstrapMutation.mutate()}
            disabled={bootstrapMutation.isPending}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            {bootstrapMutation.isPending ? "Creating users..." : "🔧 Initialize Default Users"}
          </button>
        </div>
      </div>
    </div>
  );
}
