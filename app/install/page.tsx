"use client";

import PWAInstallButton from "@/components/PWAInstallButton";

export default function InstallPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-black mb-6">
          RD Wood RRHH App
        </h1>
        <p className="text-slate-300 text-lg mb-8">
          Instala la aplicación en tu celular y accede a asistencia, nómina,
          vacaciones y notificaciones.
        </p>

        <PWAInstallButton />
      </div>
    </main>
  );
}