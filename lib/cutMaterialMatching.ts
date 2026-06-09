import { materialHeight, materialWidth } from "@/lib/cutShared";

export type CutMaterialMatchMaterial = {
  id?: string | null;
  code?: string | null;
  material?: string | null;
  name?: string | null;
  product_name?: string | null;
  category?: string | null;
  source?: string | null;
  sheet_width_mm?: number | null;
  width_mm?: number | null;
  ancho_mm?: number | null;
  sheet_height_mm?: number | null;
  height_mm?: number | null;
  largo_mm?: number | null;
  length_mm?: number | null;
};

export type CutMaterialMatchPiece = {
  material_name?: string | null;
  piece_name?: string | null;
  module_name?: string | null;
  thickness_mm?: number | string | null;
};

export function normalizedText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function materialSearchText(m?: CutMaterialMatchMaterial | null) {
  if (!m) return "";
  return normalizedText([m.name, m.product_name, m.material, m.code, m.category, m.source].filter(Boolean).join(" "));
}

export function materialColorToken(value: unknown) {
  const text = normalizedText(value);
  if (text.includes("roble")) return "roble";
  if (text.includes("bardolino") || text.includes("baldolino")) return "bardolino";
  if (text.includes("blanco")) return "blanco";
  if (text.includes("caoba")) return "caoba";
  if (text.includes("negro")) return "negro";
  if (text.includes("nogal")) return "nogal";
  return "";
}

export function includesAnyText(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export function isWoodColorToken(token: string) {
  return token === "roble" || token === "bardolino";
}

export function materialColorMatchesToken(materialToken: string, desiredToken: string) {
  if (!desiredToken) return true;
  if (desiredToken === "roble") return materialToken === "roble" || materialToken === "bardolino";
  if (desiredToken === "bardolino") return materialToken === "bardolino" || materialToken === "roble";
  return materialToken === desiredToken;
}

export function isShelfStructurePart(text: string) {
  return includesAnyText(text, [
    "lateral",
    "tapa superior",
    "tapa inferior",
    "techo",
    "piso",
    "fondo",
  ]);
}

export function isShelfWhitePart(text: string) {
  if (text.includes("entrepano") || text.includes("entrepano")) return true;
  if (text.includes("repisa") && !isShelfStructurePart(text)) return true;
  return false;
}

export function isTvBaseWoodPart(text: string) {
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

export function isBoardCutMaterial(material: CutMaterialMatchMaterial) {
  const text = materialSearchText(material);
  const source = String(material.source || "").toUpperCase();
  const hasSheetSize = materialWidth(material) > 0 && materialHeight(material) > 0;
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
  if (source === "RETAZO" && hasSheetSize) return true;
  return hasSheetSize && /(melamina|tablero|mdf|plywood|hoja)/.test(text);
}

export function pieceMaterialText(piece: CutMaterialMatchPiece) {
  return [piece.material_name, piece.piece_name, piece.module_name].filter(Boolean).join(" ");
}

export function pieceDesiredMaterialToken(piece: CutMaterialMatchPiece) {
  const partText = normalizedText(piece.piece_name);
  const moduleText = normalizedText(piece.module_name);
  const materialText = normalizedText(piece.material_name);
  const semanticText = `${partText} ${moduleText}`.trim();
  const text = `${semanticText} ${materialText}`.trim();

  // Matriz real del centro TV autorizado:
  // - Panel decorativo completo: Blanco.
  // - Repisas/entrepanos internos: Blanco.
  // - Modulo bajo TV y estructura de biblioteca/repisas: Roble/Bardolino.
  if (semanticText.includes("panel decorativo") || partText.includes("panel central")) return "blanco";
  if (isShelfWhitePart(partText)) return "blanco";

  if (
    (moduleText.includes("biblioteca") || moduleText.includes("repisa") || partText.includes("biblioteca")) &&
    isShelfStructurePart(partText)
  ) {
    return "roble";
  }

  if (
    (moduleText.includes("modulo bajo") || moduleText.includes("tv") || partText.includes("modulo bajo tv")) &&
    isTvBaseWoodPart(partText)
  ) {
    return "roble";
  }

  return materialColorToken(semanticText) || materialColorToken(materialText) || materialColorToken(text);
}

export function materialScoreForPiece(piece: CutMaterialMatchPiece, material: CutMaterialMatchMaterial) {
  const pieceText = normalizedText(pieceMaterialText(piece));
  const materialText = materialSearchText(material);
  const pieceColor = pieceDesiredMaterialToken(piece) || materialColorToken(pieceText);
  const materialColor = materialColorToken(materialText);

  if (!materialText) return 0;
  if (pieceColor && materialColor && !materialColorMatchesToken(materialColor, pieceColor)) return -500;

  let score = 0;
  if (pieceColor && materialColorMatchesToken(materialColor, pieceColor)) score += 160;
  if (pieceColor === "roble" && materialColor === "roble") score += 10;
  if (pieceColor === "bardolino" && materialColor === "bardolino") score += 10;
  if (piece.material_name && materialText.includes(normalizedText(piece.material_name))) score += 120;
  if (pieceText.includes("melamina") && materialText.includes("melamina")) score += 30;
  if (String(piece.thickness_mm || "").includes("18") && materialText.includes("18")) score += 15;
  if (!pieceColor && materialText.includes("melamina")) score += 10;
  return score;
}

export function materialWithToken<TMaterial extends CutMaterialMatchMaterial>(materials: TMaterial[], token: string) {
  if (!token) return null;
  const boards = materials.filter(isBoardCutMaterial);
  const exact = boards.find((material) => materialColorToken(materialSearchText(material)) === token);
  if (exact) return exact;

  if (isWoodColorToken(token)) {
    return boards.find((material) => isWoodColorToken(materialColorToken(materialSearchText(material)))) || null;
  }

  return null;
}

export function bestMaterialForPiece<TMaterial extends CutMaterialMatchMaterial>(
  materials: TMaterial[],
  piece: CutMaterialMatchPiece,
  selectedMaterial?: TMaterial | null
) {
  const explicitToken = pieceDesiredMaterialToken(piece);
  const explicitMaterial = materialWithToken(materials, explicitToken);
  if (explicitMaterial) return explicitMaterial;

  let best: TMaterial | null = null;
  let bestScore = -Infinity;

  for (const material of materials) {
    if (!isBoardCutMaterial(material)) continue;
    const score = materialScoreForPiece(piece, material);
    if (score > bestScore) {
      best = material;
      bestScore = score;
    }
  }

  if (best && bestScore >= 45) return best;
  if (explicitToken) return null;
  return selectedMaterial || best || null;
}
