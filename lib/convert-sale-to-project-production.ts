import { supabase } from "@/lib/supabase";

export type SaleToProjectResult = {
  project_id?: string;
  production_order_id?: string;
  project_code?: string;
  production_order_code?: string;
  modules_created?: number;
  parts_created?: number;
  already_converted?: boolean;
};

export async function convertSaleToProjectProduction(
  saleId: string
): Promise<SaleToProjectResult> {
  if (!saleId) {
    throw new Error("Falta el ID de la venta.");
  }

  const { data, error } = await supabase.rpc(
    "convert_sale_to_project_production",
    { p_sale_id: saleId }
  );

  if (error) throw error;

  return data as SaleToProjectResult;
}
