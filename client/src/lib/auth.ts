import { User } from "@shared/schema";

export type UserRole = "admin" | "manager" | "sales" | "support" | "client";

export const rolePermissions: Record<UserRole, string[]> = {
  admin: ["*"],
  manager: ["dashboard", "leads", "follow_ups", "pipeline", "clients", "services", "tasks", "quotations", "invoices", "payments", "campaigns", "reports", "team"],
  sales: ["dashboard", "leads", "follow_ups", "pipeline", "clients", "tasks", "quotations"],
  support: ["dashboard", "tasks", "clients:view"],
  client: ["portal"],
};

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;
  const role = user.role as UserRole;
  const permissions = rolePermissions[role] || [];
  if (permissions.includes("*")) return true;
  return permissions.some(p => permission.startsWith(p) || p === permission);
}

export function canAccessPage(user: User | null, page: string): boolean {
  return hasPermission(user, page);
}
