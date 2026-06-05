import { supabase } from "@/lib/supabase";

export async function crearFacturaDesdeVenta({
  cliente,
  telefono,
  carrito,
  metodo_pago,
  tipo_pago,
  pagado,
  referencia,
}: any) {
  const numero = "FAC-" + Date.now();

  const subtotal = carrito.reduce(
    (acc: number, i: any) => acc + i.price * i.qty,
    0
  );

  const costo = carrito.reduce(
    (acc: number, i: any) => acc + (i.cost || 0) * i.qty,
    0
  );

  const utilidad = subtotal - costo;
  const balance = subtotal - pagado;

  const { data: factura } = await supabase
    .from("facturas")
    .insert({
      numero,
      cliente,
      telefono,
      subtotal,
      costo,
      utilidad,
      pagado,
      balance,
      metodo_pago,
      tipo_pago,
      referencia_venta: referencia,
      estado: balance > 0 ? "pendiente" : "pagada",
    })
    .select()
    .single();

  if (!factura) return;

  const items = carrito.map((i: any) => ({
    factura_id: factura.id,
    producto: i.name,
    codigo: i.code,
    cantidad: i.qty,
    precio: i.price,
    costo: i.cost,
    total: i.price * i.qty,
  }));

  await supabase.from("factura_items").insert(items);

  if (pagado > 0) {
    await supabase.from("pagos").insert({
      factura_id: factura.id,
      monto: pagado,
      metodo: metodo_pago,
      nota: "Pago inicial",
    });
  }

  return factura;
}