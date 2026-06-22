import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/security/api-guard";
import { isTrustedLocalRequest } from "@/lib/security/local-session";
import { analyzeTurquesaLocal, analyzeTurquesaWithAI } from "@/lib/turquesa/restaurant-ai";
import { freshDemoSnapshot, type TurquesaSnapshot } from "@/lib/turquesa/restaurant-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(request: Request) {
  const session = await requireApiSession(request, ["dashboard_ceo", "ventas"]);
  if (session.ok) return null;
  if (process.env.NODE_ENV !== "production" && isTrustedLocalRequest(request)) return null;
  return session.response;
}

function usableSnapshot(value: any): TurquesaSnapshot {
  if (value?.restaurant && Array.isArray(value?.tables) && Array.isArray(value?.inventory)) return value as TurquesaSnapshot;
  return freshDemoSnapshot("Modo demo: Turquesa AI sin snapshot operativo.");
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth) return auth;

  const snapshot = freshDemoSnapshot("Modo demo: Turquesa AI listo.");
  return NextResponse.json({
    ok: true,
    ai: analyzeTurquesaLocal(snapshot),
  });
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const snapshot = usableSnapshot(body?.snapshot);
  const question = String(body?.question || "").slice(0, 500);
  const ai = await analyzeTurquesaWithAI(snapshot, question);

  return NextResponse.json({
    ok: true,
    ai,
  });
}
