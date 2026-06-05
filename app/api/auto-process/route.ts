import { NextResponse } from "next/server";
import { getServiceSupabase, requireApiSession } from "@/lib/security/api-guard";

function isValidCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("x-cron-secret") === secret);
}

export async function GET(request: Request) {
  try {
    const session = isValidCronRequest(request)
      ? { ok: true as const, supabase: getServiceSupabase() }
      : await requireApiSession(request, ["compras", "inventario"]);

    if (!session.ok) return session.response;
    const supabase = session.supabase;

    const { data: products, error: productError } = await supabase
      .from("inventory")
      .select("*")
      .lte("stock", 10);

    if (productError) throw productError;

    if (!products || products.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No hay productos con stock critico.",
        compras: { createdOrders: 0 },
      });
    }

    let createdOrders = 0;
    const errores: string[] = [];

    for (const product of products) {
      try {
        const orderCode = `OC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const cantidadSugerida = 50;
        const totalEstimado = (product.cost_price || product.purchase_cost || 0) * cantidadSugerida;

        const { error: orderError } = await supabase.from("purchase_orders").insert([
          {
            code: orderCode,
            status: "pending",
            total: totalEstimado,
            notes: `Auto: Stock critico (${product.name})`,
            created_at: new Date().toISOString(),
          },
        ]);

        if (orderError) {
          errores.push(orderError.message);
          continue;
        }

        createdOrders++;
      } catch (err: any) {
        errores.push(err?.message || "Error creando orden automatica.");
      }
    }

    return NextResponse.json({
      ok: true,
      trigger: "auto-system",
      productos_criticos: products.length,
      compras: { createdOrders },
      errores,
      mensaje: "Sistema automatico ejecutado.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Error en auto-process." },
      { status: 500 }
    );
  }
}
