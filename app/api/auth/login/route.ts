import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/security/api-guard";
import type { PermissionKey } from "@/lib/saas/saas-client";

function createToken() {
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  return `rdw_${Date.now()}_${Array.from(bytes).join("-")}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cleanEmail = String(body?.email || "").trim().toLowerCase();
    const cleanPin = String(body?.pin || "").trim();
    const deviceInfo = String(body?.deviceInfo || request.headers.get("user-agent") || "unknown").slice(0, 250);

    if (!cleanEmail || !cleanPin) {
      return NextResponse.json({ ok: false, error: "Correo y PIN son requeridos." }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: userData, error } = await supabase
      .from("app_users")
      .select("id,email,full_name,name,role_key,role_label,role,permissions,status,pin,locked_until,must_change_pin,department,avatar_url")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error) throw error;

    if (!userData) {
      await supabase.rpc("register_login_attempt", {
        p_email: cleanEmail,
        p_success: false,
        p_reason: "user_not_found",
        p_device_info: deviceInfo,
      });
      return NextResponse.json({ ok: false, error: "Usuario, PIN o estado invalido." }, { status: 401 });
    }

    if (userData.locked_until && new Date(userData.locked_until).getTime() > Date.now()) {
      return NextResponse.json(
        { ok: false, error: `Usuario bloqueado hasta ${new Date(userData.locked_until).toLocaleString("es-DO")}.` },
        { status: 423 }
      );
    }

    if (String(userData.status || "").toLowerCase() !== "activo") {
      await supabase.rpc("register_login_attempt", {
        p_email: cleanEmail,
        p_success: false,
        p_reason: "inactive_user",
        p_device_info: deviceInfo,
      });
      return NextResponse.json({ ok: false, error: "Usuario inactivo. Contacta al administrador." }, { status: 403 });
    }

    if (String(userData.pin || "") !== cleanPin) {
      await supabase.rpc("register_login_attempt", {
        p_email: cleanEmail,
        p_success: false,
        p_reason: "invalid_pin",
        p_device_info: deviceInfo,
      });
      return NextResponse.json({ ok: false, error: "Usuario, PIN o estado invalido." }, { status: 401 });
    }

    const token = createToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const user = {
      id: userData.id,
      full_name: userData.full_name || userData.name || "Usuario",
      email: userData.email,
      role_key: userData.role_key || "solo_lectura",
      role_label: userData.role_label || userData.role || "Solo Lectura",
      permissions: (userData.permissions || []) as PermissionKey[],
      status: userData.status || "activo",
      department: userData.department,
      avatar_url: userData.avatar_url,
      must_change_pin: userData.must_change_pin || false,
    };

    const loginAt = new Date().toISOString();

    const { error: closeOldSessionsError } = await supabase
      .from("app_sessions")
      .update({
        status: "closed",
        closed_at: loginAt,
        closed_reason: "single_session_replaced",
      })
      .eq("app_user_id", user.id)
      .eq("status", "active");

    if (closeOldSessionsError) throw closeOldSessionsError;

    await supabase.from("app_sessions").insert({
      app_user_id: user.id,
      email: user.email,
      session_token: token,
      device_info: deviceInfo,
      status: "active",
      expires_at: expiresAt.toISOString(),
      created_at: loginAt,
      last_seen_at: loginAt,
    });

    await supabase.rpc("register_login_attempt", {
      p_email: cleanEmail,
      p_success: true,
      p_reason: "login_ok",
      p_device_info: deviceInfo,
    });

    return NextResponse.json({ ok: true, user, token });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "No se pudo iniciar sesion." },
      { status: 500 }
    );
  }
}
