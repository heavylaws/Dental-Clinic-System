import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const pool = new pg.Pool({
    connectionString:
        process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/dentalclinic",
    max: 10,
});

export const db = drizzle(pool, { schema });
export { pool };
