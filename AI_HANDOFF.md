# DermClinic System — AI Handoff Document

> **Last updated**: 2026-06-12  
> **Codebase**: ~114 source files, ~17,500 lines of TypeScript/TSX/CSS  
> **Repository**: `heavylaws/ClinicSystem` (branch: `main`)

---

## 🏗️ Architecture & Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Frontend (Desktop)** | React 19, Vite 6, Tailwind CSS 4, React Query 5, React Router 7 | Full-featured desktop UI with sidebar navigation |
| **Frontend (Mobile)** | Same stack + custom mobile CSS & gesture hooks | Dedicated `/m/*` mobile app with bottom tab bar, swipe gestures, haptic feedback |
| **Backend** | Node.js, Express 4, TypeScript | Modular Express routers, session-based auth (Passport.js), CORS enabled |
| **Database** | PostgreSQL 14+ | 16 tables, indexed for performance. Drizzle ORM for schema + queries |
| **Realtime** | WebSocket (`ws`) | Broadcasts queue/visit updates across all connected clients |
| **AI** | Google Gemini (`@google/genai`) | Multilingual chatbot assistant for medical queries |
| **Process Manager** | PM2 (production) / `concurrently` (dev) | Two processes: `tsx watch server/index.ts` + `vite --host` |

### Network / Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| `5174` | HTTP | Vite dev server (frontend + proxy to backend) |
| `3002` | HTTP | Express API server |
| `3443` | HTTPS | Express HTTPS server (required for phone camera access on LAN) |

- Vite proxies `/api/*`, `/uploads/*`, and `/ws` to `localhost:3002`.
- The server binds to `0.0.0.0` so it's accessible across the local network.
- SSL certs live in `certs/` (self-signed). If absent, HTTPS is disabled and a helpful command is logged.

---

## 📁 Project Structure

```
clinicsystem/
├── client/                     # Frontend (Vite root)
│   ├── src/
│   │   ├── App.tsx             # Root router: /m/* → Mobile, else → Desktop
│   │   ├── main.tsx            # React entry, QueryClient, BrowserRouter
│   │   ├── index.css           # Global Tailwind + custom styles (~9.4KB)
│   │   ├── lib/
│   │   │   └── api.ts          # Centralized API client (all endpoints)
│   │   ├── components/         # Shared desktop components
│   │   │   ├── Layout.tsx                # Desktop sidebar + header
│   │   │   ├── Chatbot.tsx               # Gemini AI chatbot
│   │   │   ├── StartupScreen.tsx         # Backend health-check loading screen
│   │   │   ├── NewPatientDialog.tsx       # Patient registration dialog
│   │   │   ├── BillVisitDialog.tsx        # Visit billing dialog
│   │   │   ├── AutocompleteInput.tsx      # Medical term autocomplete
│   │   │   ├── MultiSelectComboBox.tsx    # Multi-select with search
│   │   │   ├── SmartExtractionDialog.tsx  # AI-powered text extraction
│   │   │   ├── CameraCapture.tsx          # Webcam capture component
│   │   │   ├── PrescriptionPrint.tsx      # A5 prescription printable
│   │   │   ├── LabPrint.tsx               # A5 lab order printable
│   │   │   ├── ClinicalNotesPrint.tsx     # A5 clinical notes printable
│   │   │   └── patient/                   # Patient sub-components
│   │   │       ├── DiagnosticsTable.tsx
│   │   │       └── PrescriptionsTable.tsx
│   │   ├── pages/              # Desktop page-level components
│   │   │   ├── Dashboard.tsx        # Today's queue, stats, quick actions
│   │   │   ├── PatientFile.tsx      # Master patient record (1642 lines — THE core page)
│   │   │   ├── Patients.tsx         # Patient list with search, sort, pagination
│   │   │   ├── Appointments.tsx     # Calendar + appointment management
│   │   │   ├── Billing.tsx          # Billing dashboard with date filters
│   │   │   ├── Reports.tsx          # Daily/monthly/prescription reports
│   │   │   ├── Users.tsx            # User management (admin only)
│   │   │   ├── Settings.tsx         # Clinic settings, server info, backup/restore
│   │   │   └── Login.tsx            # Device-aware login (desktop vs mobile chooser)
│   │   └── mobile/             # Dedicated mobile application
│   │       ├── MobileApp.tsx        # Mobile router (/m/*)
│   │       ├── mobile.css           # Full mobile design system (~508 lines)
│   │       ├── components/          # Mobile-specific UI components
│   │       │   ├── BottomTabBar.tsx
│   │       │   ├── MobileHeader.tsx
│   │       │   ├── MobileLayout.tsx
│   │       │   ├── MobileDialog.tsx
│   │       │   ├── MobileSearchBar.tsx
│   │       │   ├── FloatingActionButton.tsx
│   │       │   └── SwipeableCard.tsx
│   │       ├── hooks/               # Mobile-specific hooks
│   │       │   ├── useDeviceType.ts      # Auto-detect phone/tablet/desktop
│   │       │   ├── useHapticFeedback.ts  # Vibration API wrapper
│   │       │   └── useSwipeGesture.ts    # Touch swipe gesture handler
│   │       └── pages/               # Mobile page-level components
│   │           ├── MobileDashboard.tsx
│   │           ├── MobilePatientFile.tsx
│   │           ├── MobilePatientSearch.tsx
│   │           ├── MobileVisitForm.tsx
│   │           ├── MobileAppointments.tsx
│   │           ├── MobileBilling.tsx
│   │           ├── MobileReports.tsx
│   │           ├── MobileSettings.tsx     # Includes logout, password change, user mgmt
│   │           └── MobileLogin.tsx
│   └── public/
│       └── manifest.json       # PWA manifest
├── server/
│   ├── index.ts                # Express app entry (middleware, routes, HTTPS)
│   ├── ws.ts                   # WebSocket setup + broadcast helper
│   ├── db/
│   │   ├── index.ts            # Drizzle client initialization
│   │   └── schema.ts           # Full database schema (16 tables, 455 lines)
│   └── modules/                # Feature-based API routers (1 index.ts each)
│       ├── auth/               # Login, logout, session, bootstrap
│       ├── patient/            # CRUD, search, insurance suggestions
│       ├── visit/              # Queue, CRUD, diagnoses, prescriptions, labs, procedures
│       ├── appointment/        # Calendar, scheduling, status updates
│       ├── billing/            # Billing records, payments
│       ├── report/             # Daily, monthly, top diagnoses/medications, prescriptions
│       ├── autocomplete/       # Medical term search + popular terms
│       ├── images/             # Patient photo upload (multer) + gallery
│       ├── user/               # User CRUD, password management (admin)
│       ├── settings/           # Clinic config, server info, backup/restore
│       ├── followup/           # Follow-up scheduling, upcoming/overdue
│       ├── referral/           # Specialist referrals, pending list
│       └── ai/                 # Gemini chatbot endpoint
├── shared/
│   └── types.ts                # Zod schemas for validation (shared client/server)
├── scripts/                    # Utility & migration scripts
│   ├── migrate.ts              # Database migration/restore
│   ├── reset-db.ts             # Database reset
│   ├── merge-backup-data.ts    # Legacy SQL Server data merge (timezone-aware)
│   ├── load-legacy-data.ts     # Legacy JSON import (DO NOT USE)
│   ├── seed-medical-terms.ts   # Medical terminology seeder
│   ├── seed-derm-medications.ts # Dermatology medication seeder
│   ├── import-past-terms.ts    # Historical term import
│   └── various test-*.ts       # Diagnostic/test scripts
├── uploads/                    # Patient image storage (gitignored)
├── certs/                      # SSL certificates (gitignored)
├── drizzle.config.ts           # Drizzle Kit configuration
├── vite.config.ts              # Vite config (proxy, aliases, Tailwind plugin)
├── tsconfig.json               # Client TypeScript config
├── tsconfig.server.json        # Server TypeScript config
├── install_remote.sh           # Linux deployment script (apt + pg_restore + PM2)
├── install_windows.bat         # Windows deployment script
├── REMOTE_ACCESS_DOCS.md       # Tailscale / Cloudflare tunnel documentation
└── .env                        # Environment variables (gitignored)
```

---

## 🗄️ Database Schema (16 Tables)

| Table | Key Fields | Notes |
|-------|-----------|-------|
| `users` | id, username, password (bcrypt), role (admin/doctor/reception), isActive | Session-based auth via Passport |
| `patients` | id, legacyId, fileNumber (serial), firstName, lastName, fatherName, gender, dateOfBirth, phone, city, region, maritalStatus, allergies, chronicConditions, insurance, notes | Indexed on name, phone, fileNumber |
| `visits` | id, patientId, doctorId, visitNumber, visitType, chiefComplaint, clinicalNotes, examination, status (queued/in_progress/completed/billed) | Indexed on patientId+date, status, date |
| `diagnoses` | id, visitId, name, icdCode, description, severity | Cascade on visit delete |
| `prescriptions` | id, visitId, medicationName, dosage, frequency, duration, route, instructions | Cascade on visit delete |
| `lab_orders` | id, visitId, testName, status (ordered/resulted), result | Cascade on visit delete |
| `procedure_logs` | id, visitId, procedureName, details, cost | Cascade on visit delete |
| `billings` | id, visitId, totalAmount, paidAmount, currency (USD), status (unpaid/partial/paid) | Indexed on status, date |
| `payments` | id, billingId, amount, method (cash), paidAt | Cascade on billing delete |
| `patient_images` | id, patientId, visitId, filePath, legacyPath, caption | Patient photos, stored in `uploads/` |
| `medical_terms` | id, category (diagnosis/medication/lab_test/procedure/complaint), term, language, usageCount | Powers autocomplete, indexed on category+term |
| `appointments` | id, patientId, doctorId, appointmentDate, timeSlot, duration, type, status | Calendar scheduling |
| `settings` | id, key, value | Key-value clinic configuration |
| `follow_ups` | id, visitId, patientId, scheduledDate, reason, status (pending/completed/missed) | Scheduled follow-ups |
| `referrals` | id, visitId, patientId, referredTo, specialty, reason, status (pending/accepted/completed) | Specialist referrals |
| `audit_logs` | id, userId, action, entityType, entityId, oldValue (jsonb), newValue (jsonb), ipAddress | Tracks all data modifications |

**Data volumes** (production): ~35,500 patients, ~59,000 visits, ~131,000 prescriptions, ~13,000 insurance records.

---

## 🔑 Authentication & Authorization

- **Method**: Session-based (express-session + Passport.js local strategy)
- **Password hashing**: bcrypt
- **Session duration**: 8 hours
- **Roles**: `admin`, `doctor`, `reception` (these are the only valid backend roles)
  - Admin: Full access (user management, settings, reports, audit log)
  - Doctor: Clinical features (visits, diagnoses, prescriptions, labs, treatment plans, general reports)
  - Reception: Patient registration, queue management, billing/ledger/payment plans, appointments, reminders
- **Backend is the source of truth**: All role enforcement is via `requireRole()` middleware. Frontend checks in `client/src/lib/permissions.ts` are advisory UI-only.
- **Bootstrap**: If no users exist, `POST /api/auth/bootstrap` creates a default admin

### Adopted Permission Policy (Phase 9C-P0)

The following policy was adopted in Phase 9C-P0 and is the source-of-truth for Phase 9C-F1 backend/frontend permission alignment. Phase 9C-0 completed baseline verification and runtime QA matrix planning; Phase 9C-1 completed the backend permission guard audit. No source code was changed in those phases.

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

Phase 9C-F1 aligned implementation with this policy (backend commit `6434093`, frontend commit `8a322b2`). Current frontend helpers in `client/src/lib/permissions.ts`:

- `canViewAuditLogs` — admin
- `canManageSettings` — admin
- `canManageReminderSettings` — admin
- `canManageUsers` — admin
- `canViewFinancialReports` — admin
- `canViewGeneralReports` — admin, doctor
- `canManageTreatmentPlans` / `canConvertTreatmentItems` — admin, doctor
- `canManageFinancials` — admin, reception (billing, ledger, payment plans, statements)
- `canManageAppointments` / `canManageReminderPreferences` — admin, doctor, reception

Runtime role QA (Phase 9C-2/9C-3): 57/57 API permission checks passed for all three roles.

---

## 📱 Mobile App Architecture

The mobile app is a fully separate UI at `/m/*` with its own design system:

- **Routing**: `App.tsx` detects `/m` prefix → renders `MobileApp.tsx` instead of desktop
- **Login flow**: `Login.tsx` has a device chooser. Selecting "mobile" stores `dermclinic-device=mobile` in localStorage and redirects to `/m`
- **Design**: Dark glassmorphic UI with custom CSS classes (`mobile-card`, `mobile-btn`, `mobile-input`, etc.)
- **Navigation**: Bottom tab bar (Home, Patients, Appointments, Billing, Settings)
- **Features implemented**:
  - ✅ Dashboard (queue, stats, quick actions)
  - ✅ Patient search & file viewer
  - ✅ Visit form (complaint, notes, diagnoses, prescriptions, labs, procedures)
  - ✅ Appointments calendar
  - ✅ Billing overview
  - ✅ Settings (logout, password change, user management, clinic settings)
  - ✅ Reports
- **Hooks**: `useDeviceType`, `useHapticFeedback`, `useSwipeGesture`

---

## 📋 API Endpoints Summary

All routes are prefixed with `/api`:

| Module | Base Path | Key Endpoints |
|--------|-----------|---------------|
| Auth | `/auth` | `POST /login`, `POST /logout`, `GET /me`, `POST /bootstrap` |
| Patients | `/patients` | `GET /search`, `GET /:id`, `GET /` (paginated), `POST /`, `PUT /:id`, `GET /insurance-suggestions` |
| Visits | `/visits` | `GET /queue`, `GET /:id`, `GET /patient/:patientId`, `POST /`, `DELETE /:id`, `PATCH /:id/status`, `PATCH /:id/notes`, CRUD for sub-resources (diagnoses, prescriptions, lab-orders, procedures) |
| Appointments | `/appointments` | `GET /` (date/range), `GET /patient/:patientId`, `POST /`, `PUT /:id`, `PATCH /:id/status`, `DELETE /:id` |
| Billing | `/billing` | `GET /visit/:visitId`, `GET /` (date range), `POST /`, `POST /payments` |
| Reports | `/reports` | `GET /daily`, `GET /monthly`, `GET /top-diagnoses`, `GET /top-medications`, `GET /prescriptions` |
| Autocomplete | `/autocomplete` | `GET /` (category + query), `GET /popular/:category` |
| Images | `/images` | `GET /:patientId`, `POST /:patientId/upload` (multipart), `DELETE /:id` |
| Users | `/users` | `GET /`, `POST /`, `PUT /:id`, `PATCH /:id/reset-password`, `PATCH /change-password` |
| Settings | `/settings` | `GET /`, `PUT /`, `GET /server-info`, `POST /restore` |
| Follow-ups | `/followups` | `GET /patient/:patientId`, `GET /upcoming`, `GET /overdue`, `POST /`, `PATCH /:id`, `DELETE /:id` |
| Referrals | `/referrals` | `GET /patient/:patientId`, `GET /pending`, `POST /`, `PATCH /:id`, `DELETE /:id` |
| AI | `/ai` | `POST /chat` |
| Health | — | `GET /health` |
| WebSocket | — | `ws://host:port/ws` (broadcast: queue updates) |

---

## 🚀 Development

### Quick Start
```bash
# Install dependencies
npm install

# Start development (both server and client)
npm run dev

# Access:
#   Desktop: http://localhost:5174
#   Mobile:  http://localhost:5174/m
#   API:     http://localhost:3002/api
```

### Environment Variables (`.env`)
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dermclinic
PORT=3002
HOST=0.0.0.0
SESSION_SECRET=dermclinic-local-session-secret
NODE_ENV=development
GEMINI_API_KEY=<optional-for-chatbot>
```

### Key Commands
```bash
npm run dev              # Start both server + client
npm run dev:server       # Server only (tsx watch)
npm run dev:client       # Client only (vite --host)
npm run build            # Production build
npm run db:push          # Push schema to database
npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Run migrations
npm run db:studio        # Drizzle Studio UI
npm run seed:terms       # Seed medical terminology
```

---

## 💾 Data Migration & Backup

- **Full dump**: `dermclinic.dump` (pg_dump custom format, ~12MB)
- **Restore**: `pg_restore -d dermclinic -1 dermclinic.dump` (or use `install_remote.sh`)
- **DO NOT** use `scripts/load-legacy-data.ts` — that was for the original JSON import from SQL Server
- **Merge script**: `scripts/merge-backup-data.ts` safely imports missing records without duplicates
- **Backup/Restore UI**: Available in Settings page (admin only) — uploads dump files via `/api/settings/restore`

---

## 🖨️ Printables

Three A5-optimized print components:
1. **PrescriptionPrint.tsx** — Medications with dosage/frequency grid
2. **LabPrint.tsx** — Lab test orders
3. **ClinicalNotesPrint.tsx** — Examination notes + diagnoses

All use `@media print` CSS with clinic header (name, doctor, phone, address from settings).

---

## 🌐 Deployment

### Linux (PM2)
```bash
./install_remote.sh   # Installs Node, PostgreSQL, restores dump, starts via PM2
```

### Windows
```bash
install_windows.bat   # Requires manual Node.js + PostgreSQL install first
```

### Remote Access
See `REMOTE_ACCESS_DOCS.md` for:
- **Tailscale** (recommended) — Private overlay network, SSH access
- **Cloudflare Tunnels** — Public domain with Zero Trust access policies

### HTTPS for Camera Access
Phones on LAN require HTTPS for `navigator.mediaDevices`:
```bash
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 3650 -nodes -subj '/CN=DermClinic'
```
Then access via `https://<server-ip>:3443`.

---

## 📝 Git History (Chronological)

| Commit | Description |
|--------|-------------|
| `d78cde5` | Initial commit: Full DermClinic system |
| `537e927` | AI chatbot (Gemini), dotenv config, enlarged selection modals |
| `fbb5ec4` | HTTPS support, search prioritization, logout fix, mobile responsiveness |
| `fd3d219` | Table sorting, alphabetical ordering, search relevance |
| `02fe403` | Print prescription & lab test features, Calendar fix |
| `1260e32` | Edit diagnoses, clinical notes print, A5-optimized printables |
| `2cf65a2` | Insurance field, merge backup data script, sortable reports |
| `f0c270c` | Windows 11 migration AI handoff guide |
| `7e518aa` | Gitignore log files, remote access docs, Windows install script |
| `db553be` | **Dedicated mobile application** — full responsive mobile UI with navigation, gestures, device-aware login |
| `cf79507` | feat: gate audit log route by role permission (`canViewAuditLogs`) |
| `848b7bd` | feat: use permission helpers for settings UI gating |
| `c45f627` | fix: align mobile role UI with backend roles (admin, doctor, reception) |
| `6de5ec7` | chore: align role terminology with backend roles |
| `f90ff75` | docs: sync role gating documentation (Phase 9B3) |
| `8efb5b3` | docs: adopt role permission policy (Phase 9C-P0) |
| `6434093` | fix: align backend permission guards (Phase 9C-F1A) |
| `8a322b2` | fix: align frontend permission gates (Phase 9C-F1B) |

---

## ⚠️ Known Issues & TODOs

- Patient edit is not yet implemented on mobile (`MobilePatientFile.tsx`)
- Mobile image upload (camera capture) needs HTTPS to work on phones
- No automated backup scheduling — currently manual via Settings UI
- `MobileReports.tsx` and `MobileBilling.tsx` are lightweight summaries, not full parity with desktop
- WebSocket broadcasts are set up but only used for queue refresh notifications
- No test suite beyond the dev diagnostic scripts in `scripts/`
