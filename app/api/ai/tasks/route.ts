import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/security/api-guard";

const TASKS_TABLE = "ai_tasks";
const LEARNING_TABLE = "ai_pricing_learning";

type AITaskStatus = "open" | "in_progress" | "done" | "cancelled";
type AITaskPriority = "low" | "normal" | "high" | "critical";

type TaskBody = {
  id?: string;
  decisionId?: string | null;
  module?: string;
  title?: string;
  summary?: string;
  status?: AITaskStatus;
  priority?: AITaskPriority;
  route?: string | null;
  payload?: Record<string, any>;
  assignedTo?: string | null;
};

function now() {
  return new Date().toISOString();
}

function safeId() {
  return `ai_task_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function text(value: any) {
  return String(value || "").trim();
}

function normalizeStatus(value: any): AITaskStatus {
  const status = text(value || "open").toLowerCase();
  if (status === "open" || status === "in_progress" || status === "done" || status === "cancelled") return status;
  return "open";
}

function normalizePriority(value: any): AITaskPriority {
  const priority = text(value || "normal").toLowerCase();
  if (priority === "low" || priority === "normal" || priority === "high" || priority === "critical") return priority;
  return "normal";
}

function toClient(row: any) {
  return {
    id: row.id,
    decisionId: row.decision_id,
    module: row.module,
    title: row.title,
    summary: row.summary,
    status: row.status,
    priority: row.priority,
    route: row.route,
    payload: row.payload || {},
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function normalizeKey(value: any) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toNumber(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function recordCompletionLearning(supabase: any, task: any, userEmail: string) {
  const pricing = task?.payload?.pricing;
  const inventoryId = text(task?.payload?.inventoryId);
  if (!pricing || !inventoryId) return false;

  const evidence = Array.isArray(pricing.evidence) ? pricing.evidence[0] : null;
  const productName = text(pricing.product || task.title || "Producto");
  const applied = task?.payload?.appliedPricing || {};

  const record = {
    id: `price_learning_completed_${task.id}`,
    task_id: task.id,
    decision_id: task.decision_id || null,
    inventory_id: inventoryId,
    product_key: normalizeKey(`${productName} ${pricing.sku || ""}`),
    product_name: productName,
    action: "complete_ai_pricing_task",
    suggested_cost: toNumber(pricing.suggestedCost),
    suggested_price: toNumber(pricing.suggestedPrice),
    approved_cost: toNumber(applied.approvedCost || pricing.suggestedCost),
    approved_price: toNumber(applied.approvedPrice || pricing.suggestedPrice),
    previous_cost: toNumber(applied.previousCost || pricing.currentCost),
    previous_price: toNumber(applied.previousPrice || pricing.currentPrice),
    source_type: text(evidence?.sourceType || "task"),
    source_label: text(evidence?.source || "Tarea IA completada"),
    confidence: toNumber(pricing.confidence || evidence?.confidence || 0),
    outcome: applied.appliedAt ? "applied" : "completed",
    notes: "Tarea IA marcada como completada.",
    payload: {
      task,
      pricing,
      applied,
    },
    created_by: userEmail,
    created_at: now(),
  };

  const { error } = await supabase.from(LEARNING_TABLE).upsert(record, { onConflict: "id" });
  return !error;
}

export async function GET(req: Request) {
  const session = await requireApiSession(req, "dashboard_ceo");
  if (!session.ok) return session.response;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const module = url.searchParams.get("module");

  let query = session.supabase
    .from(TASKS_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq("status", normalizeStatus(status));
  } else {
    query = query.in("status", ["open", "in_progress"]);
  }

  if (module) query = query.eq("module", module);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({
      ok: true,
      tasks: [],
      setupRequired: true,
      message: "La tabla ai_tasks no esta disponible. Ejecuta el SQL actualizado de IA Nivel 5.",
    });
  }

  return NextResponse.json({ ok: true, tasks: (data || []).map(toClient) });
}

export async function POST(req: Request) {
  const session = await requireApiSession(req, "dashboard_ceo");
  if (!session.ok) return session.response;

  const body = (await req.json()) as TaskBody;
  const title = text(body.title);

  if (!title) {
    return NextResponse.json({ ok: false, message: "Falta titulo de tarea." }, { status: 400 });
  }

  const date = now();
  const record = {
    id: text(body.id) || safeId(),
    decision_id: text(body.decisionId) || null,
    module: text(body.module || "global").toLowerCase(),
    title,
    summary: text(body.summary),
    status: normalizeStatus(body.status),
    priority: normalizePriority(body.priority),
    route: body.route || null,
    payload: body.payload || {},
    created_by: session.user.email,
    assigned_to: text(body.assignedTo) || null,
    created_at: date,
    updated_at: date,
  };

  const { data, error } = await session.supabase
    .from(TASKS_TABLE)
    .upsert(record, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        setupRequired: true,
        message: "No se pudo crear la tarea IA. Ejecuta el SQL actualizado de IA Nivel 5.",
      },
      { status: 503 }
    );
  }

  const learningSaved = data.status === "done" ? await recordCompletionLearning(session.supabase, data, session.user.email) : false;

  return NextResponse.json({ ok: true, task: toClient(data), learningSaved });
}

export async function PATCH(req: Request) {
  const session = await requireApiSession(req, "dashboard_ceo");
  if (!session.ok) return session.response;

  const body = (await req.json()) as TaskBody;
  const id = text(body.id);
  const status = normalizeStatus(body.status);

  if (!id) return NextResponse.json({ ok: false, message: "Falta id." }, { status: 400 });

  const patch: Record<string, any> = {
    status,
    updated_at: now(),
  };

  if (status === "done" || status === "cancelled") patch.completed_at = now();
  if (body.assignedTo !== undefined) patch.assigned_to = text(body.assignedTo) || null;

  const { data, error } = await session.supabase
    .from(TASKS_TABLE)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const learningSaved = status === "done" ? await recordCompletionLearning(session.supabase, data, session.user.email) : false;

  return NextResponse.json({ ok: true, task: toClient(data), learningSaved });
}
