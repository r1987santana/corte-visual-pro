export type CutMaterialLike = {
  material?: string | null;
  name?: string | null;
  code?: string | null;
  sheet_width_mm?: number | null;
  width_mm?: number | null;
  ancho_mm?: number | null;
  sheet_height_mm?: number | null;
  height_mm?: number | null;
  largo_mm?: number | null;
  length_mm?: number | null;
  grosor_mm?: number | null;
  cost?: number | null;
  unit_cost?: number | null;
  purchase_cost?: number | null;
  price?: number | null;
  tiene_veta?: boolean | null;
  grain_direction?: string | null;
};

export type CutPieceLike = {
  id: string;
  piece_name: string;
  module_name?: string;
  width_mm: number;
  height_mm: number;
  quantity: number;
  edge_front: boolean;
  edge_back: boolean;
  edge_left: boolean;
  edge_right: boolean;
  can_rotate: boolean;
};

export type EdgeSummary = {
  front: number;
  back: number;
  left: number;
  right: number;
  total: number;
};

export type DrillOperation = {
  id: string;
  pieceId: string;
  pieceCode: string;
  pieceName: string;
  moduleName: string;
  type: "HINGE_35" | "MINIFIX_15" | "TARUGO_8" | "CORREDERA_5" | "SHELF_PIN_5";
  x: number;
  y: number;
  diameter: number;
  depth: number;
  note: string;
};

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const money = (n: unknown) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
  }).format(num(n));

export const pieceCode = (i: number) => `PZ-${String(i + 1).padStart(4, "0")}`;

export function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

export function edgeText(p: {
  edge_front: boolean;
  edge_back: boolean;
  edge_left: boolean;
  edge_right: boolean;
}) {
  const arr: string[] = [];
  if (p.edge_front) arr.push("Frente");
  if (p.edge_back) arr.push("Atr\u00c3\u00a1s");
  if (p.edge_left) arr.push("Izq.");
  if (p.edge_right) arr.push("Der.");
  return arr.length ? arr.join(" / ") : "Sin canteo";
}

export function qrStationText() {
  return "CORTE \u00e2\u2020\u2019 CANTEO \u00e2\u2020\u2019 LIMPIEZA \u00e2\u2020\u2019 ENSAMBLAJE \u00e2\u2020\u2019 INSTALACI\u00c3\u201cN";
}

export function materialName(m?: CutMaterialLike | null) {
  if (!m) return "";
  return m.material || m.name || m.code || "Material";
}

export function materialWidth(m?: CutMaterialLike | null) {
  if (!m) return 1220;
  return num(m.sheet_width_mm) || num(m.width_mm) || num(m.ancho_mm) || 1220;
}

export function materialHeight(m?: CutMaterialLike | null) {
  if (!m) return 2440;
  return (
    num(m.sheet_height_mm) ||
    num(m.height_mm) ||
    num(m.largo_mm) ||
    num(m.length_mm) ||
    2440
  );
}

export function materialThickness(m?: CutMaterialLike | null) {
  if (!m) return 18;
  return num(m.grosor_mm) || 18;
}

export function materialCost(m?: CutMaterialLike | null) {
  if (!m) return 0;
  return num(m.cost) || num(m.unit_cost) || num(m.purchase_cost) || num(m.price);
}

export function materialHasGrain(m?: CutMaterialLike | null) {
  if (!m) return false;
  const name = `${m.material || ""} ${m.name || ""}`.toLowerCase();

  return Boolean(
    m.tiene_veta ||
      m.grain_direction ||
      name.includes("veta") ||
      name.includes("roble") ||
      name.includes("bardolino") ||
      name.includes("caoba")
  );
}

export function grainModeLabel(material?: CutMaterialLike | null, respect = true) {
  if (!material) return "Sin material";
  const has = materialHasGrain(material);
  if (!respect) return "Veta ignorada";
  return has ? "Veta bloqueada \u00c2\u00b7 No rotar" : "Sin veta \u00c2\u00b7 Rotaci\u00c3\u00b3n libre";
}

export function pieceCanRotateByGrain(piece: CutPieceLike, material?: CutMaterialLike | null, respect = true) {
  if (!respect) return piece.can_rotate !== false;
  if (materialHasGrain(material)) return false;
  return piece.can_rotate !== false;
}

export function detectDrillingType(pieceName: string) {
  const n = String(pieceName || "").toLowerCase();
  return {
    isDoor: n.includes("puerta") || n.includes("frente") || n.includes("gaveta"),
    isSide: n.includes("lateral") || n.includes("costado"),
    isShelf: n.includes("repisa") || n.includes("biblioteca"),
    isDrawer: n.includes("gaveta") || n.includes("corredera"),
  };
}

export function generateDrillOperationsForPiece(piece: CutPieceLike, pieceIndex: number): DrillOperation[] {
  const name = piece.piece_name || "Pieza";
  const code = pieceCode(pieceIndex);
  const w = Number(piece.width_mm || 0);
  const h = Number(piece.height_mm || 0);
  const ops: DrillOperation[] = [];
  const flags = detectDrillingType(name);

  if (w <= 0 || h <= 0) return ops;

  const base = {
    pieceId: piece.id,
    pieceCode: code,
    pieceName: name,
    moduleName: piece.module_name || "Sin m\u00c3\u00b3dulo",
  };

  if (flags.isDoor && h >= 500) {
    ops.push({ ...base, id: `${piece.id}-hinge-top`, type: "HINGE_35", x: 22, y: 100, diameter: 35, depth: 12, note: "Bisagra cazoleta superior 35mm" });
    ops.push({ ...base, id: `${piece.id}-hinge-bottom`, type: "HINGE_35", x: 22, y: Math.max(100, h - 100), diameter: 35, depth: 12, note: "Bisagra cazoleta inferior 35mm" });
    if (h >= 1500) ops.push({ ...base, id: `${piece.id}-hinge-middle`, type: "HINGE_35", x: 22, y: h / 2, diameter: 35, depth: 12, note: "Bisagra cazoleta central 35mm" });
  }

  if (flags.isSide || name.toLowerCase().includes("piso") || name.toLowerCase().includes("techo")) {
    const xLeft = 37;
    const xRight = Math.max(37, w - 37);
    const yTop = 70;
    const yBottom = Math.max(70, h - 70);

    [
      [xLeft, yTop, "Minifix superior izquierdo"],
      [xRight, yTop, "Minifix superior derecho"],
      [xLeft, yBottom, "Minifix inferior izquierdo"],
      [xRight, yBottom, "Minifix inferior derecho"],
    ].forEach(([x, y, note], i) => {
      ops.push({ ...base, id: `${piece.id}-minifix-${i}`, type: "MINIFIX_15", x: Number(x), y: Number(y), diameter: 15, depth: 13, note: String(note) });
    });
  }

  if (flags.isSide || flags.isShelf || name.toLowerCase().includes("piso") || name.toLowerCase().includes("techo")) {
    const yPositions = [90, Math.max(90, h - 90)];
    yPositions.forEach((yy, i) => {
      ops.push({ ...base, id: `${piece.id}-tarugo-left-${i}`, type: "TARUGO_8", x: 50, y: yy, diameter: 8, depth: 12, note: "Tarugo uni\u00c3\u00b3n" });
      ops.push({ ...base, id: `${piece.id}-tarugo-right-${i}`, type: "TARUGO_8", x: Math.max(50, w - 50), y: yy, diameter: 8, depth: 12, note: "Tarugo uni\u00c3\u00b3n" });
    });
  }

  if (flags.isDrawer || flags.isSide) {
    const railY = Math.min(Math.max(70, h / 2), h - 70);
    [64, 96, 128, 160].forEach((xx, i) => {
      if (xx < w - 30) {
        ops.push({ ...base, id: `${piece.id}-slide-${i}`, type: "CORREDERA_5", x: xx, y: railY, diameter: 5, depth: 10, note: "Perforaci\u00c3\u00b3n corredera" });
      }
    });
  }

  if (flags.isShelf || flags.isSide) {
    [120, Math.max(120, h - 120)].forEach((yy, i) => {
      ops.push({ ...base, id: `${piece.id}-shelfpin-left-${i}`, type: "SHELF_PIN_5", x: 37, y: yy, diameter: 5, depth: 10, note: "Soporte repisa" });
      ops.push({ ...base, id: `${piece.id}-shelfpin-right-${i}`, type: "SHELF_PIN_5", x: Math.max(37, w - 37), y: yy, diameter: 5, depth: 10, note: "Soporte repisa" });
    });
  }

  return ops.filter((op) => op.x > 0 && op.y > 0 && op.x <= w && op.y <= h);
}

export function edgeMl(p: {
  width_mm: number;
  height_mm: number;
  edge_front: boolean;
  edge_back: boolean;
  edge_left: boolean;
  edge_right: boolean;
}) {
  return (
    ((p.edge_front ? p.width_mm : 0) +
      (p.edge_back ? p.width_mm : 0) +
      (p.edge_left ? p.height_mm : 0) +
      (p.edge_right ? p.height_mm : 0)) /
    1000
  );
}

export function edgeSummary(pieces: CutPieceLike[]): EdgeSummary {
  let front = 0;
  let back = 0;
  let left = 0;
  let right = 0;

  pieces.forEach((p) => {
    const q = Math.max(1, num(p.quantity, 1));
    if (p.edge_front) front += (p.width_mm / 1000) * q;
    if (p.edge_back) back += (p.width_mm / 1000) * q;
    if (p.edge_left) left += (p.height_mm / 1000) * q;
    if (p.edge_right) right += (p.height_mm / 1000) * q;
  });

  return {
    front,
    back,
    left,
    right,
    total: front + back + left + right,
  };
}
