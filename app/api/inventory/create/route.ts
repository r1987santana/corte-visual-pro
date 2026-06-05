import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/security/api-guard";

export async function POST(req: Request) {
  try {
    const session = await requireApiSession(req, "inventario");
    if (!session.ok) return session.response;
    const supabase = session.supabase;

    const body = await req.json();

    const name =
      body.name ??
      body.product_name ??
      body.material ??
      "Producto sin nombre";

    const costValue = Number(
      body.unit_cost ?? body.purchase_cost ?? body.cost_price ?? 0
    );

    const saleValue = Number(body.sale_price ?? body.price ?? 0);
    const stockValue = Number(body.stock ?? body.quantity ?? 0);

    const item = {
      code: body.code ?? null,

      name,
      product_name: name,
      material: name,

      category: body.category ?? body.group ?? null,
      subcategory: body.subcategory ?? null,
      unit: body.unit ?? "Unidad",

      stock: stockValue,
      quantity: stockValue,
      min_stock: Number(body.min_stock ?? 0),

      unit_cost: costValue,
      purchase_cost: costValue,
      cost_price: costValue,

      sale_price: saleValue,
      price: saleValue,

      status: "active",
    };

    const { data, error } = await supabase
      .from("inventory")
      .insert(item)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message ?? "Error desconocido",
      },
      { status: 500 }
    );
  }
}
