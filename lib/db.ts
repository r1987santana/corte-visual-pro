import { supabase } from "./supabase";
import { getProfile } from "./auth";

export async function getEmpresaId() {
  try {
    const profile = await getProfile();

    if (profile?.empresa_id) {
      return profile.empresa_id;
    }
  } catch (error) {
    console.warn("No se pudo leer empresa_id:", error);
  }

  return null;
}

export async function insertData(table: string, values: any) {
  const empresa_id = await getEmpresaId();

  const payload = empresa_id ? { ...values, empresa_id } : { ...values };

  const { data, error } = await supabase
    .from(table)
    .insert([payload])
    .select();

  if (error) throw error;

  return data;
}

export async function updateData(table: string, id: string, values: any) {
  const { data, error } = await supabase
    .from(table)
    .update(values)
    .eq("id", id)
    .select();

  if (error) throw error;

  return data;
}

export async function getInventoryById(id: string) {
  if (!id) {
    throw new Error("ID de producto inválido");
  }

  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .eq("id", id)
    .limit(1);

  if (error) throw error;

  if (!data || data.length === 0) {
    throw new Error("Producto no encontrado en inventario");
  }

  return data[0];
}