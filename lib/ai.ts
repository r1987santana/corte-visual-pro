import { supabase } from "./supabase";

export async function recomendarCompras() {
const { data } = await supabase.from("inventory").select("*");

return (data || [])
.filter((item) => item.stock < 10)
.map((item) => ({
producto: item.name,
sugerencia: "Comprar más stock",
}));
}
