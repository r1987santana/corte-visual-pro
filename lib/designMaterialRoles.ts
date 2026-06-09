export type DesignMaterialRole = {
  material: string;
  color: string;
  edge: string;
  source: string;
  applies_to: string[];
};

export type DesignMaterialRoles = Record<string, DesignMaterialRole>;

export type DesignMaterialModule = {
  name?: string | null;
  type?: string | null;
  notes?: string | null;
  color?: string | null;
  material_roles?: DesignMaterialRoles;
};

export type DesignMaterialQuote = {
  color_palette?: string | null;
  material_preference?: string | null;
  technical_notes?: string | null;
  customer_requests?: string | null;
};

export function normalizeDesignText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function finishLabelFromText(value: unknown, fallback = "Roble Natural") {
  const text = normalizeDesignText(value);
  if (text.includes("bardolino") || text.includes("baldolino")) return "Bardolino";
  if (text.includes("roble") || text.includes("madera") || text.includes("wood")) return "Roble Natural";
  if (text.includes("blanco")) return "Blanco Alto Brillo";
  if (text.includes("caoba")) return "Caoba";
  if (text.includes("negro")) return "Negro";
  if (text.includes("nogal")) return "Nogal";
  return fallback;
}

export function melamineForFinish(finish: string) {
  const label = finishLabelFromText(finish);
  if (label === "Blanco Alto Brillo") return "Melamina Blanco Alto Brillo 18mm 4x8";
  if (label === "Bardolino") return "Melamina Bardolino 18mm 7x8";
  if (label === "Caoba") return "Melamina Caoba 18mm 4x8";
  if (label === "Negro") return "Melamina Negra 18mm 4x8";
  if (label === "Nogal") return "Melamina Nogal 18mm 4x8";
  return "Melamina Roble Natural 18mm 7x8";
}

export function edgeForFinish(finish: string) {
  const label = finishLabelFromText(finish);
  if (label === "Blanco Alto Brillo") return "Canto PVC Blanco 22mm 1mm";
  if (label === "Caoba") return "Canto PVC Caoba 22mm 1mm";
  if (label === "Negro") return "Canto PVC Negro 22mm 1mm";
  if (label === "Nogal") return "Canto PVC Nogal 22mm 1mm";
  if (label === "Bardolino") return "Canto PVC Bardolino 22mm 1mm";
  return "Canto PVC Roble 22mm 1mm";
}

export function materialRole(finish: string, appliesTo: string[], source = "ia_render_module"): DesignMaterialRole {
  const color = finishLabelFromText(finish);
  return {
    material: melamineForFinish(color),
    color,
    edge: edgeForFinish(color),
    source,
    applies_to: appliesTo,
  };
}

export function woodFinishFromQuote(q?: DesignMaterialQuote | null) {
  const text = [q?.color_palette, q?.material_preference, q?.technical_notes, q?.customer_requests]
    .filter(Boolean)
    .join(" ");
  return finishLabelFromText(text, "Roble Natural");
}

export function inferModuleMaterialRoles(
  module: DesignMaterialModule,
  q?: DesignMaterialQuote | null
): DesignMaterialRoles {
  const text = normalizeDesignText([module.name, module.type, module.notes, module.color].join(" "));
  const moduleFinish = finishLabelFromText(module.color || q?.color_palette, woodFinishFromQuote(q));
  const wood = woodFinishFromQuote(q);
  const white = "Blanco Alto Brillo";

  if (text.includes("panel")) {
    return {
      primary: materialRole(white, ["panel decorativo completo"]),
      panel: materialRole(white, ["panel central", "laterales decorativos", "fajas", "listones"]),
      frame: materialRole(white, ["marco decorativo", "refuerzos visibles"]),
    };
  }

  if (text.includes("repisa") || text.includes("biblioteca") || text.includes("librero")) {
    return {
      primary: materialRole(`${wood} / ${white}`, ["modulo con estructura madera y repisas blancas"]),
      structure: materialRole(wood, ["laterales", "tapa superior", "tapa inferior", "techo", "piso", "fondo"]),
      shelves: materialRole(white, ["repisas", "entrepano", "entrepanos"]),
      back: materialRole(wood, ["fondo biblioteca"]),
    };
  }

  if (text.includes("tv") || text.includes("credenza") || text.includes("modulo bajo") || text.includes("base inferior")) {
    return {
      primary: materialRole(wood, ["modulo bajo completo"]),
      structure: materialRole(wood, ["laterales", "piso", "techo", "divisiones"]),
      fronts: materialRole(wood, ["frentes de gaveta", "puertas"]),
    };
  }

  return {
    primary: materialRole(moduleFinish, ["modulo completo"]),
  };
}

export function enrichModuleMaterialRoles<T extends DesignMaterialModule>(
  module: T,
  q?: DesignMaterialQuote | null
): T & { material_roles: DesignMaterialRoles } {
  if (module.material_roles && Object.keys(module.material_roles).length) {
    return module as T & { material_roles: DesignMaterialRoles };
  }

  return {
    ...module,
    material_roles: inferModuleMaterialRoles(module, q),
  };
}

export function materialRolesSummary(module: DesignMaterialModule) {
  const roles = module.material_roles || {};
  return Object.entries(roles)
    .map(([key, role]) => `${key}: ${role.color} (${role.material}) -> ${role.applies_to.join(", ")}`)
    .join(" | ");
}
