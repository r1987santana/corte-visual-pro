"use client";

import { supabase } from "@/lib/supabase";

export type SecurityPolicy = {
  max_failed_attempts: number;
  lock_minutes: number;
  session_days: number;
  pin_min_length: number;
  pin_max_length: number;
  require_pin_change_days: number;
  allow_multiple_sessions: boolean;
};

export type SecurityUserStatus = {
  id: string;
  email: string;
  full_name: string;
  role_key: string;
  role_label: string;
  status: string;
  security_level: string;
  failed_login_attempts: number;
  locked_until: string | null;
  is_locked: boolean;
  must_change_pin: boolean;
  pin_updated_at: string | null;
  password_updated_at: string | null;
  last_login_at: string | null;
  active_sessions: number;
  failed_attempts_24h: number;
};

export type ActiveSession = {
  id: string;
  app_user_id: string;
  email: string;
  full_name: string;
  role_label: string;
  session_token: string;
  device_info: string | null;
  ip_address: string | null;
  location_text: string | null;
  status: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string | null;
  is_expired: boolean;
};

export type AuditLog = {
  id: string;
  module: string | null;
  action: string | null;
  entity_type: string | null;
  entity_id: string | null;
  user_email: string | null;
  severity: string | null;
  old_data: any;
  new_data: any;
  created_at: string;
};

export async function getSecurityPolicy(): Promise<SecurityPolicy> {
  const { data, error } = await supabase
    .from("security_settings")
    .select("setting_value")
    .eq("setting_key", "security_policy")
    .maybeSingle();

  if (error || !data?.setting_value) {
    return {
      max_failed_attempts: 5,
      lock_minutes: 15,
      session_days: 7,
      pin_min_length: 4,
      pin_max_length: 8,
      require_pin_change_days: 90,
      allow_multiple_sessions: true,
    };
  }

  return data.setting_value as SecurityPolicy;
}

export async function getSecurityUserStatus(email: string): Promise<SecurityUserStatus | null> {
  const { data, error } = await supabase
    .from("v_security_user_status")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error || !data) return null;
  return data as SecurityUserStatus;
}

export async function getActiveSessions(email?: string): Promise<ActiveSession[]> {
  let query = supabase
    .from("v_active_sessions")
    .select("*")
    .order("last_seen_at", { ascending: false });

  if (email) {
    query = query.eq("email", email.toLowerCase());
  }

  const { data, error } = await query;

  if (error || !data) return [];
  return data as ActiveSession[];
}

export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as AuditLog[];
}

export async function changeUserPin(email: string, currentPin: string, newPin: string) {
  const { data, error } = await supabase.rpc("change_user_pin", {
    p_email: email.toLowerCase(),
    p_current_pin: currentPin,
    p_new_pin: newPin,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return data as { ok: boolean; message: string };
}

export async function closeSession(sessionToken: string, reason = "manual") {
  const { data, error } = await supabase.rpc("close_user_session", {
    p_session_token: sessionToken,
    p_reason: reason,
  });

  if (error) return false;
  return Boolean(data);
}

export async function closeAllSessions(email: string, exceptToken?: string) {
  const { data, error } = await supabase.rpc("close_all_user_sessions", {
    p_email: email.toLowerCase(),
    p_except_token: exceptToken || null,
    p_reason: "user_close_all",
  });

  if (error) return 0;
  return Number(data || 0);
}

export async function logAuditEvent(input: {
  module: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  user_email?: string;
  old_data?: any;
  new_data?: any;
  severity?: "info" | "warning" | "critical";
  device_info?: string;
}) {
  const { data, error } = await supabase.rpc("log_audit_event", {
    p_module: input.module,
    p_action: input.action,
    p_entity_type: input.entity_type || null,
    p_entity_id: input.entity_id || null,
    p_user_email: input.user_email || null,
    p_old_data: input.old_data || null,
    p_new_data: input.new_data || null,
    p_severity: input.severity || "info",
    p_device_info: input.device_info || null,
  });

  if (error) return null;
  return data as string;
}
