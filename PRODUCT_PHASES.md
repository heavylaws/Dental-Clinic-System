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

## Phase 4B — Desktop Calendar UX Upgrade

**Status:** ✅ COMPLETE

### Goal
Turn the desktop appointment page into a premium clinic-grade scheduling tool: day/week/month views, multi-filter, color-coded status, polished cards, and a click-to-open details panel — without weakening the Phase 4A safety rules and without touching the mobile UI. Drag-and-drop is intentionally deferred to Phase 4C.

### Files Changed

| File | Change |
|------|--------|
| `client/src/pages/Appointments.tsx` | Full UI rewrite. New `month` view, polished `day` and `week` views, segmented view switcher, multi-filter toolbar (doctor/status/type) with "Clear filters", date picker, color legend, polished `<AppointmentCard>`, click-to-open `<DetailsPanel>` modal with quick status actions (Confirm/Complete/Cancel/Edit/Delete/WhatsApp), per-view empty states, responsive grids and overflow control. All Phase 4A safety wiring preserved |
| `PRODUCT_PHASES.md` | This entry |

### View Switcher

Segmented control: **Day · Week · Month**. The previously default `day` view remains the default.

- **Day** — 30-minute slots from `08:00` to `19:30`. Empty slots clickable to create at that time. The slot column shows a faint `+` button on hover for explicit-add affordance.
- **Week** — Mon–Sun grid (Mon-first), hour rows, compact cards, Sunday column tinted gray + labeled `closed`, today's column tinted primary, sticky time column on horizontal scroll.
- **Month** — Mon–Sun grid covering the full visible month range (~6 weeks). Each cell shows the day number, the appointment count, up to **3** appointment chips, and a `+N more` indicator. Today is highlighted with a circled day number and a primary inset ring. Days outside the current month are dimmed. Clicking a cell selects that date and switches to **Day** view.

### Navigation

- **Previous / Today / Next** controls plus a **date picker** input.
- Previous/Next moves by **±1 day**, **±7 days**, or **±1 month** depending on the active view. **Today** snaps to the current date.

### Filters

Three independent client-side filters that affect only what's visible (server data is never mutated):

- **Doctor** — populated from `api.appointments.doctors()` plus an "All doctors" option.
- **Status** — fixed list: Scheduled, Confirmed, Completed, Cancelled, No-show.
- **Type** — derived dynamically from the visible range's appointment data so newly added types show up automatically.

A `Clear filters` button appears whenever any filter is active.

### Color Legend

Inline legend bar above the calendar showing:
- **Status dots** for each status with its label (uses `STATUS_META`).
- **Doctor accent stripes** (left-border colors): Dr. Mohammed (blue), Dr. Layla (purple).

### Appointment Cards

`<AppointmentCard>` is used in both Day and Week views and shows: patient name, time (mono), duration, type chip, status badge (in non-compact mode), doctor name (italic), and a doctor-color left border. Whole card is a single button that opens the details panel; hover lifts and brightens.

In **Month** view, cards are inline mini-chips with `time` + `patient name` and the same color/accent system.

### Details Panel

Single click on any appointment chip opens a modal `<DetailsPanel>` showing:

- Patient name, date • time • duration
- Status pill + Type pill
- Detail rows: Doctor, Phone, Notes (if any)
- **Quick status actions** (only if not already cancelled/completed):
  - **Confirm** (when status is `scheduled`) → `PATCH /api/appointments/:id/status` with `confirmed`
  - **Complete** (when `scheduled`/`confirmed`) → status `completed`
  - **Cancel** → status `cancelled` with `window.confirm`
- **Tools**: Edit (opens existing form dialog with `formError` reset), WhatsApp reminder (only if phone present), Delete (hard-delete via `DELETE /api/appointments/:id` with `window.confirm`).

All routes used by the panel are the Phase 4A endpoints — no new client APIs were added.

### Empty States

Distinct empty states per view:
- **Day**: `No appointments scheduled` with a CTA button.
- **Week**: `No appointments this week` with a CTA button.
- **Month**: `No appointments in <Month Year>` with a CTA button.
- When filters hide everything, an amber inline banner reads `No appointments match your filters …` so users can tell it's a filter effect, not an empty schedule.

### Responsive Desktop Behavior

- Top-level page uses `max-w-7xl mx-auto px-4 sm:px-6 py-8`.
- Toolbar is `flex flex-wrap` so filters wrap below on narrow viewports.
- Week view wraps in `overflow-x-auto` with a `min-w-[760px]` grid + sticky time column.
- Month view uses `grid grid-cols-7` with day cells `min-h-[110px]`. Excess events collapse to `+N more` instead of overflowing.
- Dialogs use `max-h-[92vh] overflow-y-auto` so long forms scroll.

### Phase 4A Safety Preserved

- Error banner inside the create/edit dialog still differentiates **doctor_conflict**, **patient_conflict**, **working-hours**, and **generic** (rose / amber / neutral).
- `createMutation` and `updateMutation` still hit `POST /` and `PUT /:id` which run working-hours + conflict (doctor + patient) validation server-side.
- `statusMutation` uses `api.appointments.updateStatus` → `PATCH /:id/status` for cancellation/confirmation/completion. No schedule re-validation, by design.
- `deleteMutation` uses `DELETE /:id`. Both Cancel and Delete go through `window.confirm` first.
- Sunday and out-of-hours rules still enforced by the backend; UI surfaces the message in the banner.

### Mobile Regression Note

- **Zero** files modified under `client/src/mobile/` — verified via `git status --short` (only `client/src/pages/Appointments.tsx` and `PRODUCT_PHASES.md` are dirty).
- `MobileAppointments.tsx` still calls `api.appointments.list/updateStatus/create` with unchanged signatures.
- `vite build` passes which guarantees the full client bundle (including mobile routes under `/m`) compiles.
- Mobile UX remains unchanged — its polish is intentionally deferred to Phase 4D.

### Build Results

| Command | Result |
|---------|--------|
| `npx vite build` | ✅ `✓ built in 7.66s` — no errors |
| `npx tsc -p tsconfig.server.json` | ✅ exit 0 — no errors |

### Known Limitations

- **Drag-and-drop is deferred to Phase 4C** by design — clicks open the details panel; rescheduling still requires Edit.
- Working hours are still **code constants** from Phase 4A — no settings UI.
- **Per-doctor schedules** and **chair/room conflicts** are still future work (likely Phase 4E or later).
- **Mobile appointment UX polish** is deferred to Phase 4D.
- Month view caps at 3 chips per day + "+N more" — there is no inline expander; users click the day to jump to Day view for the full list.
- Type filter options are derived from the visible range only; uncommon types may not appear in the dropdown until they're loaded into the current view.
- Week view's hour rows are 60-minute lines (showing 30-minute slots stacked) to keep the table compact; the underlying scheduler still allows any 30-minute slot via the dialog.

---

## Phase 4C — Drag-and-Drop Rescheduling

**Status:** ✅ COMPLETE

### Goal
Enable drag-and-drop rescheduling in desktop Day/Week views while preserving all Phase 4A safety validation and all Phase 4B UI behaviors. Mobile remains unchanged.

### Files Changed

| File | Change |
|------|--------|
| `client/src/pages/Appointments.tsx` | Added `@dnd-kit/core` integration for Day/Week drag-and-drop rescheduling (`DndContext`, `DragOverlay`, `useDraggable`, `useDroppable`, `PointerSensor`) with Sunday guards, success/error DnD banners, and existing details panel actions preserved |
| `package.json` | Added dependency `@dnd-kit/core` |
| `package-lock.json` | Lockfile updates for `@dnd-kit/core` and transitive resolution |
| `PRODUCT_PHASES.md` | This entry |

### Implementation Notes

- Drag sources are restricted to active statuses only: `scheduled`, `confirmed`.
- Drop targets use slot ids in `slot::{date}::{time}` format and call existing `PUT /api/appointments/:id` update flow.
- Reschedule payload preserves appointment data: `patientId`, `doctorId`, `type`, `status`, `duration`, `notes` while changing `appointmentDate`/`timeSlot`.
- Sunday drop/create is blocked by both UI guards and existing backend validation.
- Month view remains non-DnD in this phase by design.

### Safety Compatibility (Phase 4A)

- Backend validations are unchanged and still enforce:
  - `doctor_conflict` (409)
  - `patient_conflict` (409)
  - working-hours rejection (400)
  - Sunday rejection (400)
- Cancel/delete/edit/WhatsApp/details flows remain routed through the existing Phase 4A endpoints and handlers.

### Build + Typecheck Snapshot

- `npx vite build` passes.
- `npx tsc -p tsconfig.server.json` passes.
- `npx tsc --noEmit` currently fails due to pre-existing errors outside `Appointments.tsx`.
- `Appointments.tsx` has zero TS errors in the current workspace diagnostics.

### Known Limitations

- Month view drag-and-drop is deferred.
- Week grid drag target granularity is hour-row based in compact mode.
- Mobile does not implement drag-and-drop and remains unchanged by this phase.

---

## Phase 4D — Mobile Appointment Polish

**Status:** ✅ COMPLETE

### Goal
Make mobile appointments (`/m/appointments`) usable, clear, and safe for chair-side or reception-on-phone workflows. Improve readability, add date navigation and filtering, polish appointment actions, and surface friendly error messages — without touching desktop `Appointments.tsx` or backend validation.

### Files Changed

| File | Change |
|------|--------|
| `client/src/mobile/pages/MobileAppointments.tsx` | Full rewrite — richer cards, Today/Prev/Next/date-picker navigation, status & doctor filters with clear button, Call/WhatsApp/Confirm/Complete/Cancel (with confirmation dialog) actions, friendly error banners for conflict and working-hours errors, Sunday closed empty state, filter empty state, no-appointments empty state, improved create form with doctor selector and per-field error messages |
| `PRODUCT_PHASES.md` | This entry |

### Mobile Appointment Card Improvements

Each appointment card now shows:
- **Time** — large, mono-weight, blue, flush left
- **Patient name** — bold, ellipsis on overflow
- **Status badge** — color-coded pill (Scheduled/Confirmed/Completed/Cancelled/No-show)
- **Type badge** — neutral pill
- **Doctor name** — secondary row, blue tint
- **Duration** — secondary row (e.g. `30 min`)
- **Phone number** — secondary row when present
- **Left border accent** — color-coded by status

Cards are vertically structured (3 rows) rather than the previous single-line layout, giving more breathing room and scanability on small screens.

### Mobile Filters / Date Navigation

**Navigation controls:**
- **Today button** — in the date strip, always visible, highlighted when active
- **‹ Prev / Next ›** — tap to go back/forward one day; clears the error banner on navigation
- **Date picker** (`<input type="date">`) — fills the space between Prev/Next; setting any date jumps directly to it
- **7-day strip** — centred on current date (±3 days); Sunday slots are visually dimmed

**Filters (compact selects, horizontally scrollable row):**
- **Status filter** — All / Scheduled / Confirmed / Completed / Cancelled / No-show
- **Doctor filter** — All / [doctors from `GET /api/appointments/doctors`]; only shown when doctors exist
- **✕ Clear** button — appears when any filter is active; resets both filters

Filters are client-side; server data is never mutated.

### Mobile Action Improvements

Actions appear in a dedicated action row at the bottom of each card, separated by a hairline divider:

| Action | Condition | Implementation |
|--------|-----------|----------------|
| 📞 Call | Phone present | `<a href="tel:…">` — opens native dialer |
| 💬 WhatsApp | Phone present | `https://wa.me/{cleaned_digits}?text={pre-filled reminder}` — opens WhatsApp |
| ✓ Confirm | Status `scheduled` | `PATCH /appointments/:id/status` → `confirmed` |
| ✔ Complete | Status `scheduled` or `confirmed` | `PATCH /appointments/:id/status` → `completed` |
| ✕ Cancel | Status not cancelled/completed | Opens in-app confirmation dialog (no `window.confirm`); on confirm → `PATCH /appointments/:id/status` → `cancelled` |

All status mutations use the Phase 4A `PATCH /:id/status` endpoint — no schedule re-validation, always safe.

Phone numbers are normalised (digits only) before building `tel:` and `wa.me` URLs.

### Error Handling

A `friendlyError()` helper maps server error codes/messages to human-readable strings:

| Server signal | Mobile message |
|---------------|----------------|
| `body.type === "doctor_conflict"` | "Doctor already has an appointment at this time." |
| `body.type === "patient_conflict"` | "Patient already has another appointment at this time." |
| message contains `"working hours"` / `"outside clinic"` | "Appointment is outside clinic working hours." |
| message contains `"closed that day"` / `"sunday"` | "The clinic is closed on Sunday." |
| Any other error | Server message verbatim |

**Error surfaces:**
- **Global banner** (dismissible, rose) — status mutation errors appear above the appointment list
- **Form inline banner** — create-form errors appear inside the dialog, above the submit button
- Sunday pre-flight warning shown in the create form when the selected date is Sunday

No crashes on any error path.

### Mobile Empty States

Three distinct empty states, all with icon + title + subtitle:

| State | Icon | Title |
|-------|------|-------|
| Sunday selected | 🔒 | "Clinic Closed" + "The clinic is closed on Sundays." |
| No appointments on day | 📅 | "No appointments today" + "Tap ➕ to schedule one." |
| Appointments hidden by filter | 🔍 | "No appointments match filter" + "Clear Filters" button |

### Mobile Create Appointment Form Improvements

- **Doctor selector** — populated from `api.appointments.doctors()`; pre-selects first available doctor
- **Expanded type options** — Consultation / Follow-up / Procedure / Cleaning / Emergency
- **Sunday pre-flight warning** — amber banner shown in form when date is Sunday
- **Error inline** — `⚠️ {friendlyError}` banner appears inside form on submit failure; clears on patient or doctor change
- **Label added** — "Patient *" label above the search bar for clarity
- Time slot range corrected to `08:00–17:30` (matching desktop, last slot starts at 17:30 → ends 18:00)

### Desktop Regression Note

- **Zero files modified** under `client/src/pages/` — `Appointments.tsx` is untouched.
- `MobileDashboard.tsx` untouched.
- `client/src/lib/api.ts` untouched — no new API methods added; `api.appointments.doctors()` and `api.appointments.updateStatus()` already existed.
- `server/modules/appointment/index.ts` untouched.
- No new npm dependencies added.
- Desktop Day/Week/Month views, drag-and-drop, Details panel, and WhatsApp are all unaffected.

### Build Results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx vite build` | ✅ no errors |
| `npx tsc -p tsconfig.server.json` | ✅ exit 0 |

### Known Limitations

- **No mobile drag-and-drop** — rescheduling on mobile requires desktop or future dedicated mobile edit flow.
- **No full mobile month/week calendar** — mobile shows day-by-day only; a month/week view is future work.
- **Hard delete is desktop/admin-oriented** — mobile Cancel uses soft-delete (status → `cancelled`); DELETE endpoint is not exposed on mobile in this phase.
- **Working hours are code constants** from Phase 4A — no mobile settings UI; Sunday and out-of-hours are enforced by the backend and surfaced as friendly errors.
- **No mobile edit form** — full appointment editing (change date/time/doctor) still requires desktop. Documented as future work (Phase 4E or later).
- **WhatsApp pre-filled text** is a static reminder string; rich templates (from the existing `api.whatsapp.sendAppointmentReminder`) are not wired up in this phase to avoid a dependency on WhatsApp connection state.

---

## Phase 5A — Reminder Foundation + Manual Send + Notification Log

**Status:** ✅ COMPLETE

### Goal

Allow staff to manually send appointment reminders, log every reminder attempt, and prepare the backend foundation for automatic reminders later (Phase 5B cron). No scheduled automation added in this phase.

### Files Changed

| File | Change |
|------|--------|
| `server/modules/reminder/index.ts` | **New** — `GET /api/reminders/logs` (filterable) and `POST /api/reminders/send` with WhatsApp dispatch, SMS/email stubs, in-memory log store |
| `server/index.ts` | Imported and mounted `reminderRouter` at `/api/reminders` |
| `client/src/lib/api.ts` | Added `api.reminders.logs(params?)` and `api.reminders.send(payload)` |
| `client/src/pages/Appointments.tsx` | Added `reminderMutation`, `reminderResult` state, and `handleSendReminder`. Updated `DetailsPanel` to accept reminder props; added "🔔 Send Reminder" button, result banner, and mini reminder log panel showing last 5 attempts |
| `client/src/mobile/pages/MobileAppointments.tsx` | Added `reminderMutation`, `reminderBanner` state, a "🔔 Reminder" button in each card's action row (phone-gated), and a dismissible result banner above the list |
| `PRODUCT_PHASES.md` | This entry |

### New Endpoints

#### `GET /api/reminders/logs` (auth required)

Query params (all optional): `appointmentId`, `patientId`, `status`, `from` (ISO date/datetime), `to` (ISO date/datetime).

Returns `ReminderLog[]` sorted newest first.

#### `POST /api/reminders/send` (auth required)

Body:
```json
{ "appointmentId": "string", "channel": "whatsapp|sms|email", "message": "optional override" }
```

Default channel: `whatsapp`.

Response:
```json
{ "success": boolean, "message": "string", "waUrl": "string|undefined", "log": ReminderLog }
```

### ReminderLog Shape

```ts
{
  id: string,
  appointmentId: string,
  patientId: string | null,
  patientName: string,
  phone: string | null,
  channel: "whatsapp" | "sms" | "email",
  status: "sent" | "failed" | "stubbed" | "not_configured",
  message: string,
  error?: string,
  waUrl?: string,
  sentAt: string,
  appointmentDate: string,
  timeSlot: string
}
```

### Reminder Message Template

```
Hello {patientName}, this is a reminder for your dental appointment on {appointmentDate} at {timeSlot}. Please contact us if you need to reschedule.
```

Custom `message` in POST body overrides the default.

### WhatsApp Behavior

The system uses the existing `whatsapp-web.js` backend client (`server/modules/whatsapp/index.ts`).

| WhatsApp client state | Result |
|-----------------------|--------|
| Connected + ready | `status: "sent"` — message delivered via `waClient.sendMessage()` |
| Not connected / not authenticated | `status: "stubbed"` — no fake delivery; a `wa.me/…?text=…` URL is returned so staff can send manually |

**No false delivery is claimed.** If WhatsApp is not connected, the response explicitly says so and provides a `waUrl` link.

### SMS / Email Behavior

Both are stubs in Phase 5A. They create a log entry with `status: "not_configured"` and return HTTP 200 with `success: false`. No external provider is required.

### No-Phone Handling

If the patient has no phone number:
- A `status: "failed"` log is created with `error: "Patient phone number is missing"`.
- HTTP 400 is returned with a clear message.
- No crash.

### Desktop UI Changes (`Appointments.tsx`)

Inside the `DetailsPanel` (appointment details modal), below the existing Edit / WhatsApp / Delete tools:

- A **"🔔 Send Reminder"** button (violet) calls `POST /api/reminders/send` with the current appointment.
- While pending: button shows a spinner and "Sending…".
- On success: green banner "✓ Reminder sent successfully."
- On stubbed (WA not connected): amber banner with explanation + "Open in WhatsApp Web →" link.
- On error (no phone, etc.): rose banner with the error message.
- Result banner is dismissible (×) and clears when the panel is closed.
- A **mini reminder log** panel shows the last 5 reminder attempts for that appointment (channel, status, time), loaded via `GET /api/reminders/logs?appointmentId=…`.
- All existing actions preserved: Edit, Confirm, Complete, Cancel, WhatsApp, Delete.
- Drag-and-drop is unaffected (reminder button is inside the modal, not on calendar cards).
- Conflict detection and scheduling validation are unaffected.

### Mobile Changes (`MobileAppointments.tsx`)

A lightweight **"🔔 Reminder"** button (purple tint) is added to each appointment card's action row.

- Only shown when the appointment has a phone number (same gate as the Call/WhatsApp buttons).
- Taps call `POST /api/reminders/send`.
- A dismissible result banner (success/stubbed/error) appears above the list.
- Existing actions (📞 Call, 💬 WhatsApp, ✓ Confirm, ✔ Complete, ✕ Cancel) are fully preserved.
- No layout redesign. No drag-and-drop. No new dependencies.

### Build Results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx vite build` | ✅ no errors |
| `npx tsc -p tsconfig.server.json` | ✅ exit 0 |

### Known Limitations

- **No cron automation** — Phase 5B will add scheduled automatic reminders.
- **Reminder log is in-memory** — `demoReminderLogs` resets on server restart. A proper DB table migration is deferred to a later phase (documented as TODO in the module).
- **SMS and email are stubs** — they log `not_configured`. Real SMS/email providers are Phase 5C or later.
- **Backend WhatsApp requires the client to be connected** — staff must connect via `/api/whatsapp/connect` first. If not connected, a `wa.me` URL is provided instead.
- **No patient opt-out** — patient reminder preference fields are not in the current schema. Sending is not blocked by opt-out in Phase 5A (TODO: Phase 5C patient preferences).
- **wa.me URL is built from phone digits** — country code is assumed to be present in the stored phone number. International format (e.g. `+218xxxxxxxx`) works correctly; local-format numbers may need a country code prefix in Phase 5C.

---

## Phase 5B — Automatic Reminder Scheduler / Cron Rules

**Status:** ✅ COMPLETE

### Goal

Automatically send appointment reminders based on built-in time rules, using the Phase 5A send/log foundation. No new external dependencies added.

### Files Changed

| File | Change |
|------|--------|
| `server/modules/reminder/core.ts` | **New** — `ReminderLog` type (extended), `demoReminderLogs` store, `sendAppointmentReminder()` shared function; extracted from `index.ts` to avoid circular imports |
| `server/modules/reminder/scheduler.ts` | **New** — `setInterval`-based scheduler, 3 rules, idempotency check, `startReminderScheduler / stopReminderScheduler / runReminderSchedulerOnce`, singleton guard |
| `server/modules/reminder/index.ts` | Refactored — re-exports from `core.ts`; adds `GET /scheduler/status` and `POST /scheduler/run-once` routes; `POST /send` now calls shared `sendAppointmentReminder()` |
| `server/index.ts` | Imports `startReminderScheduler` and calls it after routes are mounted |
| `client/src/lib/api.ts` | Added `api.reminders.schedulerStatus()` and `api.reminders.runSchedulerOnce()` |
| `client/src/pages/Appointments.tsx` | Added `SchedulerStatusPanel` component; inserted inside `DetailsPanel` reminder section; mini-log now shows `auto` tag for automatic reminders |
| `PRODUCT_PHASES.md` | This entry |

### Scheduler Decision

**`setInterval`-based — no `node-cron` dependency added.**

Rationale: the project already has no `node-cron` in `package.json`. A simple `setInterval(60_000)` achieves the same minute-level granularity with zero new dependencies and no extra type declarations needed. The interval is `unref()`-ed so it never blocks clean Node exits.

### Reminder Rules

| Rule key | Fires at | Description |
|----------|----------|-------------|
| `day_before_18h` | 18:00 the day before | Evening advance notice |
| `same_day_08h` | 08:00 on appointment day | Morning of appointment |
| `two_hours_before` | Appt time − 2 hours | Short-lead reminder |

Each rule has a **5-minute trigger window** so a once-per-minute poll will catch it even under slight timing jitter.

### Idempotency / No-Duplicate Behavior

A reminder is considered **already handled** if `demoReminderLogs` contains any entry matching `(appointmentId, channel, ruleKey)` — regardless of status (`sent`, `stubbed`, `failed`, `not_configured`).

- **Failed reminders are not retried automatically** in Phase 5B — documented as a known limitation.
- Manual reminders (Phase 5A) use `ruleKey: "manual"` and are never confused with automatic entries.
- The singleton guard (`schedulerStarted` flag) prevents double-start on `tsx watch` hot-reload.

### New ReminderLog Fields (Phase 5B)

All three are optional — Phase 5A logs remain fully compatible.

| Field | Type | Notes |
|-------|------|-------|
| `ruleKey` | `string` | `"manual"` for manual sends; rule key for automatic |
| `triggerType` | `"manual" \| "automatic"` | Origin of the send |
| `dueAt` | `string` | ISO timestamp when the rule was due to fire |

### New Endpoints

#### `GET /api/reminders/scheduler/status` (auth required)

```json
{
  "enabled": true,
  "running": false,
  "rules": [{ "key": "day_before_18h", "label": "...", "description": "..." }, ...],
  "lastRunAt": "2026-05-10T...",
  "lastRunSummary": { "checked": 12, "sent": 1, "skipped": 11, "failed": 0, "errors": [] }
}
```

#### `POST /api/reminders/scheduler/run-once` (auth required)

Triggers one scheduler pass immediately. Returns summary. Used for admin testing.

### Scheduler Environment Variable

| Variable | Default | Behavior |
|----------|---------|----------|
| `REMINDER_SCHEDULER_ENABLED=false` | — | Scheduler does not start |
| _(not set)_ | enabled | Scheduler starts on server startup |

Default is **enabled** — safe because idempotency prevents duplicate sends.

### Desktop UI Changes (`Appointments.tsx`)

Inside the `DetailsPanel` reminder section, below the mini reminder log:

- **Auto-scheduler panel** shows:
  - Enabled / disabled / running badge
  - Last run timestamp + quick summary (✓sent ~skipped ✕failed)
  - **"▶ Run scheduler now"** button — calls `POST /api/reminders/scheduler/run-once`, then refreshes status
  - Result summary after run
- Mini reminder log entries now show an `auto` tag when `triggerType === "automatic"`
- Auto-refreshes every 30 seconds via `refetchInterval`
- All existing actions (Edit, Confirm, Cancel, Delete, WhatsApp, Send Reminder) preserved
- Drag-and-drop unaffected

### Mobile Decision

**No mobile changes.** The existing Phase 5A "🔔 Reminder" button continues to work unchanged. Scheduler controls are admin/desktop-only in Phase 5B.

### Build Results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx vite build` | ✅ built in 7.74s |
| `npx tsc -p tsconfig.server.json` | ✅ exit 0 |

### Known Limitations

- **Failed automatic reminders are not retried** — once any log exists for `(appointmentId, channel, ruleKey)`, the rule is permanently skipped for that triple. Retry logic is Phase 5C or later.
- **Reminder log is still in-memory** — resets on server restart. DB migration deferred.
- **SMS and email still stubbed** — `not_configured` status. Real providers are Phase 5C.
- **WhatsApp requires connection** — falls back to `stubbed` + `wa.me` URL if client not connected.
- **No patient opt-out** — preference fields not yet in schema (TODO: Phase 5C).
- **Multi-instance deployments** — the in-memory singleton guard only works in single-process mode. Multi-instance needs DB-backed distributed lock for idempotency.
- **No rule editing UI** — rules are code constants. A settings UI is future work.
- **Rule windows are local-time** — `isDue()` uses `new Date()` local time. If the server timezone differs from the clinic timezone, fire times may be off. Set `TZ` env var to match clinic location.

---

## Future Phases (Not Yet Defined)

To be filled in by product owner.
