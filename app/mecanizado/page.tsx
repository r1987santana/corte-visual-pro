"use client";

export default function MecanizadoPage() {
  return (
    <div className="p-6">
      <div className="rounded-3xl bg-gradient-to-r from-blue-700 to-cyan-500 p-6 text-white shadow-xl">
        <p className="text-xs font-black tracking-[0.35em] text-cyan-200">
          RD WOOD SYSTEM
        </p>
        <h1 className="mt-2 text-3xl font-black">Mecanizado PRO</h1>
        <p className="mt-1 text-sm text-white/80">
          Control CNC, perforaciones, ranuras, mecanizados y procesos especiales.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {["Órdenes", "Piezas", "Tiempo máquina", "Costo"].map((item) => (
          <div key={item} className="rounded-2xl bg-slate-900 p-5 text-white">
            <p className="text-xs text-slate-400">{item}</p>
            <h2 className="mt-2 text-2xl font-black">
              {item === "Costo" ? "RD$0.00" : item === "Tiempo máquina" ? "0h" : "0"}
            </h2>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-slate-900 p-6 text-white">
        <h2 className="text-xl font-black">Control de mecanizado</h2>
        <p className="mt-2 text-sm text-slate-400">
          Aquí conectaremos CNC, Aspire, tiempos, piezas procesadas y control de calidad.
        </p>
      </div>
    </div>
  );
}