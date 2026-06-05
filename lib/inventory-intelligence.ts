import { supabase } from "./supabase";

export async function getInventoryAlerts() {
  const { data, error } = await supabase
    .from("products")
    .select("*");

  if (error) throw error;

  const alerts = data.map((p) => {
    const stock = Number(p.stock || 0);
    const min = Number(p.min_stock || 0);
    const max = Number(p.max_stock || 0);

    let status = "ok";

    if (stock <= 0) status = "critical";
    else if (stock <= min) status = "low";

    const suggestedBuy =
      max > 0 ? Math.max(max - stock, 0) : 0;

    return {
      ...p,
      stock,
      min,
      max,
      status,
      suggestedBuy,
    };
  });

  return alerts;
}