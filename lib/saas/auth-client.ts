"use client";

import { supabase } from "@/lib/supabase";
import type { PermissionKey } from "@/lib/saas/saas-client";

export type AuthUser = {
  id: string;
  full_name: string;
  email: string;
  role_key: string;
  role_label: string;
  permissions: PermissionKey[];
  status: string;
  department?: string | null;
  avatar_url?: string | null;
  must_change_pin?: boolean;
};

const STORAGE_KEY = "rdwood_auth_user";
const TOKEN_KEY = "rdwood_session_token";
const SESSION_VALIDATED_AT_KEY = "rdwood_session_validated_at";
const SESSION_LAST_SEEN_AT_KEY = "rdwood_session_last_seen_at";
const SESSION_VALIDATION_CACHE_MS = 30 * 1000;
const SESSION_LAST_SEEN_THROTTLE_MS = 60 * 1000;

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem("session_token");
}

export function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getStoredToken();
  return {
    ...(extra || {}),
    ...(token ? { "x-rdwood-session-token": token } : {}),
  };
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    headers: authHeaders(init.headers),
  });
}

export function storeAuth(user: AuthUser, token: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem("session_token", token);
  localStorage.setItem("rd_logged_in", "true");
  localStorage.setItem("rd_current_user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("session_token");
  localStorage.removeItem(SESSION_VALIDATED_AT_KEY);
  localStorage.removeItem(SESSION_LAST_SEEN_AT_KEY);
  localStorage.removeItem("rd_logged_in");
  localStorage.removeItem("rd_current_user");
}

export function hasPermission(user: AuthUser | null, permission: PermissionKey) {
  if (!user) return false;
  if (user.status !== "activo") return false;
  if (["admin", "administrador", "super_admin"].includes(String(user.role_key || "").toLowerCase())) return true;
  return user.permissions.includes(permission);
}

export function getPermissionForPath(pathname: string): PermissionKey | null {
  if (pathname === "/" || pathname.startsWith("/login")) return null;
  if (pathname.startsWith("/perfil")) return null;
  if (pathname.startsWith("/dashboard-ceo")) return "dashboard_ceo";
  if (pathname.startsWith("/ia-decisiones")) return "dashboard_ceo";
  if (pathname.startsWith("/ia-precios")) return "dashboard_ceo";
  if (pathname.startsWith("/pruebas-fabrica")) return "dashboard_ceo";
  if (pathname.startsWith("/contabilidad")) return "dashboard_ceo";
  if (pathname.startsWith("/dashboard-financiero")) return "dashboard_ceo";
  if (pathname.startsWith("/pagos")) return "dashboard_ceo";
  if (pathname.startsWith("/gamificacion")) return "produccion";
  if (pathname.startsWith("/tv/gamificacion")) return "produccion";
  if (pathname.startsWith("/inventario-inteligente")) return "inventario";
  if (pathname.startsWith("/inventario")) return "inventario";
  if (pathname.startsWith("/almacen")) return "inventario";
  if (pathname.startsWith("/movimientos")) return "inventario";
  if (pathname.startsWith("/compras")) return "compras";
  if (pathname.startsWith("/proveedores")) return "compras";
  if (pathname.startsWith("/ordenes-compra")) return "compras";
  if (pathname.startsWith("/cuentas-por-pagar")) return "compras";
  if (pathname.startsWith("/ventas")) return "ventas";
  if (pathname.startsWith("/facturas")) return "ventas";
  if (pathname.startsWith("/cuentas-por-cobrar")) return "ventas";
  if (pathname.startsWith("/cotizador-automatico")) return "cotizador";
  if (pathname.startsWith("/cotizaciones")) return "cotizador";
  if (pathname.startsWith("/contratos")) return "cotizador";
  if (pathname.startsWith("/ia-diseno")) return "ia_diseno";
  if (pathname.startsWith("/portal-cliente")) return "ia_diseno";
  if (pathname.startsWith("/produccion")) return "produccion";
  if (pathname.startsWith("/ordenes-produccion")) return "produccion";
  if (pathname.startsWith("/recetas")) return "produccion";
  if (pathname.startsWith("/ensamblado")) return "produccion";
  if (pathname.startsWith("/trazabilidad-piezas")) return "produccion";
  if (pathname.startsWith("/optimizacion-corte")) return "corte";
  if (pathname.startsWith("/corte")) return "corte";
  if (pathname.startsWith("/mecanizado")) return "corte";
  if (pathname.startsWith("/transporte")) return "transporte";
  if (pathname.startsWith("/instalacion")) return "instalacion";
  if (pathname.startsWith("/verificacion")) return "verificacion";
  if (pathname.startsWith("/entrega-final")) return "verificacion";
  if (pathname.startsWith("/postventa")) return "ventas";
  if (pathname.startsWith("/tecnico")) return "ventas";
  if (pathname.startsWith("/rrhh")) return "rrhh";
  if (pathname.startsWith("/payroll")) return "rrhh";
  if (pathname.startsWith("/time-attendance")) return "rrhh";
  if (pathname.startsWith("/employee-self-service")) return "portal_empleado";
  if (pathname.startsWith("/portal-empleado")) return "portal_empleado";
  if (pathname.startsWith("/recruitment")) return "rrhh";
  if (pathname.startsWith("/performance")) return "rrhh";
  if (pathname.startsWith("/compensation")) return "rrhh";
  if (pathname.startsWith("/compliance")) return "rrhh";
  if (pathname.startsWith("/succession")) return "rrhh";
  if (pathname.startsWith("/workforce")) return "rrhh";
  if (pathname.startsWith("/validar-recibo")) return "rrhh";
  if (pathname.startsWith("/configuracion")) return "configuracion";
  if (pathname.startsWith("/usuarios")) return "usuarios";
  if (pathname.startsWith("/agenda")) return "agenda";
  if (pathname.startsWith("/clientes")) return "agenda";
  if (pathname.startsWith("/referidos")) return "agenda";
  if (pathname.startsWith("/referir")) return null;
  if (pathname.startsWith("/levantamientos")) return "agenda";
  if (pathname.startsWith("/proyectos")) return "agenda";
  if (pathname.startsWith("/helpdesk")) return "compras";
  if (pathname.startsWith("/solicitudes-internas")) return "compras";
  return null;
}

export async function loginWithEmailAndPin(email: string, pin: string) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPin = pin.trim();
  const deviceInfo = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 250) : "unknown";

  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: cleanEmail, pin: cleanPin, deviceInfo }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "Usuario, PIN o estado invalido.");
  }

  const user = payload.user as AuthUser;
  const token = String(payload.token || "");
  if (!user || !token) throw new Error("La sesion no pudo ser creada.");

  storeAuth(user, token);
  return user;
}

export async function logout() {
  const token = getStoredToken();
  const user = getStoredUser();

  if (token) {
    await supabase.rpc("close_user_session", {
      p_session_token: token,
      p_reason: "logout",
    });
  }

  if (user) {
    await supabase.rpc("log_audit_event", {
      p_module: "auth",
      p_action: "logout",
      p_entity_type: "app_users",
      p_entity_id: user.id,
      p_user_email: user.email,
      p_old_data: null,
      p_new_data: null,
      p_severity: "info",
      p_device_info: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 250) : null,
    });
  }

  clearAuth();
}

function writeSessionMessage(message: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem("rdwood_lock_message", message);
  } catch {}
}

export async function validateSession(options: { force?: boolean } = {}) {
  const token = getStoredToken();
  const user = getStoredUser();

  if (!token || !user) return null;

  const lastValidatedAt = Number(localStorage.getItem(SESSION_VALIDATED_AT_KEY) || 0);
  if (!options.force && lastValidatedAt && Date.now() - lastValidatedAt < SESSION_VALIDATION_CACHE_MS) {
    return user;
  }

  const { data, error } = await supabase
    .from("app_sessions")
    .select("*")
    .eq("session_token", token)
    .maybeSingle();

  if (error || !data) {
    writeSessionMessage("Sesion invalida. Entra de nuevo.");
    clearAuth();
    return null;
  }

  if (String(data.status || "").toLowerCase() !== "active") {
    const reason = String(data.closed_reason || "").toLowerCase();
    writeSessionMessage(
      reason === "single_session_replaced"
        ? "Sesion cerrada porque este usuario inicio sesion en otro dispositivo."
        : "Sesion cerrada. Entra de nuevo."
    );
    clearAuth();
    return null;
  }

  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    await supabase.rpc("close_user_session", {
      p_session_token: token,
      p_reason: "expired",
    });
    clearAuth();
    return null;
  }

  localStorage.setItem(SESSION_VALIDATED_AT_KEY, String(Date.now()));

  const lastSeenAt = Number(localStorage.getItem(SESSION_LAST_SEEN_AT_KEY) || 0);
  if (!lastSeenAt || Date.now() - lastSeenAt > SESSION_LAST_SEEN_THROTTLE_MS) {
    await supabase
      .from("app_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("session_token", token);
    localStorage.setItem(SESSION_LAST_SEEN_AT_KEY, String(Date.now()));
  }

  return user;
}
