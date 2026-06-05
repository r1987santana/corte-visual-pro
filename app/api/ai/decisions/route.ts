import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/security/api-guard";
import { shouldRequireApproval, type AIDecisionRisk, type AIDecisionStatus } from "@/lib/ai/level5";

const DECISIONS_TABLE = "ai_decision_queue";

type DecisionBody = {
  id?: string;
  module?: string;
  actionType?: string;
  title?: string;
  summary?: string;
  risk?: AIDecisionRisk;
  payload?: Record<string, any>;
  route?: string;
  status?: AIDecisionStatus;
};

function now() {
  return new Date().toISOString();
}

function safeId() {
  return `ai_dec_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeRisk(value: any): AIDecisionRisk {
  const risk = String(value || "medium").toLowerCase();
  if (risk === "low" || risk === "medium" || risk === "high" || risk === "critical") return risk;
  return "medium";
}

function normalizeStatus(value: any): AIDecisionStatus {
  const status = String(value || "pending").toLowerCase();
  if (status === "pending" || status === "approved" || status === "rejected" || status === "executed" || status === "cancelled") {
    return status;
  }
  return "pending";
}

function toClient(row: any) {
  return {
    id: row.id,
    module: row.module,
    actionType: row.action_type,
    title: row.title,
    summary: row.summary,
    risk: row.risk,
    status: row.status,
    payload: row.payload || {},
    route: row.route,
    requiresApproval: row.requires_approval,
    createdBy: row.created_by,
    decidedBy: row.decided_by,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    executedAt: row.executed_at,
  };
}

function isAdmin(roleKey: string) {
  return ["admin", "administrador", "super_admin"].includes(String(roleKey || "").toLowerCase());
}

export async function GET(req: Request) {
  const session = await requireApiSession(req);
  if (!session.ok) return session.response;

  const url = new URL(req.url);
  const status = normalizeStatus(url.searchParams.get("status") || "pending");
  const module = url.searchParams.get("module");

  let query = session.supabase
    .from(DECISIONS_TABLE)
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  if (module) query = query.eq("module", module);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({
      ok: true,
      decisions: [],
      setupRequired: true,
      message: "La cola de decisiones IA aun no esta creada en Supabase.",
    });
  }

  return NextResponse.json({ ok: true, decisions: (data || []).map(toClient) });
}

export async function POST(req: Request) {
  const session = await requireApiSession(req);
  if (!session.ok) return session.response;

  const body = (await req.json()) as DecisionBody;
  const risk = normalizeRisk(body.risk);
  const actionType = String(body.actionType || "review").trim();
  const date = now();
  const requiresApproval = shouldRequireApproval(risk, actionType);

  const record = {
    id: body.id || safeId(),
    module: String(body.module || "global").trim().toLowerCase(),
    action_type: actionType,
    title: String(body.title || "Decision IA pendiente").trim(),
    summary: String(body.summary || "").trim(),
    risk,
    status: requiresApproval ? "pending" : "approved",
    payload: body.payload || {},
    route: body.route || null,
    requires_approval: requiresApproval,
    created_by: session.user.email,
    created_at: date,
    updated_at: date,
  };

  const { data, error } = await session.supabase
    .from(DECISIONS_TABLE)
    .insert(record)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        setupRequired: true,
        message: "No se pudo crear la decision IA. Ejecuta el SQL de foundation nivel 5.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, decision: toClient(data) });
}

export async function PATCH(req: Request) {
  const session = await requireApiSession(req);
  if (!session.ok) return session.response;

  if (!isAdmin(session.user.role_key)) {
    return NextResponse.json({ ok: false, message: "Solo administradores pueden aprobar decisiones IA." }, { status: 403 });
  }

  const body = (await req.json()) as DecisionBody;
  const id = String(body.id || "").trim();
  const status = normalizeStatus(body.status);

  if (!id) return NextResponse.json({ ok: false, message: "Falta id." }, { status: 400 });
  if (!["approved", "rejected", "cancelled", "executed"].includes(status)) {
    return NextResponse.json({ ok: false, message: "Estado no permitido." }, { status: 400 });
  }

  const patch: Record<string, any> = {
    status,
    updated_at: now(),
    decided_by: session.user.email,
    decided_at: now(),
  };

  if (status === "executed") patch.executed_at = now();

  const { data, error } = await session.supabase
    .from(DECISIONS_TABLE)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, decision: toClient(data) });
}
