import { supabase } from "@/lib/supabase";

export async function convertQuoteToSale(quoteId: string) {
  if (!quoteId) {
    throw new Error("Falta el ID de la cotización.");
  }

  const { data, error } = await supabase.rpc("convert_quote_to_sale", {
    p_quote_id: quoteId,
  });

  if (error) throw error;

  return data as string;
}
