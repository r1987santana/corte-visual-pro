import { applySaleToInventory, applyPurchaseToInventory } from "./inventario";

export async function producirProducto(
materiaPrimaId: string,
cantidadMateria: number,
productoFinalId: string,
cantidadFinal: number,
costoProduccion: number
) {
// quitar materia prima
await applySaleToInventory(materiaPrimaId, cantidadMateria);

// agregar producto terminado
await applyPurchaseToInventory(
productoFinalId,
cantidadFinal,
costoProduccion
);
}
