export type ItemType =
  | "material"
  | "mano_obra"
  | "instalacion"
  | "diseno"
  | "otro";

export type InventoryProduct = {
  id: string;
  code: string | null;
  name: string | null;
  material: string | null;
  grupo: string | null;
  subgrupo: string | null;
  category: string | null;
  subcategory: string | null;
  stock: number | null;
  minimo: number | null;
  unit_cost: number | null;
  unit_price: number | null;
  cost_price: number | null;
  sale_price: number | null;
  medidas: string | null;
};

export type ProjectItem = {
  id: string;
  item_type: ItemType;
  product_id: string | null;
  product_name: string;
  description: string;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  stock_available: number;
};

export type ProjectSale = {
  id: string;
  invoice_number: string | null;
  project_code: string | null;
  project_name: string | null;
  project_type: string | null;
  client_name: string | null;
  client_phone: string | null;
  status: string | null;
  production_status: string | null;
  total: number | null;
  amount_paid: number | null;
  balance: number | null;
  created_at: string;
};

export type DbProjectItem = {
  id: string;
  item_type: string;
  product_name: string;
  description: string | null;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  total_cost: number;
  total_price: number;
};