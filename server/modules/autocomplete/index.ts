import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import { demoTerms } from "../../demo-store.js";

const router = Router();
router.use(requireAuth);

// Autocomplete query
router.get("/", (req, res) => {
    const category = (req.query.category as string) || "";
    const query = ((req.query.q as string) || "").toLowerCase();
    const limit = parseInt(req.query.limit as string) || 8;

    const results = demoTerms
        .filter((t) => t.category === category && t.term.toLowerCase().includes(query))
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, limit)
        .map(({ id, term, usageCount, category }) => ({ id, term, usageCount, category }));

    res.json(results);
});

// Popular terms by category
router.get("/popular/:category", (req, res) => {
    const results = demoTerms
        .filter((t) => t.category === req.params.category)
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 20)
        .map(({ term, usageCount }) => ({ term, usageCount }));

    res.json(results);
});

// Learn a term (no-op in demo mode)
export async function learnTerm(category: string, term: string) {
    const normalized = term.trim().toLowerCase();
    if (!normalized || normalized.length < 2) return;
    const existing = demoTerms.find(
        (t) => t.category === category && t.term.toLowerCase() === normalized
    );
    if (existing) {
        existing.usageCount += 1;
    } else {
        demoTerms.push({ id: `t${Date.now()}`, category, term: term.trim(), usageCount: 1 });
    }
}

export { router as autocompleteRouter };
