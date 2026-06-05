import { supabase } from "@/lib/supabase";

export async function generarOrdenAutomatica() {
  const { data: productos, error } = await supabase
    .from("products")
    .select("*");

  if (error) throw error;

  const bajos = productos.filter(
    (p) => p.stock <= p.min_stock
  );

  if (bajos.length === 0) {
    alert("No hay productos bajos");
    return;
  }

  const orderNumber = "PO-" + Date.now();

  // Crear orden
  const { data: order, error: orderError } = await supabase
    .from("purchase_orders")
    .insert({
      order_number: orderNumber,
      supplier_name: "Proveedor general",
      status: "pendiente",
      total_estimated: 0,
    })
    .select()
    .single();

  if (orderError) throw orderError;

  let total = 0;
  let mensaje = `Hola, necesito cotización para la siguiente orden:\n\nOrden: ${orderNumber}\n\n`;

  for (const p of bajos) {
    const cantidad = p.max_stock - p.stock;

    await supabase.from("purchase_order_items").insert({
      purchase_order_id: order.id,
      product_id: p.id,
      product_name: p.name,
      group_name: p.group_name,
      subgroup_name: p.subgroup_name,
      unit: p.unit,
      current_stock: p.stock,
      min_stock: p.min_stock,
      max_stock: p.max_stock,
      quantity_to_buy: cantidad,
      estimated_cost: 0,
    });

    mensaje += `- ${p.name}: ${cantidad} ${p.unit}\n`;
  }

  mensaje += `\nGracias.`;

  // Guardar mensaje
  await supabase
    .from("purchase_orders")
    .update({
      whatsapp_message: mensaje,
    })
    .eq("id", order.id);

  return {
    orderId: order.id,
    message: mensaje,
  };
}