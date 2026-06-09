import { materialRolesSummary, type DesignMaterialRoles } from "./designMaterialRoles";

export type IADesignModuleForPrompt = {
  name: string;
  type: string;
  quantity: number;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  material: string;
  color: string;
  edge: string;
  notes: string;
  material_roles?: DesignMaterialRoles;
};

export type IADesignRenderVariantForPrompt = {
  id: string;
  name: string;
  concept: string;
  mood: string;
};

export type IADesignQuoteForPrompt = {
  project_type?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  width_mm?: number | null;
  depth_mm?: number | null;
  height_mm?: number | null;
  style?: string | null;
  material_preference?: string | null;
  color_palette?: string | null;
  hardware_preference?: string | null;
  presupuesto?: number | null;
  customer_requests?: string | null;
  technical_notes?: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function buildIADesignPrompt(
  quote: IADesignQuoteForPrompt,
  modules: IADesignModuleForPrompt[],
  variant: IADesignRenderVariantForPrompt
) {
  const moduleLines = modules
    .map(
      (module, index) =>
        `${index + 1}. ${module.name}: quantity ${module.quantity}. Each unit: ${module.width_mm}mm width x ${module.depth_mm}mm depth x ${module.height_mm}mm height. Type: ${module.type}. Material: ${module.material}. Color/finish: ${module.color}. Edge banding: ${module.edge}. Material roles from approved render plan: ${materialRolesSummary(module) || "primary finish only"}. Notes: ${module.notes}.`
    )
    .join("\n");

  return [
    "Create a professional realistic interior render for RD WOOD SYSTEM.",
    `Variant: ${variant.id} - ${variant.name}.`,
    `Concept: ${variant.concept}.`,
    `Mood: ${variant.mood}.`,
    `Project type: ${quote.project_type}.`,
    `Project name: ${quote.project_name}.`,
    `Client: ${quote.client_name}.`,
    `Real dimensions: ${quote.width_mm}mm width x ${quote.depth_mm}mm depth x ${quote.height_mm}mm height.`,
    `Style: ${quote.style}.`,
    `Material required: ${quote.material_preference || "Melamina 18mm"}.`,
    `Mandatory color palette: ${quote.color_palette || "blanco / madera / negro"}.`,
    `Hardware required: ${quote.hardware_preference || "herrajes premium"}.`,
    `Budget reference: ${money(Number(quote.presupuesto || 0))}.`,
    `Customer requests: ${quote.customer_requests || "No additional requests."}`,
    `Technical notes: ${quote.technical_notes || "No technical notes."}`,
    "",
    "Manufacturable modules required in the design:",
    moduleLines,
    "",
    "Rules:",
    "- Use ALL specified materials, colors and hardware.",
    "- Preserve the material roles exactly: structure, fronts, shelves, panels and frames must keep their assigned finishes.",
    "- Respect exact real dimensions.",
    "- Design must be fully manufacturable.",
    "- Use premium commercial render quality.",
    "- Include LED lighting if requested.",
    "- This stage is ONLY for client visual approval.",
    "- The image must be ONLY the furniture/interior render.",
    "- Do NOT include text, labels, titles, tables, captions, diagrams, watermarks, measurement callouts, UI panels, or written notes inside the image.",
    "- Do NOT create a technical sheet. No typography should appear in the generated image.",
  ].join("\n");
}
