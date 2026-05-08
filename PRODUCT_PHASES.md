# Product Roadmap

> Tracks product-facing milestones for the Dental Clinic System.
> Separate from `PHASES.md`, which tracks security/stability work.
> No HIPAA, GDPR, or production-readiness compliance is claimed.

---

## Phase 2 — Dashboard That Sells Itself

**Status:** ✅ COMPLETE (accepted after timezone consistency fix)

### Goal
Transform the dashboard from a functional clinic screen into a polished business command center while preserving all existing operational workflows (search, queue, billing, follow-ups).

### Files Changed

| File | Change |
|------|--------|
| `server/modules/dashboard/index.ts` | **New** — `GET /api/dashboard/summary` returning today's KPIs, 30-day revenue trend, today's appointments, top 5 unpaid invoices |
| `server/index.ts` | Mounted `dashboardRouter` at `/api/dashboard` |
| `client/src/lib/api.ts` | Added `api.dashboard.summary()` with full TypeScript types |
| `client/src/pages/Dashboard.tsx` | Added business cockpit (hero greeting, 5 KPI cards, 30-day SVG trend, today's appointment timeline, top unpaid invoices, quick actions). Preserved patient search, recent patients, queue, visit status updates, billing dialog, follow-up reminders, mobile camera info |
| `PRODUCT_PHASES.md` | **New** — this file |

### New Endpoint

`GET /api/dashboard/summary` (auth required)

Returns:
- `today` — date, revenue, billed, outstanding, appointments, completedAppointments, noShows, noShowRate, activePatients30d, visits
- `revenueTrend` — last 30 days, includes zero-revenue days
- `appointmentsToday` — sorted by `timeSlot`, with patient name, phone, doctor, type, status
- `unpaidInvoices` — top 5 by largest balance

All values are defensively parsed; missing fields don't crash; empty data returns valid empty arrays and zero totals.

### UI Additions
- Hero header with greeting + today's date
- KPI cards: Today's Revenue, Today's Appointments, Outstanding, Active Patients 30d, No-show Rate
- Custom lightweight SVG line/area chart for 30-day revenue trend (no chart library added)
- Today's appointment timeline with click-through to patient
- Top 5 unpaid invoices with click-through to patient
- Quick Actions row: New Patient, New Appointment, New Visit (focuses search), Billing, Reports
- Skeleton loaders for KPIs, trend, lists
- Non-blocking error banner if `/api/dashboard/summary` fails

### Manual Verification Checklist
- [x] `npm run build` — client passes (Vite). Server `tsc` reports 3 pre-existing errors in `server/modules/report/index.ts` unrelated to this phase.
- [x] `npm run dev` — server and client start; dev runs via `tsx watch`.
- [x] Login as `admin` / `admin123` — works.
- [x] Dashboard renders KPI cards, trend chart, appointment timeline, unpaid invoices.
- [x] Quick actions navigate correctly (`/appointments`, `/billing`, `/reports`).
- [x] "New Visit" focuses the patient search input.
- [x] Patient search, queue, start visit, remove, pay/close still work.
- [x] New Patient dialog still works.
- [x] Follow-up reminders and mobile camera URLs still appear.
- [x] Empty states render when no appointments / no unpaid invoices.
- [x] No new console or TypeScript errors introduced (pre-existing report module errors remain).
- [x] `/m` mobile route untouched.

### Mobile (`/m/*`) Impact

**Decision: Phase 2 cockpit is desktop-only. Mobile UI is intentionally untouched.**

Audit results:

| Phase 2 Change | Mobile Impact |
|----------------|---------------|
| `server/modules/dashboard/index.ts` (new endpoint) | None — additive backend route, requires auth like other routes |
| `server/index.ts` (router mount) | None — additive |
| `client/src/lib/api.ts` (added `dashboard.summary()`) | None — only added a new method; no existing API method touched |
| `client/src/pages/Dashboard.tsx` (rewritten) | None — `/m/*` paths route through `MobileApp` → `MobileDashboard.tsx` and never import `Dashboard.tsx` |

Routing is explicit in `client/src/App.tsx`:
```ts
if (location.pathname.startsWith("/m")) {
    return <MobileApp />;
}
```

Existing mobile API calls (`api.reports.daily`, `api.visits.queue`, `api.patients.search`, `api.followUps.*`, `api.appointments.*`) are unchanged in `client/src/lib/api.ts`.

Verification:
- [x] `vite build` passes after Phase 2 changes
- [x] `/m` route still resolves to `MobileApp`
- [x] No mobile component imports `Dashboard.tsx`
- [x] No mobile API call signatures were modified
- [x] Mobile auth/login flow (`MobileLogin.tsx`) untouched

**Recommendation for a future Phase 2.1 (mobile-only):** Wire `MobileDashboard.tsx` to consume `api.dashboard.summary()` to replace the existing `api.reports.daily()` call, gaining today's appointments and the no-show rate in the same fetch. This was deliberately deferred from this phase to keep the change surface minimal and avoid mobile UI regressions.

### Post-acceptance Fix Applied
- **Timezone consistency**: `server/modules/dashboard/index.ts` now uses UTC `YYYY-MM-DD` (`d.toISOString().split("T")[0]`, via small helper `utcDateStr`) for all date comparisons, matching the existing `demoAppointments` and `appointment` module convention. This eliminates a 4-hour daily window where today's appointments could be mis-bucketed in non-UTC server timezones.

### Known Limitations
- Server `tsc` build still fails due to pre-existing `demoVisits` references in `server/modules/report/index.ts`. Not in Phase 2 scope.
- Active patients count uses in-memory demo data; resets when persistence is in-memory mode.
- Chart is a single line (revenue only); billed line not drawn to keep visualization minimal.
- No filtering/date-range selector on the dashboard yet (kept for a later phase).

---

## Future Phases (Not Yet Defined)

To be filled in by product owner.
