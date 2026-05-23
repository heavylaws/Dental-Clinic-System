import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import MobileHeader from "../components/MobileHeader";
import MobileDialog from "../components/MobileDialog";

export default function MobileSettings({ user }: { user: any }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showClinicSettings, setShowClinicSettings] = useState(false);

  const logoutMutation = useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => {
      localStorage.removeItem("dermclinic-device");
      queryClient.clear();
      navigate("/");
    },
  });

  const isAdmin = user.role === "admin";

  return (
    <div className="mobile-animate-in">
      <MobileHeader title="Settings" subtitle={`${user.fullName || user.username} • ${user.role}`} />

      <div style={{ padding: "16px 16px 100px" }}>
        {/* Profile Section */}
        <p className="mobile-section-label">👤 Account</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "24px" }}>
          <div className="mobile-card" style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px" }}>
            <div style={{
              width: "50px", height: "50px", borderRadius: "16px",
              background: "linear-gradient(135deg, rgba(59,138,244,0.2), rgba(59,138,244,0.1))",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px",
              border: "1px solid rgba(59,138,244,0.15)",
            }}>👤</div>
            <div>
              <p style={{ fontWeight: 700, fontSize: "1rem", color: "#f1f5f9", margin: 0 }}>{user.fullName || user.username}</p>
              <p style={{ fontSize: "0.78rem", color: "#64748b", margin: 0 }}>
                {user.role === "admin" ? "👑 Administrator" : user.role === "doctor" ? "🩺 Doctor" : "👩‍💼 Reception"}
              </p>
            </div>
          </div>

          <button onClick={() => setShowChangePassword(true)} className="mobile-card touch-button"
            style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", width: "100%", textAlign: "left", cursor: "pointer" }}>
            <span style={{ fontSize: "18px" }}>🔑</span>
            <span style={{ fontWeight: 600, color: "#e2e8f0", flex: 1 }}>Change Password</span>
            <span style={{ color: "#475569" }}>→</span>
          </button>
        </div>

        {/* Admin Section */}
        {isAdmin && (
          <>
            <p className="mobile-section-label">⚙️ Administration</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "24px" }}>
              <button onClick={() => setShowUsers(true)} className="mobile-card touch-button"
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", width: "100%", textAlign: "left", cursor: "pointer" }}>
                <span style={{ fontSize: "18px" }}>👥</span>
                <span style={{ fontWeight: 600, color: "#e2e8f0", flex: 1 }}>User Management</span>
                <span style={{ color: "#475569" }}>→</span>
              </button>

              <button onClick={() => setShowClinicSettings(true)} className="mobile-card touch-button"
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", width: "100%", textAlign: "left", cursor: "pointer" }}>
                <span style={{ fontSize: "18px" }}>🏥</span>
                <span style={{ fontWeight: 600, color: "#e2e8f0", flex: 1 }}>Clinic Settings</span>
                <span style={{ color: "#475569" }}>→</span>
              </button>

              <button onClick={() => navigate("/m/reports")} className="mobile-card touch-button"
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", width: "100%", textAlign: "left", cursor: "pointer" }}>
                <span style={{ fontSize: "18px" }}>📊</span>
                <span style={{ fontWeight: 600, color: "#e2e8f0", flex: 1 }}>Reports</span>
                <span style={{ color: "#475569" }}>→</span>
              </button>
            </div>
          </>
        )}

        {/* Device & App */}
        <p className="mobile-section-label">📱 App</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "24px" }}>
          <button onClick={() => {
            localStorage.removeItem("dermclinic-device");
            navigate("/");
          }} className="mobile-card touch-button"
            style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", width: "100%", textAlign: "left", cursor: "pointer" }}>
            <span style={{ fontSize: "18px" }}>🖥️</span>
            <span style={{ fontWeight: 600, color: "#e2e8f0", flex: 1 }}>Switch to Desktop Mode</span>
            <span style={{ color: "#475569" }}>→</span>
          </button>
        </div>

        {/* Logout */}
        <button onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}
          className="mobile-btn" style={{
            width: "100%", padding: "16px", borderRadius: "18px",
            background: "rgba(244,63,94,0.1)", color: "#fb7185", fontWeight: 800,
            border: "1px solid rgba(244,63,94,0.2)", fontSize: "0.95rem",
          }}>
          {logoutMutation.isPending ? "Logging out..." : "🚪 Logout"}
        </button>
      </div>

      {/* Change Password Dialog */}
      <MobileDialog open={showChangePassword} onClose={() => setShowChangePassword(false)} title="Change Password">
        <ChangePasswordForm onDone={() => setShowChangePassword(false)} />
      </MobileDialog>

      {/* User Management Dialog */}
      <MobileDialog open={showUsers} onClose={() => setShowUsers(false)} title="User Management" fullScreen>
        <UserManagement />
      </MobileDialog>

      {/* Clinic Settings Dialog */}
      <MobileDialog open={showClinicSettings} onClose={() => setShowClinicSettings(false)} title="Clinic Settings">
        <ClinicSettingsForm onDone={() => setShowClinicSettings(false)} />
      </MobileDialog>
    </div>
  );
}

// ─── Change Password ─────────────────────────────────────────────────
function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.users.changePassword(currentPw, newPw),
    onSuccess: onDone,
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {error && <p style={{ color: "#fb7185", fontSize: "0.85rem", margin: 0 }}>❌ {error}</p>}
      <div><label style={labelStyle}>Current Password</label>
        <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="mobile-input" /></div>
      <div><label style={labelStyle}>New Password</label>
        <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="mobile-input" /></div>
      <div><label style={labelStyle}>Confirm New Password</label>
        <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="mobile-input" /></div>
      {newPw && confirmPw && newPw !== confirmPw && (
        <p style={{ color: "#fbbf24", fontSize: "0.82rem", margin: 0 }}>⚠️ Passwords don't match</p>
      )}
      <button onClick={() => { setError(""); mutation.mutate(); }}
        disabled={!currentPw || !newPw || newPw !== confirmPw || mutation.isPending}
        className="mobile-btn mobile-btn-primary" style={{ opacity: (!currentPw || !newPw || newPw !== confirmPw) ? 0.3 : 1 }}>
        {mutation.isPending ? "Changing..." : "🔑 Change Password"}
      </button>
    </div>
  );
}

// ─── User Management ──────────────────────────────────────────────────
function UserManagement() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [resetPwUser, setResetPwUser] = useState<any>(null);
  const [newPw, setNewPw] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: api.users.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.users.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); setShowCreate(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.users.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); setEditUser(null); },
  });

  const resetPwMutation = useMutation({
    mutationFn: () => api.users.resetPassword(resetPwUser.id, newPw),
    onSuccess: () => { setResetPwUser(null); setNewPw(""); },
  });

  if (isLoading) return <div className="skeleton" style={{ height: "200px", borderRadius: "18px" }} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <button onClick={() => setShowCreate(true)} className="mobile-btn mobile-btn-primary">
        ➕ Create User
      </button>

      {users.map((u: any) => (
        <div key={u.id} className="mobile-card" style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <div>
              <p style={{ fontWeight: 700, color: "#e2e8f0", margin: 0 }}>{u.fullName || u.username}</p>
              <p style={{ fontSize: "0.76rem", color: "#64748b", margin: 0 }}>{u.role} • @{u.username}</p>
            </div>
            <span style={{
              padding: "2px 10px", borderRadius: "20px", fontSize: "0.68rem", fontWeight: 700,
              background: u.active ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)",
              color: u.active ? "#34d399" : "#fb7185",
              border: `1px solid ${u.active ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.2)"}`,
            }}>{u.active ? "Active" : "Inactive"}</span>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button onClick={() => setEditUser(u)} className="touch-button"
              style={{ padding: "6px 12px", borderRadius: "10px", border: "1px solid rgba(59,138,244,0.2)", background: "rgba(59,138,244,0.08)", color: "#60a5fa", fontSize: "0.76rem", fontWeight: 700, cursor: "pointer" }}>
              ✏️ Edit
            </button>
            <button onClick={() => setResetPwUser(u)} className="touch-button"
              style={{ padding: "6px 12px", borderRadius: "10px", border: "1px solid rgba(251,191,36,0.2)", background: "rgba(251,191,36,0.08)", color: "#fbbf24", fontSize: "0.76rem", fontWeight: 700, cursor: "pointer" }}>
              🔑 Reset PW
            </button>
          </div>
        </div>
      ))}

      {/* Create User inline form */}
      {showCreate && <UserForm title="Create User" onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending} onCancel={() => setShowCreate(false)} />}

      {/* Edit User inline form */}
      {editUser && <UserForm title={`Edit ${editUser.username}`} user={editUser}
        onSubmit={(data) => updateMutation.mutate({ id: editUser.id, ...data })}
        isPending={updateMutation.isPending} onCancel={() => setEditUser(null)} />}

      {/* Reset Password inline */}
      {resetPwUser && (
        <div className="mobile-card" style={{ padding: "16px" }}>
          <p style={{ fontWeight: 700, color: "#e2e8f0", marginBottom: "8px" }}>Reset password for @{resetPwUser.username}</p>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
            className="mobile-input" placeholder="New password" style={{ marginBottom: "8px" }} />
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setResetPwUser(null)} className="mobile-btn mobile-btn-outline" style={{ flex: 1 }}>Cancel</button>
            <button onClick={() => resetPwMutation.mutate()} disabled={!newPw || resetPwMutation.isPending}
              className="mobile-btn mobile-btn-primary" style={{ flex: 1, opacity: newPw ? 1 : 0.3 }}>
              {resetPwMutation.isPending ? "..." : "Reset"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserForm({ title, user, onSubmit, isPending, onCancel }: {
  title: string; user?: any; onSubmit: (data: any) => void; isPending: boolean; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    username: user?.username || "",
    fullName: user?.fullName || "",
    role: user?.role || "reception",
    password: "",
    active: user?.active !== undefined ? user.active : true,
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="mobile-card" style={{ padding: "16px" }}>
      <p style={{ fontWeight: 700, color: "#e2e8f0", marginBottom: "10px" }}>{title}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <input value={form.username} onChange={e => set("username", e.target.value)}
          className="mobile-input" placeholder="Username" disabled={!!user} />
        <input value={form.fullName} onChange={e => set("fullName", e.target.value)}
          className="mobile-input" placeholder="Full Name" />
        {!user && <input type="password" value={form.password} onChange={e => set("password", e.target.value)}
          className="mobile-input" placeholder="Password" />}
        <select value={form.role} onChange={e => set("role", e.target.value)} className="mobile-input">
          <option value="admin">Admin</option>
          <option value="doctor">Doctor</option>
          <option value="reception">Reception</option>
        </select>
        {user && (
          <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", fontSize: "0.88rem" }}>
            <input type="checkbox" checked={form.active} onChange={e => set("active", e.target.checked)} />
            Active
          </label>
        )}
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onCancel} className="mobile-btn mobile-btn-outline" style={{ flex: 1 }}>Cancel</button>
          <button onClick={() => onSubmit(form)} disabled={isPending} className="mobile-btn mobile-btn-primary" style={{ flex: 1 }}>
            {isPending ? "..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Clinic Settings ──────────────────────────────────────────────────
function ClinicSettingsForm({ onDone }: { onDone: () => void }) {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings.get,
  });

  const [form, setForm] = useState<Record<string, string>>({});

  // Sync settings to form when loaded
  if (settings && Object.keys(form).length === 0) {
    // Use a timeout to avoid setting state during render
    setTimeout(() => setForm(settings), 0);
  }

  const mutation = useMutation({
    mutationFn: () => api.settings.update(form),
    onSuccess: onDone,
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div><label style={labelStyle}>Clinic Name</label>
        <input value={form.clinicName || ""} onChange={e => set("clinicName", e.target.value)} className="mobile-input" /></div>
      <div><label style={labelStyle}>Doctor Name</label>
        <input value={form.doctorName || ""} onChange={e => set("doctorName", e.target.value)} className="mobile-input" /></div>
      <div><label style={labelStyle}>Specialty</label>
        <input value={form.specialty || ""} onChange={e => set("specialty", e.target.value)} className="mobile-input" /></div>
      <div><label style={labelStyle}>Phone</label>
        <input value={form.clinicPhone || ""} onChange={e => set("clinicPhone", e.target.value)} className="mobile-input" type="tel" /></div>
      <div><label style={labelStyle}>Address</label>
        <textarea value={form.clinicAddress || ""} onChange={e => set("clinicAddress", e.target.value)} className="mobile-input" rows={2} /></div>
      <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
        className="mobile-btn mobile-btn-primary">
        {mutation.isPending ? "Saving..." : "💾 Save Settings"}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8",
  marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.03em",
};
