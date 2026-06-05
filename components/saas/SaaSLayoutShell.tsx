"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Brain,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Factory,
  FileText,
  FolderKanban,
  Gauge,
  Landmark,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPinned,
  PackageCheck,
  PackageSearch,
  ReceiptText,
  Route,
  Scissors,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  Trophy,
  UserCog,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";

import {
  AppUser,
  DEFAULT_SAAS_SETTINGS,
  PermissionKey,
  SaasSettings,
  getCurrentAppUser,
  getSaasSettings,
  hasPermission,
} from "@/lib/saas/saas-client";
import {
  AINotification,
  getAINotifications,
  markAINotificationAsRead,
  markAllAINotificationsAsRead,
} from "@/lib/ai/notification-center";

const ModuleAIAssistant = dynamic(() => import("@/components/ai/ModuleAIAssistant"), {
  ssr: false,
  loading: () => null,
});

type NavChild = {
  label: string;
  href: string;
  permission: PermissionKey;
};

type NavItem = {
  label: string;
  subtitle: string;
  href: string;
  permission: PermissionKey;
  icon: React.ReactNode;
  match?: string[];
  children?: NavChild[];
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

/**
 * FASE 44.1.2 – Sidebar sin Módulos Viejos PRO
 *
 * Auditoría aplicada:
 * - Se conserva el layout activo real: components/saas/SaaSLayoutShell.tsx
 * - No se borran rutas ni módulos internos.
 * - Se eliminan referencias legacy de match[] sin borrar módulos físicos.
 * - Se agrupa el flujo maestro del negocio:
 *   CEO → Comercial → Diseño → Producción → CNC → Campo → Postventa → Inventario/Compras → RRHH → Sistema.
 * - Solo se usan PermissionKey existentes para no romper roles.
 */
const navGroups: NavGroup[] = [
  {
    title: "Centro Ejecutivo",
    items: [
      {
        label: "Dashboard CEO",
        subtitle: "Indicadores generales",
        href: "/dashboard-ceo",
        permission: "dashboard_ceo",
        icon: <LayoutDashboard size={20} />,
        match: ["/dashboard-ceo", "/ceo/postventa"],
        children: [
          { label: "Dashboard CEO", href: "/dashboard-ceo", permission: "dashboard_ceo" },
          { label: "Postventa CEO", href: "/ceo/postventa", permission: "dashboard_ceo" },
        ],
      },
      {
        label: "Contabilidad",
        subtitle: "Ingresos, egresos y auditoria",
        href: "/contabilidad",
        permission: "dashboard_ceo",
        icon: <Landmark size={20} />,
        match: ["/contabilidad", "/dashboard-financiero", "/pagos"],
        children: [
          { label: "Contabilidad Blindada", href: "/contabilidad", permission: "dashboard_ceo" },
          { label: "Dashboard Financiero", href: "/dashboard-financiero", permission: "dashboard_ceo" },
          { label: "Pagos", href: "/pagos", permission: "dashboard_ceo" },
        ],
      },
    ],
  },
  {
    title: "Cultura Operativa",
    items: [
      {
        label: "Gamificacion",
        subtitle: "Puntos, ranking y recompensas",
        href: "/gamificacion",
        permission: "produccion",
        icon: <Trophy size={20} />,
        match: ["/gamificacion", "/tv/gamificacion"],
        children: [
          { label: "Panel Gamificacion", href: "/gamificacion", permission: "produccion" },
          { label: "TV Gamificacion", href: "/tv/gamificacion", permission: "produccion" },
        ],
      },
    ],
  },
  {
    title: "Comercial",
    items: [
      {
        label: "CRM y Agenda",
        subtitle: "Clientes y levantamientos",
        href: "/agenda",
        permission: "agenda",
        icon: <CalendarDays size={20} />,
        match: ["/agenda", "/clientes", "/levantamientos", "/referidos"],
        children: [
          { label: "Agenda", href: "/agenda", permission: "agenda" },
          { label: "Clientes", href: "/clientes", permission: "agenda" },
          { label: "Referidos", href: "/referidos", permission: "agenda" },
          { label: "Levantamientos", href: "/levantamientos", permission: "agenda" },
        ],
      },
      {
        label: "Cotización",
        subtitle: "Cotizador y propuestas",
        href: "/cotizador-automatico",
        permission: "cotizador",
        icon: <ReceiptText size={20} />,
        match: ["/cotizador-automatico", "/cotizaciones", "/contratos", "/servicios-portal"],
        children: [
          { label: "Cotizador Automático", href: "/cotizador-automatico", permission: "cotizador" },
          { label: "Cotizaciones", href: "/cotizaciones", permission: "cotizador" },
          { label: "Servicios Portal", href: "/servicios-portal", permission: "cotizador" },
          { label: "Contratos", href: "/contratos", permission: "cotizador" },
        ],
      },
      {
        label: "Ventas Mostrador",
        subtitle: "Articulos por unidad",
        href: "/ventas",
        permission: "ventas",
        icon: <Wallet size={20} />,
        match: ["/ventas"],
        children: [
          { label: "Venta Mostrador", href: "/ventas", permission: "ventas" },
        ],
      },
    ],
  },
  {
    title: "Diseño y Aprobación",
    items: [
      {
        label: "IA Diseño",
        subtitle: "Renders y aprobación visual",
        href: "/ia-diseno",
        permission: "ia_diseno",
        icon: <Brain size={20} />,
        match: ["/ia-diseno"],
        children: [
          { label: "IA Diseño", href: "/ia-diseno", permission: "ia_diseno" },
        ],
      },
    ],
  },
  {
    title: "Producción",
    items: [
      {
        label: "Producción",
        subtitle: "Órdenes y planta",
        href: "/produccion",
        permission: "produccion",
        icon: <Factory size={20} />,
        match: [
          "/produccion",
          "/trazabilidad-piezas",
        ],
        children: [
          { label: "Panel Producción", href: "/produccion", permission: "produccion" },
          { label: "QR / Trazabilidad", href: "/trazabilidad-piezas", permission: "produccion" },
        ],
      },
      {
        label: "Corte y CNC",
        subtitle: "Nesting y corte",
        href: "/corte",
        permission: "corte",
        icon: <Scissors size={20} />,
        match: [
          "/corte",
          "/corte/disenos-personalizados",
        ],
        children: [
          { label: "Corte Inteligente", href: "/corte", permission: "corte" },
          { label: "Disenos Personalizados", href: "/corte/disenos-personalizados", permission: "corte" },
        ],
      },
    ],
  },
  {
    title: "Campo",
    items: [
      {
        label: "Logística e Instalación",
        subtitle: "Transporte, instalación y entrega",
        href: "/transporte",
        permission: "transporte",
        icon: <Truck size={20} />,
        match: [
          "/transporte",
          "/instalacion",
          "/verificacion",
          "/entrega-final",
        ],
        children: [
          { label: "Transporte", href: "/transporte", permission: "transporte" },
          { label: "Instalación", href: "/instalacion", permission: "instalacion" },
          { label: "Verificación", href: "/verificacion", permission: "verificacion" },
          { label: "Entrega Final", href: "/entrega-final", permission: "verificacion" },
        ],
      },
    ],
  },
  {
    title: "Postventa",
    items: [
      {
        label: "Postventa",
        subtitle: "Garantías y tickets",
        href: "/postventa",
        permission: "ventas",
        icon: <ShieldCheck size={20} />,
        match: ["/postventa", "/tecnico"],
        children: [
          { label: "Tickets Garantía", href: "/postventa", permission: "ventas" },
          { label: "Agenda Visitas", href: "/postventa/agenda", permission: "ventas" },
          { label: "App Técnico", href: "/tecnico", permission: "ventas" },
          { label: "Costos Garantía", href: "/postventa/costos-garantia", permission: "ventas" },
        ],
      },
    ],
  },
  {
    title: "Inventario y Compras",
    items: [
      {
        label: "Inventario",
        subtitle: "Stock, almacén y movimientos",
        href: "/inventario-inteligente",
        permission: "inventario",
        icon: <PackageSearch size={20} />,
        match: ["/inventario-inteligente", "/almacen"],
        children: [
          { label: "Inventario Inteligente", href: "/inventario-inteligente", permission: "inventario" },
          { label: "Movimientos", href: "/inventario-inteligente/movimientos", permission: "inventario" },
          { label: "Recepción Compras", href: "/inventario-inteligente/recepcion-compras", permission: "inventario" },
          { label: "Centro de Requisiciones", href: "/inventario-inteligente/requisiciones", permission: "inventario" },
        ],
      },
      {
        label: "Compras",
        subtitle: "Proveedores, órdenes y CxP",
        href: "/compras",
        permission: "compras",
        icon: <ShoppingCart size={20} />,
        match: ["/compras", "/proveedores", "/ordenes-compra", "/cuentas-por-pagar"],
        children: [
          { label: "Compras", href: "/compras", permission: "compras" },
          { label: "Proveedores", href: "/proveedores", permission: "compras" },
          { label: "Órdenes de Compra", href: "/ordenes-compra", permission: "compras" },
          { label: "Cuentas por Pagar", href: "/cuentas-por-pagar", permission: "compras" },
        ],
      },
    ],
  },
  {
    title: "RRHH",
    items: [
      {
        label: "RRHH",
        subtitle: "Empleados, asistencia y nómina",
        href: "/rrhh",
        permission: "rrhh",
        icon: <Users size={20} />,
        match: [
          "/rrhh",
          "/rrhh/empleados",
          "/rrhh/equipos",
          "/rrhh/registro-facial",
          "/rrhh/ponche-facial",
          "/rrhh/asistencia",
          "/rrhh/nomina",
          "/rrhh/recibos-nomina",
          "/rrhh/auditoria",
          "/lms",
        ],
        children: [
          { label: "Dashboard RRHH", href: "/rrhh", permission: "rrhh" },
          { label: "Empleados", href: "/rrhh/empleados", permission: "rrhh" },
          { label: "Equipos Operativos", href: "/rrhh/equipos", permission: "rrhh" },
          { label: "Registro Facial", href: "/rrhh/registro-facial", permission: "rrhh" },
          { label: "Ponche Facial", href: "/rrhh/ponche-facial", permission: "rrhh" },
          { label: "Asistencia", href: "/rrhh/asistencia", permission: "rrhh" },
          { label: "Nómina", href: "/rrhh/nomina", permission: "rrhh" },
          { label: "Recibos Nómina", href: "/rrhh/recibos-nomina", permission: "rrhh" },
          { label: "Auditoria RRHH", href: "/rrhh/auditoria", permission: "rrhh" },
          { label: "LMS / Cursos", href: "/lms", permission: "rrhh" },
        ],
      },
    ],
  },
  {
    title: "Mi Portal",
    items: [
      {
        label: "Portal Empleado",
        subtitle: "Perfil, recibos, cursos y certificados",
        href: "/portal-empleado",
        permission: "portal_empleado",
        icon: <Users size={20} />,
        match: ["/portal-empleado", "/employee-self-service"],
        children: [
          { label: "Mi Portal", href: "/portal-empleado", permission: "portal_empleado" },
        ],
      },
    ],
  },
  {
    title: "Solicitudes Internas",
    items: [
      {
        label: "Solicitudes Internas",
        subtitle: "Requisiciones y soporte operativo",
        href: "/solicitudes-internas/requisicion-compra",
        permission: "compras",
        icon: <ClipboardList size={20} />,
        match: ["/solicitudes-internas"],
        children: [
          { label: "Requisición Compra", href: "/solicitudes-internas/requisicion-compra", permission: "compras" },
          { label: "Centro de Requisiciones", href: "/solicitudes-internas/requisicion-almacen", permission: "compras" },
          { label: "Faltantes Proyecto", href: "/solicitudes-internas/faltantes-proyecto", permission: "compras" },
          { label: "Mantenimiento", href: "/solicitudes-internas/mantenimiento", permission: "compras" },
        ],
      },
    ],
  },
  {
    title: "Sistema",
    items: [
      {
        label: "Usuarios",
        subtitle: "Roles y permisos",
        href: "/usuarios",
        permission: "usuarios",
        icon: <UserCog size={20} />,
        match: ["/usuarios"],
      },
      {
        label: "Configuración",
        subtitle: "SaaS, seguridad y auditoría",
        href: "/configuracion",
        permission: "configuracion",
        icon: <Settings size={20} />,
        match: ["/configuracion", "/perfil/seguridad"],
        children: [
          { label: "Configuración", href: "/configuracion", permission: "configuracion" },
          { label: "Seguridad", href: "/perfil/seguridad", permission: "configuracion" },
        ],
      },
    ],
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isActive(pathname: string, item: NavItem) {
  if (item.match?.length) {
    return item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
  }
  return pathname === item.href;
}

function childActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isPublicClientRoute(pathname: string) {
  return (
    pathname.startsWith("/portal-cliente") ||
    pathname.startsWith("/portal/") ||
    pathname.startsWith("/privacidad") ||
    pathname.startsWith("/terminos") ||
    pathname.startsWith("/eliminar-cuenta")
  );
}

function isKioskRoute(pathname: string) {
  return pathname.startsWith("/tv/");
}

function isAuthRoute(pathname: string) {
  return pathname.startsWith("/login");
}

function clearLocalSession() {
  localStorage.removeItem("rdwood_auth_user");
  localStorage.removeItem("rdwood_session_token");
  localStorage.removeItem("rd_logged_in");
  localStorage.removeItem("rd_current_user");
  localStorage.removeItem("app_user");
  localStorage.removeItem("session_token");
  sessionStorage.clear();
}

function alertTone(severity?: string) {
  if (severity === "danger") return "border-red-400/30 bg-red-500/10 text-red-100";
  if (severity === "warning") return "border-amber-400/30 bg-amber-500/10 text-amber-100";
  if (severity === "success") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
  return "border-cyan-400/30 bg-cyan-500/10 text-cyan-100";
}

function priorityText(priority?: string) {
  if (priority === "critical") return "Critica";
  if (priority === "high") return "Alta";
  if (priority === "medium") return "Media";
  return "Baja";
}

function timeAgoShort(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return date.toLocaleDateString("es-DO");
}

function getStoredShellUser(): AppUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw =
      localStorage.getItem("rdwood_auth_user") ||
      localStorage.getItem("rd_current_user") ||
      localStorage.getItem("app_user");
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AppUser>;
    if (!parsed.id || !parsed.email) return null;

    return {
      id: String(parsed.id),
      full_name: String(parsed.full_name || "Usuario"),
      email: String(parsed.email),
      role_key: String(parsed.role_key || "solo_lectura"),
      role_label: String(parsed.role_label || "Solo Lectura"),
      permissions: (parsed.permissions || []) as PermissionKey[],
      status: String(parsed.status || "activo"),
    };
  } catch {
    return null;
  }
}

export default function SaaSLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [settings, setSettings] = useState<SaasSettings>(DEFAULT_SAAS_SETTINGS);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [systemAlerts, setSystemAlerts] = useState<AINotification[]>([]);
  const publicClientRoute = isPublicClientRoute(pathname);
  const kioskRoute = isKioskRoute(pathname);
  const layoutlessRoute = publicClientRoute || kioskRoute || isAuthRoute(pathname);

  useEffect(() => {
    if (layoutlessRoute) {
      setLoading(false);
      return;
    }

    async function init() {
      setLoading(true);
      const cachedUser = getStoredShellUser();
      if (cachedUser) setUser(cachedUser);

      const [s, u] = await Promise.all([
        getSaasSettings(),
        cachedUser ? Promise.resolve(cachedUser) : getCurrentAppUser(),
      ]);
      setSettings(s);
      setUser(u);
      setLoading(false);
    }

    init();
  }, [layoutlessRoute]);

  useEffect(() => {
    if (layoutlessRoute) return;

    const timeoutMs = 5 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;

    async function lockByInactivity() {
      try {
        const token =
          localStorage.getItem("rdwood_session_token") ||
          localStorage.getItem("session_token");

        if (token) {
          const { supabase } = await import("@/lib/supabase");
          await supabase.rpc("close_user_session", {
            p_session_token: token,
            p_reason: "inactivity_5_min",
          });
        }
      } catch (error) {
        console.error("Error cerrando sesión por inactividad:", error);
      } finally {
        clearLocalSession();
        sessionStorage.setItem(
          "rdwood_lock_message",
          "Sesión bloqueada por 5 minutos sin actividad."
        );
        router.push("/login");
        router.refresh();
      }
    }

    function resetTimer() {
      clearTimeout(timer);
      timer = setTimeout(lockByInactivity, timeoutMs);
    }

    const events = ["mousemove", "mousedown", "keydown", "click", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer));

    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [pathname, layoutlessRoute, router]);

  useEffect(() => {
    if (layoutlessRoute) return;

    const loadAlerts = () => {
      setSystemAlerts(getAINotifications({ limit: 20 }));
    };

    loadAlerts();
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, [layoutlessRoute]);

  useEffect(() => {
    setAlertsOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    const ok = window.confirm("¿Seguro que deseas cerrar sesión?");
    if (!ok) return;

    try {
      const token =
        localStorage.getItem("rdwood_session_token") ||
        localStorage.getItem("session_token");

      if (token) {
        const { supabase } = await import("@/lib/supabase");
        await supabase.rpc("close_user_session", {
          p_session_token: token,
          p_reason: "logout",
        });
      }
    } catch (error) {
      console.error("Error cerrando sesión:", error);
    } finally {
      clearLocalSession();
      router.push("/login");
      router.refresh();
    }
  };

  const visibleGroups = useMemo(() => {
    if (layoutlessRoute) return [];
    if (!user) return [];

    return navGroups
      .map((group) => {
        const items = group.items
          .filter((item) => hasPermission(user, item.permission))
          .map((item) => ({
            ...item,
            children: item.children?.filter((c) => hasPermission(user, c.permission)),
          }));

        return { ...group, items };
      })
      .filter((group) => group.items.length > 0);
  }, [layoutlessRoute, user]);

  const activeTitle = useMemo(() => {
    if (publicClientRoute) return "Portal Cliente";
    if (kioskRoute) return "TV Operacional";

    for (const group of navGroups) {
      for (const item of group.items) {
        if (isActive(pathname, item)) return item.label;

        const child = item.children?.find((c) => childActive(pathname, c.href));
        if (child) return child.label;
      }
    }

    return "RD Wood System";
  }, [pathname, publicClientRoute, kioskRoute]);

  const unreadAlerts = useMemo(
    () => systemAlerts.filter((alert) => !alert.read).length,
    [systemAlerts]
  );

  if (layoutlessRoute) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020817] text-cyan-200">
        <Loader2 className="animate-spin" size={42} />
      </div>
    );
  }

  if (settings.maintenance_mode && !pathname.startsWith("/configuracion")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020817] p-6 text-white">
        <div className="max-w-xl rounded-3xl border border-amber-400/30 bg-amber-500/10 p-8 text-center">
          <ShieldCheck className="mx-auto mb-4 text-amber-300" size={54} />
          <h1 className="text-3xl font-black">Sistema en mantenimiento</h1>
          <p className="mt-3 text-slate-300">{settings.maintenance_message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rd-industrial-shell min-h-screen text-white">
      <aside
        className={cx(
          "rd-industrial-sidebar fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-cyan-400/10 transition-all duration-300",
          sidebarOpen ? "w-[304px]" : "w-[92px]"
        )}
      >
        <div className="border-b border-slate-800/80 px-4 py-5">
          <div className="flex items-center gap-3">
            <Link href="/dashboard-ceo" className="flex min-w-0 flex-1 items-center gap-3">
              {settings.logo_url ? (
                <img
                  src={settings.logo_url}
                  className="h-14 w-14 shrink-0 rounded-2xl object-cover"
                  alt="Logo"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-700 text-4xl font-black text-white">
                  R
                </div>
              )}

              {sidebarOpen ? (
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-black uppercase tracking-[0.28em] text-cyan-300">
                    {settings.brand_name}
                  </p>
                  <h1 className="truncate text-xl font-black leading-tight tracking-tight">
                    ERP Profesional
                  </h1>
                </div>
              ) : null}
            </Link>

            {sidebarOpen ? (
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-xl border border-slate-800 bg-slate-950 p-2 text-slate-400 hover:text-cyan-200"
                title="Contraer menú"
              >
                <ChevronDown size={18} />
              </button>
            ) : null}
          </div>

          {sidebarOpen ? (
            <div className="mt-5 rounded-2xl border border-slate-800 bg-[#07111f] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                Módulo activo
              </p>
              <p className="mt-1 truncate text-sm font-black text-cyan-100">
                {activeTitle}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="mt-4 flex w-full justify-center rounded-xl border border-slate-800 bg-slate-950 p-2 text-slate-400 hover:text-cyan-200"
              title="Expandir menú"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>

        <nav className="sidebar-premium-scroll flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-5">
            {visibleGroups.map((group) => (
              <div key={group.title}>
                {sidebarOpen ? (
                  <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.28em] text-slate-600">
                    {group.title}
                  </p>
                ) : null}

                <div className="space-y-2">
                  {group.items.map((item) => (
                    <SidebarItem
                      key={item.label}
                      item={item}
                      pathname={pathname}
                      collapsed={!sidebarOpen}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-slate-800/80 p-3">
          <div className="rounded-2xl border border-slate-800 bg-[#07111f] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-xs font-black text-cyan-200">
                CEO
              </div>

              {sidebarOpen ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">
                    {user?.full_name || "Usuario"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {user?.role_label || "Sin rol"}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className={cx(
              "mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 transition hover:bg-red-500/20",
              !sidebarOpen && "px-2"
            )}
            title="Cerrar sesión"
          >
            <LogOut size={18} />
            {sidebarOpen ? "Cerrar sesión" : null}
          </button>

          {sidebarOpen ? (
            <p className="mt-3 text-center text-[11px] text-slate-500">
              Auto bloqueo: 5 minutos
            </p>
          ) : null}
        </div>
      </aside>

      <section
        className={cx(
          "rd-industrial-main min-h-screen transition-all duration-300",
          sidebarOpen ? "pl-[304px]" : "pl-[92px]"
        )}
      >
        <header className="rd-industrial-topbar sticky top-0 z-30 border-b border-cyan-400/10 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                {settings.company_name}
              </p>
              <h2 className="text-xl font-black">{activeTitle}</h2>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/configuracion"
                className="rd-premium-button hidden rounded-2xl px-4 py-3 text-sm font-black text-cyan-100 md:inline-flex"
              >
                SaaS Config
              </Link>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAlertsOpen((current) => !current)}
                  className={cx(
                    "relative rounded-2xl border p-3 text-slate-300 transition hover:text-cyan-200",
                    alertsOpen
                      ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                      : "border-cyan-400/20 bg-slate-950/80"
                  )}
                  title="Alertas generales del sistema"
                >
                  <Bell size={18} />
                  {unreadAlerts > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-4 ring-[#020817]">
                      {unreadAlerts > 9 ? "9+" : unreadAlerts}
                    </span>
                  ) : (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-400" />
                  )}
                </button>

                {alertsOpen ? (
                  <div className="absolute right-0 top-14 z-50 w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-cyan-400/25 bg-[#020817]/98 text-white shadow-2xl shadow-black/60 backdrop-blur-xl">
                    <div className="border-b border-slate-800 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
                            Centro de alertas
                          </p>
                          <h3 className="mt-1 text-lg font-black">Alertas generales</h3>
                          <p className="mt-1 text-xs text-slate-400">
                            Riesgos, bloqueos y acciones del sistema.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setAlertsOpen(false)}
                          className="rounded-xl border border-slate-700 bg-slate-950 p-2 text-slate-400 hover:text-white"
                          title="Cerrar"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <MiniAlertStat label="Total" value={systemAlerts.length} />
                        <MiniAlertStat label="Nuevas" value={unreadAlerts} />
                        <MiniAlertStat label="Criticas" value={systemAlerts.filter((alert) => alert.priority === "critical").length} />
                      </div>
                    </div>

                    <div className="max-h-[440px] space-y-3 overflow-y-auto p-4">
                      {systemAlerts.length ? (
                        systemAlerts.map((alert) => (
                          <button
                            key={alert.id}
                            type="button"
                            onClick={() => {
                              markAINotificationAsRead(alert.id);
                              setSystemAlerts(getAINotifications({ limit: 20 }));
                              if (alert.actionRoute) router.push(alert.actionRoute);
                            }}
                            className={cx(
                              "w-full rounded-2xl border p-4 text-left transition hover:scale-[1.01]",
                              alertTone(alert.severity)
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-white/15 bg-black/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]">
                                    {priorityText(alert.priority)}
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-black/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-300">
                                    {alert.category}
                                  </span>
                                  {!alert.read ? <span className="h-2 w-2 rounded-full bg-red-400" /> : null}
                                </div>
                                <p className="mt-2 truncate text-sm font-black text-white">{alert.title}</p>
                              </div>
                              <span className="shrink-0 text-[10px] font-bold text-slate-400">
                                {timeAgoShort(alert.createdAt)}
                              </span>
                            </div>

                            {alert.description ? (
                              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-300">
                                {alert.description}
                              </p>
                            ) : null}

                            {alert.recommendedAction ? (
                              <p className="mt-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-[11px] font-bold leading-relaxed text-slate-200">
                                Accion: {alert.recommendedAction}
                              </p>
                            ) : null}
                          </button>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-6 text-center">
                          <ShieldCheck className="mx-auto text-emerald-300" size={34} />
                          <p className="mt-3 text-sm font-black text-emerald-100">Operacion estable</p>
                          <p className="mt-1 text-xs text-slate-400">No hay alertas activas en este momento.</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-slate-800 p-4">
                      <button
                        type="button"
                        onClick={() => {
                          markAllAINotificationsAsRead();
                          setSystemAlerts(getAINotifications({ limit: 20 }));
                        }}
                        className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs font-black text-slate-200 hover:border-cyan-400/40"
                      >
                        Marcar leidas
                      </button>
                      <Link
                        href="/dashboard-ceo"
                        onClick={() => setAlertsOpen(false)}
                        className="rounded-2xl bg-cyan-500/20 px-4 py-3 text-center text-xs font-black text-cyan-100 hover:bg-cyan-500/30"
                      >
                        Ver dashboard
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>

              <Link
                href="/usuarios"
                className="rd-premium-button rounded-2xl px-4 py-3 text-sm font-black text-cyan-100"
              >
                {user?.role_label || "Usuario"}
              </Link>
            </div>
          </div>
        </header>

        {children}
      </section>

      <ModuleAIAssistant />
    </div>
  );
}

function MiniAlertStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function SidebarItem({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const active = isActive(pathname, item);
  const hasChildren = Boolean(item.children?.length);
  const hasChildActive = item.children?.some((c) => childActive(pathname, c.href));
  const [open, setOpen] = useState(active || Boolean(hasChildActive));

  useEffect(() => {
    if (active || hasChildActive) setOpen(true);
  }, [active, hasChildActive]);

  return (
    <div>
      <Link
        href={item.href}
        className={cx(
          "group flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all",
          active || hasChildActive
            ? "rd-nav-active-glow border-cyan-400/45 bg-cyan-500/15 shadow-[0_0_34px_rgba(6,182,212,0.14)]"
            : "border-transparent hover:border-cyan-500/25 hover:bg-cyan-500/[0.08]"
        )}
        title={collapsed ? item.label : undefined}
      >
        <div
          className={cx(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition",
            active || hasChildActive
              ? "border-cyan-300/40 bg-cyan-400/20 text-cyan-200"
              : "border-slate-800 bg-slate-900/80 text-slate-300 group-hover:text-cyan-200"
          )}
        >
          {item.icon}
        </div>

        {!collapsed ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-white">{item.label}</p>
              <p className="truncate text-[11px] text-slate-500">{item.subtitle}</p>
            </div>

            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen((v) => !v);
                }}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-cyan-200"
                title={open ? "Cerrar grupo" : "Abrir grupo"}
              >
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : null}
          </>
        ) : null}
      </Link>

      {!collapsed && hasChildren && open ? (
        <div className="ml-[58px] mt-2 space-y-1 border-l border-cyan-500/20 pl-3">
          {item.children?.map((child) => {
            const cActive = childActive(pathname, child.href);

            return (
              <Link
                key={child.href}
                href={child.href}
                className={cx(
                  "block rounded-xl px-3 py-2 text-xs font-black transition",
                  cActive
                    ? "bg-cyan-500/15 text-cyan-100"
                    : "text-slate-400 hover:bg-slate-900 hover:text-cyan-200"
                )}
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
