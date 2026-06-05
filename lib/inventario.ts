import { getInventoryById, updateData } from "./db";
import { supabase } from "./supabase";

export async function applyPurchaseToInventory(
productId: string,
cantidad: number,
precioCompra: number
) {
const producto = await getInventoryById(productId);

const stock = producto.stock || 0;
const cost = producto.cost || 0;

const newStock = stock + cantidad;

const newCost =
(stock * cost + cantidad * precioCompra) / newStock;

await updateData("inventory", productId, {
stock: newStock,
cost: newCost,
});
}

export async function applySaleToInventory(
productId: string,
cantidad: number
) {
const producto = await getInventoryById(productId);

if (producto.stock < cantidad) {
throw new Error("Stock insuficiente");
}

await updateData("inventory", productId, {
stock: producto.stock - cantidad,
});
}

function num(value: any) {
const n = Number(value || 0);
return Number.isFinite(n) ? n : 0;
}

function itemInventoryId(item: any) {
return (
item.inventory_item_id ||
item.inventory_id ||
item.material_id ||
item.product_id ||
item.part_id ||
null
);
}

function itemName(item: any) {
return item.material_name || item.part_name || item.name || "Material";
}

export async function terminarProduccion(orderId: string) {
if (!orderId) {
throw new Error("Orden de produccion invalida");
}

const { data: order, error: orderError } = await supabase
.from("production_orders")
.select("*")
.eq("id", orderId)
.maybeSingle();

if (orderError) throw orderError;
if (!order) throw new Error("Orden de produccion no encontrada");

const { data: items, error: itemsError } = await supabase
.from("production_order_items")
.select("*")
.eq("production_order_id", orderId);

if (itemsError) throw itemsError;
if (!items || items.length === 0) {
throw new Error("La orden no tiene materiales para consumir");
}

const checks = await Promise.all(
items.map(async (item: any) => {
const inventoryId = itemInventoryId(item);
if (!inventoryId) {
throw new Error(`Material sin inventario vinculado: ${itemName(item)}`);
}

const producto = await getInventoryById(inventoryId);
const cantidad = num(item.quantity || item.cantidad || 0);

if (cantidad <= 0) {
throw new Error(`Cantidad invalida para ${itemName(item)}`);
}

const stockActual = num(producto.stock ?? producto.quantity ?? 0);
if (stockActual < cantidad) {
throw new Error(
`Stock insuficiente para ${producto.name || producto.product_name || itemName(item)}. Disponible: ${stockActual}, requerido: ${cantidad}`
);
}

const unitCost = num(
item.unit_cost ??
producto.costo_promedio ??
producto.unit_cost ??
producto.purchase_cost ??
producto.cost_price ??
producto.cost ??
0
);

return {
item,
producto,
inventoryId,
cantidad,
stockActual,
stockFinal: stockActual - cantidad,
totalCost: num(item.total_cost) || unitCost * cantidad,
};
})
);

for (const row of checks) {
const payload: Record<string, any> = {};

if (row.producto.stock !== undefined) payload.stock = row.stockFinal;
if (row.producto.quantity !== undefined) payload.quantity = row.stockFinal;
if (Object.keys(payload).length === 0) payload.stock = row.stockFinal;

await updateData("inventory", row.inventoryId, payload);

await supabase.from("inventory_movements").insert({
item_id: row.inventoryId,
inventory_id: row.inventoryId,
product_id: row.inventoryId,
type: "salida",
movement_type: "salida",
origin: "produccion",
reason: "produccion",
quantity: row.cantidad,
stock_before: row.stockActual,
stock_after: row.stockFinal,
note: `Consumo por orden de produccion ${order.order_code || order.code || orderId}`,
});
}

const costoTotal = checks.reduce((acc, row) => acc + row.totalCost, 0);

const { error: updateOrderError } = await supabase
.from("production_orders")
.update({
status: "terminado",
total_cost: costoTotal,
updated_at: new Date().toISOString(),
})
.eq("id", orderId);

if (updateOrderError) throw updateOrderError;

return costoTotal;
}
