"use client";

import { getStoredUser, type AuthUser } from "@/lib/saas/auth-client";
import { supabase } from "@/lib/supabase";

type AuditSeverity = "info" | "warning" | "critical";

export type SupervisorApproval = {
  supervisor_id: string;
  supervisor_email: string;
  supervisor_name: string;
  supervisor_role: string;
  reason: string;
  approved_at: string;
};

function deviceInfo() {
  if (typeof navigator === "undefined") return null;
  return navigator.userAgent.slice(0, 250);
}

function roleText(user: Partial<AuthUser> & { role?: string | null }) {
  return `${user.role_key || ""} ${user.role_label || ""} ${user.role || ""}`.toLowerCase();
}

export function isSupervisorUser(user?: (Partial<AuthUser> & { role?: string | null }) | null) {
  if (!user) return false;
  const roles = roleText(user);
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return (
    roles.includes("super") ||
    roles.includes("admin") ||
    roles.includes("gerente") ||
    roles.includes("manager") ||
    roles.includes("ceo") ||
    permissions.includes("configuracion" as any) ||
    permissions.includes("dashboard_ceo" as any)
  );
}

export function auditUser() {
  const user = getStoredUser();
  return {
    id: user?.id || null,
    email: user?.email || "sistema@rdwood.local",
    name: user?.full_name || "Sistema",
    role: user?.role_label || user?.role_key || "Sistema",
  };
}

export async function writeAuditLog(input: {
  module: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  entity_name?: string | null;
  old_data?: any;
  new_data?: any;
  payload?: any;
  severity?: AuditSeverity;
  user_email?: string | null;
}) {
  const user = auditUser();
  const severity = input.severity || "info";

  try {
    const { error } = await supabase.rpc("log_audit_event", {
      p_module: input.module,
      p_action: input.action,
      p_entity_type: input.entity_type || null,
      p_entity_id: input.entity_id || null,
      p_user_email: input.user_email || user.email,
      p_old_data: input.old_data || null,
      p_new_data: input.new_data || input.payload || null,
      p_severity: severity,
      p_device_info: deviceInfo(),
    });

    if (!error) return true;
  } catch {
    // Fallback abajo.
  }

  try {
    const { error } = await supabase.from("audit_logs").insert({
      module: input.module,
      action: input.action,
      entity_type: input.entity_type || null,
      entity_id: input.entity_id || null,
      entity_name: input.entity_name || null,
      user_email: input.user_email || user.email,
      old_data: input.old_data || null,
      new_data: input.new_data || null,
      payload: input.payload || input.new_data || null,
      severity,
      device_info: deviceInfo(),
    });

    return !error;
  } catch {
    return false;
  }
}

export async function requestSupervisorApproval(action: string, entityName: string): Promise<SupervisorApproval> {
  const current = getStoredUser();
  const suggestedEmail = isSupervisorUser(current) ? current?.email || "" : "";
  const email = window.prompt(`Correo del supervisor para ${action} (${entityName})`, suggestedEmail)?.trim().toLowerCase();

  if (!email) throw new Error("Se requiere correo de supervisor.");

  const pin = window.prompt("PIN del supervisor")?.trim();
  if (!pin) throw new Error("Se requiere PIN de supervisor.");

  const reason = window.prompt("Motivo obligatorio de la anulacion / reverso")?.trim();
  if (!reason || reason.length < 6) throw new Error("El motivo debe tener al menos 6 caracteres.");

  const { data, error } = await supabase
    .from("app_users")
    .select("id,email,name,full_name,role,role_key,role_label,permissions,status,pin")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Supervisor no encontrado.");
  if (String(data.status || "").toLowerCase() !== "activo") throw new Error("Supervisor inactivo.");
  if (String(data.pin || "") !== pin) throw new Error("PIN de supervisor invalido.");
  if (!isSupervisorUser(data)) throw new Error("Este usuario no tiene nivel de supervisor.");

  const approval: SupervisorApproval = {
    supervisor_id: data.id,
    supervisor_email: data.email,
    supervisor_name: data.full_name || data.name || data.email,
    supervisor_role: data.role_label || data.role_key || data.role || "Supervisor",
    reason,
    approved_at: new Date().toISOString(),
  };

  await writeAuditLog({
    module: "seguridad",
    action: "supervisor_approval_granted",
    entity_type: "supervisor_approval",
    entity_id: approval.supervisor_id,
    entity_name: entityName,
    new_data: { action, entityName, approval },
    severity: "warning",
    user_email: approval.supervisor_email,
  });

  return approval;
}
