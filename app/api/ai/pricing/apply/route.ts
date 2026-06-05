import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/security/api-guard";

const INVENTORY_TABLE = "inventory";
const TASKS_TABLE = "ai_tasks";
const LEARNING_TABLE = "ai_pricing_learning";

type ApplyBody = {
  taskId?: string;
  inventoryId?: string;
  approvedCost?: number;
  approvedPrice?: number;
  notes?: string;
};

function now() {
  return new Date().toISOString();
}

function text(value: any) {
  return String(value || "").trim();
}

function toNumber(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeKey(value: any) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isAdmin(roleKey: string) {
  return ["admin", "administrador", "super_admin"].includes(String(roleKey || "").toLowerCase());
}

function productName(row: any) {
  return text(row.name) || text(row.product_name) || text(row.material) || text(row.code) || "Producto";
}

function productCost(row: any) {
  return toNumber(row.cost_price ?? row.unit_cost ?? row.purchase_cost ?? row.cost ?? row.costo_prom ?? row.costo_promedio);
}

function productPrice(row: any) {
  return toNumber(row.sale_price ?? row.price ?? row.precio_venta ?? row.venta ?? row.unit_price);
}

function pricingFromPayload(payload: any) {
  return payload?.pricing || payload?.payload?.pricing || null;
}

async function safeInsertLearning(supabase: any, record: Record<string, any>) {
  const { error } = await supabase.from(LEARNING_TABLE).upsert(record, { onConflict: "id" });
  return !error;
}

export async function POST(req: Request) {
  const session = await requireApiSession(req, "dashboard_ceo");
  if (!session.ok) return session.response;

  if (!isAdmin(session.user.role_key)) {
    return NextResponse.json({ ok: false, message: "Solo administradores pueden aplicar precios IA." }, { status: 403 });
  }

  const body = (await req.json()) as ApplyBody;
  const taskId = text(body.taskId);
  let task: any = null;
  let pricing: any = null;
  let inventoryId = text(body.inventoryId);

  if (taskId) {
    const { data, error } = await session.supabase
      .from(TASKS_TABLE)
      .select("*")
      .eq("id", taskId)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, message: "Tarea IA no encontrada." }, { status: 404 });

    task = data;
    pricing = pricingFromPayload(data.payload || {});
    inventoryId = inventoryId || text(data.payload?.inventoryId);
  }

  if (!pricing && body.inventoryId) {
    pricing = {
      suggestedCost: body.approvedCost,
      suggestedPrice: body.approvedPrice,
    };
  }

  if (!inventoryId) {
    return NextResponse.json({ ok: false, message: "Falta inventoryId para aplicar precio." }, { status: 400 });
  }

  const { data: product, error: productError } = await session.supabase
    .from(INVENTORY_TABLE)
    .select("*")
    .eq("id", inventoryId)
    .maybeSingle();

  if (productError) return NextResponse.json({ ok: false, message: productError.message }, { status: 500 });
  if (!product) return NextResponse.json({ ok: false, message: "Producto de inventario no encontrado." }, { status: 404 });

  const previousCost = productCost(product);
  const previousPrice = productPrice(product);
  const approvedCost = toNumber(body.approvedCost ?? pricing?.suggestedCost ?? previousCost);
  const approvedPrice = toNumber(body.approvedPrice ?? pricing?.suggestedPrice ?? previousPrice);

  if (approvedCost <= 0 || approvedPrice <= 0) {
    return NextResponse.json({ ok: false, message: "Costo y precio aprobado deben ser mayores que cero." }, { status: 400 });
  }

  if (approvedPrice < approvedCost) {
    return NextResponse.json({ ok: false, message: "El precio aprobado no puede ser menor que el costo." }, { status: 400 });
  }

  const date = now();
  const updatePayload = {
    purchase_cost: approvedCost,
    cost_price: approvedCost,
    unit_cost: approvedCost,
    cost: approvedCost,
    costo_prom: approvedCost,
    costo_promedio: approvedCost,
    sale_price: approvedPrice,
    price: approvedPrice,
    unit_price: approvedPrice,
    venta: approvedPrice,
    precio_venta: approvedPrice,
    updated_at: date,
  };

  const { data: updatedProduct, error: updateError } = await session.supabase
    .from(INVENTORY_TABLE)
    .update(updatePayload)
    .eq("id", inventoryId)
    .select("*")
    .single();

  if (updateError) return NextResponse.json({ ok: false, message: updateError.message }, { status: 500 });

  if (taskId) {
    await session.supabase
      .from(TASKS_TABLE)
      .update({
        status: "done",
        updated_at: date,
        completed_at: date,
        payload: {
          ...(task?.payload || {}),
          appliedPricing: {
            inventoryId,
            previousCost,
            previousPrice,
            approvedCost,
            approvedPrice,
            appliedAt: date,
            appliedBy: session.user.email,
          },
        },
      })
      .eq("id", taskId);
  }

  const productLabel = productName(product);
  const evidence = Array.isArray(pricing?.evidence) ? pricing.evidence[0] : null;
  const learningRecord = {
    id: `price_learning_${taskId || inventoryId}_${Date.now()}`,
    task_id: taskId || null,
    decision_id: task?.decision_id || null,
    inventory_id: inventoryId,
    product_key: normalizeKey(`${productLabel} ${product.code || product.sku || ""}`),
    product_name: productLabel,
    action: "apply_inventory_price",
    suggested_cost: toNumber(pricing?.suggestedCost),
    suggested_price: toNumber(pricing?.suggestedPrice),
    approved_cost: approvedCost,
    approved_price: approvedPrice,
    previous_cost: previousCost,
    previous_price: previousPrice,
    source_type: text(evidence?.sourceType || "manual"),
    source_label: text(evidence?.source || "Aprobacion manual"),
    confidence: toNumber(pricing?.confidence || evidence?.confidence || 0),
    outcome: "applied",
    notes: text(body.notes),
    payload: {
      pricing: pricing || {},
      productBefore: product,
      productAfter: updatedProduct,
    },
    created_by: session.user.email,
    created_at: date,
  };

  const learningSaved = await safeInsertLearning(session.supabase, learningRecord);

  return NextResponse.json({
    ok: true,
    product: updatedProduct,
    taskId: taskId || null,
    applied: {
      inventoryId,
      previousCost,
      previousPrice,
      approvedCost,
      approvedPrice,
    },
    learningSaved,
  });
}
