"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type ChildItem = {
  label: string;
  href: string;
};

type MenuGroup = {
  title: string;
  subtitle: string;
  code: string;
  children: ChildItem[];
};

const MENU_GROUPS: MenuGroup[] = [
  {
    title: "Dashboard CEO",
    subtitle: "Indicadores y reportes",
    code: "DB",
    children: [
      { label: "Dashboard CEO", href: "/dashboard-ceo" },
      { label: "BI CEO", href: "/bi-ceo" },
      { label: "BI Ejecutivo", href: "/bi-executive" },
      { label: "Reportes", href: "/reportes" },
    ],
  },
  {
    title: "CRM y Proyectos",
    subtitle: "Clientes, agenda y cotizaciones",
    code: "CRM",
    children: [
      { label: "Proyectos / Ventas", href: "/proyectos-ventas" },
      { label: "Clientes", href: "/clientes" },
      { label: "Referidos", href: "/referidos" },
      { label: "Cotizaciones", href: "/cotizaciones" },
      { label: "Servicios Portal", href: "/servicios-portal" },
      { label: "Cotizador Automático", href: "/cotizador-automatico" },
      { label: "Agenda", href: "/agenda" },
    ],
  },
  {
    title: "Ventas y Finanzas",
    subtitle: "Ventas, cobros y utilidad",
    code: "$",
    children: [
      { label: "Ventas", href: "/ventas" },
      { label: "Cuentas por Cobrar", href: "/cuentas-por-cobrar" },
      { label: "Cuentas por Pagar", href: "/cuentas-por-pagar" },
    ],
  },
  {
    title: "Almacén e Inventario",
    subtitle: "Stock, compras y movimientos",
    code: "INV",
    children: [
      { label: "Inventario", href: "/inventario" },
      { label: "Compras", href: "/compras" },
      { label: "Proveedores", href: "/proveedores" },
    ],
  },
  {
    title: "Producción y CNC",
    subtitle: "Corte, canteo, CNC y QR",
    code: "CNC",
    children: [
      { label: "Producción", href: "/produccion" },
      { label: "Corte PRO", href: "/corte" },
      { label: "Disenos Personalizados", href: "/corte/disenos-personalizados" },
      { label: "QR Módulos", href: "/qr-modulos" },
    ],
  },
  {
    title: "IA Diseño",
    subtitle: "Diseño, renders y módulos",
    code: "AI",
    children: [
      { label: "IA Diseño", href: "/ia-diseno" },
    ],
  },
  {
    title: "Campo e Instalación",
    subtitle: "Transporte e instalación",
    code: "INS",
    children: [
      { label: "Transporte", href: "/transporte" },
      { label: "Instalación", href: "/instalacion" },
      { label: "Postventa", href: "/postventa" },
    ],
  },
  {
    title: "Administración",
    subtitle: "Usuarios y ajustes",
    code: "ADM",
    children: [
      { label: "Configuración", href: "/configuracion" },
      { label: "Usuarios", href: "/usuarios" },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function SidebarClient() {
  const pathname = usePathname() || "/";
  const [manualOpen, setManualOpen] = useState<Record<number, boolean>>({});

  const activeGroupIndex = useMemo(() => {
    const index = MENU_GROUPS.findIndex((group) =>
      group.children.some((child) => isActivePath(pathname, child.href))
    );
    return index >= 0 ? index : 0;
  }, [pathname]);

  return (
    <aside
      className="rdw-sidebar"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "280px",
        height: "100vh",
        zIndex: 70,
        background: "#020817",
        borderRight: "1px solid rgba(30,41,59,0.9)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
      }}
    >
      <div className="flex h-full flex-col bg-[#020817] text-slate-100">
        <div className="shrink-0 border-b border-slate-800 px-5 py-5">
          <p className="text-[10px] font-black uppercase tracking-[0.34em] text-sky-400">
            RD WOOD SYSTEM
          </p>

          <h1 className="mt-2 text-xl font-black tracking-tight text-white">
            ERP Profesional
          </h1>

          <p className="mt-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-slate-400">
            Sidebar unificado · Módulos integrados
          </p>
        </div>

        <div className="rdw-sidebar-scroll flex-1 px-3 py-4">
          <nav className="space-y-2">
            {MENU_GROUPS.map((group, index) => {
              const groupActive = index === activeGroupIndex;
              const isOpen = manualOpen[index] ?? groupActive;

              return (
                <section key={group.title}>
                  <button
                    type="button"
                    onClick={() =>
                      setManualOpen((prev) => ({
                        ...prev,
                        [index]: !isOpen,
                      }))
                    }
                    className={[
                      "w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
                      groupActive
                        ? "border-sky-500/50 bg-sky-500/10"
                        : "border-transparent hover:border-slate-700 hover:bg-slate-900",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={[
                          "flex h-9 w-9 flex-none items-center justify-center rounded-lg border text-[11px] font-black",
                          groupActive
                            ? "border-sky-400/50 bg-sky-400/10 text-sky-300"
                            : "border-slate-700 bg-slate-950 text-slate-500",
                        ].join(" ")}
                      >
                        {group.code}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white">
                          {group.title}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {group.subtitle}
                        </p>
                      </div>

                      <span
                        className={[
                          "text-slate-500 transition-transform",
                          isOpen ? "rotate-90" : "",
                        ].join(" ")}
                      >
                        ›
                      </span>
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="ml-[18px] mt-1.5 space-y-1 border-l border-slate-800 pl-3">
                      {group.children.map((child) => {
                        const active = isActivePath(pathname, child.href);

                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={[
                              "block rounded-lg px-3 py-2 text-[13px] font-semibold transition-all",
                              active
                                ? "bg-sky-500 text-white"
                                : "text-slate-400 hover:bg-slate-900 hover:text-white",
                            ].join(" ")}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </nav>
        </div>

        <div className="shrink-0 border-t border-slate-800 p-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <p className="text-xs font-black text-slate-200">Sistema activo</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Auditoría en progreso
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
