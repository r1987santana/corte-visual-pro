import {
  buildProductionMaterialVerificationRows,
  centroTvRegressionModules,
  enrichProductionModulesMaterialRoles,
  productionMaterialColorToken,
} from "../lib/productionMaterialPlan.ts";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const context = {
  project_type: "centro_tv",
  color_palette: "ROBLE / BLANCO",
};

const modules = enrichProductionModulesMaterialRoles(centroTvRegressionModules(), context);
const moduleById = new Map(modules.map((module) => [module.id, module]));

assert(
  productionMaterialColorToken(moduleById.get("modulo-bajo-tv")?.material_roles?.structure?.material) === "roble",
  "Modulo bajo TV debe usar melamina roble en estructura."
);
assert(
  productionMaterialColorToken(moduleById.get("repisas-flotantes")?.material_roles?.structure?.material) === "roble",
  "Biblioteca/repisas debe usar roble en laterales, fondo, techo e inferior."
);
assert(
  productionMaterialColorToken(moduleById.get("repisas-flotantes")?.material_roles?.shelves?.material) === "blanco",
  "Biblioteca/repisas debe usar blanco en repisas/entrepanos."
);
assert(
  productionMaterialColorToken(moduleById.get("panel-decorativo")?.material_roles?.panel?.material) === "blanco",
  "Panel decorativo TV debe usar blanco."
);

const goodRows = buildProductionMaterialVerificationRows(
  [
    {
      module_name: "Modulo bajo TV",
      part_name: "Frente gaveta 1",
      material_name: "Melamina Roble Natural 18mm 7x8",
    },
    {
      module_name: "Repisas flotantes biblioteca",
      part_name: "Lateral izquierdo biblioteca / repisa",
      material_name: "Melamina Roble Natural 18mm 7x8",
    },
    {
      module_name: "Repisas flotantes biblioteca",
      part_name: "Entrepanos biblioteca / repisa #1",
      material_name: "Melamina Blanco Alto Brillo 18mm 4x8",
    },
    {
      module_name: "Panel decorativo TV",
      part_name: "Faja inferior Bardolino",
      material_name: "Melamina Blanco Alto Brillo 18mm 4x8",
    },
    {
      module_name: "Panel decorativo TV",
      part_name: "Canto PVC Blanco Alto Brillo panel central TV",
      material_name: "Canto PVC Blanco 22mm 1mm",
    },
    {
      module_name: "Modulo bajo TV",
      part_name: "Bisagra cierre suave",
      material_name: "Bisagra cierre suave",
    },
    {
      module_name: "Repisas flotantes",
      part_name: "Canto PVC Roble Natural estructura biblioteca / repisa #1",
      material_name: "Canto PVC Roble 22mm 1mm",
    },
    {
      module_name: "Repisas flotantes",
      part_name: "Soportes repisas #1",
      material_name: "Soporte de repisa Melamina 18mm",
    },
  ],
  context
);

const wrongRows = buildProductionMaterialVerificationRows(
  [
    {
      module_name: "Panel decorativo TV",
      part_name: "Faja inferior Bardolino",
      material_name: "Melamina Bardolino 18mm 7x8",
    },
  ],
  context
);

const wrongKindRows = buildProductionMaterialVerificationRows(
  [
    {
      module_name: "Panel decorativo TV",
      part_name: "Canto PVC Blanco Alto Brillo panel central TV",
      material_name: "Melamina Blanco Alto Brillo 18mm 4x8",
    },
  ],
  context
);

assert(goodRows.every((row) => row.status === "ok"), `Filas correctas deben pasar: ${JSON.stringify(goodRows, null, 2)}`);
assert(wrongRows[0]?.status === "mismatch", `Panel blanco vinculado a Bardolino debe fallar: ${JSON.stringify(wrongRows, null, 2)}`);
assert(wrongKindRows[0]?.status === "mismatch", `Canto PVC vinculado a tablero debe fallar: ${JSON.stringify(wrongKindRows, null, 2)}`);

console.log("OK Centro TV: roble/blanco separado, canto PVC validado y choque de tipo detectado.");
