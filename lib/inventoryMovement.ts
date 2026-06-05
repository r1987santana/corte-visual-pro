import { supabase } from "@/lib/supabase";

type Origin =
  | "inventario_manual"
  | "compra"
  | "venta"
  | "produccion"
  | "consumo_interno"
  | "ajuste";

export async function registerInventoryMovement({
  itemId,
  quantity,
  origin,
  note,
}: {
  itemId: string;
  quantity: number;
  origin: Origin;
  note?: string;
}) {
  if (!itemId) throw new Error("No hay artículo seleccionado");
  if (!quantity || quantity === 0) throw new Error("Cantidad inválida");

  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    throw new Error("Artículo no encontrado en inventario");
  }

  const stockBefore = Number(item.stock || 0);
  const stockAfter = stockBefore + Number(quantity || 0);

  if (stockAfter < 0) {
    throw new Error(`Stock insuficiente para ${item.name}`);
  }

  const movementType = quantity > 0 ? "entrada" : "salida";
  const finalNote = note || `Movimiento por ${origin}`;

  const { error: updateError } = await supabase
    .from("inventory_items")
    .update({ stock: stockAfter })
    .eq("id", itemId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: movementError } = await supabase
    .from("inventory_movements")
    .insert({
      item_id: itemId,
      type: movementType,
      movement_type: movementType,
      origin,
      reason: origin,
      quantity: Math.abs(Number(quantity || 0)),
      stock_before: stockBefore,
      stock_after: stockAfter,
      note: finalNote,
    });

  if (movementError) {
    throw new Error(movementError.message);
  }

  return {
    item,
    stockBefore,
    stockAfter,
  };
}