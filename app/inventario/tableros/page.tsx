"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CrearTablero() {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("4x8");
  const [grosor, setGrosor] = useState("18");
  const [costo, setCosto] = useState("");

  function calcular() {
    let largo = 2440;
    let ancho = tipo === "7x8" ? 2134 : 1220;

    const area = (largo * ancho) / 1000000;

    return { largo, ancho, area };
  }

  async function guardar() {
    const { largo, ancho, area } = calcular();

    const nombreFinal = `${nombre} ${grosor}mm ${tipo}`;

    const { error } = await supabase.from("inventory").insert({
      material: nombreFinal,
      tipo_material: "tablero",
      tipo_tablero: tipo,
      largo_mm: largo,
      ancho_mm: ancho,
      grosor_mm: Number(grosor),
      area_m2: area,
      es_tablero: true,
      stock: 0,
      costo_promedio: Number(costo),
      unidad: "hoja",
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Tablero creado correctamente");
  }

  return (
    <div className="p-6 text-white bg-black min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Crear Tablero</h1>

      <input
        placeholder="Nombre (Ej: Melamina Blanca)"
        onChange={(e) => setNombre(e.target.value)}
        className="block mb-3 p-2 text-black"
      />

      <select onChange={(e) => setTipo(e.target.value)} className="block mb-3 text-black p-2">
        <option value="4x8">4x8</option>
        <option value="7x8">7x8</option>
      </select>

      <select onChange={(e) => setGrosor(e.target.value)} className="block mb-3 text-black p-2">
        <option value="6">6mm</option>
        <option value="15">15mm</option>
        <option value="18">18mm</option>
        <option value="38">38mm</option>
      </select>

      <input
        placeholder="Costo por hoja"
        type="number"
        onChange={(e) => setCosto(e.target.value)}
        className="block mb-3 text-black p-2"
      />

      <button onClick={guardar} className="bg-green-500 px-4 py-2 font-bold">
        Guardar
      </button>
    </div>
  );
}