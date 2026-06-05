"use client";

import { supabase } from "@/lib/supabase";

const SAAS_SETTINGS_CACHE_KEY = "rdwood_saas_settings_cache";
const SAAS_SETTINGS_CACHE_MS = 5 * 60 * 1000;

export type PermissionKey =
  | "dashboard_ceo" | "inventario" | "compras" | "ventas" | "cotizador"
  | "ia_diseno" | "produccion" | "corte" | "transporte" | "instalacion"
  | "verificacion" | "rrhh" | "portal_empleado" | "configuracion" | "usuarios" | "agenda";

export type SaasSettings = {
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  company_name?: string;
  brand_name?: string;
  system_name?: string;
  maintenance_mode?: boolean;
  maintenance_message?: string;
};

export type AppUser = {
  id: string;
  full_name: string;
  email: string;
  role_key: string;
  role_label: string;
  permissions: PermissionKey[];
  status: string;
};

export const DEFAULT_SAAS_SETTINGS: SaasSettings = {
  logo_url: "",
  primary_color: "#06b6d4",
  secondary_color: "#2563eb",
  company_name: "Santana Group",
  brand_name: "RD Wood System",
  system_name: "RD Wood System ERP Profesional",
  maintenance_mode: false,
  maintenance_message: "Sistema en mantenimiento. Contacte al administrador.",
};

function readCachedSettings(): SaasSettings | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(SAAS_SETTINGS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { timestamp: number; value: SaasSettings };
    if (!parsed?.timestamp || Date.now() - parsed.timestamp > SAAS_SETTINGS_CACHE_MS) {
      sessionStorage.removeItem(SAAS_SETTINGS_CACHE_KEY);
      return null;
    }

    return { ...DEFAULT_SAAS_SETTINGS, ...(parsed.value || {}) };
  } catch {
    return null;
  }
}

function writeCachedSettings(value: SaasSettings) {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(
      SAAS_SETTINGS_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), value })
    );
  } catch {}
}

export async function getSaasSettings(): Promise<SaasSettings> {
  const cached = readCachedSettings();
  if (cached) return cached;

  const { data } = await supabase
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", "saas_master")
    .maybeSingle();

  const settings = { ...DEFAULT_SAAS_SETTINGS, ...(data?.setting_value || {}) };
  writeCachedSettings(settings);
  return settings;
}

export async function getCurrentAppUser(email?: string): Promise<AppUser | null> {
  if (!email) return null;

  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    full_name: data.full_name || data.name || "Usuario",
    email: data.email,
    role_key: data.role_key || "solo_lectura",
    role_label: data.role_label || data.role || "Solo Lectura",
    permissions: (data.permissions || []) as PermissionKey[],
    status: data.status || "activo",
  };
}

export function hasPermission(user: AppUser | null, permission: PermissionKey) {
  if (!user) return false;
  if (user.status !== "activo") return false;
  if (["admin", "administrador", "super_admin"].includes(String(user.role_key || "").toLowerCase())) return true;
  return user.permissions.includes(permission);
}
