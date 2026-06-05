import { supabase } from "./supabase";

export async function getAlertasStockBajo() {
const { data, error } = await supabase
.from("inventory")
.select("*")
.lte("stock", 10); // mínimo

if (error) throw error;

return data;
}
