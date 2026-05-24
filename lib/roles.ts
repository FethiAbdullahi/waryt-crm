import type { UserRole } from "@/lib/types";

/** Admin or super-admin: full org tools. */
export function isOrgAdmin(role: UserRole) {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdmin(role: UserRole) {
  return role === "super_admin";
}

/** Teams, reports, org settings (not taskforce-only). */
export function canAccessManagerRoutes(role: UserRole) {
  return isOrgAdmin(role) || role === "manager";
}

/** Reports hub: managers/admins see org scope; taskforce sees their own rows (RLS + RPC). */
export function canAccessReports(role: UserRole) {
  return canAccessManagerRoutes(role) || isTaskforceMember(role);
}

/** Taskforce-only home / sales (profile role agent). */
export function isTaskforceMember(role: UserRole) {
  return role === "agent";
}
