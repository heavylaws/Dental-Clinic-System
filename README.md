# Dental Clinic System

A full-stack dental practice management system covering appointments, patients, treatment plans, billing, financial ledger, reminders, and operational dashboards — with a mobile-optimised companion interface.

---

## Overview

The Dental Clinic System is a TypeScript monorepo (Express API + React SPA) designed for small-to-medium dental practices. It ships with a rich desktop interface for front-desk staff, dentists, and clinic managers, plus a lightweight mobile interface for on-the-go appointment and patient management.

All data is stored in-memory by default (demo mode). PostgreSQL persistence is available when `DATABASE_URL` is set.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict) |
| Frontend | React 19, React Router v7, TanStack Query v5 |
| Styling | Tailwind CSS v4, Radix UI primitives, shadcn/ui components |
| Backend | Express 4, Passport.js (local strategy), express-session |
| Database | Drizzle ORM + PostgreSQL (optional; in-memory fallback) |
| Build | Vite 6 (client), tsc (server) |
| Dev runner | tsx watch (server hot-reload), concurrently |
| Icons | Lucide React |
| Testing | Vitest |

---

## How to Install

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — at minimum set SESSION_SECRET for any non-demo use

# 3. (Optional) Set up PostgreSQL
#    Set DATABASE_URL in .env, then run:
npm run db:push
npm run db:restore
```

---

## How to Run

### Development (recommended)

Starts the Express server (port 3002) and Vite dev server (port 5175) in parallel:

```bash
npm run dev
```

Or run each separately:

```bash
npm run dev:server   # Express API only — tsx watch server/index.ts
npm run dev:client   # Vite SPA only
```

### Production build

```bash
npm run build        # vite build + tsc -p tsconfig.server.json
```

### Database utilities

```bash
npm run db:generate  # Generate Drizzle migration files
npm run db:migrate   # Apply migrations
npm run db:push      # Push schema directly (dev)
npm run db:reset     # Reset database to empty
npm run db:restore   # Restore demo data
npm run db:studio    # Open Drizzle Studio (DB browser)
```

### Seed demo data

```bash
npm run seed:dental  # Load dental demo patients/appointments/billing
npm run seed:terms   # Load medical autocomplete terms
```

---

## Demo Login Credentials

> These are hardcoded demo credentials used in development/demo mode only.  
> **Change or remove them before any production deployment.**

| Username | Password | Role | Access |
|----------|----------|------|--------|
| `admin` | `admin123` | Admin | Full system — all modules, settings, user management |
| `doctor` | `doctor123` | Doctor | Patient files, treatment plans, dental chart, visits |
| `doctor2` | `doctor123` | Doctor | Same as doctor (Dr. Layla Boujdaria) |
| `reception` | `reception123` | Reception | Appointments, patients, billing, check-in |

---

## Main Desktop Routes

| Route | Description |
|-------|-------------|
| `/` | Dashboard — KPI cards, revenue trend, today's appointments, unpaid invoices |
| `/appointments` | Calendar/list appointment scheduler with drag-and-drop |
| `/patients` | Patient directory with search |
| `/patient/:id` | Full patient file — visits, billing, treatment plans, dental chart, ledger |
| `/billing` | Clinic-wide billing, invoices, payment plans, statements |
| `/reports` | Financial and operational reports, receivables aging |
| `/recalls` | Recall/follow-up management |
| `/whatsapp` | WhatsApp integration status |
| `/audit-log` | Admin-only audit trail |
| `/users` | Staff/user account management |
| `/settings` | Clinic settings, reminder templates, working hours |

---

## Main Mobile Routes

Access the mobile interface by navigating to `/m` on any device.

| Route | Description |
|-------|-------------|
| `/m` | Mobile dashboard summary |
| `/m/appointments` | Appointment list with confirm/complete/cancel actions |
| `/m/patients` | Patient search |
| `/m/patient/:id` | Patient file (mobile view) |
| `/m/visit/:visitId` | Visit form |
| `/m/billing` | Mobile billing view |
| `/m/reports` | Mobile reports summary |
| `/m/settings` | Mobile settings |

---

## Completed Modules

| Module | Status |
|--------|--------|
| Authentication (session-based, role-based) | ✅ Complete |
| Patient management (CRUD, search, file) | ✅ Complete |
| Appointment scheduling (calendar, conflict, drag-and-drop) | ✅ Complete |
| Visit records and clinical notes | ✅ Complete |
| Billing — invoices, payments, discounts | ✅ Complete |
| Account ledger (per-patient, clinic-wide) | ✅ Complete |
| Payment plans and installments | ✅ Complete |
| Financial statements and statement sharing | ✅ Complete |
| Receivables aging report | ✅ Complete |
| Treatment plans (tooth chart, items, status, convert to visit) | ✅ Complete |
| Dental chart (FDI notation, per-tooth conditions) | ✅ Complete |
| Procedure catalog | ✅ Complete |
| Reminder system (manual + scheduled, per-channel opt-out) | ✅ Complete |
| Reminder opt-out enforcement | ✅ Complete |
| Dashboard (KPIs, trend, timeline) | ✅ Complete |
| Reports (financial, operational) | ✅ Complete |
| Recall / follow-up system | ✅ Complete |
| WhatsApp integration (link-based) | ✅ Complete (stub/link) |
| AI assistant integration | ✅ Complete |
| User management | ✅ Complete |
| Clinic settings | ✅ Complete |
| Audit log | ✅ Complete |
| Mobile interface (/m) | ✅ Complete |
| PostgreSQL persistence (optional) | ✅ Complete (optional) |

---

## Known Limitations

- **In-memory data by default** — All data resets on server restart unless `DATABASE_URL` is set.
- **No server-generated PDFs** — Print/share features open a browser print dialog or WhatsApp link; no server-side PDF generation.
- **WhatsApp is stub/link-only** — The `whatsapp-web.js` integration may require a paired WhatsApp session. Without it, reminder sends log as `not_configured` and share links open `wa.me` URLs.
- **Email is not configured** — Email reminder sending is stubbed; no SMTP credentials are shipped.
- **No mobile treatment plan editing** — The mobile interface can view treatment plans but cannot create or edit items.
- **No production hardening** — Demo credentials are hardcoded; session secret has a fallback default; no SSL certs shipped.
- **Camera requires HTTPS** — Mobile camera capture (patient photo) requires HTTPS. Self-signed cert generation instructions are in `REMOTE_ACCESS_DOCS.md`.
- **No DB-backed audit trail** — The audit log is in-memory only unless PostgreSQL persistence is enabled.

---

## Important Safety Notes

- `SESSION_SECRET` **must** be set to a strong random value in production — the server will refuse to start in `NODE_ENV=production` without it.
- `CORS_ORIGIN` **should** be set to your frontend URL in production — a warning is logged if omitted.
- Do not expose the server directly to the internet without placing it behind a reverse proxy (nginx, Caddy) with TLS.
- The demo credentials (`admin/admin123`, `doctor/doctor123`, `reception/reception123`) **must** be replaced before any real patient data is stored.
- This system is **not** HIPAA or GDPR compliant as shipped. No compliance claims are made.
