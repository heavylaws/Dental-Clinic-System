import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import { demoProcedureCatalog } from "../../demo-store.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();
router.use(requireAuth);

router.get("/", (_req, res) => {
    res.json(demoProcedureCatalog.filter((p) => p.isActive));
});

router.post("/", (req, res) => {
    const proc = { id: uuidv4(), isActive: true, ...req.body };
    demoProcedureCatalog.push(proc);
    res.status(201).json(proc);
});

router.put("/:id", (req, res) => {
    const idx = demoProcedureCatalog.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Procedure not found" });
    demoProcedureCatalog[idx] = { ...demoProcedureCatalog[idx], ...req.body };
    res.json(demoProcedureCatalog[idx]);
});

router.delete("/:id", (req, res) => {
    const idx = demoProcedureCatalog.findIndex((p) => p.id === req.params.id);
    if (idx !== -1) demoProcedureCatalog[idx].isActive = false;
    res.json({ success: true });
});

export { router as procedureCatalogRouter };
