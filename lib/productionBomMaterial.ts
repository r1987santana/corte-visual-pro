import {
  desiredProductionMaterialToken,
  productionMaterialColorToken,
  productionMaterialKindToken,
  productionMaterialTokensCompatible,
} from "@/lib/productionMaterialPlan";

export type InventoryProduct = {
  id: string;
  code?: string | null;
  name?: string | null;
  product_name?: string | null;
  material?: string | null;
  description?: string | null;
  descripcion?: string | null;
  sku?: string | null;
  category?: string | null;
  subcategory?: string | null;
  unit?: string | null;
  unidad?: string | null;
  stock?: number | null;
  quantity?: number | null;
  reserved_stock?: number | null;
  stock_reserved?: number | null;
  sheet_width_mm?: number | null;
  sheet_height_mm?: number | null;
  ancho_mm?: number | null;
  largo_mm?: number | null;
  cost_price?: number | null;
  unit_cost?: number | null;
  purchase_cost?: number | null;
  sale_price?: number | null;
  unit_price?: number | null;
};

export type ProductionItem = {
  id: string;
  inventory_item_id?: string | null;
  product_id?: string | null;
  material_id?: string | null;
  production_order_id?: string | null;
  order_id?: string | null;
  name: string;
  code: string;
  product_name?: string | null;
  item_name?: string | null;
  material?: string | null;
  material_name?: string | null;
  category: string;
  unit: string;
  stock: number;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  source: "manual" | "bom";
  part_name?: string | null;
  module_name?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
  thickness_mm?: number | null;
  edge_top?: boolean | null;
  edge_bottom?: boolean | null;
  edge_left?: boolean | null;
  edge_right?: boolean | null;
  edge_front?: boolean | null;
  edge_back?: boolean | null;
  allow_rotate?: boolean | null;
};

export type RequisitionLine = {
  key: string;
  inventoryId: string | null;
  name: string;
  unit: string;
  qty: number;
  stock: number;
  reservedQty: number;
  missingQty: number;
  note: string;
};

export const num = (value: number | null | undefined) => Number(value || 0);

export const productName = (product: InventoryProduct) =>
  product.name || product.product_name || product.material || product.code || "Producto";

export const productStock = (product: InventoryProduct) => num(product.stock ?? product.quantity);

export const productCost = (product: InventoryProduct) =>
  num(product.cost_price ?? product.unit_cost ?? product.purchase_cost);

export const productUnit = (product: InventoryProduct) => product.unit || product.unidad || "Unidad";

export function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function getRealInventoryId(item: ProductionItem) {
  if (isValidUuid(item.inventory_item_id)) return item.inventory_item_id;
  if (isValidUuid(item.product_id)) return item.product_id;
  if (isValidUuid(item.material_id)) return item.material_id;
  if (isValidUuid(item.id)) return item.id;
  return "";
}

export function appendNote(base: string, extra: string) {
  const current = String(base || "").trim();
  return current ? `${current}\n${extra}` : extra;
}

export function cleanText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function materialColorTokenFromText(value: unknown) {
  return productionMaterialColorToken(value);
}

function includesAnyText(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function productColorMatchesToken(productToken: string, desiredToken: string) {
  return productionMaterialTokensCompatible(productToken, desiredToken);
}

function isShelfStructurePartText(text: string) {
  return includesAnyText(text, [
    "lateral",
    "tapa superior",
    "tapa inferior",
    "techo",
    "piso",
    "fondo",
  ]);
}

function isShelfWhitePartText(text: string) {
  if (text.includes("entrepano")) return true;
  if (text.includes("repisa") && !isShelfStructurePartText(text)) return true;
  return false;
}

function isTvBaseWoodPartText(text: string) {
  return includesAnyText(text, [
    "lateral",
    "piso",
    "techo",
    "frente gaveta",
    "division interna",
    "divisor",
    "fondo",
    "liston",
    "faja",
  ]);
}

function productColorToken(product?: InventoryProduct | null) {
  if (!product) return "";
  return materialColorTokenFromText(
    [
      productName(product),
      product.material,
      product.name,
      product.product_name,
      product.description,
      product.descripcion,
      product.code,
      product.sku,
    ].join(" "),
  );
}

function itemDesiredMaterialToken(item: ProductionItem) {
  return desiredProductionMaterialToken(item);
}

function productMatchesDesiredToken(product: InventoryProduct, token: string) {
  if (!token) return true;
  return productColorMatchesToken(productColorToken(product), token);
}

export function productReserved(product?: InventoryProduct | null) {
  return num(product?.reserved_stock ?? product?.stock_reserved);
}

export function productAvailable(product?: InventoryProduct | null) {
  return Math.max(0, productStock(product || ({} as InventoryProduct)) - productReserved(product));
}

function itemTechnicalName(item: ProductionItem) {
  return [
    item.name,
    item.product_name,
    item.item_name,
    item.material_name,
    item.material,
    item.category,
    item.module_name,
    item.part_name,
    item.code,
  ]
    .filter(Boolean)
    .join(" ");
}

function isBoardLike(item: ProductionItem) {
  const text = cleanText(itemTechnicalName(item));
  const hasDims = Number(item.width_mm || 0) > 0 && Number(item.height_mm || 0) > 0;
  if (isEdgeLike(item)) return false;
  if (productionMaterialKindToken(text) === "board") return true;
  if (hasDims && !/(bisagra|corredera|tornillo|minifix|soporte|herraje|tirador|broca|tarugo|pegamento|cola)/.test(text)) {
    return true;
  }
  return false;
}

function isEdgeLike(item: ProductionItem) {
  return productionMaterialKindToken(itemTechnicalName(item)) === "edge";
}

function inventoryProductSearchText(product?: InventoryProduct | null) {
  if (!product) return "";
  return cleanText(
    [
      productName(product),
      product.material,
      product.name,
      product.product_name,
      product.description,
      product.descripcion,
      product.code,
      product.sku,
      product.category,
      product.subcategory,
      product.unit,
      product.unidad,
    ].join(" "),
  );
}

function isInventoryBoardProduct(product?: InventoryProduct | null) {
  const text = inventoryProductSearchText(product);
  const hasSheetSize =
    Number(product?.sheet_width_mm || product?.ancho_mm || 0) > 0 ||
    Number(product?.sheet_height_mm || product?.largo_mm || 0) > 0;
  const badWords = [
    "canto",
    "pvc",
    "bisagra",
    "corredera",
    "tornillo",
    "minifix",
    "soporte",
    "herrajes",
    "herraje",
    "tirador",
  ];

  if (badWords.some((word) => text.includes(word))) return false;
  return hasSheetSize || /(melamina|tablero|mdf|plywood|hoja)/.test(text);
}

function isInventoryEdgeProduct(product?: InventoryProduct | null) {
  const text = inventoryProductSearchText(product);
  return text.includes("canto") || text.includes("pvc");
}

function sheetSizeForMaterial(name: string, product?: InventoryProduct | null) {
  const text = cleanText(name);
  const explicitW = num(product?.sheet_width_mm ?? product?.ancho_mm);
  const explicitH = num(product?.sheet_height_mm ?? product?.largo_mm);

  if (explicitW > 0 && explicitH > 0) {
    return { width: explicitW, height: explicitH };
  }

  if (text.includes("7x8") || text.includes("7 x 8")) {
    return { width: 2134, height: 2440 };
  }

  return { width: 1220, height: 2440 };
}

function roundQty(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(Number(value || 0) * factor) / factor;
}

export function itemMaterialName(item: ProductionItem) {
  return (
    item.material_name ||
    item.material ||
    item.item_name ||
    item.product_name ||
    item.name ||
    "Material sin identificar"
  );
}

function inventoryAliases(product: InventoryProduct) {
  return [
    productName(product),
    product.material,
    product.name,
    product.product_name,
    product.description,
    product.descripcion,
    product.code,
    product.sku,
  ]
    .filter(Boolean)
    .map((value) => cleanText(value));
}

export function findInventoryProductForItem(item: ProductionItem, products: InventoryProduct[]) {
  const desiredToken = itemDesiredMaterialToken(item);
  const wantsBoard = isBoardLike(item);
  const wantsEdge = isEdgeLike(item);
  const matchesKind = (product: InventoryProduct) => {
    if (wantsBoard) return isInventoryBoardProduct(product);
    if (wantsEdge) return isInventoryEdgeProduct(product);
    return true;
  };
  const realId = getRealInventoryId(item);
  if (realId) {
    const byId = products.find((product) => String(product.id) === String(realId));
    if (byId && productMatchesDesiredToken(byId, desiredToken) && matchesKind(byId)) return byId;
  }

  const exactCandidates = [
    item.material_name,
    item.material,
    item.item_name,
    item.product_name,
    item.name,
    item.code,
  ]
    .filter(Boolean)
    .map((value) => cleanText(value));

  const colorCandidates = desiredToken
    ? products.filter((product) => productMatchesDesiredToken(product, desiredToken))
    : products;
  const typedCandidates = colorCandidates.filter(matchesKind);
  const candidates = typedCandidates.length ? typedCandidates : colorCandidates;

  for (const candidate of exactCandidates) {
    const exact = candidates.find((product) => inventoryAliases(product).includes(candidate));
    if (exact) return exact;
  }

  const fuzzyCandidates = exactCandidates.filter((candidate) => candidate.length >= 8);
  for (const candidate of fuzzyCandidates) {
    const fuzzy = candidates.find((product) =>
      inventoryAliases(product).some(
        (alias) => alias.length >= 8 && (alias.includes(candidate) || candidate.includes(alias)),
      ),
    );
    if (fuzzy) return fuzzy;
  }

  if (desiredToken && wantsBoard) {
    const boardMatch = candidates.find(
      (product) => isInventoryBoardProduct(product) && cleanText(productName(product)).includes("melamina"),
    );
    if (boardMatch) return boardMatch;
  }

  return null;
}

export function buildRequisitionLines(items: ProductionItem[], products: InventoryProduct[]): RequisitionLine[] {
  const byId = new Map(products.map((product) => [String(product.id), product]));
  const grouped = new Map<string, RequisitionLine & { areaM2?: number; rawQty?: number }>();

  for (const item of items) {
    const inventoryId = getRealInventoryId(item);
    const product = findInventoryProductForItem(item, products) || (inventoryId ? byId.get(inventoryId) : null);
    const linkedInventoryId = product?.id || inventoryId || null;
    const materialName = product ? productName(product) : itemMaterialName(item);
    const itemForClass = { ...item, name: `${item.name} ${materialName}` };
    const boardLine = isBoardLike(itemForClass);
    const edgeLine = isEdgeLike(itemForClass);
    const keyBase = `${linkedInventoryId || cleanText(materialName)}|${boardLine ? "plancha" : edgeLine ? "canto" : "unidad"}`;
    const current =
      grouped.get(keyBase) ||
      {
        key: keyBase,
        inventoryId: linkedInventoryId,
        name: materialName,
        unit: item.unit || productUnit(product || ({} as InventoryProduct)),
        qty: 0,
        stock: product ? productStock(product) : item.stock,
        reservedQty: 0,
        missingQty: 0,
        note: "",
        areaM2: 0,
        rawQty: 0,
      };

    if (boardLine) {
      const sheet = sheetSizeForMaterial(materialName, product);
      const sheetArea = Math.max(0.0001, (sheet.width * sheet.height) / 1_000_000);
      const itemArea =
        (Number(item.width_mm || 0) * Number(item.height_mm || 0) * Number(item.quantity || 1)) /
        1_000_000;
      current.areaM2 = Number(current.areaM2 || 0) + itemArea;
      current.rawQty = Number(current.rawQty || 0) + Number(item.quantity || 1);
      current.qty = Math.max(1, Math.ceil((Number(current.areaM2 || 0) * 1.15) / sheetArea));
      current.unit = "plancha";
      current.note = `Plancha estimada por area BOM (${roundQty(Number(current.areaM2 || 0), 3)} m2 + 15% merma). Formato ${sheet.height} x ${sheet.width} mm.`;
    } else if (edgeLine) {
      current.rawQty = Number(current.rawQty || 0) + Number(item.quantity || 0);
      current.qty = roundQty(Number(current.rawQty || 0) * 1.1, 1);
      current.unit = "metro";
      current.note = "Canto PVC calculado desde cantos del BOM + 10% merma.";
    } else {
      current.qty = roundQty(current.qty + Number(item.quantity || 0), 2);
      current.unit = item.unit || current.unit || "unidad";
      current.note = "Herraje/material consolidado desde BOM de produccion.";
    }

    grouped.set(keyBase, current);
  }

  return Array.from(grouped.values())
    .map((line) => ({
      key: line.key,
      inventoryId: line.inventoryId,
      name: line.name,
      unit: line.unit,
      qty: line.qty,
      stock: line.stock,
      reservedQty: 0,
      missingQty: line.qty,
      note: line.note,
    }))
    .filter((line) => line.qty > 0);
}
