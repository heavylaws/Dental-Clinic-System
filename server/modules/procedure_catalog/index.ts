import { Router } from "express";
import { db } from "../../db/index.js";
import { dentalProcedureCatalog } from "../../db/schema.js";
import { eq, ilike } from "drizzle-orm";
import { requireAuth } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

// ─── Get all procedures (or filter by category) ─────────────────────

router.get("/", async (req, res) => {
    try {
        const { category } = req.query;
        let query = db.select().from(dentalProcedureCatalog).where(eq(dentalProcedureCatalog.isActive, true));
        
        if (category) {
            query = query.where(eq(dentalProcedureCatalog.category, category as string));
        }

        const catalog = await query;
        res.json(catalog);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Search procedures ──────────────────────────────────────────────

router.get("/search", async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== "string") return res.json([]);

        const results = await db.select()
            .from(dentalProcedureCatalog)
            .where(ilike(dentalProcedureCatalog.name, `%${q}%`))
            .limit(10);
            
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Create a catalog procedure (Admin) ─────────────────────────────

router.post("/", async (req, res) => {
    try {
        const data = req.body;
        const [proc] = await db.insert(dentalProcedureCatalog).values(data).returning();
        res.status(201).json(proc);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export { router as procedureCatalogRouter };
