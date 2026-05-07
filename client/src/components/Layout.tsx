import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

    const navItems = [
        { label: "Dashboard", href: "/", roles: ["admin", "doctor", "reception"] },
        { label: "Patients", href: "/patients", roles: ["admin", "doctor", "reception"] },
        { label: "Reports", href: "/reports", roles: ["admin", "doctor"] },
        { label: "Billing", href: "/billing", roles: ["admin", "reception"] },
        { label: "Appointments", href: "/appointments", roles: ["admin", "doctor", "reception"] },
        { label: "Users", href: "/users", roles: ["admin"] },
        { label: "Settings", href: "/settings", roles: ["admin", "doctor", "reception"] },
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
                            <span className="text-2xl">🦷</span>
                            <span className="text-xl font-extrabold text-primary-900 hidden sm:inline">
                                DentalClinic
                            </span>
                        </Link>

                        <div className="hidden md:flex items-center gap-1">
                            {navItems.map((item) =>
                                canAccess(item.roles) ? (
                                    <Link
                                        key={item.href}
                                        to={item.href}
                                        className={cn(
                                            "px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
                                            location.pathname === item.href
                                                ? "bg-primary-50 text-primary-700"
                                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                        )}
                                    >
                                        {item.label}
                                    </Link>
                                ) : null
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
