import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_BASE_URL = "https://corte-visual-pro.vercel.app";
const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const ROUTES = [
  "/login",
  "/dashboard-ceo",
  "/inventario",
  "/ia-decisiones",
  "/ia-precios",
  "/pagos",
];

function loadEnvFile(fileName) {
  const envPath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

function printResult(ok, label, detail = "") {
  const mark = ok ? "OK" : "FAIL";
  console.log(`${mark.padEnd(5)} ${label}${detail ? ` - ${detail}` : ""}`);
}

async function checkRoute(baseUrl, route) {
  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const ms = Date.now() - started;
    return { ok: response.status < 500, status: response.status, ms };
  } catch (error) {
    return { ok: false, status: "ERROR", ms: Date.now() - started, error: error?.message || String(error) };
  }
}

async function checkSupabase() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase
    .from("app_sessions")
    .select("id,app_user_id,status,created_at,last_seen_at")
    .eq("status", "active")
    .order("app_user_id", { ascending: true });

  if (error) throw error;

  const sessions = data || [];
  const perUser = new Map();
  for (const session of sessions) {
    perUser.set(session.app_user_id, (perUser.get(session.app_user_id) || 0) + 1);
  }

  const duplicateUsers = Array.from(perUser.values()).filter((count) => count > 1).length;
  return {
    activeSessions: sessions.length,
    duplicateUsers,
  };
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const baseUrl = (process.env.RDWOOD_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  let failed = 0;

  console.log(`RD Wood pilot check: ${baseUrl}`);
  console.log("");

  for (const key of REQUIRED_ENV) {
    const ok = Boolean(process.env[key]);
    if (!ok) failed += 1;
    printResult(ok, `env ${key}`);
  }

  console.log("");

  if (REQUIRED_ENV.every((key) => Boolean(process.env[key]))) {
    try {
      const result = await checkSupabase();
      const ok = result.duplicateUsers === 0;
      if (!ok) failed += 1;
      printResult(ok, "Supabase sesiones", `${result.activeSessions} activas, ${result.duplicateUsers} usuarios duplicados`);
    } catch (error) {
      failed += 1;
      printResult(false, "Supabase sesiones", error?.message || String(error));
    }
  }

  console.log("");

  for (const route of ROUTES) {
    const result = await checkRoute(baseUrl, route);
    if (!result.ok) failed += 1;
    printResult(result.ok, `GET ${route}`, `${result.status} ${result.ms}ms${result.error ? ` ${result.error}` : ""}`);
  }

  console.log("");
  if (failed) {
    console.log(`Pilot check terminado con ${failed} aviso(s).`);
    process.exitCode = 1;
    return;
  }

  console.log("Pilot check listo: sistema responde y no hay sesiones duplicadas.");
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
