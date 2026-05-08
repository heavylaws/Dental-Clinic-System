import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { Toaster } from "./ui/Toaster";
import { useToast } from "./ui/use-toast";
import { useWebSocket } from "../lib/ws";
import Chatbot from "./Chatbot";

interface LayoutProps {
    user: any;
}

export default function Layout({ user }: LayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { data: settings } = useQuery({
        queryKey: ["settings"],
        queryFn: api.settings.get,
        staleTime: 60000,
    });

    const clinicIcon = settings?.clinic_icon || "🦷";
    const clinicName = settings?.clinic_name || settings?.clinicName || "DentalClinic";

    useWebSocket("visit:completed", (data: any) => {
        if (user.role === "reception" || user.role === "admin") {
            toast({
                title: "Visit Completed",
                description: `Dr. finished with ${data.patientName}. Ready for billing.`,
                variant: "success",
            });
            queryClient.invalidateQueries({ queryKey: ["queue"] });
        }
    });

    const logoutMutation = useMutation({
        mutationFn: api.auth.logout,
        onSettled: () => {
            queryClient.clear();
            window.location.href = "/login";
        },
    });

    const [adminMenuOpen, setAdminMenuOpen] = useState(false);
    const adminMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (adminMenuRef.current && !adminMenuRef.current.contains(e.target as Node)) {
                setAdminMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const navItems = [
        { label: "Dashboard", href: "/", roles: ["admin", "doctor", "reception"] },
        { label: "Patients", href: "/patients", roles: ["admin", "doctor", "reception"] },
        { label: "Recalls", href: "/recalls", roles: ["admin", "doctor", "reception"] },
        { label: "Reports", href: "/reports", roles: ["admin", "doctor"] },
        { label: "Billing", href: "/billing", roles: ["admin", "reception"] },
        { label: "Appointments", href: "/appointments", roles: ["admin", "doctor", "reception"] },
        { label: "WhatsApp", href: "/whatsapp", roles: ["admin", "reception"] },
        { label: "Settings", href: "/settings", roles: ["admin", "doctor", "reception"] },
    ];

    // Admin-only items go in a dropdown to avoid nav overflow
    const adminOnlyItems = [
        { label: "Users", href: "/users" },
        { label: "Audit Log", href: "/audit-log" },
    ];

    const canAccess = (roles: string[]) => roles.includes(user.role);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* ─── Navigation Bar ─── */}
            <nav className="bg-white border-b-2 border-primary-100 shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    {/* Logo & Links */}
                    <div className="flex items-center gap-8">
                        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition">
                            <span className="text-2xl">{clinicIcon}</span>
                            <span className="text-xl font-extrabold text-primary-900 hidden sm:inline">
                                {clinicName}
                            </span>
                        </Link>

                        <div className="hidden md:flex items-center gap-1">
                            {navItems.map((item) =>
                                canAccess(item.roles) ? (
                                    <Link
                                        key={item.href}
                                        to={item.href}
                                        className={cn(
                                            "px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
                                            location.pathname === item.href
                                                ? "bg-primary-50 text-primary-700"
                                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                        )}
                                    >
                                        {item.label}
                                    </Link>
                                ) : null
                            )}
                            {/* Admin dropdown */}
                            {user.role === "admin" && (
                                <div className="relative" ref={adminMenuRef}>
                                    <button
                                        onClick={() => setAdminMenuOpen((v) => !v)}
                                        className={cn(
                                            "px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1",
                                            adminOnlyItems.some((i) => location.pathname === i.href)
                                                ? "bg-primary-50 text-primary-700"
                                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                        )}
                                    >
                                        Admin
                                        <svg className="w-3 h-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {adminMenuOpen && (
                                        <div className="absolute top-full left-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                                            {adminOnlyItems.map((item) => (
                                                <Link
                                                    key={item.href}
                                                    to={item.href}
                                                    onClick={() => setAdminMenuOpen(false)}
                                                    className={cn(
                                                        "block px-4 py-2 text-sm font-semibold transition-colors",
                                                        location.pathname === item.href
                                                            ? "bg-primary-50 text-primary-700"
                                                            : "text-gray-700 hover:bg-gray-100"
                                                    )}
                                                >
                                                    {item.label}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* User Profile & Actions */}
                    <div className="flex items-center gap-4 sm:gap-6">
                        <div className="hidden lg:block text-right">
                            <p className="font-semibold text-sm text-gray-800">{user.displayName}</p>
                            <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                        </div>
                        <div className="h-8 w-[1px] bg-gray-200 hidden lg:block"></div>
                        <button
                            onClick={() => logoutMutation.mutate()}
                            className="text-xs sm:text-sm font-bold text-gray-400 hover:text-danger-600 transition uppercase tracking-wider"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </nav>

            {/* ─── Main Content ─── */}
            <main className="flex-1">
                <Outlet />
            </main>
            <Toaster />
            <Chatbot />
        </div>
    );
}
