"use client";

/**
 * RD WOOD SYSTEM
 * FASE 4 – Nesting Multi-Tablero PRO
 *
 * Motor de asignación global para usar:
 * 1) Retazos
 * 2) Tableros abiertos
 * 3) Tableros completos
 *
 * Respeta veta cuando la pieza/material lo requiere.
 */

export type MultiBoardSource = "RETAZO" | "TABLERO_ABIERTO" | "TABLERO";

export type MultiBoardMaterial = {
  id: string;
  source: MultiBoardSource | string;
  name?: string | null;
  material?: string | null;
  code?: string | null;
  width_mm: number;
  height_mm: number;
  thickness_mm?: number | null;
  cost?: number | null;
  unit_cost?: number | null;
  tiene_veta?: boolean | null;
  grain_direction?: string | null;
  quantity?: number | null;
};

export type MultiBoardPiece = {
  id: string;
  name: string;
  module_name?: string;
  width_mm: number;
  height_mm: number;
  thickness_mm?: number | null;
  quantity?: number | null;
  can_rotate?: boolean | null;
  grain_sensitive?: boolean | null;
  material_name?: string | null;
};

export type NestedPiece = MultiBoardPiece & {
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  board_id: string;
  board_index: number;
};

export type NestedBoard = {
  id: string;
  board_index: number;
  source: MultiBoardSource | string;
  name: string;
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
  cost: number;
  pieces: NestedPiece[];
  used_m2: number;
  total_m2: number;
  waste_m2: number;
  efficiency: number;
};

export type MultiBoardResult = {
  boards: NestedBoard[];
  unplaced: MultiBoardPiece[];
  total_used_m2: number;
  total_board_m2: number;
  total_waste_m2: number;
  global_efficiency: number;
  total_cost: number;
};

const n = (v: any, fallback = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

const text = (v: any) => String(v || "").toLowerCase();

export function materialDisplayName(material: MultiBoardMaterial) {
  return material.material || material.name || material.code || "Material";
}

export function materialCost(material: MultiBoardMaterial) {
  return n(material.cost) || n(material.unit_cost);
}

export function hasGrain(material: MultiBoardMaterial) {
  const hay = text(`${material.name || ""} ${material.material || ""} ${material.grain_direction || ""}`);
  return Boolean(
    material.tiene_veta ||
      material.grain_direction ||
      hay.includes("bardolino") ||
      hay.includes("roble") ||
      hay.includes("nogal") ||
      hay.includes("caoba") ||
      hay.includes("veta")
  );
}

export function pieceNeedsGrain(piece: MultiBoardPiece, material?: MultiBoardMaterial) {
  const hay = text(`${piece.name} ${piece.material_name || ""}`);
  return Boolean(
    piece.grain_sensitive ||
      hasGrain(material as any) ||
      hay.includes("bardolino") ||
      hay.includes("roble") ||
      hay.includes("nogal") ||
      hay.includes("caoba") ||
      hay.includes("veta")
  );
}

function sourcePriority(source: string) {
  const s = String(source || "").toUpperCase();
  if (s === "RETAZO") return 0;
  if (s === "TABLERO_ABIERTO") return 1;
  return 2;
}

function expandPieces(pieces: MultiBoardPiece[]) {
  const out: MultiBoardPiece[] = [];

  pieces.forEach((p) => {
    const q = Math.max(1, Math.round(n(p.quantity, 1)));
    for (let i = 0; i < q; i++) {
      out.push({
        ...p,
        id: `${p.id}-${i}`,
        quantity: 1,
      });
    }
  });

  return out.sort((a, b) => {
    const areaA = n(a.width_mm) * n(a.height_mm);
    const areaB = n(b.width_mm) * n(b.height_mm);
    return areaB - areaA;
  });
}

function buildBoardCopies(materials: MultiBoardMaterial[]) {
  const boards: NestedBoard[] = [];

  materials
    .filter((m) => n(m.width_mm) > 0 && n(m.height_mm) > 0)
    .sort((a, b) => {
      const p = sourcePriority(String(a.source)) - sourcePriority(String(b.source));
      if (p !== 0) return p;
      const areaA = n(a.width_mm) * n(a.height_mm);
      const areaB = n(b.width_mm) * n(b.height_mm);
      return areaA - areaB;
    })
    .forEach((m) => {
      const qty =
        String(m.source || "").toUpperCase() === "RETAZO"
          ? 1
          : Math.max(1, Math.round(n(m.quantity, 1)));

      for (let i = 0; i < qty; i++) {
        const totalM2 = (n(m.width_mm) * n(m.height_mm)) / 1_000_000;
        boards.push({
          id: `${m.id}-${i}`,
          board_index: boards.length + 1,
          source: m.source || "TABLERO",
          name: materialDisplayName(m),
          width_mm: n(m.width_mm),
          height_mm: n(m.height_mm),
          thickness_mm: n(m.thickness_mm, 18),
          cost: materialCost(m),
          pieces: [],
          used_m2: 0,
          total_m2: totalM2,
          waste_m2: totalM2,
          efficiency: 0,
        });
      }
    });

  return boards;
}

type FreeRect = { x: number; y: number; w: number; h: number };

function splitFreeRect(rect: FreeRect, used: FreeRect) {
  const result: FreeRect[] = [];

  const rightW = rect.w - used.w;
  const bottomH = rect.h - used.h;

  if (rightW > 20) {
    result.push({
      x: rect.x + used.w,
      y: rect.y,
      w: rightW,
      h: used.h,
    });
  }

  if (bottomH > 20) {
    result.push({
      x: rect.x,
      y: rect.y + used.h,
      w: rect.w,
      h: bottomH,
    });
  }

  return result;
}

function canPlaceInRect(piece: MultiBoardPiece, rect: FreeRect, board: NestedBoard) {
  const pw = n(piece.width_mm);
  const ph = n(piece.height_mm);
  const requiresGrain = pieceNeedsGrain(piece, {
    id: board.id,
    source: board.source,
    name: board.name,
    material: board.name,
    width_mm: board.width_mm,
    height_mm: board.height_mm,
    thickness_mm: board.thickness_mm,
    tiene_veta: String(board.name).toLowerCase().includes("bardolino"),
  });

  const normal = pw <= rect.w && ph <= rect.h;
  const rotated =
    piece.can_rotate !== false &&
    !requiresGrain &&
    ph <= rect.w &&
    pw <= rect.h;

  if (normal) return { rotated: false, w: pw, h: ph };
  if (rotated) return { rotated: true, w: ph, h: pw };
  return null;
}

function recalcBoard(board: NestedBoard) {
  board.used_m2 = board.pieces.reduce((sum, p) => sum + (p.w * p.h) / 1_000_000, 0);
  board.total_m2 = (board.width_mm * board.height_mm) / 1_000_000;
  board.waste_m2 = Math.max(0, board.total_m2 - board.used_m2);
  board.efficiency = board.total_m2 > 0 ? (board.used_m2 / board.total_m2) * 100 : 0;
}

export function optimizeMultiBoardNesting(params: {
  materials: MultiBoardMaterial[];
  pieces: MultiBoardPiece[];
  kerf_mm?: number;
}): MultiBoardResult {
  const kerf = n(params.kerf_mm, 8);
  const expanded = expandPieces(params.pieces).map((p) => ({
    ...p,
    width_mm: n(p.width_mm) + kerf,
    height_mm: n(p.height_mm) + kerf,
  }));

  const boards = buildBoardCopies(params.materials);
  const freeRects = new Map<string, FreeRect[]>();

  boards.forEach((b) => {
    freeRects.set(b.id, [{ x: 0, y: 0, w: b.width_mm, h: b.height_mm }]);
  });

  const unplaced: MultiBoardPiece[] = [];

  for (const piece of expanded) {
    let best:
      | {
          board: NestedBoard;
          rect: FreeRect;
          rectIndex: number;
          placement: { rotated: boolean; w: number; h: number };
          score: number;
        }
      | null = null;

    for (const board of boards) {
      const rects = freeRects.get(board.id) || [];

      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const placement = canPlaceInRect(piece, rect, board);
        if (!placement) continue;

        const waste = rect.w * rect.h - placement.w * placement.h;
        const priority = sourcePriority(String(board.source));
        const score = priority * 10_000_000 + waste;

        if (!best || score < best.score) {
          best = { board, rect, rectIndex: i, placement, score };
        }
      }
    }

    if (!best) {
      unplaced.push(piece);
      continue;
    }

    const nested: NestedPiece = {
      ...piece,
      x: best.rect.x,
      y: best.rect.y,
      w: best.placement.w,
      h: best.placement.h,
      rotated: best.placement.rotated,
      board_id: best.board.id,
      board_index: best.board.board_index,
    };

    best.board.pieces.push(nested);

    const rects = freeRects.get(best.board.id) || [];
    rects.splice(best.rectIndex, 1);

    const usedRect = {
      x: best.rect.x,
      y: best.rect.y,
      w: best.placement.w,
      h: best.placement.h,
    };

    const newRects = splitFreeRect(best.rect, usedRect);
    rects.push(...newRects);

    rects.sort((a, b) => a.w * a.h - b.w * b.h);
    freeRects.set(best.board.id, rects);

    recalcBoard(best.board);
  }

  const usedBoards = boards.filter((b) => b.pieces.length > 0);
  usedBoards.forEach((b, i) => {
    b.board_index = i + 1;
    b.pieces = b.pieces.map((p) => ({ ...p, board_index: i + 1 }));
    recalcBoard(b);
  });

  const totalUsed = usedBoards.reduce((sum, b) => sum + b.used_m2, 0);
  const totalM2 = usedBoards.reduce((sum, b) => sum + b.total_m2, 0);
  const totalWaste = Math.max(0, totalM2 - totalUsed);

  return {
    boards: usedBoards,
    unplaced,
    total_used_m2: totalUsed,
    total_board_m2: totalM2,
    total_waste_m2: totalWaste,
    global_efficiency: totalM2 > 0 ? (totalUsed / totalM2) * 100 : 0,
    total_cost: usedBoards.reduce((sum, b) => sum + b.cost, 0),
  };
}
