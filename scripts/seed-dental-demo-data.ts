import { db } from '../server/db';
import { 
    users, 
    patients, 
    visits, 
    dentalCharts, 
    toothRecords, 
    dentalFindings, 
    dentalProcedures, 
    dentalProcedureCatalog, 
    treatmentPlans, 
    treatmentPlanItems,
    settings 
} from '../server/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function seed() {
    console.log("🌱 Starting DentalClinic Seed...");

    // 1. Settings
    console.log("Setting clinic info...");
    await db.insert(settings).values([
        { key: "clinicName", value: "DentalClinic Premium" },
        { key: "clinicPhone", value: "(555) 123-4567" },
        { key: "clinicAddress", value: "123 Smile Ave, Medical District" },
    ]).onConflictDoNothing();

    // 2. Clear old data (optional, but let's just insert if empty or let it grow)
    // 3. Insert Admin/Doctor
    console.log("Creating default users...");
    const hashedPass = await bcrypt.hash("admin", 10);
    await db.insert(users).values([
        {
            username: "admin",
            password: hashedPass,
            role: "admin",
            displayName: "System Admin"
        },
        {
            username: "drsmith",
            password: await bcrypt.hash("password", 10),
            role: "doctor",
            displayName: "Dr. Sarah Smith (DDS)"
        }
    ]).onConflictDoNothing();

    // 4. Procedure Catalog
    console.log("Populating Procedure Catalog...");
    const catalog = [
        { code: "D0120", name: "Periodic oral evaluation", category: "Diagnostic", defaultPrice: "50.00" },
        { code: "D0150", name: "Comprehensive oral evaluation", category: "Diagnostic", defaultPrice: "85.00" },
        { code: "D0210", name: "Intraoral - complete series of radiographic images", category: "Diagnostic", defaultPrice: "120.00" },
        { code: "D0220", name: "Intraoral - periapical first radiographic image", category: "Diagnostic", defaultPrice: "25.00" },
        { code: "D0274", name: "Bitewings - four radiographic images", category: "Diagnostic", defaultPrice: "60.00" },
        { code: "D1110", name: "Prophylaxis - adult", category: "Preventive", defaultPrice: "100.00" },
        { code: "D1206", name: "Topical application of fluoride varnish", category: "Preventive", defaultPrice: "40.00" },
        { code: "D1351", name: "Sealant - per tooth", category: "Preventive", defaultPrice: "45.00" },
        { code: "D2140", name: "Amalgam - one surface, primary or permanent", category: "Restorative", defaultPrice: "150.00" },
        { code: "D2330", name: "Resin-based composite - one surface, anterior", category: "Restorative", defaultPrice: "160.00" },
        { code: "D2391", name: "Resin-based composite - one surface, posterior", category: "Restorative", defaultPrice: "180.00" },
        { code: "D2740", name: "Crown - porcelain/ceramic substrate", category: "Restorative", defaultPrice: "1200.00" },
        { code: "D3310", name: "Endodontic therapy, anterior tooth", category: "Endodontics", defaultPrice: "800.00" },
        { code: "D3320", name: "Endodontic therapy, bicuspid tooth", category: "Endodontics", defaultPrice: "950.00" },
        { code: "D3330", name: "Endodontic therapy, molar", category: "Endodontics", defaultPrice: "1100.00" },
        { code: "D4341", name: "Periodontal scaling and root planing - four or more teeth per quadrant", category: "Periodontics", defaultPrice: "250.00" },
        { code: "D4910", name: "Periodontal maintenance", category: "Periodontics", defaultPrice: "130.00" },
        { code: "D5110", name: "Complete denture - maxillary", category: "Prosthodontics", defaultPrice: "1500.00" },
        { code: "D6010", name: "Surgical placement of implant body: endosteal implant", category: "Implant Services", defaultPrice: "2000.00" },
        { code: "D7140", name: "Extraction, erupted tooth or exposed root", category: "Oral Surgery", defaultPrice: "180.00" },
        { code: "D7210", name: "Surgical removal of erupted tooth", category: "Oral Surgery", defaultPrice: "250.00" },
        { code: "D7230", name: "Removal of impacted tooth - partially bony", category: "Oral Surgery", defaultPrice: "400.00" },
        { code: "D9230", name: "Inhalation of nitrous oxide/analgesia, anxiolysis", category: "Adjunctive General Services", defaultPrice: "75.00" }
    ];

    await db.insert(dentalProcedureCatalog).values(catalog).onConflictDoNothing();

    // 5. Patient
    console.log("Creating Demo Patient...");
    const [patient] = await db.insert(patients).values({
        firstName: "Jane",
        lastName: "Doe",
        gender: "Female",
        dateOfBirth: "1985-06-15",
        phone: "+15550123456",
        city: "Metropolis",
        visitCount: 1,
        lastVisit: new Date().toISOString().split('T')[0]
    }).returning();

    // 6. Dental Chart
    console.log("Initializing Dental Chart...");
    const [chart] = await db.insert(dentalCharts).values({
        patientId: patient.id,
        isArchived: false,
        notationSystem: "fdi"
    }).returning();

    await db.insert(toothRecords).values([
        { patientId: patient.id, chartId: chart.id, toothCode: "18", status: "extracted" },
        { patientId: patient.id, chartId: chart.id, toothCode: "28", status: "extracted" },
        { patientId: patient.id, chartId: chart.id, toothCode: "38", status: "impacted" },
        { patientId: patient.id, chartId: chart.id, toothCode: "48", status: "impacted" },
        { patientId: patient.id, chartId: chart.id, toothCode: "16", status: "crown" },
        { patientId: patient.id, chartId: chart.id, toothCode: "26", status: "present" },
    ]);

    // 7. Visit
    console.log("Creating initial visit...");
    const [visit] = await db.insert(visits).values({
        patientId: patient.id,
        visitType: "consultation",
        status: "completed",
        chiefComplaint: "Patient complains of pain in the lower right jaw.",
        clinicalNotes: "Visual inspection and X-rays reveal impacted lower right wisdom tooth (48). Requires surgical extraction.",
        examination: "Patient has good oral hygiene overall. Old crown on 16 is intact.",
        startedAt: new Date()
    }).returning();

    // 8. Findings
    console.log("Adding Findings...");
    await db.insert(dentalFindings).values([
        { visitId: visit.id, patientId: patient.id, toothCode: "48", findingType: "impaction", severity: "high", status: "active" },
        { visitId: visit.id, patientId: patient.id, toothCode: "38", findingType: "impaction", severity: "medium", status: "active" },
        { visitId: visit.id, patientId: patient.id, toothCode: "24", surfaces: ["O"], findingType: "caries", severity: "low", status: "active" },
    ]);

    // 9. Treatment Plan
    console.log("Creating Treatment Plan...");
    const [plan] = await db.insert(treatmentPlans).values({
        patientId: patient.id,
        title: "Wisdom Teeth Extraction & Filling",
        status: "presented",
        priority: "high",
        totalEstimatedCost: "860.00" // 400 + 400 + 60
    }).returning();

    await db.insert(treatmentPlanItems).values([
        { treatmentPlanId: plan.id, patientId: patient.id, toothCode: "48", procedureCode: "D7230", procedureName: "Removal of impacted tooth - partially bony", estimatedCost: "400.00", status: "planned" },
        { treatmentPlanId: plan.id, patientId: patient.id, toothCode: "38", procedureCode: "D7230", procedureName: "Removal of impacted tooth - partially bony", estimatedCost: "400.00", status: "planned" },
        { treatmentPlanId: plan.id, patientId: patient.id, toothCode: "24", surfaces: ["O"], procedureCode: "D2391", procedureName: "Resin-based composite - one surface, posterior", estimatedCost: "60.00", status: "planned" },
    ]);

    console.log("✅ Seed completed successfully!");
    process.exit(0);
}

seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
