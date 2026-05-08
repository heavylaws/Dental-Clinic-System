import { Router } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import type { Express, Request, Response, NextFunction } from "express";

const router = Router();

// ─── Demo In-Memory User Store (for testing without database) ─────────────

interface DemoUser {
    id: string;
    username: string;
    password: string;
    displayName: string;
    role: "admin" | "doctor" | "reception";
    isActive: boolean;
}

const demoUsers: DemoUser[] = [
    {
        id: "1",
        username: "admin",
        password: "admin123",
        displayName: "Admin",
        role: "admin",
        isActive: true,
    },
    {
        id: "2",
        username: "doctor",
        password: "doctor123",
        displayName: "Dr. Mohammed Al-Mansouri",
        role: "doctor",
        isActive: true,
    },
    {
        id: "3",
        username: "reception",
        password: "reception123",
        displayName: "Reception",
        role: "reception",
        isActive: true,
    },
    {
        id: "4",
        username: "doctor2",
        password: "doctor123",
        displayName: "Dr. Layla Boujdaria",
        role: "doctor",
        isActive: true,
    },
];

// ─── Passport Setup ─────────────────────────────────────────────────

export function setupPassport(app: Express) {
    passport.use(
        new LocalStrategy(
            {
                usernameField: "username",
                passwordField: "password",
                passReqToCallback: false,
            },
            async (username, password, done) => {
                try {
                    const user = demoUsers.find(u => u.username === username);

                    if (!user) return done(null, false, { message: "Invalid credentials" });
                    if (!user.isActive) return done(null, false, { message: "Account disabled" });

                    // Demo mode: plaintext password comparison
                    const valid = password === user.password;
                    if (!valid) return done(null, false, { message: "Invalid credentials" });

                    return done(null, user);
                } catch (err) {
                    return done(err);
                }
            }
        )
    );

    passport.serializeUser((user: any, done) => done(null, user.id));
    passport.deserializeUser((id: string, done) => {
        const user = demoUsers.find(u => u.id === id);
        done(null, user || null);
    });

    app.use(passport.initialize());
    app.use(passport.session());
}

// ─── Auth Middleware ─────────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: "Not authenticated" });
}

export function requireRole(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        const user = req.user as any;
        if (!roles.includes(user.role)) {
            return res.status(403).json({ error: "Insufficient permissions" });
        }
        next();
    };
}

// ─── Routes ─────────────────────────────────────────────────────────

router.post("/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ error: info?.message || "Login failed" });
        req.logIn(user, (err) => {
            if (err) return next(err);
            const { password, ...safeUser } = user;
            res.json(safeUser);
        });
    })(req, res, next);
});

router.post("/logout", (req, res) => {
    req.logout((err) => {
        if (err) return res.status(500).json({ error: "Logout failed" });
        res.json({ success: true });
    });
});

router.get("/me", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
    const user = req.user as any;
    const { password, ...safeUser } = user;
    res.json(safeUser);
});

// ─── Bootstrap: Already initialized with demo users ───────────────

router.post("/bootstrap", async (req, res) => {
    res.json({
        message: "Demo auth initialized",
        users: [
            { username: "admin", password: "admin123", role: "admin" },
            { username: "doctor", password: "doctor123", role: "doctor" },
            { username: "reception", password: "reception123", role: "reception" },
        ],
    });
});

export { router as authRouter };
export { demoUsers };
