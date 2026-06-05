"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, Brain, Factory, Gauge, PackageSearch, Settings, ShieldCheck, Users } from "lucide-react";

const routes = [
  { href: "/dashboard-ceo", label: "Dashboard CEO", icon: <Gauge /> },
  { href: "/configuracion", label: "Centro SaaS", icon: <Settings /> },
  { href: "/usuarios", label: "Usuarios", icon: <Users /> },
  { href: "/inventario-inteligente", label: "Inventario", icon: <PackageSearch /> },
  { href: "/produccion", label: "Producción", icon: <Factory /> },
  { href: "/ia-diseno", label: "IA Diseño", icon: <Brain /> },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#020817] p-6 text-white">
      <section className="mx-auto max-w-7xl rounded-3xl border border-cyan-900/50 bg-gradient-to-br from-[#081421] via-[#0b1830] to-[#111b3f] p-8 shadow-2xl shadow-black/40">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.30em] text-cyan-300">
          <BadgeCheck size={14} /> FASE SAAS 1
        </div>
        <h1 className="mt-5 text-4xl font-black md:text-6xl">RD Wood System SaaS PRO</h1>
        <p className="mt-4 max-w-3xl text-slate-300">Layout SaaS, sidebar dinámico, usuarios, permisos, auditoría, branding y configuración central.</p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Info title="SaaS Ready" text="Base para vender el sistema." icon={<ShieldCheck />} />
          <Info title="Permisos" text="Control por módulo y rol." icon={<Users />} />
          <Info title="Branding" text="Logo y tema dinámico." icon={<Settings />} />
        </div>
      </section>
      <section className="mx-auto mt-6 grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-3">
        {routes.map((r) => (
          <Link key={r.href} href={r.href} className="group rounded-3xl border border-cyan-900/45 bg-[#07111f] p-5 transition hover:border-cyan-400/40 hover:bg-cyan-500/10">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">{r.icon}</div>
            <div className="flex items-center justify-between"><h2 className="text-xl font-black">{r.label}</h2><ArrowRight className="text-slate-500 transition group-hover:text-cyan-300" /></div>
          </Link>
        ))}
      </section>
    </main>
  );
}

function Info({ title, text, icon }: { title: string; text: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-cyan-400/15 bg-[#030817] p-5">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">{icon}</div>
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{text}</p>
    </div>
  );
}
