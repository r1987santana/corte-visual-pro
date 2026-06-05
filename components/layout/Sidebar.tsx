// COMPONENTE COMPLETO PARA AGREGAR EN TU SIDEBAR
// ARCHIVO: components/layout/Sidebar.tsx
// O donde tengas definido el menú principal

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  LayoutDashboard,
  ClipboardList,
  Factory,
  Scissors,
  Truck,
  Boxes,
  ShoppingCart,
  BrainCircuit,
  CalendarDays,
  FileText,
  Wallet,
  ChevronDown,
} from "lucide-react";

const menu = [
  {
    title: "Dashboard CEO",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Indicadores generales",
  },

  {
    title: "CRM y Agenda",
    href: "/crm",
    icon: CalendarDays,
    description: "Clientes y levantamientos",
  },

  {
    title: "Cotización",
    href: "/cotizaciones",
    icon: FileText,
    description: "Cotizador y propuestas",
    children: [
      {
        title: "Cotizaciones",
        href: "/cotizaciones",
      },
    ],
  },

  {
    title: "Ventas Mostrador",
    href: "/ventas",
    icon: Wallet,
    description: "Venta directa de articulos",
  },

  // =========================
  // IA DISEÑO
  // =========================
  {
    title: "IA Diseño",
    href: "/ia-diseno",
    icon: BrainCircuit,
    description: "Renders y aprobación visual",
    children: [
      {
        title: "IA Diseño",
        href: "/ia-diseno",
      },
      {
        title: "Portal Cliente",
        href: "/portal-cliente",
      },
    ],
  },

  // =========================
  // PRODUCCIÓN
  // =========================
  {
    title: "Producción",
    href: "/produccion",
    icon: Factory,
    description: "Órdenes y planta",
    children: [
      {
        title: "Panel Producción",
        href: "/produccion",
      },
      {
        title: "QR / Trazabilidad",
        href: "/qr-trazabilidad",
      },
    ],
  },

  // =========================
  // CORTE Y CNC
  // =========================
  {
    title: "Corte y CNC",
    href: "/corte",
    icon: Scissors,
    description: "Nesting y corte",
    children: [
      {
        title: "Corte Inteligente",
        href: "/corte",
      },
      {
        title: "Disenos Personalizados",
        href: "/corte/disenos-personalizados",
      },
      {
        title: "Nesting CNC",
        href: "/nesting",
      },
    ],
  },

  // =========================
  // HELPDESK OPERATIVO PRO
  // =========================
  {
    title: "Solicitudes Internas",
    href: "/solicitudes-internas/requisicion-compra",
    icon: ClipboardList,
    description: "Requisiciones y soporte operativo",
    children: [
      {
        title: "Requisición Compra",
        href: "/solicitudes-internas/requisicion-compra",
      },
      {
        title: "Centro de Requisiciones",
        href: "/solicitudes-internas/requisicion-almacen",
      },
      {
        title: "Faltantes Proyecto",
        href: "/solicitudes-internas/faltantes-proyecto",
      },
      {
        title: "Mantenimiento",
        href: "/solicitudes-internas/mantenimiento",
      },
    ],
  },

  // =========================
  // LOGÍSTICA
  // =========================
  {
    title: "Logística e Instalación",
    href: "/logistica",
    icon: Truck,
    description: "Transporte, instalación y entrega",
  },

  // =========================
  // INVENTARIO
  // =========================
  {
    title: "Inventario",
    href: "/inventario",
    icon: Boxes,
    description: "Stock, almacén y movimientos",
  },

  // =========================
  // COMPRAS
  // =========================
  {
    title: "Compras",
    href: "/compras",
    icon: ShoppingCart,
    description: "Órdenes y cuentas por pagar",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[260px] bg-[#020817] border-r border-cyan-950 h-screen overflow-y-auto">
      <div className="p-4 border-b border-cyan-950">
        <h1 className="text-white text-xl font-black tracking-wide">
          RD WOOD SYSTEM
        </h1>

        <p className="text-cyan-400 text-xs mt-1">
          ERP Profesional Industrial
        </p>
      </div>

      <div className="p-3 space-y-2">
        {menu.map((item) => {
          const Icon = item.icon;

          const active =
            pathname === item.href ||
            item.children?.some((c) => pathname === c.href);

          return (
            <div
              key={item.title}
              className="rounded-2xl border border-cyan-950 bg-[#071224]"
            >
              <Link
                href={item.href}
                className={`
                  flex items-center justify-between
                  px-4 py-4
                  transition-all
                  rounded-2xl
                  ${
                    active
                      ? "bg-cyan-500/10 border-cyan-400"
                      : "hover:bg-cyan-500/5"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="
                      w-11 h-11 rounded-xl
                      bg-cyan-500/10
                      border border-cyan-500/20
                      flex items-center justify-center
                    "
                  >
                    <Icon className="w-5 h-5 text-cyan-400" />
                  </div>

                  <div>
                    <div className="text-white font-bold text-sm">
                      {item.title}
                    </div>

                    <div className="text-slate-400 text-[11px]">
                      {item.description}
                    </div>
                  </div>
                </div>

                {item.children && (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </Link>

              {item.children && (
                <div className="pb-3 px-3 space-y-1">
                  {item.children.map((child) => {
                    const childActive = pathname === child.href;

                    return (
                      <Link
                        key={child.title}
                        href={child.href}
                        className={`
                          flex items-center
                          px-4 py-2 rounded-xl text-sm transition-all
                          ${
                            childActive
                              ? "bg-cyan-500 text-black font-bold"
                              : "text-slate-300 hover:bg-cyan-500/10"
                          }
                        `}
                      >
                        {child.title}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
