import {
    pgTable,
    uuid,
    varchar,
    text,
    integer,
    boolean,
    timestamp,
    decimal,
    jsonb,
    serial,
    bigserial,
    index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Users ──────────────────────────────────────────────────────────

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 100 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 200 }).notNull(),
    role: varchar("role", { length: 20 }).notNull().default("reception"), // admin, doctor, reception
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Patients ───────────────────────────────────────────────────────

export const patients = pgTable(
    "patients",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        legacyId: integer("legacy_id").unique(),
        legacyRaw: text("legacy_raw"),
        fileNumber: serial("file_number"),
        firstName: varchar("first_name", { length: 200 }).notNull(),
        lastName: varchar("last_name", { length: 200 }).notNull(),
        fatherName: varchar("father_name", { length: 200 }),
        gender: varchar("gender", { length: 10 }),
        dateOfBirth: varchar("date_of_birth", { length: 20 }),
        phone: varchar("phone", { length: 30 }),
        city: varchar("city", { length: 200 }),
        region: varchar("region", { length: 200 }),
        maritalStatus: varchar("marital_status", { length: 20 }),
        allergies: text("allergies"),
        chronicConditions: text("chronic_conditions"),
        insurance: varchar("insurance", { length: 300 }),
        notes: text("notes"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_patient_name").on(table.lastName, table.firstName),
        index("idx_patient_phone").on(table.phone),
        index("idx_patient_file_number").on(table.fileNumber),
    ]
);

// ─── Visits (Dental Encounters) ─────────────────────────────────────

export const visits = pgTable(
    "visits",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        patientId: uuid("patient_id")
            .notNull()
            .references(() => patients.id),
        doctorId: uuid("doctor_id").references(() => users.id),
        visitNumber: integer("visit_number").notNull().default(1),
        visitType: varchar("visit_type", { length: 50 }).default("consultation"),
        chiefComplaint: text("chief_complaint"),
        clinicalNotes: text("clinical_notes"),
        examination: text("examination"),
        status: varchar("status", { length: 20 }).notNull().default("queued"),
        startedAt: timestamp("started_at").notNull().defaultNow(),
        completedAt: timestamp("completed_at"),
    },
    (table) => [
        index("idx_visit_patient").on(table.patientId, table.startedAt),
        index("idx_visit_status").on(table.status),
        index("idx_visit_date").on(table.startedAt),
    ]
);

// ─── Dental Charts ──────────────────────────────────────────────────

export const dentalCharts = pgTable("dental_charts", {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
        .notNull()
        .references(() => patients.id, { onDelete: "cascade" }),
    chartDate: timestamp("chart_date").notNull().defaultNow(),
    chartType: varchar("chart_type", { length: 50 }).notNull().default("existing"), // initial, existing, proposed, completed
    dentistId: uuid("dentist_id").references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Tooth Records ──────────────────────────────────────────────────

export const toothRecords = pgTable("tooth_records", {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
        .notNull()
        .references(() => patients.id, { onDelete: "cascade" }),
    chartId: uuid("chart_id")
        .notNull()
        .references(() => dentalCharts.id, { onDelete: "cascade" }),
    toothCode: varchar("tooth_code", { length: 10 }).notNull(),
    notationSystem: varchar("notation_system", { length: 20 }).default("fdi"),
    dentition: varchar("dentition", { length: 20 }), // permanent, primary
    arch: varchar("arch", { length: 10 }), // upper, lower
    quadrant: integer("quadrant"),
    toothType: varchar("tooth_type", { length: 20 }), // incisor, canine, premolar, molar
    status: varchar("status", { length: 50 }).default("present"), // present, missing, extracted, impacted, unerupted, root_remnant, implant, crown, bridge_pontic
    mobility: varchar("mobility", { length: 20 }),
    prognosis: varchar("prognosis", { length: 50 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Dental Findings ────────────────────────────────────────────────

export const dentalFindings = pgTable("dental_findings", {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
        .notNull()
        .references(() => patients.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id").references(() => visits.id),
    chartId: uuid("chart_id").references(() => dentalCharts.id),
    toothCode: varchar("tooth_code", { length: 10 }),
    surfaces: jsonb("surfaces"), // e.g. ["M", "O", "D"]
    findingType: varchar("finding_type", { length: 100 }).notNull(), // caries, fracture, restoration, missing, abscess, sensitivity, gingivitis, periodontitis, impaction, periapical_lesion, other
    severity: varchar("severity", { length: 50 }),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default("active"), // active, resolved, monitoring
    diagnosedAt: timestamp("diagnosed_at").notNull().defaultNow(),
    diagnosedBy: uuid("diagnosed_by").references(() => users.id),
});

// ─── Treatment Plans ────────────────────────────────────────────────

export const treatmentPlans = pgTable("treatment_plans", {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
        .notNull()
        .references(() => patients.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, presented, accepted, partially_completed, completed, cancelled
    priority: varchar("priority", { length: 20 }).default("normal"),
    totalEstimatedCost: decimal("total_estimated_cost", { precision: 15, scale: 2 }).default("0"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Treatment Plan Items ───────────────────────────────────────────

export const treatmentPlanItems = pgTable("treatment_plan_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    treatmentPlanId: uuid("treatment_plan_id")
        .notNull()
        .references(() => treatmentPlans.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
        .notNull()
        .references(() => patients.id, { onDelete: "cascade" }),
    toothCode: varchar("tooth_code", { length: 10 }),
    surfaces: jsonb("surfaces"),
    procedureCode: varchar("procedure_code", { length: 50 }),
    procedureName: varchar("procedure_name", { length: 500 }).notNull(),
    description: text("description"),
    estimatedCost: decimal("estimated_cost", { precision: 15, scale: 2 }).default("0"),
    discount: decimal("discount", { precision: 15, scale: 2 }).default("0"),
    status: varchar("status", { length: 50 }).notNull().default("proposed"), // proposed, accepted, scheduled, in_progress, completed, cancelled
    sequenceOrder: integer("sequence_order").default(0),
    appointmentId: uuid("appointment_id"), // defined after appointments table if we used relations directly, here we use strings
    completedVisitId: uuid("completed_visit_id").references(() => visits.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Dental Procedures ──────────────────────────────────────────────

export const dentalProcedures = pgTable("dental_procedures", {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
        .notNull()
        .references(() => patients.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id")
        .notNull()
        .references(() => visits.id, { onDelete: "cascade" }),
    treatmentPlanItemId: uuid("treatment_plan_item_id").references(() => treatmentPlanItems.id),
    toothCode: varchar("tooth_code", { length: 10 }),
    surfaces: jsonb("surfaces"),
    procedureCode: varchar("procedure_code", { length: 50 }),
    procedureName: varchar("procedure_name", { length: 500 }).notNull(),
    category: varchar("category", { length: 100 }), // diagnostic, preventive, restorative, endodontic, periodontic, prosthodontic, oral_surgery, orthodontic, implant, cosmetic, emergency, other
    notes: text("notes"),
    cost: decimal("cost", { precision: 15, scale: 2 }).default("0"),
    status: varchar("status", { length: 50 }).notNull().default("completed"), // planned, in_progress, completed, cancelled
    performedBy: uuid("performed_by").references(() => users.id),
    performedAt: timestamp("performed_at").notNull().defaultNow(),
});

// ─── Dental Procedure Catalog ───────────────────────────────────────

export const dentalProcedureCatalog = pgTable("dental_procedure_catalog", {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }), // e.g. ADA code or local code
    name: varchar("name", { length: 500 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    defaultPrice: decimal("default_price", { precision: 15, scale: 2 }).default("0"),
    durationMinutes: integer("duration_minutes").default(30),
    requiresTooth: boolean("requires_tooth").default(false),
    requiresSurface: boolean("requires_surface").default(false),
    isActive: boolean("is_active").default(true),
});

// ─── Dental Media ───────────────────────────────────────────────────

export const dentalMedia = pgTable("dental_media", {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
        .notNull()
        .references(() => patients.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id").references(() => visits.id),
    toothCode: varchar("tooth_code", { length: 10 }),
    mediaType: varchar("media_type", { length: 50 }).notNull().default("other"), // intraoral_photo, xray, panoramic, cephalometric, cbct, document, other
    filePath: varchar("file_path", { length: 1000 }).notNull(),
    originalFilename: varchar("original_filename", { length: 500 }),
    caption: text("caption"),
    takenAt: timestamp("taken_at").notNull().defaultNow(),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
});

// ─── Prescriptions ──────────────────────────────────────────────────

export const prescriptions = pgTable("prescriptions", {
    id: uuid("id").primaryKey().defaultRandom(),
    visitId: uuid("visit_id")
        .notNull()
        .references(() => visits.id, { onDelete: "cascade" }),
    medicationName: varchar("medication_name", { length: 500 }).notNull(),
    dosage: varchar("dosage", { length: 200 }),
    frequency: varchar("frequency", { length: 200 }),
    duration: varchar("duration", { length: 200 }),
    route: varchar("route", { length: 100 }),
    instructions: text("instructions"),
});

// ─── Lab Orders ─────────────────────────────────────────────────────

export const labOrders = pgTable("lab_orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    visitId: uuid("visit_id")
        .notNull()
        .references(() => visits.id, { onDelete: "cascade" }),
    testName: varchar("test_name", { length: 500 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("ordered"),
    result: text("result"),
    orderedAt: timestamp("ordered_at").notNull().defaultNow(),
    resultedAt: timestamp("resulted_at"),
});

// ─── Recalls ────────────────────────────────────────────────────────

export const recalls = pgTable("recalls", {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
        .notNull()
        .references(() => patients.id, { onDelete: "cascade" }),
    recallType: varchar("recall_type", { length: 100 }).notNull(), // cleaning, checkup, post_op, ortho, implant, perio, other
    dueDate: timestamp("due_date").notNull(),
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, scheduled, completed, missed, cancelled
    notes: text("notes"),
});

// ─── Consent Forms ──────────────────────────────────────────────────

export const consentForms = pgTable("consent_forms", {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
        .notNull()
        .references(() => patients.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id").references(() => visits.id),
    treatmentPlanId: uuid("treatment_plan_id").references(() => treatmentPlans.id),
    formType: varchar("form_type", { length: 100 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    signedAt: timestamp("signed_at"),
    signaturePath: varchar("signature_path", { length: 1000 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Billing ────────────────────────────────────────────────────────

export const billings = pgTable(
    "billings",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        visitId: uuid("visit_id")
            .notNull()
            .references(() => visits.id),
        totalAmount: decimal("total_amount", { precision: 15, scale: 2 })
            .notNull()
            .default("0"),
        paidAmount: decimal("paid_amount", { precision: 15, scale: 2 })
            .notNull()
            .default("0"),
        currency: varchar("currency", { length: 5 }).notNull().default("USD"),
        status: varchar("status", { length: 20 }).notNull().default("unpaid"),
        notes: text("notes"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_billing_status").on(table.status),
        index("idx_billing_date").on(table.createdAt),
    ]
);

// ─── Payments ───────────────────────────────────────────────────────

export const payments = pgTable("payments", {
    id: uuid("id").primaryKey().defaultRandom(),
    billingId: uuid("billing_id")
        .notNull()
        .references(() => billings.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    method: varchar("method", { length: 30 }).default("cash"),
    paidAt: timestamp("paid_at").notNull().defaultNow(),
});

// ─── Medical Terms ──────────────────────────────────────────────────

export const medicalTerms = pgTable(
    "medical_terms",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        category: varchar("category", { length: 50 }).notNull(), // medication, lab_test, complaint
        term: varchar("term", { length: 500 }).notNull(),
        language: varchar("language", { length: 5 }).default("fr"),
        usageCount: integer("usage_count").notNull().default(1),
        isVerified: boolean("is_verified").notNull().default(false),
        firstUsed: timestamp("first_used").notNull().defaultNow(),
        lastUsed: timestamp("last_used").notNull().defaultNow(),
    },
    (table) => [
        index("idx_term_category").on(table.category),
        index("idx_term_search").on(table.category, table.term),
    ]
);

// ─── Appointments ───────────────────────────────────────────────────

export const appointments = pgTable(
    "appointments",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        patientId: uuid("patient_id")
            .notNull()
            .references(() => patients.id),
        doctorId: uuid("doctor_id").references(() => users.id),
        appointmentDate: varchar("appointment_date", { length: 10 }).notNull(), // YYYY-MM-DD
        timeSlot: varchar("time_slot", { length: 5 }).notNull(), // HH:MM
        duration: integer("duration").notNull().default(30), // minutes
        type: varchar("type", { length: 50 }).default("consultation"),
        status: varchar("status", { length: 20 }).notNull().default("scheduled"), // scheduled, confirmed, cancelled, completed
        notes: text("notes"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_appointment_date").on(table.appointmentDate),
        index("idx_appointment_patient").on(table.patientId),
        index("idx_appointment_doctor").on(table.doctorId, table.appointmentDate),
    ]
);

// ─── Settings ───────────────────────────────────────────────────────

export const settings = pgTable("settings", {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 100 }).notNull().unique(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Follow-ups ─────────────────────────────────────────────────────

export const followUps = pgTable(
    "follow_ups",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        visitId: uuid("visit_id")
            .notNull()
            .references(() => visits.id, { onDelete: "cascade" }),
        patientId: uuid("patient_id")
            .notNull()
            .references(() => patients.id),
        scheduledDate: varchar("scheduled_date", { length: 10 }).notNull(),
        reason: text("reason"),
        status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, completed, missed
        notes: text("notes"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_followup_date").on(table.scheduledDate),
        index("idx_followup_patient").on(table.patientId),
    ]
);

// ─── Referrals ──────────────────────────────────────────────────────

export const referrals = pgTable("referrals", {
    id: uuid("id").primaryKey().defaultRandom(),
    visitId: uuid("visit_id")
        .notNull()
        .references(() => visits.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
        .notNull()
        .references(() => patients.id),
    referredTo: varchar("referred_to", { length: 300 }).notNull(),
    specialty: varchar("specialty", { length: 200 }),
    reason: text("reason"),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, accepted, completed
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Audit Log ──────────────────────────────────────────────────────

export const auditLogs = pgTable(
    "audit_logs",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        userId: uuid("user_id").references(() => users.id),
        action: varchar("action", { length: 50 }).notNull(),
        entityType: varchar("entity_type", { length: 50 }).notNull(),
        entityId: uuid("entity_id"),
        oldValue: jsonb("old_value"),
        newValue: jsonb("new_value"),
        ipAddress: varchar("ip_address", { length: 45 }),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (table) => [
        index("idx_audit_entity").on(
            table.entityType,
            table.entityId,
            table.createdAt
        ),
        index("idx_audit_user").on(table.userId, table.createdAt),
    ]
);

// ─── Relations ──────────────────────────────────────────────────────

export const patientRelations = relations(patients, ({ many }) => ({
    visits: many(visits),
    dentalCharts: many(dentalCharts),
    toothRecords: many(toothRecords),
    dentalFindings: many(dentalFindings),
    treatmentPlans: many(treatmentPlans),
    dentalProcedures: many(dentalProcedures),
    dentalMedia: many(dentalMedia),
    recalls: many(recalls),
    consentForms: many(consentForms),
    appointments: many(appointments),
    followUps: many(followUps),
    referrals: many(referrals),
}));

export const visitRelations = relations(visits, ({ one, many }) => ({
    patient: one(patients, {
        fields: [visits.patientId],
        references: [patients.id],
    }),
    doctor: one(users, {
        fields: [visits.doctorId],
        references: [users.id],
    }),
    dentalFindings: many(dentalFindings),
    dentalProcedures: many(dentalProcedures),
    prescriptions: many(prescriptions),
    labOrders: many(labOrders),
    billing: one(billings),
    dentalMedia: many(dentalMedia),
    followUps: many(followUps),
    referrals: many(referrals),
}));

export const appointmentRelations = relations(appointments, ({ one }) => ({
    patient: one(patients, {
        fields: [appointments.patientId],
        references: [patients.id],
    }),
    doctor: one(users, {
        fields: [appointments.doctorId],
        references: [users.id],
    }),
}));

export const dentalChartRelations = relations(dentalCharts, ({ one, many }) => ({
    patient: one(patients, {
        fields: [dentalCharts.patientId],
        references: [patients.id],
    }),
    dentist: one(users, {
        fields: [dentalCharts.dentistId],
        references: [users.id],
    }),
    toothRecords: many(toothRecords),
    dentalFindings: many(dentalFindings),
}));

export const toothRecordRelations = relations(toothRecords, ({ one }) => ({
    patient: one(patients, {
        fields: [toothRecords.patientId],
        references: [patients.id],
    }),
    chart: one(dentalCharts, {
        fields: [toothRecords.chartId],
        references: [dentalCharts.id],
    }),
}));

export const dentalFindingRelations = relations(dentalFindings, ({ one }) => ({
    patient: one(patients, {
        fields: [dentalFindings.patientId],
        references: [patients.id],
    }),
    visit: one(visits, {
        fields: [dentalFindings.visitId],
        references: [visits.id],
    }),
    chart: one(dentalCharts, {
        fields: [dentalFindings.chartId],
        references: [dentalCharts.id],
    }),
    diagnosedByUser: one(users, {
        fields: [dentalFindings.diagnosedBy],
        references: [users.id],
    }),
}));

export const treatmentPlanRelations = relations(treatmentPlans, ({ one, many }) => ({
    patient: one(patients, {
        fields: [treatmentPlans.patientId],
        references: [patients.id],
    }),
    createdByUser: one(users, {
        fields: [treatmentPlans.createdBy],
        references: [users.id],
    }),
    items: many(treatmentPlanItems),
    consentForms: many(consentForms),
}));

export const treatmentPlanItemRelations = relations(treatmentPlanItems, ({ one, many }) => ({
    treatmentPlan: one(treatmentPlans, {
        fields: [treatmentPlanItems.treatmentPlanId],
        references: [treatmentPlans.id],
    }),
    patient: one(patients, {
        fields: [treatmentPlanItems.patientId],
        references: [patients.id],
    }),
    completedVisit: one(visits, {
        fields: [treatmentPlanItems.completedVisitId],
        references: [visits.id],
    }),
    dentalProcedures: many(dentalProcedures),
}));

export const dentalProcedureRelations = relations(dentalProcedures, ({ one }) => ({
    patient: one(patients, {
        fields: [dentalProcedures.patientId],
        references: [patients.id],
    }),
    visit: one(visits, {
        fields: [dentalProcedures.visitId],
        references: [visits.id],
    }),
    treatmentPlanItem: one(treatmentPlanItems, {
        fields: [dentalProcedures.treatmentPlanItemId],
        references: [treatmentPlanItems.id],
    }),
    performedByUser: one(users, {
        fields: [dentalProcedures.performedBy],
        references: [users.id],
    }),
}));

export const dentalMediaRelations = relations(dentalMedia, ({ one }) => ({
    patient: one(patients, {
        fields: [dentalMedia.patientId],
        references: [patients.id],
    }),
    visit: one(visits, {
        fields: [dentalMedia.visitId],
        references: [visits.id],
    }),
    uploadedByUser: one(users, {
        fields: [dentalMedia.uploadedBy],
        references: [users.id],
    }),
}));

export const prescriptionRelations = relations(prescriptions, ({ one }) => ({
    visit: one(visits, {
        fields: [prescriptions.visitId],
        references: [visits.id],
    }),
}));

export const labOrderRelations = relations(labOrders, ({ one }) => ({
    visit: one(visits, {
        fields: [labOrders.visitId],
        references: [visits.id],
    }),
}));

export const billingRelations = relations(billings, ({ one, many }) => ({
    visit: one(visits, {
        fields: [billings.visitId],
        references: [visits.id],
    }),
    payments: many(payments),
}));

export const paymentRelations = relations(payments, ({ one }) => ({
    billing: one(billings, {
        fields: [payments.billingId],
        references: [billings.id],
    }),
}));

export const followUpRelations = relations(followUps, ({ one }) => ({
    visit: one(visits, {
        fields: [followUps.visitId],
        references: [visits.id],
    }),
    patient: one(patients, {
        fields: [followUps.patientId],
        references: [patients.id],
    }),
}));

export const referralRelations = relations(referrals, ({ one }) => ({
    visit: one(visits, {
        fields: [referrals.visitId],
        references: [visits.id],
    }),
    patient: one(patients, {
        fields: [referrals.patientId],
        references: [patients.id],
    }),
}));

export const recallRelations = relations(recalls, ({ one }) => ({
    patient: one(patients, {
        fields: [recalls.patientId],
        references: [patients.id],
    }),
}));

export const consentFormRelations = relations(consentForms, ({ one }) => ({
    patient: one(patients, {
        fields: [consentForms.patientId],
        references: [patients.id],
    }),
    visit: one(visits, {
        fields: [consentForms.visitId],
        references: [visits.id],
    }),
    treatmentPlan: one(treatmentPlans, {
        fields: [consentForms.treatmentPlanId],
        references: [treatmentPlans.id],
    }),
}));

// ─── Type Exports ───────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
export type Visit = typeof visits.$inferSelect;
export type NewVisit = typeof visits.$inferInsert;
export type DentalChart = typeof dentalCharts.$inferSelect;
export type ToothRecord = typeof toothRecords.$inferSelect;
export type DentalFinding = typeof dentalFindings.$inferSelect;
export type TreatmentPlan = typeof treatmentPlans.$inferSelect;
export type TreatmentPlanItem = typeof treatmentPlanItems.$inferSelect;
export type DentalProcedure = typeof dentalProcedures.$inferSelect;
export type DentalProcedureCatalog = typeof dentalProcedureCatalog.$inferSelect;
export type DentalMedia = typeof dentalMedia.$inferSelect;
export type Prescription = typeof prescriptions.$inferSelect;
export type LabOrder = typeof labOrders.$inferSelect;
export type Recall = typeof recalls.$inferSelect;
export type ConsentForm = typeof consentForms.$inferSelect;
export type Billing = typeof billings.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type MedicalTerm = typeof medicalTerms.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
