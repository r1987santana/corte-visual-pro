import { num, uid } from "@/lib/cutShared";

export type ProductionCutPiece = {
  id: string;
  original_id?: string;
  piece_name: string;
  module_name?: string;
  material_name?: string;
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
  quantity: number;
  edge_front: boolean;
  edge_back: boolean;
  edge_left: boolean;
  edge_right: boolean;
  can_rotate: boolean;
};

function textValue(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isPanelLike(item: any) {
  const nameText = textValue([
    item.part_name,
    item.piece_name,
    item.product_name,
    item.nombre_producto,
    item.material_name,
  ].filter(Boolean).join(" "));

  const fullText = textValue([
    item.part_name,
    item.piece_name,
    item.product_name,
    item.nombre_producto,
    item.material_name,
    item.module_name,
    item.category,
    item.source,
    item.unit,
  ].filter(Boolean).join(" "));

  const inventoryMaterialWords = [
    "melamina",
    "mdf",
    "tablero",
    "hoja",
    "plywood",
    "canto pvc",
    "pvc",
    "canto",
    "bisagra",
    "corredera",
    "tornillo",
    "minifix",
    "perno",
    "tarugo",
    "soporte",
    "colgador",
    "tirador",
    "pata",
    "silicon",
    "adhesivo",
    "pegamento",
    "riel",
    "herrajes",
    "herraje",
  ];

  const realPieceWords = [
    "lateral",
    "costado",
    "piso",
    "base",
    "techo",
    "tapa",
    "puerta",
    "frente",
    "gaveta",
    "cajon",
    "fondo",
    "trasera",
    "espaldar",
    "repisa",
    "divisor",
    "division",
    "panel decorativo",
    "panel superior",
    "panel inferior",
    "soporte repisa",
  ];

  const looksLikeInventoryMaterial = inventoryMaterialWords.some((word) =>
    nameText.includes(word)
  );

  const looksLikeRealPiece = realPieceWords.some((word) =>
    fullText.includes(word)
  );

  if (looksLikeInventoryMaterial && !looksLikeRealPiece) return false;
  if (looksLikeRealPiece) return true;

  const hasDimensions =
    (num(item.width_mm) || num(item.width) || num(item.ancho_mm) || num(item.ancho)) > 0 &&
    (num(item.height_mm) || num(item.length_mm) || num(item.largo_mm) || num(item.largo) || num(item.height)) > 0;

  return hasDimensions && !looksLikeInventoryMaterial;
}

export function parseSizeFromText(text: string) {
  const clean = textValue(text);
  const match = clean.match(/(\d{2,4})\s*(?:x|\u00d7|\u00c3\u2014)\s*(\d{2,4})/i);
  if (!match) return null;

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

export function productionItemToPiece(item: any, index: number): ProductionCutPiece | null {
  if (!isPanelLike(item)) return null;

  const name =
    item.part_name ||
    item.piece_name ||
    item.nombre_pieza ||
    item.product_name ||
    item.nombre_producto ||
    item.material_name ||
    `Pieza ${index + 1}`;

  const moduleName =
    item.module_name ||
    item.category ||
    item.source ||
    "Modulo general";

  const sizeText = [name, item.notes, item.description, item.material_name]
    .filter(Boolean)
    .join(" ");

  const parsed = parseSizeFromText(sizeText);

  const width =
    num(item.width_mm) ||
    num(item.width) ||
    num(item.ancho_mm) ||
    num(item.ancho) ||
    parsed?.width ||
    0;

  const height =
    num(item.height_mm) ||
    num(item.length_mm) ||
    num(item.largo_mm) ||
    num(item.largo) ||
    num(item.height) ||
    parsed?.height ||
    0;

  if (width <= 0 || height <= 0) return null;

  const lower = textValue(name);
  const isBack = lower.includes("fondo");
  const isDoor = lower.includes("puerta") || lower.includes("frente");
  const isShelf = lower.includes("repisa");

  return {
    id: uid(),
    original_id: item.id || item.production_order_item_id || "",
    piece_name: name,
    module_name: moduleName,
    material_name: item.material_name || item.product_name || item.nombre_producto || "",
    width_mm: width,
    height_mm: height,
    thickness_mm: num(item.thickness) || num(item.thickness_mm) || num(item.grosor_mm) || (isBack ? 6 : 18),
    quantity: Math.max(1, num(item.quantity ?? item.cantidad, 1)),
    edge_front: !isBack,
    edge_back: isDoor,
    edge_left: isDoor || isShelf,
    edge_right: isDoor || isShelf,
    can_rotate: true,
  };
}

export function normalizeDbProductionItemsToPieces(rows: any[]): ProductionCutPiece[] {
  const unique = new Map<string, any>();

  (rows || []).forEach((item: any, index: number) => {
    const key = String(item?.id || `${item?.production_order_id || item?.order_id || "row"}-${index}`);
    if (!unique.has(key)) unique.set(key, item);
  });

  return Array.from(unique.values())
    .map((item: any, index: number) => productionItemToPiece(item, index))
    .filter(Boolean) as ProductionCutPiece[];
}

export function normalizeLocalCuttingPayloadToPieces(payload: any): ProductionCutPiece[] {
  const rawPieces =
    payload?.pieces ||
    payload?.items ||
    payload?.cutting_items ||
    payload?.production_items ||
    [];

  if (!Array.isArray(rawPieces)) return [];

  return rawPieces
    .map((item: any, index: number) => {
      const normalized = {
        ...item,
        part_name:
          item.part_name ||
          item.piece_name ||
          item.product_name ||
          item.nombre_producto ||
          item.name ||
          `Pieza ${index + 1}`,
        product_name:
          item.part_name ||
          item.piece_name ||
          item.product_name ||
          item.nombre_producto ||
          item.name ||
          `Pieza ${index + 1}`,
        module_name: item.module_name || item.modulo || item.category || "Sin modulo",
        width_mm:
          Number(item.width_mm ?? item.width ?? item.ancho_mm ?? item.ancho ?? 0) || 0,
        height_mm:
          Number(item.height_mm ?? item.height ?? item.length_mm ?? item.largo_mm ?? item.largo ?? item.alto_mm ?? item.alto ?? 0) || 0,
        thickness_mm:
          Number(item.thickness_mm ?? item.thickness ?? item.grosor_mm ?? item.grosor ?? 18) || 18,
        quantity: Number(item.quantity ?? item.cantidad ?? item.qty ?? 1) || 1,
      };

      return productionItemToPiece(normalized, index);
    })
    .filter(Boolean) as ProductionCutPiece[];
}
