const API_BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${url}`, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
        ...options,
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        const err = new Error(body.error || body.message || "Request failed") as Error & {
            status?: number;
            body?: any;
        };
        err.status = res.status;
        err.body = body;
        throw err;
    }

    // Handle 204 No Content or empty responses
    if (res.status === 204 || res.headers.get("content-length") === "0") {
        return {} as T;
    }

    return res.json();
}

// ─── Auth ───────────────────────────────────────────────────────────

export const api = {
    public: {
        branding: () => request<{ clinicName: string; clinicIcon: string; clinicSubtitle: string }>("/public/branding"),
    },

    auth: {
        login: (username: string, password: string) =>
            request("/auth/login", {
                method: "POST",
                body: JSON.stringify({ username, password }),
            }),
        logout: () => request("/auth/logout", { method: "POST" }),
        me: () => request<any>("/auth/me"),
        bootstrap: () => request("/auth/bootstrap", { method: "POST" }),
    },

    // ─── Patients ─────────────────────────────────────────────────────

    patients: {
        search: async (params: string | { firstName?: string; middleName?: string; lastName?: string; lastVisit?: Date; sortBy?: string; order?: string }) => {
            let query = "";
            if (typeof params === "string") {
                query = `q=${encodeURIComponent(params)}`;
            } else {
                const parts = [];
                if (params.firstName) parts.push(`firstName=${encodeURIComponent(params.firstName)}`);
                if (params.middleName) parts.push(`middleName=${encodeURIComponent(params.middleName)}`);
                if (params.lastName) parts.push(`lastName=${encodeURIComponent(params.lastName)}`);
                if (params.lastVisit) parts.push(`lastVisit=${params.lastVisit.toISOString()}`);
                if (params.sortBy) parts.push(`sortBy=${params.sortBy}`);
                if (params.order) parts.push(`order=${params.order}`);
                query = parts.join("&");
            }
            const res = await fetch(`/api/patients/search?${query}`);
            if (!res.ok) throw new Error("Failed to search patients");
            return res.json();
        },
        get: (id: string) => request<any>(`/patients/${id}`),
        list: (page = 1, limit = 30, sortBy = "lastVisit", order = "desc") =>
            request<{ patients: any[]; total: number }>(`/patients?page=${page}&limit=${limit}&sortBy=${sortBy}&order=${order}`),
        create: (data: any) =>
            request<any>("/patients", { method: "POST", body: JSON.stringify(data) }),
        update: (id: string, data: any) =>
            request<any>(`/patients/${id}`, { method: "PUT", body: JSON.stringify(data) }),
        insuranceSuggestions: (q: string) =>
            request<string[]>(`/patients/insurance-suggestions?q=${encodeURIComponent(q)}`),
    },

    // ─── Visits ───────────────────────────────────────────────────────

    visits: {
        queue: () => request<any[]>("/visits/queue"),
        get: (id: string) => request<any>(`/visits/${id}`),
        forPatient: (patientId: string) => request<any[]>(`/visits/patient/${patientId}`),
        delete: (id: string) =>
            request(`/visits/${id}`, { method: "DELETE" }),
        create: (data: any) =>
            request<any>("/visits", { method: "POST", body: JSON.stringify(data) }),
        updateStatus: (id: string, status: string) =>
            request<any>(`/visits/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            }),
        updateNotes: (id: string, data: any) =>
            request<any>(`/visits/${id}/notes`, {
                method: "PATCH",
                body: JSON.stringify(data),
            }),
        addFinding: (visitId: string, data: any) =>
            request<any>(`/visits/${visitId}/findings`, {
                method: "POST",
                body: JSON.stringify(data),
            }),
        deleteFinding: (id: string) =>
            request(`/visits/findings/${id}`, { method: "DELETE" }),
        updateFinding: (id: string, data: any) =>
            request<any>(`/visits/findings/${id}`, {
                method: "PATCH",
                body: JSON.stringify(data),
            }),
        addPrescription: (visitId: string, data: any) =>
            request<any>(`/visits/${visitId}/prescriptions`, {
                method: "POST",
                body: JSON.stringify(data),
            }),
        deletePrescription: (id: string) =>
            request(`/visits/prescriptions/${id}`, { method: "DELETE" }),
        addLabOrder: (visitId: string, data: any) =>
            request<any>(`/visits/${visitId}/lab-orders`, {
                method: "POST",
                body: JSON.stringify(data),
            }),
        updateLabOrder: (visitId: string, labId: string, data: any) =>
            request<any>(`/visits/${visitId}/lab-orders/${labId}`, {
                method: "PATCH",
                body: JSON.stringify(data),
            }),
        deleteLabOrder: (id: string) =>
            request(`/visits/lab-orders/${id}`, { method: "DELETE" }),
        addProcedure: (visitId: string, data: any) =>
            request<any>(`/visits/${visitId}/procedures`, {
                method: "POST",
                body: JSON.stringify(data),
            }),
        deleteProcedure: (id: string) =>
            request(`/visits/procedures/${id}`, { method: "DELETE" }),
    },

    // ─── Dental Charts ────────────────────────────────────────────────

    dentalCharts: {
        forPatient: (patientId: string) => request<any[]>(`/dental-charts/patient/${patientId}`),
        activeForPatient: (patientId: string) => request<any>(`/dental-charts/patient/${patientId}/active`),
        updateTooth: (chartId: string, toothCode: string, data: any) =>
            request<any>(`/dental-charts/${chartId}/tooth/${toothCode}`, {
                method: "PATCH",
                body: JSON.stringify(data),
            }),
    },

    // ─── Procedure Catalog ────────────────────────────────────────────

    procedureCatalog: {
        list: (category?: string) => request<any[]>(category ? `/procedure-catalog?category=${category}` : "/procedure-catalog"),
        search: (q: string) => request<any[]>(`/procedure-catalog/search?q=${encodeURIComponent(q)}`),
        create: (data: any) => request<any>("/procedure-catalog", { method: "POST", body: JSON.stringify(data) }),
    },

    // ─── Recalls ──────────────────────────────────────────────────────

    recalls: {
        list: () => request<any[]>("/recalls"),
        forPatient: (patientId: string) => request<any[]>(`/recalls/patient/${patientId}`),
        create: (data: any) => request<any>("/recalls", { method: "POST", body: JSON.stringify(data) }),
        update: (id: string, data: any) => request<any>(`/recalls/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
        delete: (id: string) => request(`/recalls/${id}`, { method: "DELETE" }),
    },

    // ─── Autocomplete ─────────────────────────────────────────────────

    autocomplete: {
        search: (category: string, q: string) =>
            request<any[]>(`/autocomplete?category=${category}&q=${encodeURIComponent(q)}`),
        popular: (category: string) =>
            request<any[]>(`/autocomplete/popular/${category}`),
    },

    // ─── Billing ──────────────────────────────────────────────────────

    billing: {
        forVisit: (visitId: string) => request<any>(`/billing/visit/${visitId}`),
        get: (startDate?: string, endDate?: string) => {
            const params = new URLSearchParams();
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);
            return request<any>(`/billing?${params.toString()}`);
        },
        create: (data: any) =>
            request<any>("/billing", { method: "POST", body: JSON.stringify(data) }),
        save: (data: any) =>
            request<any>("/billing", { method: "POST", body: JSON.stringify(data) }),
        addPayment: (data: any) =>
            request<any>("/billing/payments", { method: "POST", body: JSON.stringify(data) }),
    },

    // ─── Audit Log ────────────────────────────────────────────────────

    auditLog: {
        list: (limit = 100, resource?: string) => {
            const params = new URLSearchParams({ limit: limit.toString() });
            if (resource) params.set("resource", resource);
            return request<any[]>(`/audit-log?${params}`);
        },
    },

    // ─── WhatsApp ─────────────────────────────────────────────────────

    whatsapp: {
        status: () => request<any>("/whatsapp/status"),
        connect: () => request<any>("/whatsapp/connect", { method: "POST" }),
        disconnect: () => request<any>("/whatsapp/disconnect", { method: "POST" }),
        send: (phone: string, message: string) =>
            request<any>("/whatsapp/send", { method: "POST", body: JSON.stringify({ phone, message }) }),
        sendAppointmentReminder: (data: {
            patientName: string; phone: string; doctorName?: string;
            date: string; time: string; clinicName?: string;
        }) => request<any>("/whatsapp/send-appointment-reminder", { method: "POST", body: JSON.stringify(data) }),
        sendRecallReminder: (data: {
            patientName: string; phone: string; recallType?: string;
            dueDate: string; clinicName?: string;
        }) => request<any>("/whatsapp/send-recall-reminder", { method: "POST", body: JSON.stringify(data) }),
    },

    reports: {
        daily: (date?: string) =>
            request<any>(`/reports/daily${date ? `?date=${date}` : ""}`),
        monthly: (month?: number, year?: number) => {
            const params = new URLSearchParams();
            if (month) params.set("month", month.toString());
            if (year) params.set("year", year.toString());
            return request<any>(`/reports/monthly?${params}`);
        },
        financial: (from?: string, to?: string) => {
            const params = new URLSearchParams();
            if (from) params.set("from", from);
            if (to) params.set("to", to);
            return request<any>(`/reports/financial?${params}`);
        },
        topDiagnoses: () => request<any[]>("/reports/top-diagnoses"),
        topMedications: () => request<any[]>("/reports/top-medications"),
        ownerSummary: (from: string, to: string, groupBy: "daily" | "weekly" | "monthly" = "daily") => {
            const params = new URLSearchParams({ from, to, groupBy });
            return request<{
                range: { from: string; to: string; groupBy: "daily" | "weekly" | "monthly" };
                totals: {
                    billed: number;
                    collected: number;
                    outstanding: number;
                    visitCount: number;
                    procedureCount: number;
                    patientCount: number;
                    averageTicket: number;
                    collectionRate: number;
                };
                revenueTrend: Array<{ period: string; billed: number; collected: number; visits: number }>;
                doctorProduction: Array<{
                    doctorId: string;
                    doctorName: string;
                    billed: number;
                    collected: number;
                    outstanding: number;
                    visitCount: number;
                    procedureCount: number;
                    patientCount: number;
                    averageTicket: number;
                }>;
                topProcedures: Array<{ name: string; category: string; revenue: number; count: number }>;
                patientGrowth: Array<{ period: string; newPatients: number; activePatients: number }>;
            }>(`/reports/owner-summary?${params}`);
        },
        prescriptions: (startDate: string, endDate: string, medication?: string) => {
            const params = new URLSearchParams();
            params.set("from", startDate);
            params.set("to", endDate);
            if (medication) params.set("medication", medication);
            return request<any>(`/reports/prescriptions?${params}`);
        },
    },

    // ─── Appointments ─────────────────────────────────────────────────

    appointments: {
        list: (date: string, doctorId?: string) => {
            const params = new URLSearchParams({ date });
            if (doctorId) params.set("doctorId", doctorId);
            return request<any[]>(`/appointments?${params}`);
        },
        range: (from: string, to: string, doctorId?: string) => {
            const params = new URLSearchParams({ from, to });
            if (doctorId) params.set("doctorId", doctorId);
            return request<any[]>(`/appointments?${params}`);
        },
        doctors: () => request<{ id: string; name: string }[]>("/appointments/doctors"),
        forPatient: (patientId: string) =>
            request<any[]>(`/appointments/patient/${patientId}`),
        create: (data: any) =>
            request<any>("/appointments", { method: "POST", body: JSON.stringify(data) }),
        update: (id: string, data: any) =>
            request<any>(`/appointments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
        updateStatus: (id: string, status: string) =>
            request<any>(`/appointments/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            }),
        delete: (id: string) =>
            request(`/appointments/${id}`, { method: "DELETE" }),
    },

    // ─── Images ───────────────────────────────────────────────────────

    images: {
        forPatient: (patientId: string) =>
            request<any[]>(`/images/${patientId}`),
        upload: async (patientId: string, file: File, visitId?: string, caption?: string) => {
            const formData = new FormData();
            formData.append("image", file);
            if (visitId) formData.append("visitId", visitId);
            if (caption) formData.append("caption", caption);

            const res = await fetch(`/api/images/${patientId}/upload`, {
                method: "POST",
                credentials: "include",
                body: formData,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: res.statusText }));
                throw new Error(err.error || "Upload failed");
            }
            return res.json();
        },
        delete: (id: string) =>
            request(`/images/${id}`, { method: "DELETE" }),
    },

    // ─── Users (Admin) ────────────────────────────────────────────────

    users: {
        list: () => request<any[]>("/users"),
        create: (data: any) =>
            request<any>("/users", { method: "POST", body: JSON.stringify(data) }),
        update: (id: string, data: any) =>
            request<any>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
        resetPassword: (id: string, password: string) =>
            request(`/users/${id}/reset-password`, {
                method: "PATCH",
                body: JSON.stringify({ password }),
            }),
        changePassword: (currentPassword: string, newPassword: string) =>
            request("/users/change-password", {
                method: "PATCH",
                body: JSON.stringify({ currentPassword, newPassword }),
            }),
    },

    // ─── Settings ─────────────────────────────────────────────────────

    settings: {
        get: () => request<Record<string, string>>("/settings"),
        update: (data: Record<string, string>) =>
            request<Record<string, string>>("/settings", {
                method: "PUT",
                body: JSON.stringify(data),
            }),
        serverInfo: () =>
            request<{
                hostname: string;
                port: string;
                uiPort: string;
                addresses: { name: string; address: string; family: string }[];
                accessUrls: string[];
                httpsUrls: string[];
            }>("/settings/server-info"),
        restore: async (file: File) => {
            const formData = new FormData();
            formData.append("backup", file);

            const res = await fetch("/api/settings/restore", {
                method: "POST",
                credentials: "include",
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: res.statusText }));
                throw new Error(err.error || "Restore failed");
            }

            return res; // Returning the raw Response to allow streaming the body
        },
    },

    // ─── Follow-ups ───────────────────────────────────────────────────

    followUps: {
        forPatient: (patientId: string) =>
            request<any[]>(`/followups/patient/${patientId}`),
        upcoming: () => request<any[]>("/followups/upcoming"),
        overdue: () => request<any[]>("/followups/overdue"),
        create: (data: any) =>
            request<any>("/followups", { method: "POST", body: JSON.stringify(data) }),
        update: (id: string, data: any) =>
            request<any>(`/followups/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
        delete: (id: string) =>
            request(`/followups/${id}`, { method: "DELETE" }),
    },

    // ─── Referrals ────────────────────────────────────────────────────

    referrals: {
        forPatient: (patientId: string) =>
            request<any[]>(`/referrals/patient/${patientId}`),
        pending: () => request<any[]>("/referrals/pending"),
        create: (data: any) =>
            request<any>("/referrals", { method: "POST", body: JSON.stringify(data) }),
        update: (id: string, data: any) =>
            request<any>(`/referrals/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
        delete: (id: string) =>
            request(`/referrals/${id}`, { method: "DELETE" }),
    },

    // ─── Dashboard ────────────────────────────────────────────────────

    dashboard: {
        summary: () =>
            request<{
                today: {
                    date: string;
                    revenue: number;
                    billed: number;
                    outstanding: number;
                    appointments: number;
                    completedAppointments: number;
                    noShows: number;
                    noShowRate: number;
                    activePatients30d: number;
                    visits: number;
                };
                revenueTrend: Array<{ date: string; revenue: number; billed: number }>;
                appointmentsToday: Array<{
                    id: string;
                    patientId: string;
                    patientName: string;
                    patientPhone: string | null;
                    doctorId: string | null;
                    doctorName: string;
                    appointmentDate: string;
                    timeSlot: string;
                    duration: number | null;
                    type: string;
                    status: string;
                }>;
                unpaidInvoices: Array<{
                    id: string;
                    visitId: string;
                    patientId: string | null;
                    patientName: string;
                    totalAmount: number;
                    paidAmount: number;
                    balance: number;
                    status: string;
                    createdAt: string;
                }>;
            }>("/dashboard/summary"),
    },

    // ─── Reminders (Phase 5A) ─────────────────────────────────────────

    reminders: {
        logs: (params?: {
            appointmentId?: string;
            patientId?: string;
            status?: string;
            from?: string;
            to?: string;
        }) => {
            const p = new URLSearchParams();
            if (params?.appointmentId) p.set("appointmentId", params.appointmentId);
            if (params?.patientId) p.set("patientId", params.patientId);
            if (params?.status) p.set("status", params.status);
            if (params?.from) p.set("from", params.from);
            if (params?.to) p.set("to", params.to);
            const qs = p.toString();
            return request<any[]>(`/reminders/logs${qs ? `?${qs}` : ""}`);
        },
        send: (payload: {
            appointmentId: string;
            channel?: "whatsapp" | "sms" | "email";
            message?: string;
        }) =>
            request<{
                success: boolean;
                message: string;
                waUrl?: string;
                log: any;
            }>("/reminders/send", {
                method: "POST",
                body: JSON.stringify(payload),
            }),
        schedulerStatus: () =>
            request<{
                enabled: boolean;
                running: boolean;
                rules: Array<{ key: string; label: string; description: string }>;
                lastRunAt: string | null;
                lastRunSummary: {
                    checked: number;
                    sent: number;
                    skipped: number;
                    failed: number;
                    errors: string[];
                } | null;
            }>("/reminders/scheduler/status"),
        runSchedulerOnce: () =>
            request<{
                success: boolean;
                summary: {
                    checked: number;
                    sent: number;
                    skipped: number;
                    failed: number;
                    errors: string[];
                };
            }>("/reminders/scheduler/run-once", { method: "POST" }),
        settings: () =>
            request<{
                schedulerEnabled: boolean;
                defaultChannel: "whatsapp" | "sms" | "email";
                rules: Record<string, { enabled: boolean; channel: "whatsapp" | "sms" | "email" }>;
                templates: Record<string, string>;
            }>("/reminders/settings"),
        updateSettings: (payload: {
            schedulerEnabled?: boolean;
            defaultChannel?: "whatsapp" | "sms" | "email";
            rules?: Record<string, { enabled?: boolean; channel?: "whatsapp" | "sms" | "email" }>;
            templates?: Record<string, string>;
        }) =>
            request<{
                schedulerEnabled: boolean;
                defaultChannel: "whatsapp" | "sms" | "email";
                rules: Record<string, { enabled: boolean; channel: "whatsapp" | "sms" | "email" }>;
                templates: Record<string, string>;
            }>("/reminders/settings", {
                method: "PUT",
                body: JSON.stringify(payload),
            }),
        resetSettings: () =>
            request<{
                schedulerEnabled: boolean;
                defaultChannel: "whatsapp" | "sms" | "email";
                rules: Record<string, { enabled: boolean; channel: "whatsapp" | "sms" | "email" }>;
                templates: Record<string, string>;
            }>("/reminders/settings/reset", { method: "POST" }),
        preferences: (patientId: string) =>
            request<{
                remindersEnabled: boolean;
                whatsapp: boolean;
                sms: boolean;
                email: boolean;
            }>(`/reminders/preferences/${patientId}`),
        updatePreferences: (
            patientId: string,
            payload: { remindersEnabled?: boolean; whatsapp?: boolean; sms?: boolean; email?: boolean }
        ) =>
            request<{
                remindersEnabled: boolean;
                whatsapp: boolean;
                sms: boolean;
                email: boolean;
            }>(`/reminders/preferences/${patientId}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            }),
    },

    // ─── AI ───────────────────────────────────────────────────────────

    ai: {
        chat: (message: string, history: any[]) =>
            request<{ text: string }>("/ai/chat", {
                method: "POST",
                body: JSON.stringify({ message, history }),
            }),
    },

    // ─── Ledger (Phase 6A) ────────────────────────────────────────────

    ledger: {
        patient: (patientId: string) =>
            request<{
                patientId: string;
                patientName: string;
                totals: {
                    charged: number;
                    paid: number;
                    balance: number;
                    invoiceCount: number;
                    paymentCount: number;
                    lastPaymentDate: string | null;
                    lastChargeDate: string | null;
                };
                entries: Array<{
                    id: string;
                    patientId: string;
                    date: string;
                    type: "charge" | "payment" | "adjustment";
                    sourceType: "visit" | "invoice" | "payment" | "manual";
                    sourceId: string;
                    description: string;
                    debit: number;
                    credit: number;
                    balanceAfter: number;
                    status?: string;
                }>;
            }>(`/ledger/patient/${patientId}`),
        patients: () =>
            request<
                Array<{
                    patientId: string;
                    patientName: string;
                    charged: number;
                    paid: number;
                    balance: number;
                    lastActivityDate: string | null;
                }>
            >("/ledger/patients"),
        addAdjustment: (
            patientId: string,
            payload: { amount: number; description: string; direction: "debit" | "credit" }
        ) =>
            request<{ success: boolean; adjustment: any; note?: string }>(
                `/ledger/patient/${patientId}/adjustment`,
                {
                    method: "POST",
                    body: JSON.stringify(payload),
                }
            ),
        statement: (patientId: string, params?: { from?: string; to?: string }) => {
            const p = new URLSearchParams();
            if (params?.from) p.set("from", params.from);
            if (params?.to) p.set("to", params.to);
            const qs = p.toString();
            return request<{
                patient: {
                    id: string;
                    name: string;
                    phone?: string | null;
                    email?: string | null;
                };
                statement: {
                    from: string;
                    to: string;
                    generatedAt: string;
                    openingBalance: number;
                    totalCharges: number;
                    totalPayments: number;
                    totalAdjustments: number;
                    closingBalance: number;
                };
                entries: Array<{
                    id: string;
                    date: string;
                    type: "charge" | "payment" | "adjustment";
                    sourceType: string;
                    sourceId: string;
                    description: string;
                    debit: number;
                    credit: number;
                    balanceAfter: number;
                    status?: string;
                }>;
                paymentPlans: Array<{
                    planId: string;
                    title: string;
                    status: string;
                    totalAmount: number;
                    paidAmount: number;
                    remainingAmount: number;
                    nextDueDate: string | null;
                    overdueAmount: number;
                    overdueCount: number;
                }>;
            }>(`/ledger/patient/${patientId}/statement${qs ? `?${qs}` : ""}`);
        },
        shareStatement: (
            patientId: string,
            payload: {
                from?: string;
                to?: string;
                channel: "whatsapp" | "email";
                message?: string;
            }
        ) =>
            request<{
                success: boolean;
                status: "sent" | "stubbed" | "not_configured" | "failed";
                channel: "whatsapp" | "email";
                message: string;
                waUrl?: string;
                log?: {
                    id: string;
                    patientId: string;
                    patientName: string;
                    channel: "whatsapp" | "email";
                    status: "sent" | "stubbed" | "not_configured" | "failed";
                    from?: string;
                    to?: string;
                    closingBalance: number;
                    message: string;
                    error?: string;
                    createdAt: string;
                };
            }>(`/ledger/patient/${patientId}/statement/share`, {
                method: "POST",
                body: JSON.stringify(payload),
            }),
        statementShareLogs: (patientId: string) =>
            request<{
                patientId: string;
                patientName: string;
                logs: Array<{
                    id: string;
                    patientId: string;
                    patientName: string;
                    channel: "whatsapp" | "email";
                    status: "sent" | "stubbed" | "not_configured" | "failed";
                    from?: string;
                    to?: string;
                    closingBalance: number;
                    message: string;
                    error?: string;
                    createdAt: string;
                }>;
                count: number;
            }>(`/ledger/patient/${patientId}/statement/share-logs`),
        // ─── Aging (Phase 6D1) ──────────────────────────────────────────────
        aging: () =>
            request<{
                asOf: string;
                totals: {
                    totalBalance: number;
                    current: number;
                    days31to60: number;
                    days61to90: number;
                    over90: number;
                    patientCount: number;
                    overduePatientCount: number;
                };
                patients: Array<{
                    patientId: string;
                    patientName: string;
                    totalBalance: number;
                    buckets: {
                        current: number;
                        days31to60: number;
                        days61to90: number;
                        over90: number;
                    };
                    oldestUnpaidDate: string | null;
                    lastPaymentDate: string | null;
                }>;
            }>("/ledger/aging"),
        patientAging: (patientId: string) =>
            request<{
                patientId: string;
                patientName: string;
                totalBalance: number;
                buckets: {
                    current: number;
                    days31to60: number;
                    days61to90: number;
                    over90: number;
                };
                oldestUnpaidDate: string | null;
                lastPaymentDate: string | null;
            }>(`/ledger/patient/${patientId}/aging`),
    },

    // ─── Payment Plans (Phase 6B) ─────────────────────────────────────

    paymentPlans: {
        patient: (patientId: string) =>
            request<{
                patientId: string;
                patientName: string;
                plans: Array<{
                    plan: {
                        id: string;
                        patientId: string;
                        title: string;
                        description?: string;
                        totalAmount: number;
                        downPayment: number;
                        installmentCount: number;
                        installmentAmount: number;
                        startDate: string;
                        frequency: "weekly" | "biweekly" | "monthly";
                        status: "active" | "completed" | "cancelled";
                        createdAt: string;
                        updatedAt: string;
                    };
                    installments: Array<{
                        id: string;
                        planId: string;
                        patientId: string;
                        installmentNumber: number;
                        dueDate: string;
                        amount: number;
                        paidAmount: number;
                        status: "pending" | "partial" | "paid" | "overdue" | "cancelled";
                        paidAt?: string | null;
                    }>;
                    summary: {
                        totalAmount: number;
                        downPayment: number;
                        scheduledAmount: number;
                        paidAmount: number;
                        remainingAmount: number;
                        nextDueDate: string | null;
                        overdueAmount: number;
                        overdueCount: number;
                    };
                }>;
            }>(`/payment-plans/patient/${patientId}`),
        create: (
            patientId: string,
            payload: {
                title: string;
                description?: string;
                totalAmount: number;
                downPayment?: number;
                installmentCount: number;
                startDate: string;
                frequency: "weekly" | "biweekly" | "monthly";
            }
        ) =>
            request<{
                success: boolean;
                plan: any;
                installments: any[];
                summary: any;
                note?: string;
            }>(`/payment-plans/patient/${patientId}`, {
                method: "POST",
                body: JSON.stringify(payload),
            }),
        updateStatus: (planId: string, status: "active" | "completed" | "cancelled") =>
            request<{
                success: boolean;
                plan: any;
                installments: any[];
                summary: any;
            }>(`/payment-plans/${planId}/status`, {
                method: "PUT",
                body: JSON.stringify({ status }),
            }),
        payInstallment: (
            installmentId: string,
            payload: { amount: number; note?: string }
        ) =>
            request<{
                success: boolean;
                payment: any;
                installment: any;
                summary: any;
                ledgerEntry?: any;
                note?: string;
            }>(`/payment-plans/installments/${installmentId}/payment`, {
                method: "POST",
                body: JSON.stringify(payload),
            }),
    },

    // ─── Treatment Plans (Phase 7A) ───────────────────────────────────

    treatmentPlans: {
        patient: (patientId: string) =>
            request<{
                patientId: string;
                patientName: string;
                plans: Array<{
                    plan: {
                        id: string;
                        patientId: string;
                        title: string;
                        description?: string;
                        status: "draft" | "presented" | "accepted" | "partially_accepted" | "declined" | "completed" | "cancelled";
                        createdAt: string;
                        updatedAt: string;
                    };
                    items: Array<{
                        id: string;
                        planId: string;
                        patientId: string;
                        tooth?: string | null;
                        area?: string | null;
                        procedureName: string;
                        category?: string | null;
                        description?: string;
                        estimatedCost: number;
                        priority: "low" | "medium" | "high" | "urgent";
                        status: "proposed" | "accepted" | "declined" | "completed" | "cancelled";
                        notes?: string;
                        createdAt: string;
                        updatedAt: string;
                    }>;
                    summary: {
                        itemCount: number;
                        proposedTotal: number;
                        acceptedTotal: number;
                        completedTotal: number;
                        declinedTotal: number;
                        remainingAcceptedTotal: number;
                    };
                }>;
            }>(`/treatment-plans/patient/${patientId}`),
        create: (patientId: string, payload: { title: string; description?: string }) =>
            request<{
                id: string;
                patientId: string;
                title: string;
                description?: string;
                status: string;
                createdAt: string;
                updatedAt: string;
            }>(`/treatment-plans/patient/${patientId}`, {
                method: "POST",
                body: JSON.stringify(payload),
            }),
        update: (
            planId: string,
            payload: { title?: string; description?: string; status?: string }
        ) =>
            request<{
                id: string;
                patientId: string;
                title: string;
                description?: string;
                status: string;
                createdAt: string;
                updatedAt: string;
            }>(`/treatment-plans/${planId}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            }),
        addItem: (
            planId: string,
            payload: {
                tooth?: string;
                area?: string;
                procedureName: string;
                category?: string;
                description?: string;
                estimatedCost: number;
                priority: "low" | "medium" | "high" | "urgent";
                notes?: string;
            }
        ) =>
            request<{
                id: string;
                planId: string;
                patientId: string;
                tooth?: string | null;
                area?: string | null;
                procedureName: string;
                category?: string | null;
                description?: string;
                estimatedCost: number;
                priority: string;
                status: string;
                notes?: string;
                createdAt: string;
                updatedAt: string;
            }>(`/treatment-plans/${planId}/items`, {
                method: "POST",
                body: JSON.stringify(payload),
            }),
        updateItem: (
            itemId: string,
            payload: {
                tooth?: string;
                area?: string;
                procedureName?: string;
                category?: string;
                description?: string;
                estimatedCost?: number;
                priority?: "low" | "medium" | "high" | "urgent";
                status?: "proposed" | "accepted" | "declined" | "completed" | "cancelled";
                notes?: string;
            }
        ) =>
            request<{
                id: string;
                planId: string;
                patientId: string;
                tooth?: string | null;
                area?: string | null;
                procedureName: string;
                category?: string | null;
                description?: string;
                estimatedCost: number;
                priority: string;
                status: string;
                notes?: string;
                createdAt: string;
                updatedAt: string;
            }>(`/treatment-plans/items/${itemId}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            }),
        deleteItem: (itemId: string) =>
            request<{ success: boolean; message: string; item?: any }>(
                `/treatment-plans/items/${itemId}`,
                {
                    method: "DELETE",
                }
            ),
    },
};

export default api;
