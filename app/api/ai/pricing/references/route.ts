import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/security/api-guard";

const REFERENCES_TABLE = "ai_pricing_references";

type ReferenceBody = {
  id?: string;
  productKey?: string;
  productName?: string;
  category?: string | null;
  unit?: string | null;
  sourceType?: "manual" | "supplier" | "internet" | "internal" | "system";
  sourceName?: string | null;
  sourceUrl?: string | null;
  observedCost?: number | null;
  observedPrice?: number | null;
  currency?: string;
  confidence?: number;
  notes?: string | null;
  metadata?: Record<string, any>;
};

function now() {
  return new Date().toISOString();
}

function text(value: any) {
  return String(value || "").trim();
}

function numberOrNull(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeKey(value: any) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function safeId(input: ReferenceBody) {
  const raw = `${input.sourceType || "manual"}_${input.productKey || input.productName || Date.now()}_${input.sourceName || "ref"}`;
  return `price_ref_${normalizeKey(raw).replace(/\s+/g, "_").slice(0, 130)}`;
}

function normalizeSourceType(value: any) {
  const type = text(value || "manual").toLowerCase();
  if (type === "manual" || type === "supplier" || type === "internet" || type === "internal" || type === "system") return type;
  return "manual";
}

function normalizeConfidence(value: any) {
  const n = Number(value ?? 0.7);
  if (!Number.isFinite(n)) return 0.7;
  return Math.max(0, Math.min(1, n));
}

function toClient(row: any) {
  return {
    id: row.id,
    productKey: row.product_key,
    productName: row.product_name,
    category: row.category,
    unit: row.unit,
    sourceType: row.source_type,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    observedCost: row.observed_cost,
    observedPrice: row.observed_price,
    currency: row.currency,
    confidence: row.confidence,
    notes: row.notes,
    metadata: row.metadata || {},
    createdBy: row.created_by,
    observedAt: row.observed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordFromBody(body: ReferenceBody, userEmail: string) {
  const productName = text(body.productName);
  const productKey = normalizeKey(body.productKey || productName);
  const date = now();

  if (!productName) return null;
  if (!productKey) return null;

  return {
    id: text(body.id) || safeId({ ...body, productKey }),
    product_key: productKey,
    product_name: productName,
    category: text(body.category) || null,
    unit: text(body.unit) || null,
    source_type: normalizeSourceType(body.sourceType),
    source_name: text(body.sourceName) || null,
    source_url: text(body.sourceUrl) || null,
    observed_cost: numberOrNull(body.observedCost),
    observed_price: numberOrNull(body.observedPrice),
    currency: text(body.currency || "DOP").toUpperCase(),
    confidence: normalizeConfidence(body.confidence),
    notes: text(body.notes) || null,
    metadata: body.metadata || {},
    created_by: userEmail,
    observed_at: date,
    created_at: date,
    updated_at: date,
  };
}

export async function GET(req: Request) {
  const session = await requireApiSession(req, "dashboard_ceo");
  if (!session.ok) return session.response;

  const url = new URL(req.url);
  const product = normalizeKey(url.searchParams.get("product"));
  const sourceType = text(url.searchParams.get("sourceType"));

  let query = session.supabase
    .from(REFERENCES_TABLE)
    .select("*")
    .order("observed_at", { ascending: false })
    .limit(200);

  if (product) query = query.ilike("product_key", `%${product}%`);
  if (sourceType) query = query.eq("source_type", normalizeSourceType(sourceType));

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({
      ok: true,
      references: [],
      setupRequired: true,
      message: "La tabla ai_pricing_references no esta disponible. Ejecuta el SQL actualizado de IA Nivel 5.",
    });
  }

  return NextResponse.json({ ok: true, references: (data || []).map(toClient) });
}

export async function POST(req: Request) {
  const session = await requireApiSession(req, "dashboard_ceo");
  if (!session.ok) return session.response;

  const body = await req.json();
  const inputs: ReferenceBody[] = Array.isArray(body?.references) ? body.references : [body];
  const records = inputs
    .map((item: ReferenceBody) => recordFromBody(item, session.user.email))
    .filter((record): record is NonNullable<ReturnType<typeof recordFromBody>> => Boolean(record));

  if (!records.length) {
    return NextResponse.json({ ok: false, message: "Faltan referencias validas de precio." }, { status: 400 });
  }

  const { data, error } = await session.supabase
    .from(REFERENCES_TABLE)
    .upsert(records, { onConflict: "id" })
    .select("*");

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        setupRequired: true,
        message: "No se pudieron guardar referencias de precio. Ejecuta el SQL actualizado de IA Nivel 5.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, references: (data || []).map(toClient) });
}
