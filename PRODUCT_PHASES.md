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

## Phase 5C — Reminder Settings, Templates, and Opt-In/Out Foundation

**Status:** ✅ COMPLETE

### Goal

Add a safe reminder configuration layer: editable templates, enable/disable rules, default channel control, and patient-level opt-in/opt-out. No new dependencies. No DB migrations. No SMS/email provider integrations.

### Files Changed

| File | Change |
|------|--------|
| `server/modules/reminder/settings.ts` | **New** — in-memory settings store, patient preferences map, `renderTemplate()`, `getReminderSettings / setReminderSettings / resetReminderSettings`, `getPatientPreferences / setPatientPreferences` |
| `server/modules/reminder/core.ts` | Updated — imports `renderTemplate` + `getPatientPreferences`; patient opt-out check before send; template rendering replaces hardcoded message builder |
| `server/modules/reminder/scheduler.ts` | Updated — imports `getReminderSettings`; respects `schedulerEnabled`, per-rule `enabled`, per-rule `channel` |
| `server/modules/reminder/index.ts` | Added `GET/PUT /settings`, `POST /settings/reset`, `GET/PUT /preferences/:patientId` routes |
| `client/src/lib/api.ts` | Added `api.reminders.settings()`, `updateSettings()`, `resetSettings()`, `preferences()`, `updatePreferences()` |
| `client/src/pages/Settings.tsx` | Added collapsible `ReminderSettingsPanel` (admin-only) — master toggle, default channel, per-rule toggles/channels, template textareas, Save + Reset-to-defaults |
| `client/src/pages/Appointments.tsx` | Added patient opt-out toggle + opt-out notice banner inside `DetailsPanel` reminder section |
| `PRODUCT_PHASES.md` | This entry |

### Reminder Settings Model

```ts
{
  schedulerEnabled: boolean,         // master auto-scheduler on/off (app-level)
  defaultChannel: "whatsapp"|"sms"|"email",
  rules: {
    day_before_18h:   { enabled: boolean, channel: "whatsapp"|"sms"|"email" },
    same_day_08h:     { enabled: boolean, channel: "whatsapp"|"sms"|"email" },
    two_hours_before: { enabled: boolean, channel: "whatsapp"|"sms"|"email" },
  },
  templates: {
    manual:           string,
    day_before_18h:   string,
    same_day_08h:     string,
    two_hours_before: string,
  }
}
```

**Defaults:** all rules enabled, channel `whatsapp`, templates use all four variables.

**Persistence:** in-memory (resets on server restart). Document as limitation.

### Template Variables

| Variable | Value |
|----------|-------|
| `{patientName}` | Patient's full name |
| `{appointmentDate}` | Appointment date string (YYYY-MM-DD) |
| `{timeSlot}` | Appointment time (HH:MM) |
| `{clinicName}` | `demoSettings.clinic_name` or `"Dental Clinic"` |

Missing variables in template are left as-is (no crash). Custom `message` in `sendAppointmentReminder()` always overrides the template.

### Settings Endpoints

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/reminders/settings` | Returns current settings |
| `PUT` | `/api/reminders/settings` | Merges partial patch; validates channels; 400 on invalid |
| `POST` | `/api/reminders/settings/reset` | Resets to defaults |

All auth-required.

### Patient Preferences Model

```ts
{
  remindersEnabled: boolean,   // master opt-in/out
  whatsapp: boolean,
  sms: boolean,
  email: boolean,
}
```

**Default:** `remindersEnabled: true, whatsapp: true, sms: false, email: false`.

**Storage:** in-memory `Map<patientId, prefs>` (resets on restart).

### Patient Preference Endpoints

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/reminders/preferences/:patientId` | Returns prefs or defaults |
| `PUT` | `/api/reminders/preferences/:patientId` | Merges partial patch |

### Opt-Out Behavior

When `remindersEnabled: false`:
- `sendAppointmentReminder()` creates a log with `status: "not_configured"`, `error: "Patient has opted out of reminders"`.
- No WhatsApp/SMS/email attempt is made.
- Applies to both **manual** and **automatic** reminders.
- No force-override flag in Phase 5C.

### Scheduler Integration (Phase 5C changes)

- `schedulerEnabled: false` in settings → `runReminderSchedulerOnce()` returns immediately with `{ errors: ["Scheduler disabled via settings"] }`.
- `REMINDER_SCHEDULER_ENABLED=false` env var → runtime scheduler never starts (Phase 5B behavior preserved).
- Both controls are independent; env var controls process startup, settings control runtime behavior.
- Per-rule `enabled: false` → rule is skipped in scheduler loop.
- Per-rule `channel` → used as the send channel (with fallback to `defaultChannel`).
- Idempotency key is `(appointmentId, channel, ruleKey)` — changing channel setting after a rule fires can allow a re-send on the new channel. Document as limitation.

### Desktop UI

**Settings page** (`/settings`, admin-only):
- Collapsible `🔔 Reminder Settings` panel (violet border).
- Master scheduler toggle + default channel select.
- Per-rule rows: enabled checkbox + channel select.
- Template textareas for all 4 keys with variable hint.
- **Save** and **↺ Reset to defaults** buttons.
- Invalidates `reminder-settings` and `reminder-scheduler-status` query cache on save.

**Appointments DetailsPanel**:
- Opt-in/out checkbox beside "Reminder" heading, showing current patient preference.
- Amber warning banner when patient is opted out.
- Toggle saves immediately via `PUT /api/reminders/preferences/:patientId`.

### Mobile Decision

**No mobile changes.** The existing Phase 5A Reminder button calls `api.reminders.send()` which now naturally routes through `sendAppointmentReminder()`. Opt-out is enforced on the backend — if opted out, the response returns a clear message and a `not_configured` log. Mobile banner (if applicable) shows whatever message the backend returns. No mobile settings UI added.

### Build Results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx vite build` | ✅ built in 6.29s |
| `npx tsc -p tsconfig.server.json` | ✅ exit 0 |

### Known Limitations

- **Settings and preferences are in-memory** — reset on server restart. DB migration needed for production.
- **Opt-out channel granularity deferred** — `remindersEnabled` is a single master flag; per-channel opt-out (`sms: false`) has no effect on sending yet (only WhatsApp is implemented).
- **No force-send override** — opted-out patients cannot receive reminders even in urgent cases (TODO: Phase 5D).
- **No SMS/email provider** — still stubbed as `not_configured`.
- **Template variable `{appointmentDate}` is raw YYYY-MM-DD** — no locale formatting yet.
- **Changing per-rule channel after a rule fired** — idempotency key includes `channel`, so a channel change allows re-send on new channel.
- **Multi-instance still needs DB-backed locks** for idempotency and settings consistency.
- **No mobile settings UI** — deferred to a later phase.

---

## Phase 6A — Patient Account Ledger Foundation

**Status:** ✅ COMPLETE

### Goal

Create a reliable patient-level financial ledger that shows a running balance across all visits, invoices, charges, and payments. This phase establishes the foundation for future payment plans (6B), account statements (6C), and aging buckets (6D).

### Files Changed

| File | Change |
|------|--------|
| `server/modules/ledger/index.ts` | **New** — Ledger computation from existing billing/visit/payment data, three endpoints (`GET /patient/:id`, `GET /patients`, `POST /patient/:id/adjustment`), in-memory manual adjustments support |
| `server/index.ts` | Imported and mounted `ledgerRouter` at `/api/ledger` |
| `client/src/lib/api.ts` | Added `api.ledger.patient()`, `api.ledger.patients()`, `api.ledger.addAdjustment()` with full TypeScript types |
| `client/src/pages/PatientFile.tsx` | Added `Account Ledger` tab with summary cards (charged, paid, balance, activity) and detailed ledger table with running balance |
| `client/src/pages/Billing.tsx` | Added `Patient Account Balances` section showing all patients with financial activity, clickable rows to navigate to patient file |
| `PRODUCT_PHASES.md` | This entry |

### Ledger Computation Rules

The ledger is computed from existing data sources (no database migration required):

**Data Sources:**
- `demoBillings` — invoice records linked to visits
- `demoVisits` — visit records for patient linkage and context
- `demoAdjustments` (in-memory) — manual adjustments posted via API

**Entry Types:**
- `charge` — debits that increase balance (from billing invoices)
- `payment` — credits that decrease balance (from billing payments)
- `adjustment` — manual corrections (debit or credit, from adjustment endpoint)

**Ledger Entry Shape:**
```typescript
{
  id: string,
  patientId: string,
  date: string,
  type: "charge" | "payment" | "adjustment",
  sourceType: "visit" | "invoice" | "payment" | "manual",
  sourceId: string,
  description: string,
  debit: number,
  credit: number,
  balanceAfter: number,
  status?: string
}
```

**Running Balance Calculation:**
1. Sort entries by date ascending (oldest first)
2. On same date: charges before payments (deterministic ordering)
3. Start with balance = 0
4. For each entry: `balanceAfter = previousBalance + debit - credit`

**Safe Numeric Parsing:**
- All amounts parsed with `safeParseFloat()` helper
- Non-numeric values default to 0
- Missing/empty data does not crash

### New Endpoints

#### `GET /api/ledger/patient/:patientId` (auth required)

Returns complete patient ledger:

```json
{
  "patientId": "p1",
  "patientName": "Sara Al-Hassan",
  "totals": {
    "charged": 280,
    "paid": 200,
    "balance": 80,
    "invoiceCount": 3,
    "paymentCount": 2,
    "lastPaymentDate": "2026-05-10T...",
    "lastChargeDate": "2026-05-05T..."
  },
  "entries": [ /* LedgerEntry[] sorted by date ascending */ ]
}
```

Returns 404 if patient not found.

#### `GET /api/ledger/patients` (auth required)

Returns array of all patient balance summaries:

```json
[
  {
    "patientId": "p4",
    "patientName": "Youssef Mansour",
    "charged": 80,
    "paid": 40,
    "balance": 40,
    "lastActivityDate": "2026-05-03T..."
  }
]
```

Sorted by balance descending (non-zero balances first, then by amount).

#### `POST /api/ledger/patient/:patientId/adjustment` (auth required)

Creates a manual adjustment entry:

```json
// Request body
{
  "amount": 25,
  "description": "Courtesy adjustment",
  "direction": "credit"  // or "debit"
}

// Response
{
  "success": true,
  "adjustment": { /* created adjustment */ },
  "note": "Adjustments are stored in-memory only..."
}
```

Validations:
- Patient must exist (404 if not)
- Amount must be positive number > 0 (400 if invalid)
- Direction must be "debit" or "credit" (400 if invalid)

### Desktop UI Summary

**Patient File → Account Ledger Tab:**
- Summary cards: Total Charged, Total Paid, Current Balance (color-coded: rose if positive, emerald if zero), Activity stats
- Ledger table: Date, Type (charge/payment/adjustment), Description, Debit, Credit, Running Balance
- Visual distinction: orange for debits, emerald for credits
- Empty state: "No financial activity yet." with 💰 icon

**Billing Page → Patient Account Balances:**
- Table showing all patients with financial activity
- Columns: Patient, Charged, Paid, Balance (color-coded), Last Activity
- Click row → navigate to patient file
- Filtered to show only patients with charges or non-zero balance

### Mobile Decision

**No mobile changes.** 

- `MobileBilling.tsx` was not modified
- Mobile continues to show today's billing transactions only
- Patient ledger is accessible via desktop PatientFile
- Mobile ledger view deferred to future phase

### Build Results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx vite build` | ✅ no errors |
| `npx tsc -p tsconfig.server.json` | ✅ exit 0 |

### Known Limitations

- **Ledger is computed from existing billing/demo data** — no dedicated ledger table in database
- **Manual adjustments are in-memory only** — `demoAdjustments` resets on server restart; production deployment should persist to DB
- **Payment plans deferred to Phase 6B** — no installment tracking yet
- **Account statement PDF deferred to Phase 6C** — no print/export yet
- **Aging buckets deferred to Phase 6D** — no 30/60/90 day breakdown yet
- **No mobile ledger view** — desktop PatientFile only
- **Adjustment endpoint is admin-capable but not admin-restricted** — should add role check in production

---

## Phase 6B — Payment Plans / Installments

**Status:** ✅ COMPLETE

### Goal

Allow clinics to create patient payment plans with scheduled installments. Track payment progress, record installment payments, and link payments to the patient ledger (Phase 6A foundation).

### Files Changed

| File | Change |
|------|--------|
| `server/modules/paymentPlan/index.ts` | **New** — Payment plan and installment models, four endpoints, in-memory storage with ledger integration for payments |
| `server/index.ts` | Imported and mounted `paymentPlanRouter` at `/api/payment-plans` |
| `client/src/lib/api.ts` | Added `api.paymentPlans.patient()`, `api.paymentPlans.create()`, `api.paymentPlans.updateStatus()`, `api.paymentPlans.payInstallment()` |
| `client/src/pages/PatientFile.tsx` | Added `Payment Plans` tab with create form, plan list, installment table, payment modal, and cancellation |
| `PRODUCT_PHASES.md` | This entry |

### Payment Plan Model

**PaymentPlan:**
```typescript
{
  id: string,
  patientId: string,
  title: string,
  description?: string,
  totalAmount: number,
  downPayment: number,
  installmentCount: number,
  installmentAmount: number,
  startDate: string,
  frequency: "weekly" | "biweekly" | "monthly",
  status: "active" | "completed" | "cancelled",
  createdAt: string,
  updatedAt: string
}
```

**PaymentInstallment:**
```typescript
{
  id: string,
  planId: string,
  patientId: string,
  installmentNumber: number,
  dueDate: string,
  amount: number,
  paidAmount: number,
  status: "pending" | "partial" | "paid" | "overdue" | "cancelled",
  paidAt?: string | null
}
```

### Installment Calculation Rules

1. **Remaining amount** = `totalAmount - downPayment`
2. **Base installment amount** = `remaining / installmentCount` (rounded to 2 decimals)
3. **Last installment absorbs rounding** — ensures total installments exactly equal remaining amount
4. **Due dates calculated from startDate** using frequency:
   - `weekly`: +7 days per installment
   - `biweekly`: +14 days per installment
   - `monthly`: +1 month per installment

### Installment Status Rules

Derived dynamically when fetching plans:
- `paid` — paidAmount >= amount
- `partial` — paidAmount > 0 and < amount
- `overdue` — dueDate < today and not fully paid
- `cancelled` — plan status is cancelled
- `pending` — otherwise

### Endpoints Added

#### `GET /api/payment-plans/patient/:patientId` (auth required)

Returns patient's payment plans with installments and summary:

```json
{
  "patientId": "p1",
  "patientName": "Sara Al-Hassan",
  "plans": [{
    "plan": { /* PaymentPlan */ },
    "installments": [ /* PaymentInstallment[] */ ],
    "summary": {
      "totalAmount": 1200,
      "downPayment": 200,
      "scheduledAmount": 1000,
      "paidAmount": 400,
      "remainingAmount": 600,
      "nextDueDate": "2026-06-01T...",
      "overdueAmount": 0,
      "overdueCount": 0
    }
  }]
}
```

#### `POST /api/payment-plans/patient/:patientId` (auth required)

Creates payment plan and generates installments.

**Validation:**
- Patient must exist (404 if not)
- Title required (400 if missing)
- totalAmount > 0 (400 if invalid)
- downPayment >= 0 and <= totalAmount (400 if invalid)
- installmentCount >= 1 (400 if invalid)
- Valid startDate and frequency (400 if invalid)

**Response:**
```json
{
  "success": true,
  "plan": { /* created plan */ },
  "installments": [ /* generated installments */ ],
  "summary": { /* computed summary */ },
  "note": "Payment plans are stored in-memory only..."
}
```

#### `PUT /api/payment-plans/:planId/status` (auth required)

Updates plan status to `active`, `completed`, or `cancelled`.

- Cancelling marks all unpaid installments as `cancelled`
- Does not delete financial history

#### `POST /api/payment-plans/installments/:installmentId/payment` (auth required)

Records payment against an installment.

**Validation:**
- Amount > 0 (400 if invalid)
- Installment must exist (404 if not)
- Plan must not be cancelled (400 if cancelled)
- Payment amount cannot exceed remaining balance (400 if overpay)

**Ledger Integration:**
On successful payment, the endpoint creates a real ledger credit in the same Phase 6A in-memory ledger source and returns the created entry:
```json
{
  "id": "adj-{uuid}",
  "type": "payment",
  "sourceType": "payment",
  "sourceId": "{installmentPaymentId}",
  "description": "Payment plan installment #N - {plan title}",
  "credit": amount
}
```

This credit is included by `GET /api/ledger/patient/:patientId` and `GET /api/ledger/patients` immediately after payment.

### Desktop UI Summary

**PatientFile → Payment Plans Tab:**
- Header with count summary (active/completed/cancelled) and "Create Payment Plan" button
- Create plan form (collapsible):
  - Title, Description, Total Amount, Down Payment, Installments, Start Date, Frequency
  - Live preview showing: Total, Down Payment, Remaining, Per Installment
- Plan cards with:
  - Title, description, status badge
  - Payment progress: paid / total with remaining
  - Summary bar: Total, Paid, Remaining, Next Due Date
  - Overdue warning banner if applicable
  - Expandable installments table
  - Cancel button for active plans (with confirmation)
- Installments table (when expanded):
  - Number, Due Date, Amount, Paid, Status badge
  - Pay button for pending/partial/overdue installments
- Payment modal:
  - Amount input (pre-filled with remaining balance)
  - Optional note
  - Submit/Cancel buttons
- Empty state: "No payment plans yet" with 📅 icon

### Ledger Integration Behavior

**Financial Rule Enforced:** Payment plans do NOT create fake payments.

- Payment plan = schedule/commitment only
- Only actual recorded payments reduce ledger balance
- Down payment is NOT automatically recorded as a payment (future enhancement)
- Installment payments trigger ledger credit entry (Phase 6A foundation)

**Integration Flow:**
1. User records payment via Pay button
2. Backend validates amount and installment remaining balance
3. Backend updates installment paidAmount/status
4. Backend creates real ledger credit entry (`sourceType: payment`, `sourceId: installmentPaymentId`)
5. Frontend refetches both payment plans AND ledger
6. Account Ledger tab reflects new balance

### Mobile Decision

**No mobile changes.**

- `MobileBilling.tsx` not modified
- Mobile continues showing only today's billing transactions
- Payment plans accessible via desktop PatientFile only
- Mobile payment plan UI deferred to future phase

### Build Results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx vite build` | ✅ no errors |
| `npx tsc -p tsconfig.server.json` | ✅ exit 0 |

### Known Limitations

- **Payment plans are in-memory only** — stored in `demoPaymentPlans`, `demoInstallments`, `demoInstallmentPayments` arrays; resets on server restart
- **No database persistence** — production deployment needs DB tables
- **No true payment idempotency key yet** — each payment call is treated as a new payment event; database phase should add transaction/payment IDs for safe retries
- **No automatic payment reminders** — installment due dates not linked to reminder system
- **No account statement PDF** — deferred to Phase 6C
- **No aging buckets** — deferred to Phase 6D
- **No mobile payment plan UI** — desktop only
- **Down payment not auto-recorded** — must be recorded separately as payment
- **No transaction safety** — in-memory storage lacks ACID guarantees
- **No overpayment across installments** — each installment must be paid individually

---

## Phase 6C1 — Account Statement Data + Printable Statement

**Status:** ✅ COMPLETE

### Goal

Generate professional patient account statements from existing ledger (6A) and payment plan (6B) data. Provide both on-screen viewing and printable/PDF-ready output without adding heavy PDF libraries.

### Files Changed

| File | Change |
|------|--------|
| `server/modules/ledger/index.ts` | Added `GET /patient/:patientId/statement` endpoint with date range filtering, opening/closing balance calculation, and payment plan integration |
| `server/modules/paymentPlan/index.ts` | Exported `getPatientPaymentPlanSummaries()` helper for statement integration |
| `client/src/lib/api.ts` | Added `api.ledger.statement(patientId, params?)` method |
| `client/src/pages/PatientFile.tsx` | Added statement modal to Account Ledger tab with date controls, summary cards, transaction table, payment plans, and print/PDF functionality |
| `PRODUCT_PHASES.md` | This entry |

### Statement Endpoint

**`GET /api/ledger/patient/:patientId/statement?from=YYYY-MM-DD&to=YYYY-MM-DD`**

**Date Range Rules:**
- Omitted dates → all available ledger history
- `from` only → from date through today
- `to` only → earliest history through to date
- Both supplied → inclusive range
- Invalid dates → HTTP 400

**Response Shape:**
```json
{
  "patient": {
    "id": "p1",
    "name": "Sara Al-Hassan",
    "phone": "+1234567890",
    "email": null
  },
  "statement": {
    "from": "2026-01-01",
    "to": "2026-05-31",
    "generatedAt": "2026-05-11T...",
    "openingBalance": 0,
    "totalCharges": 280,
    "totalPayments": 200,
    "totalAdjustments": 0,
    "closingBalance": 80
  },
  "entries": [ /* LedgerEntry[] within date range */ ],
  "paymentPlans": [ /* Payment plan summaries */ ]
}
```

### Opening/Closing Balance Rules

- **Opening Balance** = sum of all entries before `from` date
- **Total Charges** = sum of debits in range (charges)
- **Total Payments** = sum of credits in range (payments)
- **Total Adjustments** = sum of adjustment amounts in range (debits - credits)
- **Closing Balance** = `openingBalance + totalCharges - totalPayments + totalAdjustments`
- All amounts rounded to 2 decimals
- Closing balance must match ledger's running balance at end of range

### Payment Plan Summary Behavior

- All patient's payment plans included (active, completed, cancelled)
- Each plan shows: title, status, total, paid, remaining, next due, overdue count/amount
- Overdue indicators displayed in statement
- No payment plan state mutated during statement generation

### Desktop UI Summary

**Account Ledger Tab → Generate Statement Button:**
- Opens full-screen modal with statement controls and display
- Date range inputs (From/To) with Generate button
- Print/Save as PDF button (appears after generation)

**Statement Display:**
- Patient info header (name, ID, phone, email)
- Period and generation timestamp
- 5 summary cards: Opening Balance, Charges (+), Payments (-), Adjustments, Closing Balance
- Transaction table with date, type badge, description, debit, credit, running balance
- Payment plans section (if applicable) with status, totals, and overdue indicators

**Print/PDF Behavior:**
- Opens clean print window with professional styling
- Clinic header with statement period
- Summary grid with color-coded amounts
- Transaction table with type badges
- Payment plans table included
- Auto-triggers browser print dialog (`window.print()`)
- User can "Save as PDF" via browser print dialog
- Print-specific CSS removes navigation/buttons

### Mobile Decision

**No mobile changes.**

- Mobile statement view deferred
- Mobile billing continues unchanged
- Statement generation desktop-only in Phase 6C1

### Build Results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx vite build` | ✅ no errors |
| `npx tsc -p tsconfig.server.json` | ✅ exit 0 |

### Known Limitations

- **WhatsApp/email sending deferred** to Phase 6C2
- **Browser print/save-as-PDF only** — no server-side PDF generator (jsPDF/html2canvas not added)
- **No mobile statement UI** — desktop PatientFile only
- **Aging buckets deferred** to Phase 6D
- **In-memory data** — statements reset on server restart
- **No print template customization** — clinic name hardcoded as "Dental Clinic"
- **Production needs persistent tables** for ledger and payment plans

---

## Phase 6C2 — WhatsApp/Email Statement Sharing

**Status:** ✅ COMPLETE

### Goal

Allow staff to share or send patient account statements via WhatsApp or email. Truthfully report delivery status (sent vs stubbed vs not_configured vs failed).

### Files Changed

| File | Change |
|------|--------|
| `server/modules/ledger/index.ts` | Added `POST /patient/:patientId/statement/share` and `GET /patient/:patientId/statement/share-logs` endpoints with WhatsApp integration, email stub, and in-memory share logging |
| `client/src/lib/api.ts` | Added `api.ledger.shareStatement()` and `api.ledger.statementShareLogs()` methods |
| `client/src/pages/PatientFile.tsx` | Added share buttons (WhatsApp/Email), share result display, and share history table to statement modal |
| `PRODUCT_PHASES.md` | This entry |

### Statement Share Endpoint

**`POST /api/ledger/patient/:patientId/statement/share`**

**Request Body:**
```json
{
  "from": "2026-01-01",
  "to": "2026-05-31",
  "channel": "whatsapp" | "email",
  "message": "Optional custom message"
}
```

**Response:**
```json
{
  "success": boolean,
  "status": "sent" | "stubbed" | "not_configured" | "failed",
  "channel": "whatsapp" | "email",
  "message": "Human-readable status description",
  "waUrl": "https://wa.me/1234567890?text=...", // If stubbed
  "log": { /* StatementShareLog */ }
}
```

### WhatsApp Behavior

**Connected (ready):**
- Sends statement summary text via `sendWhatsApp()` helper
- Returns `status: "sent"` if delivery confirmed

**Disconnected (not ready):**
- Returns `status: "stubbed"`
- Generates `wa.me` URL with pre-filled message
- Returns `waUrl` for user to open manually
- Does NOT claim delivery

**Missing Patient Phone:**
- Returns HTTP 400
- `status: "failed"`
- Clear message: "Patient has no phone number on file"

### Email Behavior

**Not Configured:**
- Returns `status: "not_configured"`
- Message: "Email sending is not configured. Please contact the administrator to set up SMTP."
- Does NOT fake sending

**Missing Patient Email:**
- Returns HTTP 400
- `status: "failed"`
- Clear message: "Patient has no email address on file"

### Statement Message Format

**Auto-generated message includes:**
- Clinic name (hardcoded as "Dental Clinic")
- Patient name and statement period
- Opening balance, total charges, total payments
- Closing balance (bold)
- Active payment plans summary (paid/remaining, next due, overdue count)
- Closing note: "Please contact the clinic for details."

### Share Log Behavior

**In-memory logging (`demoStatementShareLogs`):**
- Every share attempt logged regardless of outcome
- Fields: id, patientId, patientName, channel, status, from/to dates, closingBalance, message, error, createdAt
- Logs reset on server restart (demo limitation)

**Share Log Endpoint:**
- `GET /api/ledger/patient/:patientId/statement/share-logs`
- Returns patient's share history sorted newest first

### Desktop UI Summary

**Statement Modal → Share Controls (appears after generation):**
- WhatsApp button (green) with loading spinner
- Email button (blue) with loading spinner
- View History toggle link

**Share Result Display:**
- **Sent:** Green banner with ✅
- **Stubbed:** Amber banner with ⚠️ + "Open WhatsApp to Send" button
- **Not Configured:** Gray banner with ⚙️
- **Failed:** Red banner with ❌

**Share History Table:**
- Date, channel badge, status badge, closing balance, details
- Shows all past share attempts for the patient

### Mobile Decision

**No mobile changes.**

- Mobile statement sharing deferred
- Mobile billing continues unchanged

### Build Results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx vite build` | ✅ no errors |
| `npx tsc -p tsconfig.server.json` | ✅ exit 0 |

### Known Limitations

- **Browser print/PDF remains client-side** — no server PDF generator
- **WhatsApp PDF attachment not implemented** — text-only messages
- **Email is not_configured** — no SMTP configured in this system
- **Share logs are in-memory only** — reset on server restart
- **Mobile sharing UI deferred** — desktop PatientFile only
- **Aging buckets deferred** to Phase 6D
- **Clinic name hardcoded** as "Dental Clinic" in messages

---

## Future Phases (Not Yet Defined)

To be filled in by product owner.
