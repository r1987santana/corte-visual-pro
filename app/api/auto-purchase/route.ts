import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/security/api-guard";

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request, "compras");
    if (!session.ok) return session.response;
    const supabase = session.supabase;

    const { data: existingOrder } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("status", "pendiente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingOrder) {
      return NextResponse.json({
        success: false,
        message: "Ya existe una orden pendiente.",
        orderNumber: existingOrder.order_number,
      });
    }

    const { data: products, error } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (error) throw error;

    const lowProducts = (products || []).filter((p) => {
      const stock = Number(p.stock || 0);
      const min = Number(p.min_stock || 0);
      const max = Number(p.max_stock || 0);

      return min > 0 && stock <= min && max > stock;
    });

    if (lowProducts.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No hay productos bajos.",
      });
    }

    const orderNumber = "PO-" + Date.now();

    let total = 0;
    let whatsappMessage =
      "Hola, necesito cotización para la siguiente orden:\n\n";

    whatsappMessage += `Orden: ${orderNumber}\n\n`;

    const { data: order, error: orderError } = await supabase
      .from("purchase_orders")
      .insert([
        {
          order_number: orderNumber,
          supplier_name: "Proveedor general",
          status: "pendiente",
          total_estimated: 0,
          whatsapp_message: "",
        },
      ])
      .select()
      .single();

    if (orderError) throw orderError;

    const items = lowProducts.map((p) => {
      const stock = Number(p.stock || 0);
      const max = Number(p.max_stock || 0);
      const buy = Math.max(max - stock, 0);
      const cost = buy * Number(p.last_cost || 0);

      total += cost;

      whatsappMessage += `• ${p.name}: ${buy} ${p.unit || ""}\n`;

      return {
        purchase_order_id: order.id,
        product_id: p.id,
        product_name: p.name,
        group_name: p.group_name,
        subgroup_name: p.subgroup_name,
        unit: p.unit,
        current_stock: stock,
        min_stock: Number(p.min_stock || 0),
        max_stock: max,
        quantity_to_buy: buy,
        estimated_cost: cost,
      };
    });

    whatsappMessage += "\nGracias.";

    const { error: itemError } = await supabase
      .from("purchase_order_items")
      .insert(items);

    if (itemError) throw itemError;

    const { error: updateError } = await supabase
      .from("purchase_orders")
      .update({
        total_estimated: total,
        whatsapp_message: whatsappMessage,
      })
      .eq("id", order.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      orderNumber,
      message: whatsappMessage,
      total,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
