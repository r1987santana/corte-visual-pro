import { supabase } from "@/lib/supabase";

type AutoTrigger = "venta" | "produccion" | "manual" | "dashboard";

function n(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getStock(item: any) {
  return n(item.stock ?? item.quantity ?? item.stock_actual ?? 0);
}

function getMinStock(item: any) {
  return n(item.minimum_stock ?? item.min_stock ?? item.minimo ?? item.stock_minimo ?? 0);
}

function getMaxStock(item: any) {
  return n(item.maximum_stock ?? item.max_stock ?? item.maximo ?? 0);
}

function getCost(item: any) {
  return n(
    item.unit_cost ??
      item.purchase_cost ??
      item.cost_price ??
      item.cost ??
      item.costo_compra ??
      item.costo_promedio ??
      0
  );
}

function getSupplier(item: any) {
  return String(item.supplier || item.proveedor || "Sin proveedor");
}

function getName(item: any) {
  return String(
    item.material ||
      item.name ||
      item.product_name ||
      item.nombre ||
      item.code ||
      item.codigo ||
      "Material sin nombre"
  );
}

function getCode(item: any) {
  return String(item.code || item.codigo || item.sku || "").trim();
}

function getReorderQty(item: any) {
  const stock = getStock(item);
  const min = getMinStock(item);
  const max = getMaxStock(item);
  const reorder = n(item.reorder_quantity ?? item.cantidad_reorden ?? 0);

  if (reorder > 0) return reorder;
  if (max > stock) return max - stock;
  if (min > stock) return Math.max(min - stock, min || 10);

  return 10;
}

function createOrderCode() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rnd = Math.floor(100000 + Math.random() * 900000);
  return `OC-AUTO-${y}${m}${day}-${rnd}`;
}

async function existeOrdenPendienteParaMaterial(inventoryId: string) {
  const { data, error } = await supabase
    .from("purchase_order_items")
    .select("id, purchase_order_id, purchase_orders(status)")
    .eq("inventory_id", inventoryId)
    .limit(10);

  if (error || !data) return false;

  return data.some((row: any) => {
    const status = String(row.purchase_orders?.status || "").toLowerCase();
    return !["recibida", "recibido", "cancelada", "cancelado"].includes(status);
  });
}

export async function generarComprasAutomaticasPorStock({
  referencia,
}: {
  referencia?: string;
} = {}) {
  const { data: inventory, error } = await supabase.from("inventory").select("*");

  if (error) {
    throw new Error("Error leyendo inventario: " + error.message);
  }

  const criticalRaw = (inventory || []).filter((item: any) => {
    const active = item.status ? item.status === "active" : true;
    const auto = item.auto_purchase === false ? false : true;
    return active && auto && getStock(item) <= getMinStock(item);
  });

  const critical: any[] = [];

  for (const item of criticalRaw) {
    const alreadyPending = await existeOrdenPendienteParaMaterial(String(item.id));
    if (!alreadyPending) critical.push(item);
  }

  if (critical.length === 0) {
    return {
      ok: true,
      createdOrders: 0,
      createdItems: 0,
      message: "No hay materiales críticos nuevos para comprar.",
    };
  }

  const grouped = new Map<string, any[]>();

  critical.forEach((item) => {
    const supplier = getSupplier(item);
    const list = grouped.get(supplier) || [];
    list.push(item);
    grouped.set(supplier, list);
  });

  let createdOrders = 0;
  let createdItems = 0;

  for (const [supplier, list] of grouped.entries()) {
    const code = createOrderCode();

    const totalCost = list.reduce((acc, item) => {
      const qty = getReorderQty(item);
      const cost = getCost(item);
      return acc + qty * cost;
    }, 0);

    const whatsappMessage = [
      "ORDEN DE COMPRA AUTOMÁTICA",
      `Código: ${code}`,
      `Proveedor: ${supplier}`,
      "",
      "Materiales:",
      ...list.map((item) => {
        const qty = getReorderQty(item);
        const cost = getCost(item);
        return `- ${getName(item)} (${getCode(item) || "Sin código"}) | Cant: ${qty} | Costo: RD$${cost.toFixed(2)}`;
      }),
      "",
      `Total estimado: RD$${totalCost.toFixed(2)}`,
      referencia ? `Referencia: ${referencia}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { data: order, error: orderError } = await supabase
      .from("purchase_orders")
      .insert({
        code,
        order_number: code,
        supplier,
        supplier_name: supplier,
        status: "pendiente",
        total_cost: totalCost,
        total_estimated: totalCost,
        reason: `AUTOMÁTICO TOTAL por stock bajo${referencia ? ` | ${referencia}` : ""}`,
        whatsapp_message: whatsappMessage,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message || "No se pudo crear orden de compra automática.");
    }

    createdOrders += 1;

    const rows = list.map((item) => {
      const qty = getReorderQty(item);
      const cost = getCost(item);

      return {
        purchase_order_id: order.id,
        inventory_id: item.id,
        product_id: item.id,
        producto_id: item.id,
        product_name: getName(item),
        group_name: item.grupo || item.category || "General",
        subgroup_name: item.subgrupo || item.subcategory || "",
        unit: item.unit || item.unidad || "",
        current_stock: getStock(item),
        min_stock: getMinStock(item),
        max_stock: getMaxStock(item),
        suggested_quantity: qty,
        quantity_to_buy: qty,
        unit_cost: cost,
        estimated_cost: cost,
        total_cost: qty * cost,
        created_at: new Date().toISOString(),
      };
    });

    const { error: itemsError } = await supabase
      .from("purchase_order_items")
      .insert(rows);

    if (itemsError) {
      throw new Error("Orden creada, pero error creando items: " + itemsError.message);
    }

    createdItems += rows.length;
  }

  return {
    ok: true,
    createdOrders,
    createdItems,
    message: `Se crearon ${createdOrders} órdenes y ${createdItems} items de compra.`,
  };
}

export async function ejecutarSistemaAutomatico({
  trigger,
  referencia,
}: {
  trigger: AutoTrigger;
  referencia?: string;
}) {
  const result = {
    ok: true,
    trigger,
    referencia: referencia || null,
    compras: {
      createdOrders: 0,
      createdItems: 0,
      message: "",
    },
    alertas: [] as string[],
  };

  try {
    const compras = await generarComprasAutomaticasPorStock({ referencia });
    result.compras = {
      createdOrders: compras.createdOrders,
      createdItems: compras.createdItems,
      message: compras.message,
    };

    const { data: ventas } = await supabase
      .from("sales")
      .select("total, subtotal, profit, balance, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    const ventasList = ventas || [];
    const total = ventasList.reduce((acc: number, v: any) => acc + n(v.total ?? v.subtotal), 0);
    const profit = ventasList.reduce((acc: number, v: any) => acc + n(v.profit), 0);
    const margen = total > 0 ? (profit / total) * 100 : 0;
    const cobrar = ventasList.reduce((acc: number, v: any) => acc + n(v.balance), 0);

    if (margen > 0 && margen < 20) {
      result.alertas.push(`Margen bajo detectado: ${margen.toFixed(2)}%`);
    }

    if (cobrar > 0) {
      result.alertas.push(`Cuentas por cobrar activas: RD$${cobrar.toFixed(2)}`);
    }

    const { data: inventory } = await supabase.from("inventory").select("*");
    const critical = (inventory || []).filter((item: any) => getStock(item) <= getMinStock(item));

    if (critical.length > 0) {
      result.alertas.push(`Stock crítico: ${critical.length} materiales`);
    }

    return result;
  } catch (error: any) {
    console.error("ERROR SISTEMA AUTOMÁTICO:", error);
    return {
      ...result,
      ok: false,
      error: error?.message || "Error desconocido",
    };
  }
}
