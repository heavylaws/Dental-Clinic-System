import { Router } from "express";
import { db } from "../../db/index.js";
import { visits, patients, billings, dentalFindings, prescriptions, medicalTerms } from "../../db/schema.js";
import { eq, sql, desc, count, and, gte, lte, ilike } from "drizzle-orm"; // Add ilike import

import { requireAuth, requireRole } from "../auth/index.js";

const router = Router();
router.use(requireAuth);

// ─── Daily summary ──────────────────────────────────────────────────

router.get("/daily", async (req, res) => {
    try {
        const dateStr = (req.query.date as string) || new Date().toISOString().split("T")[0];
        const startDate = new Date(dateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateStr);
        endDate.setHours(23, 59, 59, 999);

        // Visit count
        const [{ count: visitCount }] = await db
            .select({ count: count() })
            .from(visits)
            .where(and(gte(visits.startedAt, startDate), lte(visits.startedAt, endDate)));

        // Patient count (unique)
        const [patientResult] = await db
            .select({ count: sql<number>`COUNT(DISTINCT ${visits.patientId})` })
            .from(visits)
            .where(and(gte(visits.startedAt, startDate), lte(visits.startedAt, endDate)));

        // Revenue
        const [revenueResult] = await db
            .select({
                totalBilled: sql<string>`COALESCE(SUM(CAST(${billings.totalAmount} AS NUMERIC)), 0)`,
                totalPaid: sql<string>`COALESCE(SUM(CAST(${billings.paidAmount} AS NUMERIC)), 0)`,
            })
            .from(billings)
            .where(and(gte(billings.createdAt, startDate), lte(billings.createdAt, endDate)));

        res.json({
            date: dateStr,
            visitCount: Number(visitCount),
            uniquePatients: Number(patientResult.count),
            totalBilled: Number(revenueResult.totalBilled),
            totalPaid: Number(revenueResult.totalPaid),
            outstanding: Number(revenueResult.totalBilled) - Number(revenueResult.totalPaid),
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Monthly overview ───────────────────────────────────────────────

router.get("/monthly", async (req, res) => {
    try {
        const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year as string) || new Date().getFullYear();

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        // Visits per day
        const dailyVisits = await db
            .select({
                date: sql<string>`DATE(${visits.startedAt})`,
                count: count(),
            })
            .from(visits)
            .where(and(gte(visits.startedAt, startDate), lte(visits.startedAt, endDate)))
            .groupBy(sql`DATE(${visits.startedAt})`)
            .orderBy(sql`DATE(${visits.startedAt})`);

        // Revenue
        const [revenueResult] = await db
            .select({
                totalBilled: sql<string>`COALESCE(SUM(CAST(${billings.totalAmount} AS NUMERIC)), 0)`,
                totalPaid: sql<string>`COALESCE(SUM(CAST(${billings.paidAmount} AS NUMERIC)), 0)`,
            })
            .from(billings)
            .where(and(gte(billings.createdAt, startDate), lte(billings.createdAt, endDate)));

        // Top findings
        const topDiagnoses = await db
            .select({
                name: dentalFindings.findingType,
                count: count(),
            })
            .from(dentalFindings)
            .innerJoin(visits, eq(dentalFindings.visitId, visits.id))
            .where(and(gte(visits.startedAt, startDate), lte(visits.startedAt, endDate)))
            .groupBy(dentalFindings.findingType)
            .orderBy(desc(count()))
            .limit(10);

        res.json({
            month,
            year,
            dailyVisits,
            totalBilled: Number(revenueResult.totalBilled),
            totalPaid: Number(revenueResult.totalPaid),
            topDiagnoses,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Top medications ────────────────────────────────────────────────

router.get("/top-medications", async (req, res) => {
    try {
        const results = await db
            .select({
                term: medicalTerms.term,
                usageCount: medicalTerms.usageCount,
            })
            .from(medicalTerms)
            .where(eq(medicalTerms.category, "medication"))
            .orderBy(desc(medicalTerms.usageCount))
            .limit(20);

        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Top diagnoses ──────────────────────────────────────────────────

router.get("/top-diagnoses", async (req, res) => {
    try {
        const results = await db
            .select({
                term: medicalTerms.term,
                usageCount: medicalTerms.usageCount,
            })
            .from(medicalTerms)
            .where(eq(medicalTerms.category, "diagnosis"))
            .orderBy(desc(medicalTerms.usageCount))
            .limit(20);

        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Prescription Report ────────────────────────────────────────────

router.get("/prescriptions", async (req, res) => {
    try {
        const startDateStr = req.query.startDate as string;
        const endDateStr = req.query.endDate as string;
        const medication = req.query.medication as string;

        if (!startDateStr || !endDateStr) {
            return res.status(400).json({ error: "Start date and end date are required" });
        }

        const startDate = new Date(startDateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);

        const dateFilter = and(
            gte(visits.startedAt, startDate),
            lte(visits.startedAt, endDate),
            medication ? ilike(prescriptions.medicationName, `%${medication}%`) : undefined
        );

        // Get detailed prescription rows
        const rows = await db
            .select({
                id: prescriptions.id,
                medicationName: prescriptions.medicationName,
                dosage: prescriptions.dosage,
                frequency: prescriptions.frequency,
                duration: prescriptions.duration,
                visitDate: visits.startedAt,
                patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
                patientId: patients.id,
                patientFileNumber: patients.fileNumber,
            })
            .from(prescriptions)
            .innerJoin(visits, eq(prescriptions.visitId, visits.id))
            .innerJoin(patients, eq(visits.patientId, patients.id))
            .where(dateFilter)
            .orderBy(desc(visits.startedAt));

        // Get total prescription count (all-time) for the searched medication
        let totalAllTime = 0;
        if (medication) {
            const [result] = await db
                .select({ count: count() })
                .from(prescriptions)
                .where(ilike(prescriptions.medicationName, `%${medication}%`));
            totalAllTime = Number(result.count);
        }

        // Get unique patient count for this medication in the date range
        const uniquePatients = new Set(rows.map(r => r.patientId)).size;

        res.json({
            rows,
            totalInRange: rows.length,
            totalAllTime,
            uniquePatients,
            medication: medication || null,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Export: Patients CSV ───────────────────────────────────────────

router.get("/export/patients", requireRole("admin"), async (_req, res) => {
    try {
        const allPatients = await db
            .select({
                fileNumber: patients.fileNumber,
                firstName: patients.firstName,
                lastName: patients.lastName,
                fatherName: patients.fatherName,
                gender: patients.gender,
                dateOfBirth: patients.dateOfBirth,
                phone: patients.phone,
                city: sql<string>`COALESCE(${patients.city}, '')`,
                createdAt: patients.createdAt,
            })
            .from(patients)
            .orderBy(patients.fileNumber);

        const headers = "File #,First Name,Last Name,Father,Gender,DOB,Phone,City,Registered\n";
        const rows = allPatients
            .map((p) => [
                p.fileNumber,
                `"${p.firstName}"`,
                `"${p.lastName}"`,
                `"${p.fatherName || ""}"`,
                p.gender || "",
                p.dateOfBirth || "",
                p.phone || "",
                `"${p.city}"`,
                p.createdAt ? new Date(p.createdAt).toISOString().split("T")[0] : "",
            ].join(","))
            .join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=patients.csv");
        res.send(headers + rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Export: Billing CSV ────────────────────────────────────────────

router.get("/export/billing", requireRole("admin"), async (req, res) => {
    try {
        const startDateStr = req.query.startDate as string;
        const endDateStr = req.query.endDate as string;

        let dateFilter;
        if (startDateStr && endDateStr) {
            const startDate = new Date(startDateStr);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(endDateStr);
            endDate.setHours(23, 59, 59, 999);
            dateFilter = and(gte(billings.createdAt, startDate), lte(billings.createdAt, endDate));
        }

        const allBillings = await db
            .select({
                date: billings.createdAt,
                patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
                fileNumber: patients.fileNumber,
                totalAmount: billings.totalAmount,
                paidAmount: billings.paidAmount,
                status: billings.status,
            })
            .from(billings)
            .innerJoin(visits, eq(billings.visitId, visits.id))
            .innerJoin(patients, eq(visits.patientId, patients.id))
            .where(dateFilter)
            .orderBy(desc(billings.createdAt));

        const headers = "Date,Patient,File #,Total,Paid,Status\n";
        const rows = allBillings
            .map((b) => [
                b.date ? new Date(b.date).toISOString().split("T")[0] : "",
                `"${b.patientName}"`,
                b.fileNumber,
                b.totalAmount,
                b.paidAmount,
                b.status,
            ].join(","))
            .join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=billing.csv");
        res.send(headers + rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export { router as reportRouter };
