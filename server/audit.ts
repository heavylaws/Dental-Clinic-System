// ─── In-Memory Audit Log ─────────────────────────────────────────────────────

export interface AuditEntry {
    id: string;
    timestamp: string;
    userId: string;
    username: string;
    role: string;
    method: string;
    path: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    status: number;
    ipAddress: string;
}

const MAX_ENTRIES = 500;
export const auditLog: AuditEntry[] = [];

let _counter = 0;
function nextId() {
    return `al${++_counter}`;
}

function classifyAction(method: string, path: string): { action: string; resourceType: string; resourceId?: string } {
    const parts = path.replace(/^\/api\//, "").split("/");
    const resource = parts[0];
    const id = parts[1] && !parts[1].startsWith("?") ? parts[1] : undefined;
    const sub = parts[2];

    const resourceMap: Record<string, string> = {
        patients: "Patient",
        visits: "Visit",
        billing: "Billing",
        appointments: "Appointment",
        recalls: "Recall",
        referrals: "Referral",
        users: "User",
        settings: "Settings",
    };

    const resourceType = resourceMap[resource] || resource;

    let action = "VIEW";
    if (method === "POST") action = sub ? `ADD_${sub.replace("-", "_").toUpperCase()}` : "CREATE";
    else if (method === "PUT" || method === "PATCH") action = "UPDATE";
    else if (method === "DELETE") action = "DELETE";

    return { action, resourceType, resourceId: id };
}

export function createAuditMiddleware() {
    return (req: any, res: any, next: any) => {
        // Only log write operations + logins
        const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
        const isLogin = req.path.includes("/auth/login");

        if (!isWrite && !isLogin) return next();
        if (req.path.includes("/health") || req.path.includes("/server-info")) return next();

        const originalSend = res.json.bind(res);
        res.json = (body: any) => {
            if (res.statusCode < 400 && req.user) {
                const { action, resourceType, resourceId } = classifyAction(req.method, req.path);
                const entry: AuditEntry = {
                    id: nextId(),
                    timestamp: new Date().toISOString(),
                    userId: req.user.id,
                    username: req.user.username,
                    role: req.user.role,
                    method: req.method,
                    path: req.path,
                    action,
                    resourceType,
                    resourceId,
                    status: res.statusCode,
                    ipAddress: req.ip || req.connection?.remoteAddress || "unknown",
                };
                auditLog.unshift(entry);
                if (auditLog.length > MAX_ENTRIES) auditLog.pop();
            }
            return originalSend(body);
        };

        next();
    };
}
