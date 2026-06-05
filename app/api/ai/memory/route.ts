import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/security/api-guard";

type ServerMemoryRecord = {
  id: string;
  scope: string;
  title: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  priority?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
};

const memoryStore: ServerMemoryRecord[] = [];

function now() {
  return new Date().toISOString();
}

function safeId() {
  return `srv_mem_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function GET(req: Request) {
  const session = await requireApiSession(req);
  if (!session.ok) return session.response;

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const query = String(url.searchParams.get("q") || "").toLowerCase();

  const records = memoryStore
    .filter((r) => {
      if (scope && r.scope !== scope && r.scope !== "global") return false;
      if (!query) return true;
      return `${r.title} ${r.summary} ${r.scope} ${r.entityType || ""} ${r.entityId || ""}`
        .toLowerCase()
        .includes(query);
    })
    .slice(0, 50);

  return NextResponse.json({ ok: true, records });
}

export async function POST(req: Request) {
  try {
    const session = await requireApiSession(req);
    if (!session.ok) return session.response;

    const body = await req.json();
    const date = now();

    const record: ServerMemoryRecord = {
      id: safeId(),
      scope: body?.scope || "global",
      title: body?.title || "Memoria operativa",
      summary: body?.summary || "",
      entityType: body?.entityType || undefined,
      entityId: body?.entityId || undefined,
      priority: body?.priority || "normal",
      createdAt: date,
      updatedAt: date,
      metadata: body?.metadata || {},
    };

    memoryStore.unshift(record);

    return NextResponse.json({
      ok: true,
      record,
      message: "Memoria operativa guardada.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "Error guardando memoria.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const session = await requireApiSession(req);
  if (!session.ok) return session.response;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ ok: false, message: "Falta id." }, { status: 400 });
  }

  const index = memoryStore.findIndex((r) => r.id === id);

  if (index >= 0) {
    memoryStore.splice(index, 1);
  }

  return NextResponse.json({ ok: true, message: "Memoria eliminada." });
}
