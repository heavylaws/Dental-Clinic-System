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
- ~~Server `tsc` build still fails due to pre-existing `demoVisits` references in `server/modules/report/index.ts`. Not in Phase 2 scope.~~ — **Resolved in Phase 3 pre-flight**.
- Active patients count uses in-memory demo data; resets when persistence is in-memory mode.
- Chart is a single line (revenue only); billed line not drawn to keep visualization minimal.
- No filtering/date-range selector on the dashboard yet (kept for a later phase).

---

## Phase 3 — Reports With Charts + Doctor Production

**Status:** ✅ COMPLETE

### Goal
Turn the Reports page into a premium clinic-owner analytics page that answers: how much money did the clinic make, which doctor produced the most, which procedures generate the most revenue, are visits/patients growing, and can the owner export a clean report.

### Files Changed

| File | Change |
|------|--------|
| `server/modules/report/index.ts` | **Pre-flight fix**: replaced bare `demoVisits` references with `getLiveDemoVisits()` (resolves prior `TS2304` errors). **Added** `GET /api/reports/owner-summary` with totals, revenue trend, doctor production, top procedures, and patient growth |
| `client/src/lib/api.ts` | Added `api.reports.ownerSummary(from, to, groupBy)` with full TypeScript response type |
| `client/src/pages/Reports.tsx` | Rewritten: tabbed UI (Owner Analytics + Prescription Report). Owner tab includes filter bar (from/to/groupBy), KPI cards, custom SVG revenue trend chart, sortable doctor production table, top procedures bar list, patient growth chart, CSV export, and Print/PDF export. Prescription Report tab fully preserved (date range, medication filter, sortable detail table, summary stats). Admin bulk-export buttons preserved on the prescription tab |
| `PRODUCT_PHASES.md` | This entry |

### New Endpoint

`GET /api/reports/owner-summary?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=daily|weekly|monthly` (auth required)

Returns:
- `range` — echo of `{from, to, groupBy}`
- `totals` — billed, collected, outstanding, visitCount, procedureCount, patientCount, averageTicket, collectionRate
- `revenueTrend` — every period in range (zeroes included), `{period, billed, collected, visits}`
- `doctorProduction` — sorted by collected desc; falls back to `Unassigned / Clinic` bucket if no doctors found
- `topProcedures` — top 10 by revenue, `{name, category, revenue, count}`
- `patientGrowth` — per period, `{period, newPatients, activePatients}` (newPatients computed from each patient's all-time first visit)

Date handling uses UTC `YYYY-MM-DD` for daily/weekly buckets and `YYYY-MM` for monthly, matching Phase 2 conventions. Numbers parsed defensively.

### Desktop UI Summary

- Tabs: **Owner Analytics** (default) and **Prescription Report**.
- Owner tab filter bar: From/To date pickers, Group By selector (daily/weekly/monthly), Refresh, Export CSV, Print/PDF buttons.
- 6 KPI cards: Collected, Billed, Outstanding, Collection Rate, Visits, Avg Ticket.
- Custom SVG line chart with billed (dashed sky) vs collected (solid emerald + gradient area), Y-axis ticks, hover tooltips, period labels.
- Doctor Production table with click-to-sort columns (collected, billed, visits, patients, avg ticket).
- Top Procedures: ranked horizontal bar list with category labels and counts.
- Patient Growth: dual-bar mini chart (active vs new) per period.
- Skeleton loaders + non-blocking error banner.

### Export Behavior

**CSV** (`Export CSV` button): generates a single multi-section CSV with BOM:
- `# Totals`
- `# Revenue Trend`
- `# Doctor Production`
- `# Top Procedures`
- `# Patient Growth`

Filename: `clinic-owner-report-<from>-to-<to>.csv`. Implemented as a browser-side `Blob` download — **no dependencies added**.

**Print/PDF** (`🖨 Print / PDF` button): opens a new window with a clean printable HTML report (header, KPI grid, doctor table, top procedures table, revenue trend table, patient growth table) and a top-right Print button. The user can pick "Save as PDF" from the system print dialog. **No PDF library added**. If pop-ups are blocked, an alert prompts the user.

### Mobile Regression Note

- `client/src/mobile/pages/MobileReports.tsx` was **not modified**.
- Existing mobile API methods (`api.reports.daily`, `api.reports.prescriptions`) are unchanged.
- `vite build` passes; mobile bundle compiles. `/m/reports` continues to render the existing mobile report layout.

### Build Results

| Command | Result |
|---------|--------|
| `npx vite build` | ✅ `✓ built in 6.07s` — no errors |
| `npx tsc -p tsconfig.server.json` | ✅ exit 0 — **all pre-existing `report/index.ts` errors fixed** |

### Known Limitations

- Demo data has only one doctor populated on visits (`DOCTOR_ID = "2"`), so the doctor production table typically shows a single row (Dr. Mohammed Al-Mansouri) plus possibly an Unassigned fallback. Once visits start carrying varied `doctorId` values, the table will fill out.
- Print/PDF relies on the browser's native print-to-PDF; appearance varies slightly by browser.
- CSV export is per-range; bulk historical export still goes through the existing admin `/api/reports/export/*` links, which we preserved on the Prescription tab.
- Pop-up blockers can prevent the Print window from opening; user is alerted to allow pop-ups.
- Patient growth uses each patient's all-time first visit — depending on demo-store seeding, "new" patients may concentrate on a single date.

---

## Phase 4A — Appointment Engine & Conflict Safety

**Status:** ✅ COMPLETE

### Goal
Make the appointment system safer and more clinic-realistic before building advanced UI on top: enforce working hours, prevent double-booking by doctor OR patient, and surface clear errors. UI redesign and drag-and-drop are deferred to Phase 4B/4C.

### Files Changed

| File | Change |
|------|--------|
| `server/modules/appointment/index.ts` | Added working-hours config (Mon–Sat, 08:00–18:00, Sun closed), refactored `findConflict()` helper to detect both doctor and patient overlaps with conflict type, added PATCH endpoint for safe status/notes updates without re-validating schedule. POST, PUT, PATCH validate appropriately. New `GET /api/appointments/working-hours`. Existing fields (`type`, `notes`, `status`, etc.) are preserved on update via merge |
| `client/src/lib/api.ts` | Enhanced `request()` to safely handle 204 No Content and empty responses. Enhanced error handling to attach `status` and structured `body` to thrown errors so the UI can render server-provided detail. No existing API method renamed |
| `client/src/pages/Appointments.tsx` | Added friendly error banners for doctor_conflict and patient_conflict with distinct messages. Dialog shows conflicting appointment details (patient, doctor, date, time, duration). Banner clears on dialog open/close/submit. Fixed pre-existing strict-TS index error around `DOCTOR_ACCENT[appt.doctorId]` |
| `PRODUCT_PHASES.md` | This entry — updated for patient conflict and delete/cancel safety |

### Conflict Detection (Updated for Phase 4A Surgical Fix)

A refactored `findConflict()` helper inside `server/modules/appointment/index.ts`. Detects **two types** of conflicts:

**A) Doctor Conflict:**
- Same `doctorId`
- Same `appointmentDate`
- Time intervals overlap using the rule **A starts before B ends AND B starts before A ends** (touching boundaries do NOT conflict — `09:00–09:30` and `09:30–10:00` are allowed)
- Both candidate and existing appointments are in a *blocking* status (NOT `cancelled`, `no_show`, `no-show`)
- Self is excluded on update via `excludeId`

**B) Patient Conflict (NEW in surgical fix):**
- Same `patientId`
- Same `appointmentDate`
- Time intervals overlap (same rule as above)
- Both candidate and existing appointments are in a *blocking* status
- Self is excluded on update

Conflict response (HTTP **409**) — **doctor conflict:**

```json
{
  "message": "Appointment conflict detected",
  "type": "doctor_conflict",
  "conflict": {
    "appointmentId": "…",
    "patientName": "…",
    "doctorName": "…",
    "appointmentDate": "YYYY-MM-DD",
    "timeSlot": "HH:mm",
    "duration": 30
  }
}
```

Conflict response (HTTP **409**) — **patient conflict:**

```json
{
  "message": "Patient already has an overlapping appointment",
  "type": "patient_conflict",
  "conflict": {
    "appointmentId": "…",
    "patientName": "…",
    "doctorName": "…",
    "appointmentDate": "YYYY-MM-DD",
    "timeSlot": "HH:mm",
    "duration": 30
  }
}
```

Falls back to a default 30-minute duration if `duration` is missing/invalid. Numbers parsed defensively.

### Working-Hours Validation

Constants in the appointment module (no settings UI yet):

- Open: 08:00 (480 minutes)
- Close: 18:00 (1080 minutes)
- Closed days: Sunday (UTC `getUTCDay()` == 0)
- Default duration: 30 minutes

Validation runs on POST and on PUT (only when the merged appointment is in a blocking status, so cancelling a Sunday legacy record still works). Rejects with HTTP **400**:

```json
{ "message": "Appointment is outside clinic working hours (08:00–18:00)." }
```

…or `(clinic is closed that day).` for Sunday.

Date strings use the same UTC `YYYY-MM-DD` convention established in Phase 2 / Phase 3.

### Appointment Cancellation & Deletion (NEW in surgical fix)

**Status Updates (PATCH):**
- `PATCH /api/appointments/:id` with `{ status: "cancelled" }` — bypasses schedule validation, allows cancellation of any appointment
- Accepts: `status`, `notes`, `type` fields only
- Does not re-validate working hours or conflicts
- Enables safe soft-delete by status change

**Hard Delete (DELETE):**
- `DELETE /api/appointments/:id` — removes appointment entirely
- Bypasses schedule validation
- Returns `{ success: true }` or empty response

**Backend Validation Policy:**
- Schedule-relevant fields (date, time, doctor, patient, duration) trigger validation only when changing a blocking appointment to another blocking state
- Status changes to cancelled/no_show/no-show are always allowed
- All validation is skipped on PATCH and DELETE

**Frontend Behavior:**
- Cancel button calls PATCH endpoint to change status to `cancelled` (soft-delete)
- Delete button calls DELETE endpoint (hard-delete)
- After cancel/delete, React Query refetches appointment list

### UI Behavior

- **Create with doctor overlap** → dialog stays open with rose-tinted banner: `⚠ Time conflict — Conflicts with <patient> — <doctor> on <date> at <time> (Nm). Pick a different time, doctor, or duration.`
- **Create with patient overlap** → dialog stays open with rose-tinted banner: `⚠ Patient already has appointment — This patient already has another appointment at this time: <patient> — <doctor> on <date> at <time> (Nm). Pick a different time, doctor, or duration.`
- **Sunday or out-of-hours** → amber banner: `⚠ Outside working hours` + server message.
- **Generic 5xx / network** → neutral banner with the underlying message.
- Banner clears on submit, dialog open, dialog close, and on successful save.
- Existing list/day/week views, doctor filter, status badges, WhatsApp reminder buttons, and patient picker behavior are all preserved.

### Mobile Regression Note

- Zero files under `client/src/mobile/` modified. Verified via `git status`.
- `MobileAppointments.tsx` continues to call `api.appointments.list`, `api.appointments.updateStatus`, and `api.appointments.create` with unchanged signatures.
- A mobile create that would conflict (doctor or patient) or be out-of-hours now receives 409/400 instead of silent success. React Query mutations enter the standard error state — no crash. Mobile UI does not surface a friendly error in this phase by design (mobile UI redesign is deferred to Phase 4D).
- PATCH endpoint is available for mobile status updates if needed in future phases.

### Build Results

| Command | Result |
|---------|--------|
| `npx vite build` | ✅ (run in surgical fix phase) |
| `npx tsc -p tsconfig.server.json` | ✅ (run in surgical fix phase) |

### Known Limitations

- Working-hours config is a constant in code, not a configurable setting. A real settings UI is deferred (likely Phase 4B/4E).
- Per-doctor working hours (e.g. one doctor only Wed/Fri) are not modeled yet — clinic-wide hours apply to everyone.
- Chair/room resource conflict detection is not modeled — only doctor + patient + time.
- Walk-in vs scheduled distinction is not in the schema; not added to avoid a migration in this phase. Documented for a later phase.
- Mobile appointment dialog does not surface friendly conflict/working-hours errors yet (no UI redesign in this phase). Errors still propagate as React Query error states without crashing.
- Day-of-week is computed in UTC for consistency with stored dates. In timezones far from UTC, a date typed locally is still treated by its calendar string, so the rule is intuitive.

### Surgical Audit Changes (Added in Phase 4A fix)

This section documents the fixes applied to resolve manual testing issues:

**Root Causes Fixed:**
1. Same-patient double-booking: `findConflict()` only checked doctor overlap, not patient overlap
2. Delete/cancel failure: Frontend called non-existent PATCH endpoint; `request()` didn't handle empty responses

**Implementation:**
- Refactored `findConflict()` to return `{ conflict, type: "doctor_conflict" | "patient_conflict" }`
- Created PATCH endpoint for safe status/notes updates without schedule re-validation
- Updated `request()` to safely handle 204 and empty responses
- Updated frontend to display appropriate error messages per conflict type
- Verified DELETE endpoint works (already in place) and bypasses validation

---

## Future Phases (Not Yet Defined)

To be filled in by product owner.
