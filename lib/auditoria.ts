import { insertData } from "./db";

export async function logEvento(tipo: string, data: any) {
await insertData("logs", {
tipo,
data: JSON.stringify(data),
fecha: new Date().toISOString(),
});
}
