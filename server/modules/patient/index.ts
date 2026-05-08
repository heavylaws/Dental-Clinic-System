import { Router } from "express";
import { requireAuth } from "../auth/index.js";
import { demoPatients, demoVisits } from "../../demo-store.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();
router.use(requireAuth);

function getVisitCount(patientId: string): number {
    return demoVisits.filter((v) => v.patientId === patientId).length;
}

function getLastVisit(patientId: string): string | null {
    const pvs = demoVisits
        .filter((v) => v.patientId === patientId)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return pvs.length > 0 ? pvs[0].startedAt : null;
}

// Insurance suggestions
router.get("/insurance-suggestions", (_req, res) => {
    const insurers = [...new Set(demoPatients.map((p) => p.insurance).filter(Boolean))] as string[];
    res.json(insurers);
});

// Search patients
router.get("/search", (req, res) => {
    const q = (req.query.q as string || "").toLowerCase().trim();
    const firstName = (req.query.firstName as string || "").toLowerCase().trim();
    const lastName = (req.query.lastName as string || "").toLowerCase().trim();
    const phone = (req.query.phone as string || "").toLowerCase().trim();
    const fileNumber = req.query.fileNumber as string;

    let results = [...demoPatients];

    if (fileNumber) {
        results = results.filter((p) => String(p.fileNumber) === fileNumber);
    } else if (q) {
        results = results.filter((p) =>
            p.firstName.toLowerCase().includes(q) ||
            p.lastName.toLowerCase().includes(q) ||
            (p.fatherName && p.fatherName.toLowerCase().includes(q)) ||
            (p.phone && p.phone.includes(q)) ||
            String(p.fileNumber).includes(q)
        );
    } else {
        if (firstName) results = results.filter((p) => p.firstName.toLowerCase().includes(firstName));
        if (lastName) results = results.filter((p) => p.lastName.toLowerCase().includes(lastName));
        if (phone) results = results.filter((p) => p.phone && p.phone.includes(phone));
    }

    const mapped = results.map((p) => ({
        ...p,
        visitCount: getVisitCount(p.id),
        lastVisit: getLastVisit(p.id),
    }));

    res.json(mapped);
});

// Get patient by ID
router.get("/:id", (req, res) => {
    const patient = demoPatients.find((p) => p.id === req.params.id);
    if (!patient) return res.status(404).json({ error: "Patient not found" });
    res.json({ ...patient, visitCount: getVisitCount(patient.id), lastVisit: getLastVisit(patient.id) });
});

// List patients (paginated)
router.get("/", (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const sortBy = (req.query.sortBy as string) || "lastVisit";
    const order = (req.query.order as string) || "desc";
    const offset = (page - 1) * limit;

    let sorted = [...demoPatients].map((p) => ({
        ...p,
        visitCount: getVisitCount(p.id),
        lastVisit: getLastVisit(p.id),
    }));

    sorted.sort((a, b) => {
        let valA: any, valB: any;
        if (sortBy === "name") { valA = a.firstName; valB = b.firstName; }
        else if (sortBy === "fileNumber") { valA = a.fileNumber; valB = b.fileNumber; }
        else if (sortBy === "phone") { valA = a.phone || ""; valB = b.phone || ""; }
        else if (sortBy === "city") { valA = a.city || ""; valB = b.city || ""; }
        else if (sortBy === "visits") { valA = a.visitCount; valB = b.visitCount; }
        else {
            valA = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
            valB = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
        }
        if (valA < valB) return order === "asc" ? -1 : 1;
        if (valA > valB) return order === "asc" ? 1 : -1;
        return 0;
    });

    const paged = sorted.slice(offset, offset + limit);
    res.json({ patients: paged, total: demoPatients.length, page, limit });
});

// Create patient
router.post("/", (req, res) => {
    const nextFileNumber = Math.max(...demoPatients.map((p) => p.fileNumber), 1000) + 1;
    const patient = {
        id: uuidv4(),
        fileNumber: nextFileNumber,
        ...req.body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    demoPatients.push(patient);
    res.status(201).json(patient);
});

// Update patient
router.put("/:id", (req, res) => {
    const idx = demoPatients.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Patient not found" });
    demoPatients[idx] = { ...demoPatients[idx], ...req.body, updatedAt: new Date().toISOString() };
    res.json(demoPatients[idx]);
});

export { router as patientRouter };
