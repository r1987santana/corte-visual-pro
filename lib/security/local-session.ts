import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { PermissionKey } from "@/lib/saas/saas-client";

export type LocalSessionUser = {
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
  security_level?: string | null;
};

const LOCAL_TOKEN_PREFIX = "rdw_local_";
const LOCAL_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export const LOCAL_CEO_PERMISSIONS: PermissionKey[] = [
  "dashboard_ceo",
  "inventario",
  "compras",
  "ventas",
  "cotizador",
  "ia_diseno",
  "produccion",
  "corte",
  "transporte",
  "instalacion",
  "verificacion",
  "rrhh",
  "portal_empleado",
  "configuracion",
  "usuarios",
  "agenda",
];

export function isLocalRuntimeMode() {
  return ["1", "true", "yes", "on"].includes(String(process.env.RDWOOD_LOCAL_MODE || "").trim().toLowerCase());
}

export function getLocalCeoEmail() {
  return String(process.env.RDWOOD_LOCAL_CEO_EMAIL || "rsantana@rdsssantanagroup.com")
    .trim()
    .toLowerCase();
}

export function createLocalCeoUser(email = getLocalCeoEmail()): LocalSessionUser {
  return {
    id: "local-ceo-rsantana",
    full_name: "Ruben Santana",
    email,
    role_key: "ceo",
    role_label: "CEO Principal",
    permissions: LOCAL_CEO_PERMISSIONS,
    status: "activo",
    department: "Direccion",
    avatar_url: null,
    must_change_pin: false,
    security_level: "local_ceo",
  };
}

function localSessionSecret() {
  return (
    process.env.RDWOOD_LOCAL_SESSION_SECRET ||
    process.env.RDWOOD_LOCAL_CEO_PIN ||
    process.env.RDWOOD_OFFLINE_PIN ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "rdwood-local-session-development-only"
  );
}

function toBase64Url(value: string | Buffer) {
  const source = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return source.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function signPayload(payload: string) {
  return toBase64Url(createHmac("sha256", localSessionSecret()).update(payload).digest());
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createLocalSessionToken(user: LocalSessionUser = createLocalCeoUser()) {
  const now = Date.now();
  const payload = toBase64Url(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role_key,
      iat: now,
      exp: now + LOCAL_SESSION_TTL_MS,
      nonce: randomBytes(16).toString("hex"),
    })
  );

  return `${LOCAL_TOKEN_PREFIX}${payload}.${signPayload(payload)}`;
}

function cleanHost(value: string | null) {
  if (!value) return "";
  const first = value.split(",")[0].trim().toLowerCase();
  if (!first) return "";
  if (first.startsWith("[")) {
    const end = first.indexOf("]");
    return end > 0 ? first.slice(1, end) : first;
  }
  return first.split(":")[0];
}

function isLoopbackHost(host: string) {
  return host === "localhost" || host === "::1" || host === "0.0.0.0" || host.startsWith("127.");
}

function isPrivateLanHost(host: string) {
  return (
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

function requestHosts(request: Request) {
  const hosts = new Set<string>();

  try {
    hosts.add(cleanHost(new URL(request.url).hostname));
  } catch {}

  hosts.add(cleanHost(request.headers.get("host")));
  hosts.add(cleanHost(request.headers.get("x-forwarded-host")));

  return Array.from(hosts).filter(Boolean);
}

export function isTrustedLocalRequest(request: Request) {
  return requestHosts(request).some((host) => isLoopbackHost(host) || isPrivateLanHost(host));
}

export function isLoopbackRequest(request: Request) {
  return requestHosts(request).some(isLoopbackHost);
}

function parseSignedLocalToken(token: string) {
  if (!token.startsWith(LOCAL_TOKEN_PREFIX)) return null;

  const raw = token.slice(LOCAL_TOKEN_PREFIX.length);
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;

  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  if (!payload || !signature || !safeEqual(signature, signPayload(payload))) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as {
      email?: string;
      exp?: number;
    };

    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return createLocalCeoUser(String(parsed.email || getLocalCeoEmail()).toLowerCase());
  } catch {
    return null;
  }
}

export function localSessionUserFromToken(token: string, request: Request): LocalSessionUser | null {
  if (!isLocalRuntimeMode() || !token.startsWith(LOCAL_TOKEN_PREFIX) || !isTrustedLocalRequest(request)) {
    return null;
  }

  const signedUser = parseSignedLocalToken(token);
  if (signedUser) return signedUser;

  // Compatibilidad para sesiones locales abiertas antes de introducir firma.
  // Solo se permite en loopback para no aceptar tokens inventados desde la LAN.
  if (isLoopbackRequest(request)) {
    return createLocalCeoUser();
  }

  return null;
}
