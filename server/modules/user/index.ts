import { Router } from "express";
import { requireAuth, requireRole, demoUsers } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

// ─── List all users (admin only) ────────────────────────────────────

router.get("/", requireRole("admin"), (_req, res) => {
    const safeUsers = demoUsers.map(({ password: _, ...u }) => ({
        ...u,
        createdAt: new Date("2026-01-01").toISOString(),
    }));
    res.json(safeUsers);
});

// ─── Create user (admin only) ───────────────────────────────────────

router.post("/", requireRole("admin"), (req, res) => {
    const { username, password, displayName, role } = req.body;
    if (!username || !password || !displayName) {
        return res.status(400).json({ error: "username, password, displayName are required" });
    }
    if (demoUsers.find(u => u.username === username)) {
        return res.status(409).json({ error: "Username already exists" });
    }
    const newUser = {
        id: String(demoUsers.length + 1),
        username,
        password,
        displayName,
        role: role || "reception",
        isActive: true,
    };
    demoUsers.push(newUser as any);
    const { password: _, ...safeUser } = newUser;
    res.status(201).json({ ...safeUser, createdAt: new Date().toISOString() });
});

// ─── Update user (admin only) ───────────────────────────────────────

router.put("/:id", requireRole("admin"), (req, res) => {
    const user = demoUsers.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { displayName, role, isActive } = req.body;
    if (displayName !== undefined) user.displayName = displayName;
    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    const { password: _, ...safeUser } = user;
    res.json({ ...safeUser, createdAt: new Date("2026-01-01").toISOString() });
});

// ─── Reset user password (admin only) ───────────────────────────────

router.patch("/:id/reset-password", requireRole("admin"), (req, res) => {
    const user = demoUsers.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { password } = req.body;
    if (!password || password.length < 4) {
        return res.status(400).json({ error: "Password must be at least 4 characters" });
    }
    user.password = password;
    res.json({ success: true });
});

// ─── Change own password (any authenticated user) ───────────────────

router.patch("/change-password", (req, res) => {
    const currentUser = req.user as any;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new password required" });
    }
    if (newPassword.length < 4) {
        return res.status(400).json({ error: "New password must be at least 4 characters" });
    }
    const user = demoUsers.find(u => u.id === currentUser.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (currentPassword !== user.password) {
        return res.status(401).json({ error: "Current password is incorrect" });
    }
    user.password = newPassword;
    res.json({ success: true });
});

export { router as userRouter };
