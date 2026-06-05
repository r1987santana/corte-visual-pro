import { supabase } from "@/lib/supabase";

export type PermissionKey =
  | "dashboard_ceo"
  | "inventario"
  | "compras"
  | "ventas"
  | "cotizador"
  | "ia_diseno"
  | "produccion"
  | "corte"
  | "transporte"
  | "instalacion"
  | "verificacion"
  | "rrhh"
  | "configuracion"
  | "usuarios"
  | "agenda";

export async function getUserPermissions(email: string) {
  const { data, error } = await supabase
    .from("app_users")
    .select("permissions,status,role_key")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error || !data) {
    return {
      allowed: false,
      permissions: [] as PermissionKey[],
      role: null,
      status: "missing",
    };
  }

  return {
    allowed: data.status === "activo",
    permissions: (data.permissions || []) as PermissionKey[],
    role: data.role_key,
    status: data.status,
  };
}

export function hasPermission(
  permissions: PermissionKey[],
  permission: PermissionKey
) {
  return permissions.includes(permission);
}
