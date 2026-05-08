// ─── Demo In-Memory Store ────────────────────────────────────────────────────
// Shared in-memory data used by all modules when no database is available.

export const DOCTOR_ID = "2";
export const DOCTOR2_ID = "4";
export const ADMIN_ID = "1";

// ─── Patients ────────────────────────────────────────────────────────────────

export const demoPatients: any[] = [
    {
        id: "p1",
        fileNumber: 1001,
        firstName: "Sara",
        lastName: "Al-Hassan",
        fatherName: "Ahmad",
        gender: "female",
        dateOfBirth: "1990-04-15",
        phone: "0912345678",
        city: "Tripoli",
        region: "Tripoli",
        maritalStatus: "married",
        allergies: "Penicillin",
        chronicConditions: "Diabetes Type 2",
        insurance: "National Insurance Co.",
        notes: "Prefers morning appointments",
        createdAt: new Date("2026-01-10").toISOString(),
        updatedAt: new Date("2026-04-20").toISOString(),
    },
    {
        id: "p2",
        fileNumber: 1002,
        firstName: "Khalid",
        lastName: "Ben-Omar",
        fatherName: "Omar",
        gender: "male",
        dateOfBirth: "1985-09-22",
        phone: "0923456789",
        city: "Benghazi",
        region: "Benghazi",
        maritalStatus: "married",
        allergies: null,
        chronicConditions: "Hypertension",
        insurance: "Libya Insurance",
        notes: null,
        createdAt: new Date("2026-01-15").toISOString(),
        updatedAt: new Date("2026-04-25").toISOString(),
    },
    {
        id: "p3",
        fileNumber: 1003,
        firstName: "Fatima",
        lastName: "Al-Zahra",
        fatherName: "Mohammed",
        gender: "female",
        dateOfBirth: "2001-12-03",
        phone: "0934567890",
        city: "Misrata",
        region: "Misrata",
        maritalStatus: "single",
        allergies: null,
        chronicConditions: null,
        insurance: null,
        notes: "Orthodontic follow-up",
        createdAt: new Date("2026-02-01").toISOString(),
        updatedAt: new Date("2026-05-01").toISOString(),
    },
    {
        id: "p4",
        fileNumber: 1004,
        firstName: "Youssef",
        lastName: "Mansour",
        fatherName: "Ibrahim",
        gender: "male",
        dateOfBirth: "1975-06-18",
        phone: "0945678901",
        city: "Tripoli",
        region: "Ain Zara",
        maritalStatus: "married",
        allergies: "Latex",
        chronicConditions: "Asthma",
        insurance: "Gulf Insurance",
        notes: null,
        createdAt: new Date("2026-02-10").toISOString(),
        updatedAt: new Date("2026-04-15").toISOString(),
    },
    {
        id: "p5",
        fileNumber: 1005,
        firstName: "Nour",
        lastName: "El-Amin",
        fatherName: "Saleh",
        gender: "female",
        dateOfBirth: "1998-03-07",
        phone: "0956789012",
        city: "Zawia",
        region: "Zawia",
        maritalStatus: "single",
        allergies: null,
        chronicConditions: null,
        insurance: null,
        notes: null,
        createdAt: new Date("2026-03-05").toISOString(),
        updatedAt: new Date("2026-05-06").toISOString(),
    },
    {
        id: "p6",
        fileNumber: 1006,
        firstName: "Omar",
        lastName: "Al-Farsi",
        fatherName: "Ali",
        gender: "male",
        dateOfBirth: "1965-11-25",
        phone: "0967890123",
        city: "Tripoli",
        region: "Janzour",
        maritalStatus: "married",
        allergies: "Aspirin",
        chronicConditions: "Diabetes, Hypertension",
        insurance: "National Insurance Co.",
        notes: "Denture fitting scheduled",
        createdAt: new Date("2026-01-20").toISOString(),
        updatedAt: new Date("2026-05-05").toISOString(),
    },
    {
        id: "p7",
        fileNumber: 1007,
        firstName: "Amira",
        lastName: "Belkacem",
        fatherName: "Kamel",
        gender: "female",
        dateOfBirth: "1993-07-14",
        phone: "0978901234",
        city: "Tripoli",
        region: "Hay Al-Andalus",
        maritalStatus: "single",
        allergies: null,
        chronicConditions: null,
        insurance: "Al-Mukhtar Insurance",
        notes: null,
        createdAt: new Date("2026-03-20").toISOString(),
        updatedAt: new Date("2026-05-07").toISOString(),
    },
    {
        id: "p8",
        fileNumber: 1008,
        firstName: "Hassan",
        lastName: "Trabelsi",
        fatherName: "Nasser",
        gender: "male",
        dateOfBirth: "1988-02-28",
        phone: "0989012345",
        city: "Tripoli",
        region: "Fashlum",
        maritalStatus: "married",
        allergies: null,
        chronicConditions: "Thyroid disorder",
        insurance: null,
        notes: null,
        createdAt: new Date("2026-04-01").toISOString(),
        updatedAt: new Date("2026-05-02").toISOString(),
    },
];

// ─── Visits ──────────────────────────────────────────────────────────────────

const today = new Date();
today.setHours(10, 0, 0, 0);
const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
const lastWeek = new Date(today); lastWeek.setDate(today.getDate() - 7);

// The date string recorded at server startup time (used as reference for "today" in demo data)
const serverStartDateStr = today.toISOString().split("T")[0];

export const demoVisits: any[] = [
    {
        id: "v1",
        patientId: "p1",
        doctorId: DOCTOR_ID,
        visitNumber: 3,
        visitType: "consultation",
        chiefComplaint: "Toothache lower left molar",
        clinicalNotes: "Patient reports sharp pain for 3 days. Percussion positive on 36.",
        examination: "Caries on tooth 36 with pulp involvement suspected.",
        status: "queued",
        startedAt: today.toISOString(),
        completedAt: null,
        dentalFindings: [],
        prescriptions: [],
        labOrders: [],
        dentalProcedures: [],
        dentalMedia: [],
        billing: null,
    },
    {
        id: "v2",
        patientId: "p2",
        doctorId: DOCTOR_ID,
        visitNumber: 2,
        visitType: "follow-up",
        chiefComplaint: "Post-extraction review",
        clinicalNotes: "Healing well. Socket clean, no signs of dry socket.",
        examination: "Normal healing at extraction site tooth 14.",
        status: "queued",
        startedAt: new Date(today.getTime() + 30 * 60000).toISOString(),
        completedAt: null,
        dentalFindings: [],
        prescriptions: [],
        labOrders: [],
        dentalProcedures: [],
        dentalMedia: [],
        billing: null,
    },
    {
        id: "v3",
        patientId: "p3",
        doctorId: DOCTOR_ID,
        visitNumber: 1,
        visitType: "orthodontics",
        chiefComplaint: "Routine orthodontic adjustment",
        clinicalNotes: "Wire adjusted, good progress on alignment.",
        examination: "All brackets intact. Mild discomfort expected post-adjustment.",
        status: "completed",
        startedAt: yesterday.toISOString(),
        completedAt: new Date(yesterday.getTime() + 45 * 60000).toISOString(),
        dentalFindings: [
            { id: "f1", visitId: "v3", patientId: "p3", toothCode: "13", findingType: "other", severity: "mild", description: "Crowding - upper canine", status: "active" },
        ],
        prescriptions: [
            { id: "rx1", visitId: "v3", medicationName: "Ibuprofen 400mg", dosage: "400mg", frequency: "Twice daily", duration: "3 days", route: "oral", instructions: "Take after meals" },
        ],
        labOrders: [],
        dentalProcedures: [
            { id: "proc1", visitId: "v3", patientId: "p3", procedureName: "Orthodontic adjustment", category: "orthodontic", cost: "50", status: "completed", performedAt: yesterday.toISOString() },
        ],
        dentalMedia: [],
        billing: {
            id: "b1", visitId: "v3", totalAmount: "50", paidAmount: "50", currency: "USD", status: "paid",
            createdAt: yesterday.toISOString(), payments: [{ id: "pay1", billingId: "b1", amount: "50", method: "cash", paidAt: yesterday.toISOString() }]
        },
    },
    {
        id: "v4",
        patientId: "p4",
        doctorId: DOCTOR_ID,
        visitNumber: 5,
        visitType: "restorative",
        chiefComplaint: "Replace old filling",
        clinicalNotes: "Secondary caries under old amalgam filling on tooth 26.",
        examination: "Composite restoration placed. Good margins.",
        status: "completed",
        startedAt: lastWeek.toISOString(),
        completedAt: new Date(lastWeek.getTime() + 60 * 60000).toISOString(),
        dentalFindings: [
            { id: "f2", visitId: "v4", patientId: "p4", toothCode: "26", findingType: "caries", severity: "moderate", description: "Secondary caries under old filling", status: "resolved" },
        ],
        prescriptions: [],
        labOrders: [],
        dentalProcedures: [
            { id: "proc2", visitId: "v4", patientId: "p4", procedureName: "Composite filling", category: "restorative", cost: "80", status: "completed", performedAt: lastWeek.toISOString() },
        ],
        dentalMedia: [],
        billing: {
            id: "b2", visitId: "v4", totalAmount: "80", paidAmount: "40", currency: "USD", status: "partial",
            createdAt: lastWeek.toISOString(), payments: [{ id: "pay2", billingId: "b2", amount: "40", method: "cash", paidAt: lastWeek.toISOString() }]
        },
    },
    {
        id: "v5",
        patientId: "p5",
        doctorId: DOCTOR_ID,
        visitNumber: 1,
        visitType: "consultation",
        chiefComplaint: "Sensitivity to cold on upper teeth",
        clinicalNotes: "Generalized enamel erosion, likely dietary acid.",
        examination: "Multiple teeth showing early erosion. No active caries.",
        status: "billed",
        startedAt: lastWeek.toISOString(),
        completedAt: new Date(lastWeek.getTime() + 30 * 60000).toISOString(),
        dentalFindings: [
            { id: "f3", visitId: "v5", patientId: "p5", toothCode: null, findingType: "sensitivity", severity: "mild", description: "Generalized cold sensitivity", status: "active" },
        ],
        prescriptions: [
            { id: "rx2", visitId: "v5", medicationName: "Sensodyne Toothpaste", dosage: "Apply twice daily", frequency: "Twice daily", duration: "Ongoing", route: "topical", instructions: "Do not rinse immediately after" },
        ],
        labOrders: [],
        dentalProcedures: [],
        dentalMedia: [],
        billing: {
            id: "b3", visitId: "v5", totalAmount: "30", paidAmount: "30", currency: "USD", status: "paid",
            createdAt: lastWeek.toISOString(), payments: [{ id: "pay3", billingId: "b3", amount: "30", method: "cash", paidAt: lastWeek.toISOString() }]
        },
    },
    {
        id: "v6",
        patientId: "p6",
        doctorId: DOCTOR_ID,
        visitNumber: 8,
        visitType: "prosthetics",
        chiefComplaint: "Complete denture adjustment",
        clinicalNotes: "Patient complains of sore spot on lower denture.",
        examination: "Pressure spot identified and relieved. Good retention.",
        status: "billed",
        startedAt: new Date(today.getTime() - 90 * 60000).toISOString(),
        completedAt: new Date(today.getTime() - 30 * 60000).toISOString(),
        dentalFindings: [],
        prescriptions: [],
        labOrders: [],
        dentalProcedures: [
            { id: "proc3", visitId: "v6", patientId: "p6", procedureName: "Complete denture adjustment", category: "prosthodontic", cost: "120", status: "completed", performedAt: new Date(today.getTime() - 60 * 60000).toISOString() },
        ],
        dentalMedia: [],
        billing: null,
    },
    {
        id: "v7",
        patientId: "p7",
        doctorId: DOCTOR_ID,
        visitNumber: 2,
        visitType: "consultation",
        chiefComplaint: "Wisdom tooth pain",
        clinicalNotes: "Pericoronitis around partially erupted 48.",
        examination: "Swelling and tenderness around lower right wisdom tooth.",
        status: "in_progress",
        startedAt: new Date(today.getTime() - 20 * 60000).toISOString(),
        completedAt: null,
        dentalFindings: [
            { id: "f4", visitId: "v7", patientId: "p7", toothCode: "48", findingType: "periapical_lesion", severity: "moderate", description: "Pericoronitis", status: "active" },
        ],
        prescriptions: [
            { id: "rx3", visitId: "v7", medicationName: "Amoxicillin 500mg", dosage: "500mg", frequency: "3 times daily", duration: "7 days", route: "oral", instructions: "Complete full course" },
            { id: "rx4", visitId: "v7", medicationName: "Metronidazole 250mg", dosage: "250mg", frequency: "3 times daily", duration: "7 days", route: "oral", instructions: "Take with food" },
        ],
        labOrders: [
            { id: "lab1", visitId: "v7", testName: "OPG X-Ray", status: "ordered", result: null, orderedAt: new Date().toISOString() },
        ],
        dentalProcedures: [],
        dentalMedia: [],
        billing: null,
    },
];

// ─── Appointments ─────────────────────────────────────────────────────────────

const todayStr = new Date().toISOString().split("T")[0];
const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
const dayAfterStr = new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0];
const nextWeekStr = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

export const demoAppointments: any[] = [
    {
        id: "a1",
        patientId: "p1",
        doctorId: DOCTOR_ID,
        appointmentDate: todayStr,
        timeSlot: "09:00",
        duration: 30,
        type: "consultation",
        status: "confirmed",
        notes: "Follow-up for root canal",
        createdAt: new Date().toISOString(),
    },
    {
        id: "a2",
        patientId: "p3",
        doctorId: DOCTOR_ID,
        appointmentDate: todayStr,
        timeSlot: "10:00",
        duration: 45,
        type: "orthodontics",
        status: "scheduled",
        notes: "Monthly wire adjustment",
        createdAt: new Date().toISOString(),
    },
    {
        id: "a3",
        patientId: "p5",
        doctorId: DOCTOR_ID,
        appointmentDate: todayStr,
        timeSlot: "11:30",
        duration: 30,
        type: "cleaning",
        status: "scheduled",
        notes: null,
        createdAt: new Date().toISOString(),
    },
    {
        id: "a4",
        patientId: "p2",
        doctorId: DOCTOR_ID,
        appointmentDate: tomorrowStr,
        timeSlot: "09:30",
        duration: 60,
        type: "extraction",
        status: "scheduled",
        notes: "Lower wisdom tooth extraction",
        createdAt: new Date().toISOString(),
    },
    {
        id: "a5",
        patientId: "p4",
        doctorId: DOCTOR_ID,
        appointmentDate: tomorrowStr,
        timeSlot: "14:00",
        duration: 90,
        type: "restorative",
        status: "confirmed",
        notes: "Crown preparation",
        createdAt: new Date().toISOString(),
    },
    {
        id: "a6",
        patientId: "p6",
        doctorId: DOCTOR_ID,
        appointmentDate: dayAfterStr,
        timeSlot: "10:00",
        duration: 60,
        type: "prosthetics",
        status: "scheduled",
        notes: "Final denture fitting",
        createdAt: new Date().toISOString(),
    },
    {
        id: "a7",
        patientId: "p8",
        doctorId: DOCTOR_ID,
        appointmentDate: nextWeekStr,
        timeSlot: "15:00",
        duration: 30,
        type: "consultation",
        status: "scheduled",
        notes: null,
        createdAt: new Date().toISOString(),
    },
    {
        id: "a8",
        patientId: "p7",
        doctorId: "4",
        appointmentDate: todayStr,
        timeSlot: "09:30",
        duration: 60,
        type: "orthodontics",
        status: "confirmed",
        notes: "Braces tightening — Dr. Layla",
        createdAt: new Date().toISOString(),
    },
    {
        id: "a9",
        patientId: "p8",
        doctorId: "4",
        appointmentDate: tomorrowStr,
        timeSlot: "11:00",
        duration: 45,
        type: "consultation",
        status: "scheduled",
        notes: "New patient consult — Dr. Layla",
        createdAt: new Date().toISOString(),
    },
];

// ─── Settings ─────────────────────────────────────────────────────────────────

export const demoSettings: Record<string, string> = {
    clinicName: "DentalClinic — Tripoli",
    clinic_name: "DentalClinic",
    clinic_subtitle: "Dental Practice Management System",
    clinic_icon: "🦷",
    doctorName: "Dr. Mohammed Al-Mansouri",
    doctor_name: "Dr. Mohammed Al-Mansouri",
    phone: "+218 91 234 5678",
    clinic_phone: "+218 91 234 5678",
    address: "15 Omar Mukhtar Street, Tripoli, Libya",
    clinic_address: "15 Omar Mukhtar Street, Tripoli, Libya",
    email: "info@dentalclinic.ly",
    currency: "USD",
    workingHours: "08:00-17:00",
    website: "",
    licenseNumber: "LY-DENT-2024-0042",
    prescription_title: "Prescription",
    prescription_signature_label: "Doctor's Signature",
    lab_request_title: "Laboratory Examination Request",
    lab_signature_label: "Medical Practitioner",
    clinical_notes_title: "Clinical Notes",
    clinical_notes_signature_label: "Medical Practitioner",
    receipt_title: "RECEIPT",
    receipt_footer_text: "Thank you for choosing our clinic",
    receipt_signature_label: "Authorized Signature",
};

// ─── Medical Terms (Autocomplete) ─────────────────────────────────────────────

export const demoTerms: any[] = [
    // Complaints
    { id: "t1", category: "complaint", term: "Toothache", usageCount: 120 },
    { id: "t2", category: "complaint", term: "Sensitivity to cold", usageCount: 95 },
    { id: "t3", category: "complaint", term: "Sensitivity to hot", usageCount: 80 },
    { id: "t4", category: "complaint", term: "Swollen gum", usageCount: 75 },
    { id: "t5", category: "complaint", term: "Broken tooth", usageCount: 60 },
    { id: "t6", category: "complaint", term: "Bleeding gums", usageCount: 55 },
    { id: "t7", category: "complaint", term: "Bad breath", usageCount: 50 },
    { id: "t8", category: "complaint", term: "Loose tooth", usageCount: 45 },
    { id: "t9", category: "complaint", term: "Jaw pain", usageCount: 40 },
    { id: "t10", category: "complaint", term: "Wisdom tooth pain", usageCount: 70 },
    // Medications
    { id: "t11", category: "medication", term: "Amoxicillin 500mg", usageCount: 200 },
    { id: "t12", category: "medication", term: "Metronidazole 250mg", usageCount: 180 },
    { id: "t13", category: "medication", term: "Ibuprofen 400mg", usageCount: 220 },
    { id: "t14", category: "medication", term: "Paracetamol 500mg", usageCount: 190 },
    { id: "t15", category: "medication", term: "Diclofenac 50mg", usageCount: 100 },
    { id: "t16", category: "medication", term: "Clindamycin 300mg", usageCount: 90 },
    { id: "t17", category: "medication", term: "Chlorhexidine mouthwash 0.2%", usageCount: 130 },
    { id: "t18", category: "medication", term: "Lidocaine 2% (local anaesthetic)", usageCount: 250 },
    { id: "t19", category: "medication", term: "Articaine 4%", usageCount: 120 },
    // Lab tests
    { id: "t20", category: "lab_test", term: "OPG X-Ray", usageCount: 150 },
    { id: "t21", category: "lab_test", term: "Periapical X-Ray", usageCount: 200 },
    { id: "t22", category: "lab_test", term: "CBCT Scan", usageCount: 40 },
    { id: "t23", category: "lab_test", term: "Blood glucose", usageCount: 60 },
    { id: "t24", category: "lab_test", term: "Blood pressure check", usageCount: 80 },
    // Procedures
    { id: "t25", category: "procedure", term: "Scaling and polishing", usageCount: 180 },
    { id: "t26", category: "procedure", term: "Composite filling", usageCount: 210 },
    { id: "t27", category: "procedure", term: "Root canal treatment", usageCount: 90 },
    { id: "t28", category: "procedure", term: "Tooth extraction", usageCount: 150 },
    { id: "t29", category: "procedure", term: "Crown preparation", usageCount: 70 },
    { id: "t30", category: "procedure", term: "Orthodontic adjustment", usageCount: 85 },
];

// ─── Billings ─────────────────────────────────────────────────────────────────

export const demoBillings: any[] = [
    {
        id: "b1",
        visitId: "v3",
        totalAmount: "50",
        paidAmount: "50",
        currency: "USD",
        status: "paid",
        notes: null,
        createdAt: today.toISOString(),
        payments: [{ id: "pay1", billingId: "b1", amount: "50", method: "cash", paidAt: today.toISOString() }],
    },
    {
        id: "b4",
        visitId: "v6",
        totalAmount: "120",
        paidAmount: "120",
        currency: "USD",
        status: "paid",
        notes: null,
        createdAt: today.toISOString(),
        payments: [{ id: "pay4", billingId: "b4", amount: "120", method: "cash", paidAt: today.toISOString() }],
    },
    {
        id: "b2",
        visitId: "v4",
        totalAmount: "80",
        paidAmount: "40",
        currency: "USD",
        status: "partial",
        notes: "Balance due next visit",
        createdAt: lastWeek.toISOString(),
        payments: [{ id: "pay2", billingId: "b2", amount: "40", method: "cash", paidAt: lastWeek.toISOString() }],
    },
    {
        id: "b3",
        visitId: "v5",
        totalAmount: "30",
        paidAmount: "30",
        currency: "USD",
        status: "paid",
        notes: null,
        createdAt: lastWeek.toISOString(),
        payments: [{ id: "pay3", billingId: "b3", amount: "30", method: "cash", paidAt: lastWeek.toISOString() }],
    },
];

// ─── Recalls ──────────────────────────────────────────────────────────────────

export const demoRecalls: any[] = [
    { id: "r1", patientId: "p1", recallType: "cleaning", dueDate: new Date(Date.now() + 30 * 86400000).toISOString(), status: "pending", notes: "6-month cleaning" },
    { id: "r2", patientId: "p3", recallType: "ortho", dueDate: new Date(Date.now() + 14 * 86400000).toISOString(), status: "pending", notes: "Orthodontic check" },
    { id: "r3", patientId: "p2", recallType: "post_op", dueDate: new Date(Date.now() + 7 * 86400000).toISOString(), status: "pending", notes: "Post-extraction check" },
];

// ─── Follow-ups ──────────────────────────────────────────────────────────────

export const demoFollowUps: any[] = [
    { id: "fu1", visitId: "v3", patientId: "p3", scheduledDate: tomorrowStr, reason: "Check orthodontic adjustment", status: "pending", notes: null, createdAt: yesterday.toISOString() },
    { id: "fu2", visitId: "v4", patientId: "p4", scheduledDate: nextWeekStr, reason: "Crown fitting", status: "pending", notes: null, createdAt: lastWeek.toISOString() },
];

// ─── Referrals ────────────────────────────────────────────────────────────────

export const demoReferrals: any[] = [
    { id: "ref1", visitId: "v5", patientId: "p5", referredTo: "Dr. Khalid - Periodontist", specialty: "Periodontics", reason: "Enamel erosion management", status: "pending", notes: null, createdAt: lastWeek.toISOString() },
];

// ─── Live demo data helpers (shift "today" dates to actual today at request time) ───

function shiftDateToToday(isoStr: string): string {
    const actualToday = new Date().toISOString().split("T")[0];
    if (isoStr.startsWith(serverStartDateStr)) {
        return isoStr.replace(serverStartDateStr, actualToday);
    }
    return isoStr;
}

export function getLiveDemoBillings(): any[] {
    if (serverStartDateStr === new Date().toISOString().split("T")[0]) return demoBillings;
    return demoBillings.map((b) => ({
        ...b,
        createdAt: shiftDateToToday(b.createdAt),
        payments: b.payments?.map((p: any) => ({ ...p, paidAt: shiftDateToToday(p.paidAt) })),
    }));
}

export function getLiveDemoVisits(): any[] {
    if (serverStartDateStr === new Date().toISOString().split("T")[0]) return demoVisits;
    return demoVisits.map((v) => ({
        ...v,
        startedAt: shiftDateToToday(v.startedAt),
        completedAt: v.completedAt ? shiftDateToToday(v.completedAt) : v.completedAt,
    }));
}

// ─── Procedure Catalog ────────────────────────────────────────────────────────

export const demoProcedureCatalog: any[] = [
    { id: "cat1", code: "D0120", name: "Routine examination", category: "diagnostic", defaultPrice: "30", durationMinutes: 20, requiresTooth: false, requiresSurface: false, isActive: true },
    { id: "cat2", code: "D0210", name: "Full mouth X-rays (OPG)", category: "diagnostic", defaultPrice: "50", durationMinutes: 15, requiresTooth: false, requiresSurface: false, isActive: true },
    { id: "cat3", code: "D1110", name: "Scaling and polishing", category: "preventive", defaultPrice: "60", durationMinutes: 45, requiresTooth: false, requiresSurface: false, isActive: true },
    { id: "cat4", code: "D2140", name: "Amalgam filling – 1 surface", category: "restorative", defaultPrice: "50", durationMinutes: 30, requiresTooth: true, requiresSurface: true, isActive: true },
    { id: "cat5", code: "D2150", name: "Amalgam filling – 2 surfaces", category: "restorative", defaultPrice: "65", durationMinutes: 40, requiresTooth: true, requiresSurface: true, isActive: true },
    { id: "cat6", code: "D2390", name: "Composite filling – posterior", category: "restorative", defaultPrice: "80", durationMinutes: 45, requiresTooth: true, requiresSurface: true, isActive: true },
    { id: "cat7", code: "D3310", name: "Root canal – anterior", category: "endodontic", defaultPrice: "150", durationMinutes: 90, requiresTooth: true, requiresSurface: false, isActive: true },
    { id: "cat8", code: "D3330", name: "Root canal – molar", category: "endodontic", defaultPrice: "220", durationMinutes: 120, requiresTooth: true, requiresSurface: false, isActive: true },
    { id: "cat9", code: "D7110", name: "Tooth extraction – simple", category: "oral_surgery", defaultPrice: "70", durationMinutes: 30, requiresTooth: true, requiresSurface: false, isActive: true },
    { id: "cat10", code: "D7240", name: "Impacted wisdom tooth extraction", category: "oral_surgery", defaultPrice: "200", durationMinutes: 60, requiresTooth: true, requiresSurface: false, isActive: true },
    { id: "cat11", code: "D2710", name: "Crown – porcelain/ceramic", category: "prosthodontic", defaultPrice: "350", durationMinutes: 90, requiresTooth: true, requiresSurface: false, isActive: true },
    { id: "cat12", code: "D5110", name: "Complete denture – upper", category: "prosthodontic", defaultPrice: "500", durationMinutes: 60, requiresTooth: false, requiresSurface: false, isActive: true },
    { id: "cat13", code: "D8080", name: "Orthodontic adjustment", category: "orthodontic", defaultPrice: "50", durationMinutes: 30, requiresTooth: false, requiresSurface: false, isActive: true },
    { id: "cat14", code: "D9930", name: "Bleaching – in-office", category: "cosmetic", defaultPrice: "180", durationMinutes: 60, requiresTooth: false, requiresSurface: false, isActive: true },
];
