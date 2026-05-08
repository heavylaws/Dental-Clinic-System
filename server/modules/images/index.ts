import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../auth/index.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();
router.use(requireAuth);

const UPLOAD_BASE = path.join(process.cwd(), "uploads", "patients");
fs.mkdirSync(UPLOAD_BASE, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const patientId = (req.params.patientId as string) || "unknown";
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
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.originalname)) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"));
        }
    },
});

const demoMedia: any[] = [];

router.post("/:patientId/upload", upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const patId = req.params.patientId;
    const filePath = `/uploads/patients/${patId}/${req.file.filename}`;
    const { visitId, caption } = req.body;
    const image = {
        id: uuidv4(),
        patientId: patId,
        visitId: visitId || null,
        filePath,
        caption: caption || null,
        uploadedAt: new Date().toISOString(),
    };
    demoMedia.push(image);
    res.status(201).json(image);
});

router.get("/:patientId", (req, res) => {
    const images = demoMedia
        .filter((m) => m.patientId === req.params.patientId)
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    res.json(images);
});

router.get("/:patientId/visit/:visitId", (req, res) => {
    const images = demoMedia.filter((m) => m.patientId === req.params.patientId && m.visitId === req.params.visitId);
    res.json(images);
});

router.delete("/:patientId/:imageId", (req, res) => {
    const idx = demoMedia.findIndex((m) => m.id === req.params.imageId && m.patientId === req.params.patientId);
    if (idx !== -1) {
        const imgPath = path.join(process.cwd(), demoMedia[idx].filePath);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        demoMedia.splice(idx, 1);
    }
    res.json({ success: true });
});

export { router as imageRouter };
