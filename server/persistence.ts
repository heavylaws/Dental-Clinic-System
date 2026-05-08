import {
    demoAppointments,
    demoBillings,
    demoFollowUps,
    demoPatients,
    demoRecalls,
    demoReferrals,
    demoSettings,
    demoVisits,
} from "./demo-store.js";
import { pool } from "./db/index.js";

type Snapshot = {
    settings: Record<string, string>;
    patients: any[];
    visits: any[];
    appointments: any[];
    billings: any[];
    recalls: any[];
    followUps: any[];
    referrals: any[];
};

let persistenceEnabled = false;

function replaceArray(target: any[], data: any[] = []) {
    target.splice(0, target.length, ...data);
}

function applySnapshot(snapshot: Snapshot) {
    Object.assign(demoSettings, snapshot.settings || {});
    replaceArray(demoPatients, snapshot.patients || []);
    replaceArray(demoVisits, snapshot.visits || []);
    replaceArray(demoAppointments, snapshot.appointments || []);
    replaceArray(demoBillings, snapshot.billings || []);
    replaceArray(demoRecalls, snapshot.recalls || []);
    replaceArray(demoFollowUps, snapshot.followUps || []);
    replaceArray(demoReferrals, snapshot.referrals || []);
}

function currentSnapshot(): Snapshot {
    return {
        settings: { ...demoSettings },
        patients: demoPatients,
        visits: demoVisits,
        appointments: demoAppointments,
        billings: demoBillings,
        recalls: demoRecalls,
        followUps: demoFollowUps,
        referrals: demoReferrals,
    };
}

export async function initPersistence() {
    if (!process.env.DATABASE_URL) {
        console.log("[persistence] DATABASE_URL not set - using in-memory mode");
        persistenceEnabled = false;
        return;
    }

    try {
        await pool.query(`
            create table if not exists app_state (
                id integer primary key,
                payload jsonb not null,
                updated_at timestamptz not null default now()
            )
        `);

        const existing = await pool.query(
            "select payload from app_state where id = 1"
        );

        if (existing.rows[0]?.payload) {
            applySnapshot(existing.rows[0].payload as Snapshot);
            console.log("[persistence] Loaded persisted clinic data from PostgreSQL");
        } else {
            await persistState();
            console.log("[persistence] Initialized PostgreSQL snapshot with current demo data");
        }

        persistenceEnabled = true;
    } catch (error) {
        console.error("[persistence] Failed to initialize PostgreSQL persistence:", error);
        persistenceEnabled = false;
    }
}

export async function persistState() {
    if (!persistenceEnabled) return;
    try {
        const snapshot = currentSnapshot();
        await pool.query(
            `
            insert into app_state (id, payload, updated_at)
            values (1, $1::jsonb, now())
            on conflict (id)
            do update set payload = excluded.payload, updated_at = now()
            `,
            [JSON.stringify(snapshot)]
        );
    } catch (error) {
        console.error("[persistence] Failed to persist state:", error);
    }
}

export function isPersistenceEnabled() {
    return persistenceEnabled;
}
