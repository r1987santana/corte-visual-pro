"use client";

/**
 * RD WOOD SYSTEM
 * FASE 5 – Costeo Real por Pieza PRO
 *
 * Calcula costo real por pieza:
 * - material
 * - corte
 * - canteo
 * - perforaciones CNC
 * - costo total
 */

export type PieceCostInput = {
  id: string;
  name: string;
  module_name?: string | null;

  width_mm: number;
  height_mm: number;
  thickness_mm?: number | null;
  quantity?: number | null;

  material_name?: string | null;
  material_cost?: number | null;
  board_cost?: number | null;
  board_width_mm?: number | null;
  board_height_mm?: number | null;

  edge_front?: boolean | null;
  edge_back?: boolean | null;
  edge_left?: boolean | null;
  edge_right?: boolean | null;

  edge_meters?: number | null;
  edge_cost_per_meter?: number | null;

  cut_cost_per_linear_foot?: number | null;
  cnc_holes?: number | null;
  cnc_hole_cost?: number | null;
};

export type PieceCostResult = PieceCostInput & {
  area_m2: number;
  perimeter_m: number;
  edge_total_m: number;
  cut_linear_feet: number;

  material_cost_total: number;
  cut_cost_total: number;
  edge_cost_total: number;
  cnc_cost_total: number;

  unit_total_cost: number;
  total_cost: number;
};

export type ModuleCostSummary = {
  module_name: string;
  pieces: number;
  quantity: number;
  area_m2: number;
  edge_m: number;
  cut_linear_feet: number;
  material_cost: number;
  cut_cost: number;
  edge_cost: number;
  cnc_cost: number;
  total_cost: number;
};

export type ProjectCostSummary = {
  pieces: PieceCostResult[];
  modules: ModuleCostSummary[];
  totals: {
    piece_count: number;
    quantity_total: number;
    area_m2: number;
    edge_m: number;
    cut_linear_feet: number;
    material_cost: number;
    cut_cost: number;
    edge_cost: number;
    cnc_cost: number;
    total_cost: number;
  };
};

const n = (value: any, fallback = 0) => {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function pieceAreaM2(piece: PieceCostInput) {
  return Math.max(0, (n(piece.width_mm) * n(piece.height_mm)) / 1_000_000);
}

export function piecePerimeterM(piece: PieceCostInput) {
  return Math.max(0, ((n(piece.width_mm) + n(piece.height_mm)) * 2) / 1000);
}

export function pieceEdgeMeters(piece: PieceCostInput) {
  if (n(piece.edge_meters) > 0) return n(piece.edge_meters);

  let total = 0;
  const widthM = n(piece.width_mm) / 1000;
  const heightM = n(piece.height_mm) / 1000;

  if (piece.edge_front) total += widthM;
  if (piece.edge_back) total += widthM;
  if (piece.edge_left) total += heightM;
  if (piece.edge_right) total += heightM;

  return Math.max(0, total);
}

export function pieceCutLinearFeet(piece: PieceCostInput) {
  // Corte por perímetro de la pieza en pies lineales.
  return piecePerimeterM(piece) * 3.28084;
}

export function materialCostByPiece(piece: PieceCostInput) {
  const direct = n(piece.material_cost);
  if (direct > 0) return direct;

  const boardCost = n(piece.board_cost);
  const boardArea =
    n(piece.board_width_mm) > 0 && n(piece.board_height_mm) > 0
      ? (n(piece.board_width_mm) * n(piece.board_height_mm)) / 1_000_000
      : 0;

  if (boardCost > 0 && boardArea > 0) {
    return pieceAreaM2(piece) * (boardCost / boardArea);
  }

  // Fallback industrial aproximado si no hay costo de tablero.
  const thickness = n(piece.thickness_mm, 18);
  const costPerM2 = thickness <= 6 ? 650 : 1850;
  return pieceAreaM2(piece) * costPerM2;
}

export function calculatePieceCost(piece: PieceCostInput): PieceCostResult {
  const qty = Math.max(1, n(piece.quantity, 1));

  const area = pieceAreaM2(piece);
  const perimeter = piecePerimeterM(piece);
  const edgeM = pieceEdgeMeters(piece);
  const cutFeet = pieceCutLinearFeet(piece);

  const materialCost = materialCostByPiece(piece);
  const cutCost = cutFeet * n(piece.cut_cost_per_linear_foot, 30);
  const edgeCost = edgeM * n(piece.edge_cost_per_meter, 35);
  const cncCost = n(piece.cnc_holes) * n(piece.cnc_hole_cost, 2);

  const unitTotal = materialCost + cutCost + edgeCost + cncCost;

  return {
    ...piece,
    quantity: qty,

    area_m2: round2(area),
    perimeter_m: round2(perimeter),
    edge_total_m: round2(edgeM),
    cut_linear_feet: round2(cutFeet),

    material_cost_total: round2(materialCost),
    cut_cost_total: round2(cutCost),
    edge_cost_total: round2(edgeCost),
    cnc_cost_total: round2(cncCost),

    unit_total_cost: round2(unitTotal),
    total_cost: round2(unitTotal * qty),
  };
}

export function summarizeCostsByModule(pieces: PieceCostResult[]): ModuleCostSummary[] {
  const map = new Map<string, ModuleCostSummary>();

  for (const piece of pieces) {
    const key = String(piece.module_name || "Sin módulo");
    const current =
      map.get(key) ||
      {
        module_name: key,
        pieces: 0,
        quantity: 0,
        area_m2: 0,
        edge_m: 0,
        cut_linear_feet: 0,
        material_cost: 0,
        cut_cost: 0,
        edge_cost: 0,
        cnc_cost: 0,
        total_cost: 0,
      };

    const qty = Math.max(1, n(piece.quantity, 1));

    current.pieces += 1;
    current.quantity += qty;
    current.area_m2 += piece.area_m2 * qty;
    current.edge_m += piece.edge_total_m * qty;
    current.cut_linear_feet += piece.cut_linear_feet * qty;
    current.material_cost += piece.material_cost_total * qty;
    current.cut_cost += piece.cut_cost_total * qty;
    current.edge_cost += piece.edge_cost_total * qty;
    current.cnc_cost += piece.cnc_cost_total * qty;
    current.total_cost += piece.total_cost;

    map.set(key, current);
  }

  return Array.from(map.values()).map((m) => ({
    ...m,
    area_m2: round2(m.area_m2),
    edge_m: round2(m.edge_m),
    cut_linear_feet: round2(m.cut_linear_feet),
    material_cost: round2(m.material_cost),
    cut_cost: round2(m.cut_cost),
    edge_cost: round2(m.edge_cost),
    cnc_cost: round2(m.cnc_cost),
    total_cost: round2(m.total_cost),
  }));
}

export function summarizeProjectCost(inputPieces: PieceCostInput[]): ProjectCostSummary {
  const pieces = inputPieces.map(calculatePieceCost);
  const modules = summarizeCostsByModule(pieces);

  const totals = pieces.reduce(
    (acc, piece) => {
      const qty = Math.max(1, n(piece.quantity, 1));
      acc.piece_count += 1;
      acc.quantity_total += qty;
      acc.area_m2 += piece.area_m2 * qty;
      acc.edge_m += piece.edge_total_m * qty;
      acc.cut_linear_feet += piece.cut_linear_feet * qty;
      acc.material_cost += piece.material_cost_total * qty;
      acc.cut_cost += piece.cut_cost_total * qty;
      acc.edge_cost += piece.edge_cost_total * qty;
      acc.cnc_cost += piece.cnc_cost_total * qty;
      acc.total_cost += piece.total_cost;
      return acc;
    },
    {
      piece_count: 0,
      quantity_total: 0,
      area_m2: 0,
      edge_m: 0,
      cut_linear_feet: 0,
      material_cost: 0,
      cut_cost: 0,
      edge_cost: 0,
      cnc_cost: 0,
      total_cost: 0,
    }
  );

  return {
    pieces,
    modules,
    totals: {
      piece_count: totals.piece_count,
      quantity_total: totals.quantity_total,
      area_m2: round2(totals.area_m2),
      edge_m: round2(totals.edge_m),
      cut_linear_feet: round2(totals.cut_linear_feet),
      material_cost: round2(totals.material_cost),
      cut_cost: round2(totals.cut_cost),
      edge_cost: round2(totals.edge_cost),
      cnc_cost: round2(totals.cnc_cost),
      total_cost: round2(totals.total_cost),
    },
  };
}

export function moneyDOP(value: number) {
  return `RD$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
