import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { PermissionKey } from "@/lib/saas/saas-client";

export type ApiSessionUser = {
  id: string;
  email: string;
  full_name: string;
  role_key: string;
  role_label: string;
  permissions: PermissionKey[];
  status: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SESSION_LAST_SEEN_WRITE_MS = 60 * 1000;

let serviceSupabase: SupabaseClient<any> | null = null;

export function getServiceSupabase(): SupabaseClient<any> {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (!serviceSupabase) {
    serviceSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return serviceSupabase;
}

function tokenFromRequest(request: Request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return request.headers.get("x-rdwood-session-token")?.trim() || "";
}

function isAdmin(user: ApiSessionUser) {
  return ["admin", "administrador", "super_admin"].includes(String(user.role_key || "").toLowerCase());
}

export function hasApiPermission(user: ApiSessionUser, permission?: PermissionKey | PermissionKey[]) {
  if (user.status !== "activo") return false;
  if (!permission) return true;
  if (isAdmin(user)) return true;
  const required = Array.isArray(permission) ? permission : [permission];
  return required.some((key) => user.permissions.includes(key));
}

export async function requireApiSession(request: Request, permission?: PermissionKey | PermissionKey[]) {
  const token = tokenFromRequest(request);

  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Sesion requerida." }, { status: 401 }),
    };
  }

  const supabase = getServiceSupabase();
  const { data: session, error: sessionError } = await supabase
    .from("app_sessions")
    .select("app_user_id,email,status,expires_at,last_seen_at")
    .eq("session_token", token)
    .eq("status", "active")
    .maybeSingle();

  if (sessionError || !session) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Sesion invalida o expirada." }, { status: 401 }),
    };
  }

  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
    await supabase.rpc("close_user_session", { p_session_token: token, p_reason: "expired" });
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Sesion expirada." }, { status: 401 }),
    };
  }

  const { data: user, error: userError } = await supabase
    .from("app_users")
    .select("id,email,full_name,name,role_key,role_label,role,permissions,status")
    .eq("id", session.app_user_id)
    .maybeSingle();

  if (userError || !user || String(user.status || "").toLowerCase() !== "activo") {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Usuario sin acceso activo." }, { status: 403 }),
    };
  }

  const apiUser: ApiSessionUser = {
    id: user.id,
    email: user.email,
    full_name: user.full_name || user.name || "Usuario",
    role_key: user.role_key || "solo_lectura",
    role_label: user.role_label || user.role || "Solo Lectura",
    permissions: (user.permissions || []) as PermissionKey[],
    status: user.status || "activo",
  };

  if (!hasApiPermission(apiUser, permission)) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Permiso insuficiente." }, { status: 403 }),
    };
  }

  const lastSeenMs = session.last_seen_at ? new Date(session.last_seen_at).getTime() : 0;
  if (!lastSeenMs || Date.now() - lastSeenMs > SESSION_LAST_SEEN_WRITE_MS) {
    await supabase
      .from("app_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("session_token", token);
  }

  return { ok: true as const, supabase, user: apiUser, token };
}
