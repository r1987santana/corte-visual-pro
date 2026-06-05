import { supabase } from "./supabase";

export async function getDashboardData() {
const { data, error } = await supabase
.from("sales")
.select("*");

if (error) throw error;

const totalIngreso = data.reduce((a, b) => a + (b.ingreso || 0), 0);
const totalGanancia = data.reduce((a, b) => a + (b.ganancia || 0), 0);

return {
totalIngreso,
totalGanancia,
totalVentas: data.length,
};
}
