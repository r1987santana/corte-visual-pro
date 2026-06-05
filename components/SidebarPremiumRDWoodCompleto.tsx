"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Factory,
  FileCheck2,
  FileText,
  Gauge,
  LayoutDashboard,
  PackageSearch,
  Palette,
  ReceiptText,
  Scissors,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UserCog,
  UserRoundCheck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";

type NavChild = {
  label: string;
  href: string;
  subtitle?: string;
};

type NavItem = {
  label: string;
  subtitle: string;
  href: string;
  icon: React.ReactNode;
  match?: string[];
  children?: NavChild[];
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: "Centro de mando",
    items: [
      {
        label: "Dashboard CEO",
        subtitle: "Indicadores y reportes",
        href: "/dashboard-ceo",
        icon: <LayoutDashboard size={20} />,
        match: ["/dashboard-ceo"],
      },
    ],
  },
  {
    title: "Comercial",
    items: [
      {
        label: "CRM y Agenda",
        subtitle: "Clientes, calendario y seguimiento",
        href: "/agenda",
        icon: <CalendarDays size={20} />,
        match: ["/agenda"],
      },
      {
        label: "Cotizador Automático",
        subtitle: "Cotizaciones inteligentes",
        href: "/cotizador-automatico",
        icon: <ReceiptText size={20} />,
        match: ["/cotizador-automatico"],
      },
      {
        label: "Ventas",
        subtitle: "Ventas, cobros y utilidad",
        href: "/ventas",
        icon: <Wallet size={20} />,
        match: ["/ventas"],
      },
    ],
  },
  {
    title: "Inventario y compras",
    items: [
      {
        label: "Inventario Inteligente",
        subtitle: "Stock, costos y movimientos",
        href: "/inventario-inteligente",
        icon: <PackageSearch size={20} />,
        match: ["/inventario-inteligente"],
      },
      {
        label: "Compras",
        subtitle: "Órdenes y recepción",
        href: "/compras",
        icon: <ShoppingCart size={20} />,
        match: ["/compras"],
      },
    ],
  },
  {
    title: "Diseño y producción",
    items: [
      {
        label: "IA Diseño",
        subtitle: "Diseños y renders inteligentes",
        href: "/ia-diseno",
        icon: <Brain size={20} />,
        match: ["/ia-diseno"],
      },
      {
        label: "Producción",
        subtitle: "Órdenes y control de planta",
        href: "/produccion",
        icon: <Factory size={20} />,
        match: ["/produccion"],
      },
      {
        label: "Optimización de Corte",
        subtitle: "Corte, nesting y tableros",
        href: "/optimizacion-corte",
        icon: <Scissors size={20} />,
        match: ["/optimizacion-corte"],
      },
    ],
  },
  {
    title: "Campo e instalación",
    items: [
      {
        label: "Transporte",
        subtitle: "Despacho y evidencia",
        href: "/transporte",
        icon: <Truck size={20} />,
        match: ["/transporte"],
      },
      {
        label: "Instalación",
        subtitle: "Montaje y avance en campo",
        href: "/instalacion",
        icon: <Wrench size={20} />,
        match: ["/instalacion"],
      },
      {
        label: "Verificación",
        subtitle: "Checklist y entrega final",
        href: "/verificacion",
        icon: <FileCheck2 size={20} />,
        match: ["/verificacion"],
      },
    ],
  },
  {
    title: "Recursos humanos",
    items: [
      {
        label: "RRHH Maestro",
        subtitle: "Dashboard humano CEO",
        href: "/rrhh",
        icon: <Users size={20} />,
        match: ["/rrhh"],
        children: [
          { label: "Dashboard RRHH", href: "/rrhh" },
          { label: "Empleados", href: "/rrhh/empleados" },
          { label: "Registro facial", href: "/rrhh/registro-facial" },
          { label: "Ponche facial", href: "/rrhh/ponche-facial" },
          { label: "Asistencia", href: "/rrhh/asistencia" },
          { label: "Nómina", href: "/rrhh/nomina" },
          { label: "Recibos nómina", href: "/rrhh/recibos-nomina" },
        ],
      },
    ],
  },
  {
    title: "Administración",
    items: [
      {
        label: "Usuarios",
        subtitle: "Roles, accesos y permisos",
        href: "/usuarios",
        icon: <UserCog size={20} />,
        match: ["/usuarios"],
      },
      {
        label: "Configuración",
        subtitle: "Sistema, empresa y parámetros",
        href: "/configuracion",
        icon: <Settings size={20} />,
        match: ["/configuracion"],
      },
    ],
  },
];

function isActive(pathname: string, item: NavItem) {
  if (item.match?.length) {
    return item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
  }
  return pathname === item.href;
}

function childIsActive(pathname: string, child: NavChild) {
  return pathname === child.href || pathname.startsWith(`${child.href}/`);
}

function SidebarItem({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isActive(pathname, item);
  const hasChildren = Boolean(item.children?.length);
  const childActive = item.children?.some((child) => childIsActive(pathname, child)) || false;
  const [open, setOpen] = useState(active || childActive);

  return (
    <div>
      <div className="group relative">
        <Link
          href={item.href}
          className={[
            "relative flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all duration-200",
            active || childActive
              ? "border-cyan-400/45 bg-cyan-500/15 shadow-[0_0_34px_rgba(6,182,212,0.14)]"
              : "border-transparent bg-transparent hover:border-cyan-500/25 hover:bg-cyan-500/[0.08]",
          ].join(" ")}
        >
          <div
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all duration-200",
              active || childActive
                ? "border-cyan-300/40 bg-cyan-400/20 text-cyan-200"
                : "border-slate-800 bg-slate-900/80 text-slate-300 group-hover:border-cyan-500/30 group-hover:text-cyan-200",
            ].join(" ")}
          >
            {item.icon}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black tracking-tight text-white">
              {item.label}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
              {item.subtitle}
            </p>
          </div>

          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-cyan-200"
              aria-label="Abrir submenú"
            >
              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : active ? (
            <ChevronRight size={16} className="shrink-0 text-cyan-300" />
          ) : null}
        </Link>
      </div>

      {hasChildren && open ? (
        <div className="ml-[58px] mt-2 space-y-1 border-l border-cyan-500/20 pl-3">
          {item.children?.map((child) => {
            const cActive = childIsActive(pathname, child);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={[
                  "block rounded-xl px-3 py-2 text-xs font-black transition",
                  cActive
                    ? "bg-cyan-500/15 text-cyan-100"
                    : "text-slate-400 hover:bg-slate-900 hover:text-cyan-200",
                ].join(" ")}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function SidebarPremiumRDWoodCompleto() {
  const pathname = usePathname();

  const currentTitle = useMemo(() => {
    for (const group of navGroups) {
      for (const item of group.items) {
        if (isActive(pathname, item)) return item.label;
        const child = item.children?.find((c) => childIsActive(pathname, c));
        if (child) return child.label;
      }
    }
    return "RD Wood System";
  }, [pathname]);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[304px] flex-col border-r border-slate-800/80 bg-[#030817] text-white shadow-2xl shadow-black/40">
      <div className="border-b border-slate-800/80 px-5 py-6">
        <Link href="/dashboard-ceo" className="flex items-center gap-3">
          <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-700 shadow-lg shadow-cyan-500/20">
            <span className="text-4xl font-black text-white">R</span>
            <span className="absolute -bottom-3 -right-2 h-8 w-8 rounded-full bg-white/20" />
          </div>

          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.30em] text-cyan-300">
              RD Wood System
            </p>
            <h1 className="text-xl font-black leading-tight tracking-tight">
              ERP Profesional
            </h1>
          </div>
        </Link>

        <div className="mt-5 rounded-2xl border border-slate-800 bg-[#07111f] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
            Módulo activo
          </p>
          <p className="mt-1 truncate text-sm font-black text-cyan-100">
            {currentTitle}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5 sidebar-premium-scroll">
        <div className="space-y-6">
          {navGroups.map((group) => (
            <section key={group.title}>
              <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.26em] text-slate-600">
                {group.title}
              </p>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <SidebarItem key={item.label} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-800/80 p-4">
        <div className="rounded-2xl border border-slate-800 bg-[#07111f] p-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
            </span>
            <div>
              <p className="text-sm font-black text-white">Sistema activo</p>
              <p className="text-xs text-slate-500">Todos los módulos operativos</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
