export type HardwareRequirement = {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  notes?: string;
};

function moduleText(module: any) {
  return String(module?.type || module?.module_type || module?.name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function calculateHardwareRequirements(modules: any[]): HardwareRequirement[] {
  const totals = new Map<string, HardwareRequirement>();

  const add = (
    code: string,
    name: string,
    unit: string,
    quantity: number,
    notes?: string
  ) => {
    const q = Number(quantity || 0);
    if (!q || q <= 0) return;

    const current = totals.get(code);
    if (current) {
      current.quantity += q;
      return;
    }

    totals.set(code, {
      code,
      name,
      unit,
      quantity: q,
      notes,
    });
  };

  (modules || []).forEach((m: any) => {
    const type = moduleText(m);
    const width = Number(m?.width_mm || m?.width || 0);
    const height = Number(m?.height_mm || m?.height || 0);
    const drawers = Number(m?.drawer_count || m?.drawers || 0);
    const doors = Number(m?.door_count || m?.doors || 0);
    const shelves = Number(m?.shelf_count || m?.shelves || 0);

    let doorQty = doors;

    if (!doorQty && (type.includes("aereo") || type.includes("closet") || type.includes("puerta"))) {
      doorQty = width > 900 ? 2 : 1;
    }

    if (doorQty > 0) {
      const referenceHeight = height || width;
      const hingesPerDoor =
        referenceHeight >= 2200 ? 5 :
        referenceHeight >= 1600 ? 4 :
        referenceHeight >= 900 ? 3 :
        2;

      add("HER-BIS-SUAVE", "Bisagra cierre suave", "unidad", doorQty * hingesPerDoor, "Bisagra por puerta");
      add("PLA-BIS", "Placa para bisagra", "unidad", doorQty * hingesPerDoor, "Una placa por bisagra");
      add("TOR-35X16", "Tornillo 3.5x16", "unidad", doorQty * hingesPerDoor * 8, "8 tornillos por bisagra+placa");
    }

    let drawerQty = drawers;

    if (!drawerQty && (type.includes("gaveta") || type.includes("cajon"))) {
      drawerQty = 1;
    }

    if (drawerQty > 0) {
      add("COR-TEL", "Corredera telescopica / oculta", "juego", drawerQty, "Un juego por gaveta");
      add("MIN-181-05", "Minifix 181-05", "unidad", drawerQty * 4, "Conectores por gaveta");
      add("PER-181-13", "Perno Minifix 181-13", "unidad", drawerQty * 4, "Pernos por gaveta");
      add("TAR-8", "Tarugo 8 mm", "unidad", drawerQty * 8, "Tarugos por gaveta");
    }

    let shelfQty = shelves;

    if (!shelfQty && (type.includes("repisa") || type.includes("biblioteca"))) {
      shelfQty = 1;
    }

    if (shelfQty > 0 || type.includes("closet")) {
      add("SOP-REP-5", "Soporte de repisa 5 mm", "unidad", Math.max(1, shelfQty || 1) * 4, "4 soportes por repisa");
    }

    add("MIN-181-05", "Minifix 181-05", "unidad", 8, "Base por modulo");
    add("PER-181-13", "Perno Minifix 181-13", "unidad", 8, "Base por modulo");
    add("TAR-8", "Tarugo 8 mm", "unidad", 16, "Base por modulo");
    add("TOR-ENS", "Tornillo de ensamble", "unidad", 20, "Base por modulo");
    add("TAP-182-01", "Tapon cubre minifix 182-01", "unidad", 8, "Base por modulo");
  });

  return Array.from(totals.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function exportHardwareRequirementsCsv(items: HardwareRequirement[]): string {
  const headers = ["codigo", "descripcion", "unidad", "cantidad", "notas"];

  const rows = (items || []).map((item) => [
    item.code,
    item.name,
    item.unit,
    item.quantity,
    item.notes || "",
  ]);

  return [
    headers.join(","),
    ...rows.map((row) =>
      row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
}
