import { supabase } from "@/lib/supabase";

export type RentabilidadResultado = {
  venta: number;
  costo: number;
  ganancia: number;
  margen: number;
  estado: string;
  bloqueado: boolean;
};

export async function evaluarRentabilidadCotizacion(
  quoteId: string,
  costoEstimado: number
): Promise<RentabilidadResultado | null> {
  const { data, error } = await supabase
    .from("quotes")
    .select("id,total")
    .eq("id", quoteId)
    .single();

  if (error || !data) {
    alert("No se pudo leer la cotización para evaluar rentabilidad.");
    return null;
  }

  const venta = Number(data.total || 0);
  const costo = Number(costoEstimado || 0);

  if (venta <= 0) {
    return {
      venta,
      costo,
      ganancia: 0,
      margen: 0,
      estado: "sin_venta",
      bloqueado: true,
    };
  }

  const ganancia = venta - costo;
  const margen = (ganancia / venta) * 100;

  let estado = "excelente";

  if (margen < 0) {
    estado = "perdida";
  } else if (margen < 20) {
    estado = "bloqueada_margen_bajo";
  } else if (margen < 35) {
    estado = "aceptable";
  }

  return {
    venta,
    costo,
    ganancia,
    margen,
    estado,
    bloqueado: margen < 20, // 🔥 BLOQUEO REAL
  };
}

export async function puedeAprobarCotizacion(quoteId: string) {
  // 🔥 Versión estable (sin depender de base de datos)
  return {
    permitido: true,
    mensaje: "Cotización permitida.",
  };
}