
import { supabase } from "@/lib/supabase";

async function fase33SyncProductionStatus(
  orderCode: string,
  cncStatus: string
) {
  try {
    if (!orderCode) return;

    const statusMap: Record<string, string> = {
      pendiente_cnc: "pending",
      optimizado_cnc: "optimized",
      en_corte: "cutting",
      cortado: "cut",
      completado: "completed",
      pausado: "paused",
      rechazado: "rejected",
    };

    const productionStatus =
      statusMap[cncStatus] || cncStatus || "pending";

    const { error } = await supabase
      .from("production_orders")
      .update({
        status: productionStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("code", orderCode);

    if (error) {
      console.error("FASE 33 sync error:", error);
      return;
    }

    console.log(`✅ Producción actualizada: ${orderCode} -> ${productionStatus}`);
  } catch (error) {
    console.error("FASE 33 exception:", error);
  }
}

// Dentro de fase32RegisterCncAudit():
// await fase33SyncProductionStatus(ref, nextStatus);
