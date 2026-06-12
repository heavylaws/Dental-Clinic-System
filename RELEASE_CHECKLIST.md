# Dental Clinic System — Release Checklist

> **Phase 9C-4** · Last updated: June 2026  
> Run this checklist before tagging any release or handing off to a new team.

---

## A. Pre-Release Build Checks

Run all three commands from the project root. All must exit 0.

```bash
# 1. TypeScript type-check (client)
npx tsc --noEmit

# 2. Vite production build (client bundle)
npx vite build

# 3. TypeScript compile (server)
npx tsc -p tsconfig.server.json
```

| Command | Expected result |
|---------|----------------|
| `npx tsc --noEmit` | Exit 0, no errors |
| `npx vite build` | Exit 0, `dist/` written |
| `npx tsc -p tsconfig.server.json` | Exit 0, no errors |

---

## B. Runtime Route Checklist

Start the server (`npm run dev`) and verify each route loads without errors.

### Desktop Routes

| Route | Expected |
|-------|----------|
| `/` (Dashboard) | KPI cards, revenue trend chart, today's appointments, unpaid invoices all render |
| `/appointments` | Calendar/list view loads; appointments display; drag-and-drop available |
| `/patients` | Patient list loads; search works |
| `/patient/:id` | Patient file loads; tabs (visits, billing, treatment plans, dental chart, ledger) all accessible |
| `/billing` | Invoice list loads (admin/reception only — doctor is redirected); payment plans tab accessible; statements tab accessible |
| `/reports` | Admin: Owner Analytics + aging + Prescription Report; doctor: Prescription Report only; reception is redirected |
| `/recalls` | Recall list renders |
| `/settings` | Clinic settings load (admin-only sections hidden for non-admins); Change Password section available to all authenticated users |
| `/users` | User list renders (admin only — non-admin users are redirected) |
| `/audit-log` | Audit trail renders — access gated by `canViewAuditLogs`; non-admin users are redirected |
| `/whatsapp` | WhatsApp status page loads |

### Mobile Routes

| Route | Expected |
|-------|----------|
| `/m` | Mobile dashboard loads |
| `/m/appointments` | Appointment cards render; confirm/complete/cancel buttons visible |
| `/m/patients` | Patient search renders |
| `/m/patient/:id` | Mobile patient file renders |
| `/m/billing` | Mobile billing renders (admin/reception only — doctor is redirected to `/m`) |
| `/m/reports` | Mobile reports renders |
| `/m/settings` | Mobile settings renders |

### API Health

| Endpoint | Expected |
|----------|----------|
| `GET /api/health` | `{ status: "ok", persistence: "memory" \| "postgres" }` |
| `GET /api/public/branding` | Returns clinic name/icon (no auth required) |

---

## C. Workflow Checklist

### Appointments

| Workflow | Expected |
|----------|----------|
| Create appointment | Dialog opens; patient/dentist/date/time selectable; saves and appears on calendar |
| Conflict blocking | Overlapping slot for same dentist returns an error/warning |
| Sunday / out-of-hours blocking | Sunday or times outside working hours are blocked |
| Cancel / delete appointment | Appointment removed from calendar; status updated |
| Drag-and-drop reschedule | Dragging appointment to new slot updates time |
| Mobile confirm action | Marks appointment as confirmed from `/m/appointments` |
| Mobile complete action | Marks appointment as completed from `/m/appointments` |
| Mobile cancel action | Cancels appointment from `/m/appointments` |

### Reminders

| Workflow | Expected |
|----------|----------|
| Manual reminder send | `POST /api/reminders/send` — returns success or `not_configured` for opted-out patients |
| Scheduler status | `GET /api/reminders/scheduler/status` — returns current state |
| Run once (manual trigger) | `POST /api/reminders/scheduler/run-once` — processes pending reminders |
| Reminder settings/templates | Settings page shows reminder toggle and template fields |
| `remindersEnabled=false` blocks reminders | Patient with reminders disabled returns `{ success: false, status: "not_configured" }` |
| Per-channel opt-out enforced | Patient with `whatsappOptOut=true` blocks WhatsApp reminder; same for SMS/email |
| Opted-in patient flow | Normal patient with reminders enabled receives reminder attempt |

### Financial

| Workflow | Expected |
|----------|----------|
| Account ledger — view | Patient ledger shows debit/credit entries, running balance |
| Payment plan — create | Payment plan saved with installment schedule |
| Installments — view | Installment list renders with status and due dates |
| Statement — generate | Statement renders for patient with date-range filtering |
| Statement — share (WhatsApp) | Share opens `wa.me` link with statement summary |
| Aging report | Receivables aging buckets (current/30/60/90+) render in Reports |
| Dashboard receivables | Unpaid invoices list renders on dashboard |

### Treatment Plans

| Workflow | Expected |
|----------|----------|
| Create treatment plan | New plan dialog saves and plan appears in patient file |
| Tooth chart | Tooth chart renders; clicking a tooth opens condition picker |
| Add treatment item | Item added with tooth, procedure, cost |
| Edit treatment item | Item edits save correctly |
| Delete treatment item | Item removed from plan |
| Update item status | Status transitions (planned → accepted → completed) work |
| Convert accepted item to visit | Creates visit + billing entry for accepted item |
| Duplicate conversion blocked | Second conversion of same item returns 409 |
| Zero-cost conversion | Zero-cost item converts without creating a payment entry |
| Print treatment plan | Opens browser print dialog with plan summary |
| Share via WhatsApp | Opens `wa.me` link with text summary of plan |

---

## D. Known Limitations

| Limitation | Detail |
|------------|--------|
| In-memory data | All data resets on server restart unless `DATABASE_URL` is configured |
| No server-generated PDFs | Print/export opens browser print dialog; no server-side PDF engine |
| WhatsApp stub/link-only | `whatsapp-web.js` requires a paired session; without it, reminders log as `not_configured` and share uses `wa.me` links |
| Email not configured | Email reminders are stubbed; no SMTP credentials are shipped |
| No mobile treatment plan editing | Mobile interface is read-only for treatment plans |
| No DB-backed audit trail | Audit log is in-memory; entries lost on restart unless PostgreSQL is enabled |
| Demo credentials hardcoded | `admin/admin123`, `doctor/doctor123`, `reception/reception123` must be replaced in production |
| No SSL certs shipped | Camera access from phones requires HTTPS; see `REMOTE_ACCESS_DOCS.md` for cert generation |
| No HIPAA/GDPR compliance | No compliance claims are made; production use requires legal review |

---

## E. Deployment Notes

### Minimum required environment variables for production

```bash
NODE_ENV=production
SESSION_SECRET=<64+ random hex chars>
CORS_ORIGIN=https://your-frontend-domain.com
PORT=3002
```

### Recommended additional variables

```bash
DATABASE_URL=postgres://user:pass@host:5432/dentaldb
REMINDER_SCHEDULER_ENABLED=true
```

### Generate a secure SESSION_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Production checklist

- [ ] `SESSION_SECRET` set to a strong random value
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGIN` set to frontend URL
- [ ] `DATABASE_URL` set (otherwise data resets on restart)
- [ ] Demo credentials replaced with real users
- [ ] Server placed behind reverse proxy (nginx / Caddy) with TLS
- [ ] SSL certs in `certs/` for HTTPS / mobile camera access
- [ ] `npm run build` passes before deployment

---

## F. Role Model Quick Reference

The system enforces exactly three backend roles. The backend `requireRole()` middleware is the authoritative enforcement layer. Frontend helpers in `client/src/lib/permissions.ts` are advisory UI checks only.

| Role | Access |
|------|--------|
| `admin` | Full system — all modules, settings, user management, audit log |
| `doctor` | Clinical — patients, visits, treatment plans, general reports, appointments |
| `reception` | Appointments, patient basics, billing/ledger/payment plans/statements, reminders |

Only the three roles above are valid. Any other role string is non-canonical and must not be used in source code, configuration, or documentation.

### Adopted Permission Policy (Phase 9C-P0)

Source-of-truth policy for Phase 9C implementation. Backend remains the source of truth for permissions and business rules; frontend role gating is UX only. Phase 9C-F1 will align backend and frontend implementation with this policy.

| Area | Allowed roles |
|------|---------------|
| Appointments | `admin`, `doctor`, `reception` |
| Reminder patient preferences | `admin`, `doctor`, `reception` |
| Reminder scheduler/settings | `admin` only |
| Treatment plans | `admin`, `doctor` |
| Treatment item conversion | `admin`, `doctor` |
| Billing invoices/payments | `admin`, `reception` |
| Ledger / payment plans / patient statements | `admin`, `reception` |
| Financial reports / owner summary | `admin` only |
| General reports | `admin`, `doctor` |
| User management | `admin` only |
| Audit log | `admin` only |
| Settings admin sections | `admin` only |
| Change password | `admin`, `doctor`, `reception` |

---

## G. Next Recommended Phases

| Phase | Description |
|-------|-------------|
| Phase 9A | ✅ COMPLETE — role-aware access control and rich audit logging |
| Phase 9B1 | ✅ COMPLETE — frontend permission helper infrastructure (`client/src/lib/permissions.ts`) |
| Phase 9B2 | ✅ COMPLETE — audit log route gating, settings UI permission gating, mobile role UI alignment, role terminology cleanup |
| Phase 9B3 | ✅ COMPLETE — documentation sync for Phase 9B2 |
| Phase 9C-0 | ✅ COMPLETE — baseline verification and runtime QA matrix planning (no files changed) |
| Phase 9C-1 | ✅ COMPLETE — backend permission guard audit (no files changed) |
| Phase 9C-P0 | ✅ COMPLETE — adopted role permission policy (documentation-only) |
| Phase 9C-F1A | ✅ COMPLETE — backend permission guard alignment (commit `6434093`) |
| Phase 9C-F1B | ✅ COMPLETE — frontend/mobile permission UX alignment (commit `8a322b2`) |
| Phase 9C-2/9C-3 | ✅ COMPLETE — desktop + mobile runtime role QA: 57/57 API permission checks passed for admin/doctor/reception |
| Phase 9C-4 | ✅ COMPLETE — final role-permission QA documentation (this update) |
| Phase 10 | Real email/SMS integration — configure Nodemailer or SendGrid; integrate SMS provider |
| Phase 11 | Server-side PDF generation — use Puppeteer or pdfkit for statements, receipts, treatment plans |
| Phase 12 | Production hardening — remove demo credentials, add proper user management, audit trail to DB |
| Phase 13 | Mobile treatment plans — full create/edit/delete UI on `/m` routes |
| Phase 14 | HIPAA/GDPR compliance review — encryption at rest, data retention policies, consent flows |
