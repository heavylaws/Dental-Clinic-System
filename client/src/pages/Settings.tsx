import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

const SETTING_FIELDS = [
    { key: "clinic_name", label: "Clinic Name", type: "text", placeholder: "DentalClinic" },
    { key: "clinic_icon", label: "Clinic Icon (emoji/text)", type: "text", placeholder: "🦷" },
    { key: "clinic_subtitle", label: "Clinic Subtitle", type: "text", placeholder: "Dental Practice Management System" },
    { key: "clinic_phone", label: "Phone", type: "text", placeholder: "+964 xxx xxx xxxx" },
    { key: "clinic_address", label: "Address", type: "text", placeholder: "Baghdad, Iraq" },
    { key: "currency", label: "Currency", type: "text", placeholder: "USD" },
    { key: "working_hours_start", label: "Opening Time", type: "time", placeholder: "08:00" },
    { key: "working_hours_end", label: "Closing Time", type: "time", placeholder: "20:00" },
    { key: "appointment_duration", label: "Default Appointment Duration (min)", type: "number", placeholder: "30" },
    { key: "prescription_title", label: "Prescription Print Title", type: "text", placeholder: "Prescription" },
    { key: "prescription_signature_label", label: "Prescription Signature Label", type: "text", placeholder: "Doctor's Signature" },
    { key: "lab_request_title", label: "Lab Request Print Title", type: "text", placeholder: "Laboratory Examination Request" },
    { key: "lab_signature_label", label: "Lab Request Signature Label", type: "text", placeholder: "Medical Practitioner" },
    { key: "clinical_notes_title", label: "Clinical Notes Print Title", type: "text", placeholder: "Clinical Notes" },
    { key: "clinical_notes_signature_label", label: "Clinical Notes Signature Label", type: "text", placeholder: "Medical Practitioner" },
    { key: "receipt_title", label: "Receipt Print Title", type: "text", placeholder: "RECEIPT" },
    { key: "receipt_signature_label", label: "Receipt Signature Label", type: "text", placeholder: "Authorized Signature" },
    { key: "receipt_footer_text", label: "Receipt Footer Text", type: "text", placeholder: "Thank you for choosing our clinic" },
];

export default function Settings() {
    const queryClient = useQueryClient();
    const [form, setForm] = useState<Record<string, string>>({});
    const [saved, setSaved] = useState(false);

    // Password change state
    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [pwMessage, setPwMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    const { data: user } = useQuery({ queryKey: ["auth", "me"], queryFn: api.auth.me });

    // Database restore state
    const [backupFile, setBackupFile] = useState<File | null>(null);
    const [restoreStatus, setRestoreStatus] = useState<"idle" | "restoring" | "success" | "error">("idle");
    const [restoreLogs, setRestoreLogs] = useState<string>("");

    const { data: settings, isLoading } = useQuery({
        queryKey: ["settings"],
        queryFn: () => api.settings.get(),
    });

    const { data: serverInfo } = useQuery({
        queryKey: ["settings", "server-info"],
        queryFn: () => api.settings.serverInfo(),
        enabled: user?.role === "admin",
    });

    useEffect(() => {
        if (settings) setForm(settings);
    }, [settings]);

    const saveMutation = useMutation({
        mutationFn: () => api.settings.update(form),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["settings"] });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        },
    });

    const changePwMutation = useMutation({
        mutationFn: () => api.users.changePassword(currentPw, newPw),
        onSuccess: () => {
            setPwMessage({ text: "Password changed successfully!", type: "success" });
            setCurrentPw("");
            setNewPw("");
            setConfirmPw("");
        },
        onError: (err: any) => {
            setPwMessage({ text: err.message || "Failed to change password", type: "error" });
        },
    });

    function handlePwSubmit(e: React.FormEvent) {
        e.preventDefault();
        setPwMessage(null);
        if (newPw !== confirmPw) {
            setPwMessage({ text: "New passwords don't match", type: "error" });
            return;
        }
        if (newPw.length < 4) {
            setPwMessage({ text: "Password must be at least 4 characters", type: "error" });
            return;
        }
        changePwMutation.mutate();
    }

    async function handleRestore(e: React.FormEvent) {
        e.preventDefault();
        if (!backupFile) return;

        if (!confirm("⚠️ WARNING: This will overwrite ALL current database data (patients, visits, etc.) with the uploaded backup. Are you absolutely sure you want to proceed?")) {
            return;
        }

        setRestoreStatus("restoring");
        setRestoreLogs("Starting database restore process...\n");

        try {
            const res = await api.settings.restore(backupFile);
            if (!res.body) throw new Error("No response stream available");

            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                setRestoreLogs(prev => prev + text);
            }

            setRestoreStatus("success");
            setBackupFile(null);
        } catch (error: any) {
            setRestoreLogs(prev => prev + `\n\n[ERROR]: ${error.message}`);
            setRestoreStatus("error");
        }
    }

    return (
        <div className="max-w-3xl mx-auto px-6 py-8">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-8">⚙️ Settings</h1>

            {/* ─── Server Network Info ─── */}
            {user?.role === "admin" && serverInfo && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        🌐 Server Network Info
                    </h2>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-500 w-28">Hostname:</span>
                            <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded-lg">{serverInfo.hostname}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-500 w-28">Dashboard Port:</span>
                            <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded-lg">
                                {serverInfo.uiPort}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-500 w-28">API Port:</span>
                            <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded-lg">{serverInfo.port}</span>
                        </div>

                        {/* HTTPS URLs for phones */}
                        {serverInfo.httpsUrls && serverInfo.httpsUrls.length > 0 && (
                            <div className="border-t border-gray-100 pt-3 mt-3">
                                <p className="text-sm font-bold text-green-700 mb-2">📱 Phone Access (HTTPS – camera enabled):</p>
                                <div className="space-y-2">
                                    {serverInfo.addresses.map((addr, i) => (
                                        <div key={`https-${i}`} className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                                            <span className="text-xs font-bold text-green-500 uppercase w-16">{addr.name}</span>
                                            <span className="font-mono text-lg font-bold text-green-700">
                                                {serverInfo.httpsUrls[i]}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(serverInfo.httpsUrls[i]);
                                                }}
                                                className="ml-auto px-3 py-1 bg-green-100 text-green-600 rounded-lg text-xs font-bold hover:bg-green-200 transition"
                                                title="Copy to clipboard"
                                            >
                                                📋 Copy
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-400 mt-2">* First time: tap “Advanced” → “Proceed” to accept the self-signed certificate</p>
                            </div>
                        )}

                        {/* HTTP URLs */}
                        <div className="border-t border-gray-100 pt-3 mt-3">
                            <p className="text-sm font-semibold text-gray-500 mb-2">🖥️ Desktop Access (HTTP):</p>
                            <div className="space-y-2">
                                {serverInfo.addresses.map((addr, i) => (
                                    <div key={`http-${i}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                        <span className="text-xs font-bold text-gray-400 uppercase w-16">{addr.name}</span>
                                        <span className="font-mono text-sm font-semibold text-gray-600">
                                            {serverInfo.accessUrls[i]}
                                        </span>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(serverInfo.accessUrls[i]);
                                            }}
                                            className="ml-auto px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-200 transition"
                                            title="Copy to clipboard"
                                        >
                                            📋 Copy
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Clinic Settings ─── */}
            {user?.role === "admin" && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-800 mb-6">🏥 Clinic Configuration</h2>
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {SETTING_FIELDS.map((field) => (
                                <div key={field.key} className="grid grid-cols-3 gap-4 items-center">
                                    <label className="text-sm font-semibold text-gray-600">{field.label}</label>
                                    <input
                                        type={field.type}
                                        value={form[field.key] || ""}
                                        onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                        placeholder={field.placeholder}
                                        className="col-span-2 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                            ))}
                            <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => saveMutation.mutate()}
                                    disabled={saveMutation.isPending}
                                    className="px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition disabled:opacity-50"
                                >
                                    {saveMutation.isPending ? "Saving..." : "💾 Save Settings"}
                                </button>
                                {saved && (
                                    <span className="text-emerald-600 font-semibold animate-pulse">✅ Settings saved!</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Change Password ─── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-6">🔒 Change Password</h2>
                <form onSubmit={handlePwSubmit} className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Current Password</label>
                        <input
                            type="password"
                            value={currentPw}
                            onChange={(e) => setCurrentPw(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">New Password</label>
                        <input
                            type="password"
                            value={newPw}
                            onChange={(e) => setNewPw(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                            required
                            minLength={4}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Confirm New Password</label>
                        <input
                            type="password"
                            value={confirmPw}
                            onChange={(e) => setConfirmPw(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                            required
                            minLength={4}
                        />
                    </div>
                    {pwMessage && (
                        <p className={`text-sm font-semibold ${pwMessage.type === "success" ? "text-emerald-600" : "text-red-500"}`}>
                            {pwMessage.text}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={changePwMutation.isPending}
                        className="px-6 py-2.5 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition disabled:opacity-50"
                    >
                        {changePwMutation.isPending ? "Changing..." : "🔑 Change Password"}
                    </button>
                </form>
            </div>

            {/* ─── Database Management ─── */}
            {user?.role === "admin" && (
                <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6 mt-8">
                    <h2 className="text-xl font-bold text-red-700 mb-2">⚠️ Database Management</h2>
                    <p className="text-sm text-gray-600 mb-6">Upload a legacy SQL Server `.bak` file to restore the database. This action is destructive and will overwrite existing data.</p>
                    <form onSubmit={handleRestore} className="space-y-4">
                        <div>
                            <input
                                type="file"
                                accept=".bak"
                                onChange={(e) => setBackupFile(e.target.files?.[0] || null)}
                                className="w-full px-3 py-2 border rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                disabled={restoreStatus === "restoring"}
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!backupFile || restoreStatus === "restoring"}
                            className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-50"
                        >
                            {restoreStatus === "restoring" ? "Restoring..." : "🗑️ Overwrite & Restore Data"}
                        </button>

                        {restoreLogs && (
                            <div className="mt-4 p-4 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Migration Logs</h3>
                                <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap max-h-96 overflow-y-auto">
                                    {restoreLogs}
                                </pre>
                                {restoreStatus === "success" && (
                                    <p className="mt-2 text-sm font-bold text-emerald-400">✅ Database restored successfully!</p>
                                )}
                            </div>
                        )}
                    </form>
                </div>
            )}

            {/* ─── Data Backup (Demo Mode) ─── */}
            {user?.role === "admin" && (
                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6 mt-8">
                    <h2 className="text-xl font-bold text-blue-700 mb-1">💾 Data Backup</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Download a full JSON snapshot of all current data (patients, visits, appointments, billing, recalls, referrals).
                        Store this file safely — it can be used to review data or migrate to a permanent database.
                    </p>
                    <a
                        href="/api/settings/backup"
                        download
                        className="inline-block px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition"
                    >
                        ⬇️ Download Backup JSON
                    </a>
                    <div className="mt-6 border-t border-gray-100 pt-5">
                        <h3 className="font-bold text-gray-700 mb-3">📋 Moving to PostgreSQL (Permanent Storage)</h3>
                        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                            <li>Install PostgreSQL on this machine — <span className="font-mono text-xs bg-gray-100 px-1 rounded">winget install -e --id PostgreSQL.PostgreSQL</span></li>
                            <li>Create the database: <span className="font-mono text-xs bg-gray-100 px-1 rounded">createdb dentalclinic</span></li>
                            <li>Set the env variable: <span className="font-mono text-xs bg-gray-100 px-1 rounded">DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dentalclinic</span></li>
                            <li>Run migrations: <span className="font-mono text-xs bg-gray-100 px-1 rounded">npm run db:migrate</span></li>
                            <li>The app auto-saves clinic data snapshots to PostgreSQL when DATABASE_URL is set</li>
                        </ol>
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                            ⚠️ Currently running in <strong>demo/in-memory mode</strong> — data resets on server restart.
                            Set <code>DATABASE_URL</code> to switch to persistent PostgreSQL storage.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
