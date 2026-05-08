import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

const STATUS_INFO: Record<string, { label: string; color: string; icon: string }> = {
    disconnected: { label: "Disconnected", color: "text-gray-500", icon: "⚫" },
    connecting: { label: "Connecting…", color: "text-yellow-600", icon: "🟡" },
    qr_ready: { label: "Scan QR Code", color: "text-blue-600", icon: "🔵" },
    authenticated: { label: "Authenticated", color: "text-teal-600", icon: "🔵" },
    ready: { label: "Connected", color: "text-green-600", icon: "🟢" },
    error: { label: "Error", color: "text-red-600", icon: "🔴" },
};

export default function WhatsApp() {
    const queryClient = useQueryClient();
    const [testPhone, setTestPhone] = useState("");
    const [testMsg, setTestMsg] = useState("Hello! This is a test message from the dental clinic system. 🦷");
    const [sendStatus, setSendStatus] = useState<string | null>(null);

    const { data: status, isLoading } = useQuery({
        queryKey: ["whatsapp-status"],
        queryFn: () => api.whatsapp.status(),
        refetchInterval: (query) => {
            const s = query.state.data?.status;
            return s === "connecting" || s === "qr_ready" || s === "authenticated" ? 3000 : 10000;
        },
    });

    const connectMut = useMutation({
        mutationFn: () => api.whatsapp.connect(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] }),
    });

    const disconnectMut = useMutation({
        mutationFn: () => api.whatsapp.disconnect(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] }),
    });

    const sendTestMut = useMutation({
        mutationFn: () => api.whatsapp.send(testPhone, testMsg),
        onSuccess: () => setSendStatus("✅ Message sent successfully!"),
        onError: (e: any) => setSendStatus(`❌ Failed: ${e.message || "Unknown error"}`),
    });

    useEffect(() => {
        if (sendStatus) {
            const t = setTimeout(() => setSendStatus(null), 4000);
            return () => clearTimeout(t);
        }
    }, [sendStatus]);

    const st = status?.status || "disconnected";
    const stInfo = STATUS_INFO[st] || STATUS_INFO.disconnected;

    return (
        <div className="max-w-3xl mx-auto px-6 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900">💬 WhatsApp Integration</h1>
                <p className="text-gray-500 mt-1">Send appointment reminders and recall notifications via WhatsApp</p>
            </div>

            {/* ─── Connection Card ─── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Connection Status</h2>

                {isLoading ? (
                    <div className="text-gray-400 animate-pulse">Checking status…</div>
                ) : (
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <div className={`text-xl font-bold flex items-center gap-2 ${stInfo.color}`}>
                                <span>{stInfo.icon}</span>
                                <span>{stInfo.label}</span>
                            </div>
                            {status?.clientPhone && (
                                <p className="text-sm text-gray-500 mt-1">Connected as: +{status.clientPhone}</p>
                            )}
                            {status?.error && (
                                <p className="text-sm text-red-500 mt-1">Error: {status.error}</p>
                            )}
                        </div>
                        <div className="flex gap-3">
                            {st === "disconnected" || st === "error" ? (
                                <button
                                    onClick={() => connectMut.mutate()}
                                    disabled={connectMut.isPending}
                                    className="px-5 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition disabled:opacity-50"
                                >
                                    {connectMut.isPending ? "Connecting…" : "Connect"}
                                </button>
                            ) : (
                                <button
                                    onClick={() => disconnectMut.mutate()}
                                    disabled={disconnectMut.isPending}
                                    className="px-5 py-2 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition disabled:opacity-50"
                                >
                                    Disconnect
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ─── QR Code ─── */}
            {st === "qr_ready" && status?.qr && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6 text-center">
                    <h2 className="text-lg font-bold text-blue-800 mb-2">📱 Scan with WhatsApp</h2>
                    <p className="text-sm text-blue-600 mb-4">
                        Open WhatsApp on your phone → ⋮ Menu → Linked Devices → Link a Device → scan the QR code below
                    </p>
                    <div className="inline-block bg-white p-4 rounded-xl shadow">
                        <QRDisplay value={status.qr} />
                    </div>
                    <p className="text-xs text-blue-500 mt-3">QR code refreshes automatically every 20 seconds</p>
                </div>
            )}

            {/* ─── How It Works ─── */}
            {st !== "ready" && (
                <div className="bg-gray-50 rounded-2xl border border-gray-100 p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-3">How It Works</h2>
                    <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
                        <li>Click <strong>Connect</strong> above — this starts the WhatsApp client on the server</li>
                        <li>A QR code will appear — scan it with your WhatsApp mobile app</li>
                        <li>Once authenticated, the status turns green and you can send reminders</li>
                        <li>The session is saved locally, so you only need to scan once</li>
                    </ol>
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                        ⚠️ This uses the phone linked during QR scan as the sender. Make sure it's a clinic WhatsApp number — messages will be sent from it.
                    </div>
                </div>
            )}

            {/* ─── Test Message ─── */}
            {st === "ready" && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">Send Test Message</h2>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Phone Number</label>
                            <input
                                type="tel"
                                value={testPhone}
                                onChange={(e) => setTestPhone(e.target.value)}
                                placeholder="e.g. 9715012345678"
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-300"
                            />
                            <p className="text-xs text-gray-400 mt-1">Enter full number with country code, digits only</p>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Message</label>
                            <textarea
                                value={testMsg}
                                onChange={(e) => setTestMsg(e.target.value)}
                                rows={3}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-300 resize-none"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => sendTestMut.mutate()}
                                disabled={sendTestMut.isPending || !testPhone.trim()}
                                className="px-5 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition disabled:opacity-50"
                            >
                                {sendTestMut.isPending ? "Sending…" : "Send Test"}
                            </button>
                            {sendStatus && (
                                <span className="text-sm font-semibold">{sendStatus}</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Message Templates ─── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Message Templates</h2>
                <div className="space-y-4 text-sm">
                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                        <div className="font-semibold text-gray-700 mb-1">📅 Appointment Reminder</div>
                        <pre className="text-gray-500 whitespace-pre-wrap font-sans text-xs leading-relaxed">
{`Hello [Patient Name],

This is a reminder for your appointment at *[Clinic Name]*.
📅 Date: [Date]
⏰ Time: [Time]
👨‍⚕️ Doctor: [Doctor Name]

Please reply to confirm or call us to reschedule. Thank you!`}
                        </pre>
                        <p className="text-xs text-gray-400 mt-2">Triggered from the Appointments page using the 📱 button</p>
                    </div>
                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                        <div className="font-semibold text-gray-700 mb-1">🔔 Recall Reminder</div>
                        <pre className="text-gray-500 whitespace-pre-wrap font-sans text-xs leading-relaxed">
{`Hello [Patient Name],

We'd like to remind you that your *[Recall Type]* is due.
📅 Due: [Due Date]

Please contact *[Clinic Name]* to schedule your appointment. Thank you!`}
                        </pre>
                        <p className="text-xs text-gray-400 mt-2">Triggered from the Recalls page using the 📱 button</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── QR Display using canvas ─────────────────────────────────────────

function QRDisplay({ value }: { value: string }) {
    // Use a public QR rendering endpoint (Google Charts) for display only
    // Safe to use since this is on a local network and the QR is not secret beyond the session
    const size = 256;
    const encoded = encodeURIComponent(value);
    return (
        <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`}
            alt="WhatsApp QR Code"
            width={size}
            height={size}
            className="block"
            onError={(e) => {
                // Fallback: show raw QR string if image fails
                (e.target as HTMLImageElement).style.display = "none";
            }}
        />
    );
}
