"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function NuevoProyectoPage() {
  const router = useRouter();

  useEffect(() => {
    crearProyecto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function crearProyecto() {
    try {
      const code = `PRO-${Date.now()}`;

      // Insertamos SOLO campos mínimos seguros
      const { data, error } = await supabase
        .from("furniture_projects")
        .insert({
          code,
          name: "Nuevo Proyecto",
          client_name: "Cliente General",
          type: "cocina",
          status: "borrador",
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error creando proyecto:", error);
        alert(`Error creando proyecto: ${error.message}`);
        router.push("/proyectos");
        return;
      }

      if (!data?.id) {
        alert("No se pudo obtener el ID del proyecto.");
        router.push("/proyectos");
        return;
      }

      router.replace(`/proyectos/${data.id}`);
    } catch (err: any) {
      console.error("Error inesperado:", err);
      alert(`Error inesperado: ${err.message}`);
      router.push("/proyectos");
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] flex items-center justify-center text-white">
      <div className="text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-cyan-400" />
        <h1 className="mt-6 text-3xl font-black">Creando nuevo proyecto...</h1>
        <p className="mt-2 text-slate-400">
          Preparando estructura del proyecto en RD Wood System.
        </p>
      </div>
    </main>
  );
}