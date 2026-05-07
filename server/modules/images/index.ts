import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../../db/index.js";
import { dentalMedia } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

// Ensure uploads directory exists
const UPLOAD_BASE = path.join(process.cwd(), "uploads", "patients");
fs.mkdirSync(UPLOAD_BASE, { recursive: true });

// Configure multer
const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const patientId = req.params.patientId as string || "unknown";
        const patientDir = path.join(UPLOAD_BASE, patientId);
        fs.mkdirSync(patientDir, { recursive: true });
        cb(null, patientDir);
    },
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        const ext = path.extname(file.originalname) || ".jpg";
        cb(null, `${unique}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|gif|webp|bmp)$/i;
        if (allowed.test(file.originalname)) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"));
        }
    },
});

// ─── Upload image for a patient ─────────────────────────────────────

router.post("/:patientId/upload", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const patId = req.params.patientId as string;
        const filePath = `/uploads/patients/${patId}/${req.file.filename}`;
        const { visitId, caption } = req.body;

        const [image] = await db
            .insert(dentalMedia)
            .values({
                patientId: patId,
                visitId: visitId || null,
                filePath,
                caption: caption || null,
            })
            .returning();

        res.status(201).json(image);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Get images for a patient ───────────────────────────────────────

router.get("/:patientId", async (req, res) => {
    try {
        const patId = req.params.patientId as string;
        const images = await db
            .select()
            .from(dentalMedia)
            .where(eq(dentalMedia.patientId, patId))
            .orderBy(desc(dentalMedia.capturedAt));
        res.json(images);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Delete an image ────────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
    try {
        const imgId = req.params.id as string;
        const [image] = await db
            .select()
            .from(dentalMedia)
            .where(eq(dentalMedia.id, imgId))
            .limit(1);

        if (image) {
            // Delete file from disk
            const fullPath = path.join(process.cwd(), image.filePath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
            await db.delete(dentalMedia).where(eq(dentalMedia.id, imgId));
        }

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export { router as imageRouter };
