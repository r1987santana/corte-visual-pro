"use client";
export default function PerfilSeguridadPage() {
  return (
    <div className="min-h-screen bg-[#020817] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-black">Centro de Seguridad del Usuario</h1>
        <p className="text-slate-400 mt-2">FASE SaaS 3.2</p>
        <div className="mt-6 rounded-3xl border border-cyan-900/40 bg-[#07111f] p-8">
          <p>Esta página incluye:</p>
          <ul className="list-disc pl-6 mt-4 space-y-2">
            <li>Cambio de PIN</li>
            <li>Sesiones activas</li>
            <li>Cerrar otras sesiones</li>
            <li>Auditoría reciente</li>
            <li>Estado de seguridad</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
