import { InventoryProduct, ItemType, ProjectItem } from "./types";

export function money(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

export function productName(p: InventoryProduct) {
  return p.name || p.material || p.code || "Producto sin nombre";
}

export function productCost(p: InventoryProduct) {
  return Number(p.unit_cost || p.cost_price || 0);
}

export function productPrice(p: InventoryProduct) {
  return Number(p.unit_price || p.sale_price || 0);
}

export function productStock(p: InventoryProduct) {
  return Number(p.stock || 0);
}

export function createManualItem(type: ItemType): ProjectItem {
  return {
    id: crypto.randomUUID(),
    item_type: type,
    product_id: null,
    product_name:
      type === "mano_obra"
        ? "Mano de obra fabricación"
        : type === "instalacion"
        ? "Instalación"
        : type === "diseno"
        ? "Diseño / planos"
        : "Otro concepto",
    description: "",
    quantity: 1,
    unit_cost: 0,
    unit_price: 0,
    stock_available: 0,
  };
}