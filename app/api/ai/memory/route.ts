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

const MEMORY_TABLE = "ai_operational_memory";

function now() {
  return new Date().toISOString();
}

function safeId() {
  return `srv_mem_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toClientRecord(row: any): ServerMemoryRecord {
  return {
    id: row.id,
    scope: row.scope || "global",
    title: row.title || "Memoria operativa",
    summary: row.summary || "",
    entityType: row.entity_type || undefined,
    entityId: row.entity_id || undefined,
    priority: row.priority || "normal",
    createdAt: row.created_at || now(),
    updatedAt: row.updated_at || row.created_at || now(),
    metadata: row.metadata || {},
  };
}

function toDbRecord(record: ServerMemoryRecord, userEmail: string) {
  return {
    id: record.id,
    scope: record.scope,
    title: record.title,
    summary: record.summary,
    entity_type: record.entityType || null,
    entity_id: record.entityId || null,
    priority: record.priority || "normal",
    metadata: record.metadata || {},
    user_email: userEmail,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export async function GET(req: Request) {
  const session = await requireApiSession(req);
  if (!session.ok) return session.response;

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const query = String(url.searchParams.get("q") || "").toLowerCase();

  const dbQuery = session.supabase
    .from(MEMORY_TABLE)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);

  const filteredDbQuery = scope ? dbQuery.in("scope", [scope, "global"]) : dbQuery;
  const { data, error } = await filteredDbQuery;

  if (!error && Array.isArray(data)) {
    const records = data
      .map(toClientRecord)
      .filter((r) => {
        if (!query) return true;
        return `${r.title} ${r.summary} ${r.scope} ${r.entityType || ""} ${r.entityId || ""}`
          .toLowerCase()
          .includes(query);
      });

    return NextResponse.json({ ok: true, records, storage: "supabase" });
  }

  const records = memoryStore
    .filter((r) => {
      if (scope && r.scope !== scope && r.scope !== "global") return false;
      if (!query) return true;
      return `${r.title} ${r.summary} ${r.scope} ${r.entityType || ""} ${r.entityId || ""}`
        .toLowerCase()
        .includes(query);
    })
    .slice(0, 50);

  return NextResponse.json({ ok: true, records, storage: "memory", setupRequired: true });
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

    const { error } = await session.supabase
      .from(MEMORY_TABLE)
      .upsert(toDbRecord(record, session.user.email), { onConflict: "id" });

    if (!error) {
      return NextResponse.json({
        ok: true,
        record,
        storage: "supabase",
        message: "Memoria operativa persistente guardada.",
      });
    }

    return NextResponse.json({
      ok: true,
      record,
      storage: "memory",
      setupRequired: true,
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

  await session.supabase.from(MEMORY_TABLE).delete().eq("id", id);

  return NextResponse.json({ ok: true, message: "Memoria eliminada." });
}
