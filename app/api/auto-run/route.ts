import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/security/api-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireApiSession(request, "compras");
  if (!session.ok) return session.response;

  return NextResponse.json({
    ok: true,
    message: "API auto-run activa. Usa POST para ejecutar la automática total.",
  });
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession(request, "compras");
    if (!session.ok) return session.response;

    const supabase = session.supabase;

    const { data: inventory, error: inventoryError } = await supabase
      .from("inventory")
      .select("*");

    if (inventoryError) {
      return NextResponse.json(
        {
          ok: false,
          error: inventoryError.message,
        },
        { status: 500 }
      );
    }

    const productosCriticos = (inventory || []).filter((item: any) => {
      const stock = Number(item.stock || item.quantity || 0);
      const minimo = Number(item.min_stock || item.minimum_stock || item.min || 0);
      return minimo > 0 && stock <= minimo;
    });

    let comprasCreadas = 0;

    for (const item of productosCriticos) {
      const stock = Number(item.stock || item.quantity || 0);
      const minimo = Number(item.min_stock || item.minimum_stock || item.min || 0);
      const cantidad = Math.max(minimo * 2 - stock, minimo);

      const { error } = await supabase.from("purchase_orders").insert({
        product_id: item.id,
        material_id: item.id,
        quantity: cantidad,
        status: "pendiente",
        auto_generated: true,
        created_at: new Date().toISOString(),
      });

      if (!error) comprasCreadas++;
    }

    return NextResponse.json({
      ok: true,
      message: "Automática total ejecutada correctamente",
      productosCriticos: productosCriticos.length,
      comprasCreadas,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Error desconocido en auto-run",
      },
      { status: 500 }
    );
  }
}
