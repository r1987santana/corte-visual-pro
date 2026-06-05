import { getInventoryById } from "./db";

export async function calcularGanancia(
productId: string,
cantidad: number,
precioVenta: number
) {
const producto = await getInventoryById(productId);

const costo = producto.cost * cantidad;
const ingreso = precioVenta * cantidad;
const ganancia = ingreso - costo;

return {
ingreso,
costo,
ganancia,
margen: (ganancia / ingreso) * 100,
};
}
