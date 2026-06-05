import InventarioProClient from "@/components/InventarioProClient";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DbProduct = {
  id: string;
  code?: string | null;
  name?: string | null;
  product_name?: string | null;
  material?: string | null;
  category?: string | null;
  subcategory?: string | null;
  grupo?: string | null;
  subgrupo?: string | null;
  unit?: string | null;
  unidad?: string | null;
  stock?: number | null;
  quantity?: number | null;
  sale_price?: number | null;
  price?: number | null;
  precio_venta?: number | null;
  venta?: number | null;
  unit_price?: number | null;
  purchase_cost?: number | null;
  cost?: number | null;
  cost_price?: number | null;
  unit_cost?: number | null;
  costo_prom?: number | null;
  costo_promedio?: number | null;
  min_stock?: number | null;
  minimum_stock?: number | null;
  minimo?: number | null;
  supplier?: string | null;
  proveedor?: string | null;
  location?: string | null;
  status?: string | null;
  notes?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export default async function InventarioPage() {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .or("status.is.null,status.eq.active,status.eq.activo")
    .order("name", { ascending: true });

  return (
    <InventarioProClient
      initialProducts={(data || []) as DbProduct[]}
      initialDebug={error ? error.message : `Productos cargados: ${data?.length || 0}`}
    />
  );
}
