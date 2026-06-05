import { supabase } from "./supabase";

export async function getDashboardAdvanced() {
const { data, error } = await supabase
.from("sales")
.select("*");

if (error) throw error;

// 📊 Totales
const totalIngreso = data.reduce((a, b) => a + (b.ingreso || 0), 0);
const totalGanancia = data.reduce((a, b) => a + (b.ganancia || 0), 0);

// 📦 Top productos
const productos: any = {};
data.forEach((item) => {
if (!productos[item.product_id]) {
productos[item.product_id] = 0;
}
productos[item.product_id] += item.quantity;
});

const topProductos = Object.entries(productos)
.map(([id, qty]) => ({ id, qty }))
.sort((a: any, b: any) => b.qty - a.qty)
.slice(0, 5);

// 📉 Pérdidas
const perdidas = data.filter((item) => item.ganancia < 0);

return {
totalIngreso,
totalGanancia,
totalVentas: data.length,
topProductos,
perdidas,
raw: data,
};
}
