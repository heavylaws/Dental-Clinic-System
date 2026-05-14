/**
 * Frontend Permission Helpers — Phase 9B1
 *
 * These helpers mirror the backend role guards from Phase 9A.
 * The backend remains the source of truth; these are UI-convenience
 * checks for conditionally rendering controls / pages.
 *
 * Roles (from server/modules/auth):
 *   admin     – full access
 *   doctor    – clinical + financial (appointments, billing, treatment plans, conversion)
 *   reception – front-desk (appointments, reminder preferences, manual reminders)
 */

// ─── Types ──────────────────────────────────────────────────────────

export type UserRole = "admin" | "doctor" | "reception";

/** Minimal user shape needed by permission helpers. */
export interface PermissionUser {
  id: string;
  role: UserRole;
  [key: string]: unknown; // forward-compat with additional fields
}

// ─── Core Helper ────────────────────────────────────────────────────

/**
 * Check whether the user holds one of the given roles.
 *
 * @example hasRole(user, ["admin", "doctor"])
 */
export function hasRole(
  user: PermissionUser | null | undefined,
  roles: UserRole | UserRole[],
): boolean {
  if (!user) return false;
  const list = Array.isArray(roles) ? roles : [roles];
  return list.includes(user.role);
}

// ─── Feature-Level Permission Checks ────────────────────────────────
//
// Each function documents the matching backend `requireRole(...)` guard.
// Keep in sync with server/modules/*/index.ts guards.

/**
 * Audit log viewing — admin only.
 * Backend: `server/index.ts` line 178 — inline `req.user.role !== "admin"` check.
 */
export function canViewAuditLogs(user: PermissionUser | null | undefined): boolean {
  return hasRole(user, "admin");
}

/**
 * Reminder scheduler settings (enable/disable, rules, templates, reset).
 * Backend: `requireRole("admin")` on PUT /reminders/settings, POST /reminders/settings/reset,
 *          POST /reminders/scheduler/run-once.
 */
export function canManageReminderSettings(user: PermissionUser | null | undefined): boolean {
  return hasRole(user, "admin");
}

/**
 * Appointment CRUD (create / update / delete).
 * Backend: `requireRole("admin", "doctor", "reception")` on POST / PUT / DELETE /appointments.
 * Note: listing & status-patch are open to all authenticated users.
 */
export function canManageAppointments(user: PermissionUser | null | undefined): boolean {
  return hasRole(user, ["admin", "doctor", "reception"]);
}

/**
 * Financial mutations: billing, ledger adjustments, payment plans.
 * Backend guards:
 *   - `requireRole("admin", "doctor")` on POST /ledger/patient/:id/adjustment
 *   - `requireRole("admin", "doctor")` on payment-plan create/status/installment-payment
 */
export function canManageFinancials(user: PermissionUser | null | undefined): boolean {
  return hasRole(user, ["admin", "doctor"]);
}

/**
 * Treatment plan CRUD (create plan, add/edit/delete items, update plan status).
 * Backend: `requireRole("admin", "doctor")` on all treatment-plan mutation routes.
 */
export function canManageTreatmentPlans(user: PermissionUser | null | undefined): boolean {
  return hasRole(user, ["admin", "doctor"]);
}

/**
 * Convert accepted treatment-plan items into visits + billing records.
 * Backend: `requireRole("admin", "doctor")` on POST /treatment-plans/items/:id/convert.
 */
export function canConvertTreatmentItems(user: PermissionUser | null | undefined): boolean {
  return hasRole(user, ["admin", "doctor"]);
}

/**
 * User management (list / create / update / reset-password).
 * Backend: `requireRole("admin")` on all /users routes.
 */
export function canManageUsers(user: PermissionUser | null | undefined): boolean {
  return hasRole(user, "admin");
}

/**
 * Clinic settings (update settings, server info, backup/restore).
 * Backend: `requireRole("admin")` on PUT /settings, GET /settings/server-info,
 *          GET /settings/backup, POST /settings/restore.
 */
export function canManageSettings(user: PermissionUser | null | undefined): boolean {
  return hasRole(user, "admin");
}

/**
 * Reminder preferences per-patient (all roles can update).
 * Backend: `requireRole("admin", "doctor", "reception")` on PUT /reminders/preferences/:patientId.
 */
export function canManageReminderPreferences(user: PermissionUser | null | undefined): boolean {
  return hasRole(user, ["admin", "doctor", "reception"]);
}
