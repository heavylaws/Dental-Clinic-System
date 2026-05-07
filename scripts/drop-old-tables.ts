import { db } from "../server/db/index.js";
import { sql } from "drizzle-orm";

async function run() {
    try {
        await db.execute(sql`DROP TABLE IF EXISTS diagnoses CASCADE;`);
        await db.execute(sql`DROP TABLE IF EXISTS procedure_logs CASCADE;`);
        // wait, we changed medical_terms to dental_procedure_catalog but kept medical_terms in schema.ts
        // Did we drop anything else? lab_orders was kept. prescriptions was kept. patient_images was renamed to dental_media but I kept patient_images out of the schema.
        await db.execute(sql`DROP TABLE IF EXISTS patient_images CASCADE;`);
        console.log("Old tables dropped.");
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
