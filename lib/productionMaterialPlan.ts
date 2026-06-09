export type ProductionMaterialRole = {
  material: string;
  color: string;
  edge: string;
  source: string;
  applies_to: string[];
};

export type ProductionMaterialInputRole = {
  material?: string | null;
  color?: string | null;
  edge?: string | null;
  source?: string | null;
  applies_to?: string[] | null;
};

export type ProductionMaterialRoles = Record<string, ProductionMaterialRole>;

export type ProductionMaterialModule = {
  id?: string | null;
  name?: string | null;
  module_name?: string | null;
  description?: string | null;
  type?: string | null;
  item_type?: string | null;
  quantity?: number | null;
  cantidad?: number | null;
  width_mm?: number | null;
  depth_mm?: number | null;
  height_mm?: number | null;
  material?: string | null;
  color?: string | null;
  edge?: string | null;
  notes?: string | null;
  material_roles?: ProductionMaterialRoles | Record<string, ProductionMaterialInputRole>;
  visual_materials?: ProductionMaterialRoles | Record<string, ProductionMaterialInputRole>;
};

export type ProductionMaterialProjectContext = {
  color_palette?: string | null;
  material_preference?: string | null;
  technical_notes?: string | null;
  customer_requests?: string | null;
  notes?: string | null;
  project_type?: string | null;
  type?: string | null;
};

export type ProductionMaterialPieceLike = {
  name?: string | null;
  product_name?: string | null;
  item_name?: string | null;
  part_name?: string | null;
  piece_name?: string | null;
  module_name?: string | null;
  category?: string | null;
  material?: string | null;
  material_name?: string | null;
  inventory_item_id?: string | null;
  product_id?: string | null;
  material_id?: string | null;
  color?: string | null;
  unit?: string | null;
  code?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
  thickness_mm?: number | null;
};

export type ProductionMaterialKind = "board" | "edge" | "operational" | "";

export type ProductionMaterialVerificationRow = {
  moduleName: string;
  pieceName: string;
  expectedRole: string;
  expectedColor: string;
  expectedMaterial: string;
  actualMaterial: string;
  status: "ok" | "mismatch" | "unlinked" | "unknown";
  message: string;
};

export const PRODUCTION_MATERIALS = {
  white18: "Melamina Blanco Alto Brillo 18mm 4x8",
  bardolino18: "Melamina Bardolino 18mm 7x8",
  roble18: "Melamina Roble Natural 18mm 7x8",
  negro18: "Melamina Negro Mate 18mm 7x8",
  caoba18: "Melamina Caoba 18mm 7x8",
  edgeWhite22: "Canto PVC Blanco 22mm 1mm",
  edgeBardolino22: "Canto PVC Bardolino 22mm 1mm",
  edgeRoble22: "Canto PVC Roble 22mm 1mm",
  edgeCaoba22: "Canto PVC Caoba 22mm 1mm",
} as const;

export function normalizeProductionMaterialText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function productionMaterialColorToken(value: unknown) {
  const text = normalizeProductionMaterialText(value);
  if (text.includes("blanco")) return "blanco";
  if (text.includes("roble")) return "roble";
  if (text.includes("bardolino") || text.includes("baldolino")) return "bardolino";
  if (text.includes("caoba")) return "caoba";
  if (text.includes("negro")) return "negro";
  if (text.includes("nogal")) return "nogal";
  return "";
}

export function productionMaterialKindToken(value: unknown): ProductionMaterialKind {
  const text = normalizeProductionMaterialText(value);
  if (/(canto|tapacanto|pvc|edge band|edgeband)/.test(text)) return "edge";
  if (/(mdf crudo|fondo 3mm|fondo 6mm|bisagra|corredera|tornillo|minifix|soporte|herraje|tirador|broca|tarugo|pegamento|cola)/.test(text)) {
    return "operational";
  }
  if (/(melamina|tablero|mdf|plywood|plancha|hoja|4x8|7x8|4 x 8|7 x 8)/.test(text)) return "board";
  return "";
}

export function productionMaterialTokensCompatible(actualToken: string, desiredToken: string) {
  if (!desiredToken) return true;
  if (!actualToken) return false;
  if (desiredToken === "roble") return actualToken === "roble" || actualToken === "bardolino";
  if (desiredToken === "bardolino") return actualToken === "bardolino" || actualToken === "roble";
  return actualToken === desiredToken;
}

export function finishLabelFromProductionText(value: unknown, fallback = "Roble Natural") {
  const text = normalizeProductionMaterialText(value);
  if (text.includes("bardolino") || text.includes("baldolino")) return "Bardolino";
  if (text.includes("roble") || text.includes("madera") || text.includes("wood")) return "Roble Natural";
  if (text.includes("blanco")) return "Blanco Alto Brillo";
  if (text.includes("caoba")) return "Caoba";
  if (text.includes("negro")) return "Negro";
  if (text.includes("nogal")) return "Nogal";
  return fallback;
}

export function melamineForProductionFinish(finish: string) {
  const label = finishLabelFromProductionText(finish);
  if (label === "Blanco Alto Brillo") return PRODUCTION_MATERIALS.white18;
  if (label === "Bardolino") return PRODUCTION_MATERIALS.bardolino18;
  if (label === "Caoba") return PRODUCTION_MATERIALS.caoba18;
  if (label === "Negro") return PRODUCTION_MATERIALS.negro18;
  return PRODUCTION_MATERIALS.roble18;
}

export function edgeForProductionFinish(finish: string) {
  const label = finishLabelFromProductionText(finish);
  if (label === "Blanco Alto Brillo") return PRODUCTION_MATERIALS.edgeWhite22;
  if (label === "Caoba") return PRODUCTION_MATERIALS.edgeCaoba22;
  if (label === "Roble Natural") return PRODUCTION_MATERIALS.edgeRoble22;
  return PRODUCTION_MATERIALS.edgeBardolino22;
}

export function productionMaterialRole(finish: string, appliesTo: string[], source = "production_material_plan"): ProductionMaterialRole {
  const color = finishLabelFromProductionText(finish);
  return {
    material: melamineForProductionFinish(color),
    color,
    edge: edgeForProductionFinish(color),
    source,
    applies_to: appliesTo,
  };
}

export function projectWoodFinish(context?: ProductionMaterialProjectContext | null) {
  const text = [
    context?.color_palette,
    context?.material_preference,
    context?.technical_notes,
    context?.customer_requests,
    context?.notes,
    context?.project_type,
    context?.type,
  ]
    .filter(Boolean)
    .join(" ");
  return finishLabelFromProductionText(text, "Roble Natural");
}

function roleRecord(module: ProductionMaterialModule): Record<string, ProductionMaterialInputRole> {
  return (module.material_roles || module.visual_materials || {}) as Record<string, ProductionMaterialInputRole>;
}

function coerceRole(
  role: ProductionMaterialInputRole | null | undefined,
  fallbackFinish: string,
  appliesTo: string[],
  source = "production_material_plan"
): ProductionMaterialRole {
  const text = [role?.material, role?.color, fallbackFinish].filter(Boolean).join(" ");
  const color = finishLabelFromProductionText(role?.color || role?.material || fallbackFinish);
  const materialText = String(role?.material || "");
  const material = /melamina|mdf/i.test(materialText)
    ? materialText
    : melamineForProductionFinish(text);

  return {
    material,
    color,
    edge: role?.edge || edgeForProductionFinish(color),
    source: role?.source || source,
    applies_to: role?.applies_to?.length ? [...role.applies_to] : appliesTo,
  };
}

export function inferProductionMaterialRoles(
  module: ProductionMaterialModule,
  context?: ProductionMaterialProjectContext | null
): ProductionMaterialRoles {
  const text = normalizeProductionMaterialText([module.name, module.module_name, module.description, module.type, module.item_type, module.notes, module.color].join(" "));
  const wood = projectWoodFinish(context);
  const moduleFinish = finishLabelFromProductionText([module.color, module.material, context?.color_palette].filter(Boolean).join(" "), wood);
  const white = "Blanco Alto Brillo";

  if (text.includes("panel")) {
    return {
      primary: productionMaterialRole(white, ["panel decorativo completo"]),
      panel: productionMaterialRole(white, ["panel central", "laterales decorativos", "fajas", "listones"]),
      frame: productionMaterialRole(white, ["marco decorativo", "refuerzos visibles"]),
    };
  }

  if (text.includes("repisa") || text.includes("biblioteca") || text.includes("librero")) {
    return {
      primary: productionMaterialRole(`${wood} / ${white}`, ["modulo con estructura madera y repisas blancas"]),
      structure: productionMaterialRole(wood, ["laterales", "tapa superior", "tapa inferior", "techo", "piso", "fondo"]),
      shelves: productionMaterialRole(white, ["repisas", "entrepano", "entrepanos"]),
      back: productionMaterialRole(wood, ["fondo biblioteca"]),
    };
  }

  if (text.includes("tv") || text.includes("credenza") || text.includes("modulo bajo") || text.includes("base inferior")) {
    return {
      primary: productionMaterialRole(wood, ["modulo bajo completo"]),
      structure: productionMaterialRole(wood, ["laterales", "piso", "techo", "divisiones", "fondo"]),
      fronts: productionMaterialRole(wood, ["frentes de gaveta", "puertas"]),
    };
  }

  return {
    primary: productionMaterialRole(moduleFinish, ["modulo completo"]),
  };
}

export function enrichProductionModuleMaterialRoles<T extends ProductionMaterialModule>(
  module: T,
  context?: ProductionMaterialProjectContext | null
): T & { material_roles: ProductionMaterialRoles } {
  const roles = roleRecord(module);
  if (Object.keys(roles).length > 0) {
    const inferred = inferProductionMaterialRoles(module, context);
    const normalized = Object.fromEntries(
      Object.entries({ ...inferred, ...roles }).map(([key, role]) => [
        key,
        coerceRole(role, inferred[key]?.color || projectWoodFinish(context), inferred[key]?.applies_to || ["modulo completo"], role?.source || undefined),
      ])
    ) as ProductionMaterialRoles;

    return { ...module, material_roles: normalized };
  }

  return {
    ...module,
    material_roles: inferProductionMaterialRoles(module, context),
  };
}

export function enrichProductionModulesMaterialRoles<T extends ProductionMaterialModule>(
  modules: T[],
  context?: ProductionMaterialProjectContext | null
) {
  return (modules || []).map((module) => enrichProductionModuleMaterialRoles(module, context));
}

export function getProductionModuleRole(
  module: ProductionMaterialModule,
  keys: string[],
  fallbackFinish = "Roble Natural",
  context?: ProductionMaterialProjectContext | null
): ProductionMaterialRole {
  const enriched = enrichProductionModuleMaterialRoles(module, context);
  for (const key of keys) {
    const role = enriched.material_roles[key];
    if (role) return role;
  }

  return productionMaterialRole(fallbackFinish, ["modulo completo"]);
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function isShelfStructurePart(text: string) {
  return includesAny(text, ["lateral", "tapa superior", "tapa inferior", "techo", "piso", "fondo", "estructura"]);
}

function isShelfWhitePart(text: string) {
  if (text.includes("entrepano") || text.includes("entrepano")) return true;
  if (text.includes("repisa") && !isShelfStructurePart(text)) return true;
  return false;
}

function isTvBaseWoodPart(text: string) {
  return includesAny(text, ["lateral", "piso", "techo", "frente gaveta", "division interna", "divisor", "fondo", "liston", "faja"]);
}

function pieceSearchText(piece: ProductionMaterialPieceLike) {
  return [
    piece.material_name,
    piece.material,
    piece.inventory_item_id,
    piece.product_id,
    piece.material_id,
    piece.product_name,
    piece.name,
    piece.item_name,
    piece.part_name,
    piece.piece_name,
    piece.module_name,
    piece.category,
    piece.unit,
    piece.code,
  ]
    .filter(Boolean)
    .join(" ");
}

function hasCutDimensions(piece: ProductionMaterialPieceLike) {
  return Number(piece.width_mm || 0) > 0 && Number(piece.height_mm || 0) > 0;
}

function looksLikeFurnitureCutPart(piece: ProductionMaterialPieceLike, roleKey: string) {
  if (["panel", "frame", "structure", "shelves", "back", "fronts"].includes(roleKey)) return true;
  const text = normalizeProductionMaterialText([piece.part_name, piece.piece_name, piece.name, piece.product_name].join(" "));
  return includesAny(text, [
    "lateral",
    "tapa",
    "techo",
    "piso",
    "fondo",
    "frente",
    "division",
    "divisor",
    "repisa",
    "entrepano",
    "panel",
    "faja",
    "liston",
  ]);
}

export function expectedProductionMaterialKindForPiece(
  piece: ProductionMaterialPieceLike,
  roleKey = productionPartRoleKey(piece)
): ProductionMaterialKind {
  const directKind = productionMaterialKindToken(pieceSearchText(piece));
  if (directKind) return directKind;
  if (hasCutDimensions(piece) || looksLikeFurnitureCutPart(piece, roleKey)) return "board";
  return "operational";
}

export function productionPartRoleKey(piece: ProductionMaterialPieceLike) {
  const partText = normalizeProductionMaterialText([piece.part_name, piece.piece_name, piece.name, piece.product_name, piece.item_name].join(" "));
  const moduleText = normalizeProductionMaterialText([piece.module_name, piece.category].join(" "));
  const semanticText = `${partText} ${moduleText}`.trim();

  if (semanticText.includes("panel decorativo") || partText.includes("panel central")) return "panel";
  if (isShelfWhitePart(partText)) return "shelves";

  if (
    (moduleText.includes("biblioteca") || moduleText.includes("repisa") || partText.includes("biblioteca")) &&
    isShelfStructurePart(partText)
  ) {
    return partText.includes("fondo") ? "back" : "structure";
  }

  if (
    (moduleText.includes("modulo bajo") || moduleText.includes("tv") || partText.includes("modulo bajo tv")) &&
    isTvBaseWoodPart(partText)
  ) {
    return partText.includes("frente") ? "fronts" : "structure";
  }

  return "primary";
}

export function expectedProductionMaterialForPiece(
  piece: ProductionMaterialPieceLike,
  context?: ProductionMaterialProjectContext | null
) {
  const module: ProductionMaterialModule = {
    name: piece.module_name || piece.category || "",
    module_name: piece.module_name || "",
    type: piece.category || "",
    material: piece.material || piece.material_name || "",
    color: piece.color || "",
  };
  const roleKey = productionPartRoleKey(piece);
  const role = getProductionModuleRole(module, [roleKey, "primary"], piece.material || piece.material_name || projectWoodFinish(context), context);
  return { roleKey, role };
}

export function desiredProductionMaterialToken(piece: ProductionMaterialPieceLike, context?: ProductionMaterialProjectContext | null) {
  const { role } = expectedProductionMaterialForPiece(piece, context);
  return productionMaterialColorToken([role.color, role.material].join(" "));
}

export function expectedProductionMaterialNameForPiece(
  piece: ProductionMaterialPieceLike,
  context?: ProductionMaterialProjectContext | null
) {
  const { roleKey, role } = expectedProductionMaterialForPiece(piece, context);
  const expectedKind = expectedProductionMaterialKindForPiece(piece, roleKey);
  if (expectedKind === "edge") return { roleKey, role, expectedKind, expectedMaterial: role.edge };
  if (expectedKind === "operational") return { roleKey, role, expectedKind, expectedMaterial: "Material operativo" };
  return { roleKey, role, expectedKind, expectedMaterial: role.material };
}

export function buildProductionMaterialVerificationRows(
  items: ProductionMaterialPieceLike[],
  context?: ProductionMaterialProjectContext | null
): ProductionMaterialVerificationRow[] {
  return (items || []).map((item) => {
    const { roleKey, role, expectedKind, expectedMaterial } = expectedProductionMaterialNameForPiece(item, context);
    const actualMaterial = [item.material_name, item.material, item.product_name, item.name].filter(Boolean).join(" ") || "Sin vinculo";
    const expectedToken = productionMaterialColorToken([role.color, expectedMaterial].join(" "));
    const actualToken = productionMaterialColorToken(actualMaterial);
    const actualKind = productionMaterialKindToken(actualMaterial);
    const moduleName = String(item.module_name || item.category || "Sin modulo");
    const pieceName = String(item.part_name || item.piece_name || item.name || item.product_name || "Pieza");
    const hasActualMaterial = Boolean(
      item.material_name ||
      item.material ||
      item.inventory_item_id ||
      item.product_id ||
      item.material_id
    );

    let status: ProductionMaterialVerificationRow["status"] = "unknown";
    let message = "Sin color esperado";

    if (expectedKind === "operational") {
      status = hasActualMaterial ? "ok" : "unlinked";
      message = hasActualMaterial ? "Material operativo vinculado" : "Pendiente vincular material";
    } else if (!actualToken) {
      status = "unlinked";
      message = "Pendiente vincular material";
    } else if (
      actualKind &&
      expectedKind &&
      actualKind !== expectedKind &&
      actualKind !== "operational"
    ) {
      status = "mismatch";
      message = expectedKind === "edge" ? `Esperado canto ${role.color}` : `Esperado tablero ${role.color}`;
    } else if (expectedToken && productionMaterialTokensCompatible(actualToken, expectedToken)) {
      status = "ok";
      message = "Material compatible";
    } else if (expectedToken) {
      status = "mismatch";
      message = `Esperado ${role.color}, vinculado ${actualMaterial}`;
    }

    return {
      moduleName,
      pieceName,
      expectedRole: roleKey,
      expectedColor: expectedKind === "operational" ? "No aplica" : role.color,
      expectedMaterial,
      actualMaterial,
      status,
      message,
    };
  });
}

export function summarizeProductionMaterialVerificationRows(rows: ProductionMaterialVerificationRow[]) {
  return {
    total: rows.length,
    ok: rows.filter((row) => row.status === "ok").length,
    mismatch: rows.filter((row) => row.status === "mismatch").length,
    unlinked: rows.filter((row) => row.status === "unlinked").length,
    unknown: rows.filter((row) => row.status === "unknown").length,
  };
}

export function centroTvRegressionModules(): ProductionMaterialModule[] {
  return [
    {
      id: "modulo-bajo-tv",
      name: "Modulo bajo TV",
      type: "Base inferior TV",
      material: "Melamina Roble Natural 18mm 7x8",
      color: "Roble / Bardolino",
      width_mm: 3000,
      depth_mm: 400,
      height_mm: 650,
    } as ProductionMaterialModule,
    {
      id: "repisas-flotantes",
      name: "Repisas flotantes biblioteca",
      type: "Biblioteca / repisas",
      material: "Melamina Roble Natural 18mm 7x8",
      color: "Roble / Blanco",
      width_mm: 1120,
      depth_mm: 320,
      height_mm: 1050,
    } as ProductionMaterialModule,
    {
      id: "panel-decorativo",
      name: "Panel decorativo TV",
      type: "Panel pared TV",
      material: "Melamina Blanco Alto Brillo 18mm 4x8",
      color: "Blanco",
      width_mm: 3000,
      depth_mm: 80,
      height_mm: 2900,
    } as ProductionMaterialModule,
  ];
}
