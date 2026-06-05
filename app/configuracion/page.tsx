"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Building2,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  Image,
  KeyRound,
  Loader2,
  Lock,
  Palette,
  Percent,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type PermissionKey =
  | "dashboard_ceo"
  | "inventario"
  | "compras"
  | "ventas"
  | "cotizador"
  | "ia_diseno"
  | "produccion"
  | "corte"
  | "transporte"
  | "instalacion"
  | "verificacion"
  | "rrhh"
  | "portal_empleado"
  | "configuracion"
  | "usuarios";

type SettingsRow = {
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;

  company_name: string;
  brand_name: string;
  rnc: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  address: string;

  currency: string;
  itbis_rate: number;
  default_payment_terms: string;
  invoice_prefix: string;
  quote_prefix: string;
  project_prefix: string;

  profit_margin_default: number;
  profit_margin_minimum: number;
  labor_percent_default: number;
  cut_price_per_linear_foot: number;
  edge_price_per_meter: number;
  installation_percent_default: number;
  transport_percent_default: number;

  sheet_4x8_cost: number;
  sheet_7x8_cost: number;
  waste_percent: number;
  cut_gap_mm: number;
  cnc_board_width_mm: number;
  cnc_board_height_mm: number;
  cnc_machine_name: string;
  cnc_bit_name: string;
  cnc_export_format: string;

  ai_render_enabled: boolean;
  ai_require_client_approval: boolean;
  ai_auto_generate_modules: boolean;
  ai_auto_generate_bom: boolean;
  ai_quality_mode: "rapido" | "pro" | "ultra";

  inventory_negative_stock_block: boolean;
  production_auto_bom: boolean;
  qr_labels_enabled: boolean;
  audit_log_enabled: boolean;

  pdf_header_title: string;
  pdf_footer_text: string;
  pdf_show_logo: boolean;
  pdf_show_qr: boolean;
  pdf_template_style: "premium_dark" | "classic_white" | "blue_corporate";

  maintenance_mode: boolean;
  maintenance_message: string;

  role_admin_permissions: PermissionKey[];
  role_manager_permissions: PermissionKey[];
  role_production_permissions: PermissionKey[];
  role_field_permissions: PermissionKey[];
  role_rrhh_permissions: PermissionKey[];
};

const ALL_PERMISSIONS: { key: PermissionKey; label: string }[] = [
  { key: "dashboard_ceo", label: "Dashboard CEO" },
  { key: "inventario", label: "Inventario" },
  { key: "compras", label: "Compras" },
  { key: "ventas", label: "Ventas" },
  { key: "cotizador", label: "Cotizador" },
  { key: "ia_diseno", label: "IA Diseño" },
  { key: "produccion", label: "Producción" },
  { key: "corte", label: "Optimización Corte" },
  { key: "transporte", label: "Transporte" },
  { key: "instalacion", label: "Instalación" },
  { key: "verificacion", label: "Verificación" },
  { key: "rrhh", label: "RRHH" },
  { key: "portal_empleado", label: "Portal Empleado" },
  { key: "configuracion", label: "Configuración" },
  { key: "usuarios", label: "Usuarios" },
];

const DEFAULT_SETTINGS: SettingsRow = {
  logo_url: "",
  favicon_url: "",
  primary_color: "#06b6d4",
  secondary_color: "#2563eb",

  company_name: "Santana Group",
  brand_name: "RD Wood System",
  rnc: "",
  phone: "+1 (809) 690-5636",
  whatsapp: "+1 (809) 690-5636",
  email: "info.santanagroup@gmail.com",
  instagram: "santanagroup0",
  address:
    "C2J8+96W Parque Infantil La Romana, Av. Gregorio Luperón, La Romana 22000, República Dominicana",

  currency: "DOP",
  itbis_rate: 18,
  default_payment_terms: "50% inicial / 50% contra entrega",
  invoice_prefix: "FAC",
  quote_prefix: "COT",
  project_prefix: "PROY",

  profit_margin_default: 35,
  profit_margin_minimum: 30,
  labor_percent_default: 28,
  cut_price_per_linear_foot: 30,
  edge_price_per_meter: 35,
  installation_percent_default: 10,
  transport_percent_default: 3,

  sheet_4x8_cost: 2500,
  sheet_7x8_cost: 5200,
  waste_percent: 12,
  cut_gap_mm: 8,
  cnc_board_width_mm: 2440,
  cnc_board_height_mm: 1830,
  cnc_machine_name: "Blue Elephant 4x8",
  cnc_bit_name: "E220-COMPRESSION 1/4S*1/4D*1-1/4CL*3L",
  cnc_export_format: "Aspire / DXF",

  ai_render_enabled: true,
  ai_require_client_approval: true,
  ai_auto_generate_modules: true,
  ai_auto_generate_bom: false,
  ai_quality_mode: "pro",

  inventory_negative_stock_block: true,
  production_auto_bom: true,
  qr_labels_enabled: true,
  audit_log_enabled: true,

  pdf_header_title: "RD WOOD SYSTEM",
  pdf_footer_text: "Documento generado por RD Wood System ERP.",
  pdf_show_logo: true,
  pdf_show_qr: true,
  pdf_template_style: "premium_dark",

  maintenance_mode: false,
  maintenance_message:
    "Sistema en mantenimiento. Contacte al administrador.",

  role_admin_permissions: ALL_PERMISSIONS.map((p) => p.key),
  role_manager_permissions: [
    "dashboard_ceo",
    "inventario",
    "compras",
    "ventas",
    "cotizador",
    "ia_diseno",
    "produccion",
    "corte",
    "transporte",
    "instalacion",
    "verificacion",
    "rrhh",
    "portal_empleado",
  ],
  role_production_permissions: ["produccion", "corte", "inventario"],
  role_field_permissions: ["transporte", "instalacion", "verificacion"],
  role_rrhh_permissions: ["rrhh", "portal_empleado"],
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function numberValue(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function currency(value: number, code = "DOP") {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: code || "DOP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function ConfiguracionSaasMaestroPage() {
  const [settings, setSettings] = useState<SettingsRow>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState("empresa");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadSettings() {
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .eq("setting_key", "saas_master")
        .maybeSingle();

      if (error) throw error;

      if (data?.setting_value) {
        setSettings({ ...DEFAULT_SETTINGS, ...(data.setting_value as Partial<SettingsRow>) });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }

      setMessage("Centro SaaS cargado correctamente.");
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || "No se pudo cargar la configuración SaaS.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setMessage("");

    try {
      const clean: SettingsRow = {
        ...settings,
        itbis_rate: numberValue(settings.itbis_rate),
        profit_margin_default: numberValue(settings.profit_margin_default),
        profit_margin_minimum: numberValue(settings.profit_margin_minimum),
        labor_percent_default: numberValue(settings.labor_percent_default),
        cut_price_per_linear_foot: numberValue(settings.cut_price_per_linear_foot),
        edge_price_per_meter: numberValue(settings.edge_price_per_meter),
        installation_percent_default: numberValue(settings.installation_percent_default),
        transport_percent_default: numberValue(settings.transport_percent_default),
        sheet_4x8_cost: numberValue(settings.sheet_4x8_cost),
        sheet_7x8_cost: numberValue(settings.sheet_7x8_cost),
        waste_percent: numberValue(settings.waste_percent),
        cut_gap_mm: numberValue(settings.cut_gap_mm),
        cnc_board_width_mm: numberValue(settings.cnc_board_width_mm),
        cnc_board_height_mm: numberValue(settings.cnc_board_height_mm),
      };

      const { error } = await supabase.from("system_settings").upsert(
        {
          setting_key: "saas_master",
          setting_value: clean,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "setting_key" }
      );

      if (error) throw error;

      setSettings(clean);
      setMessage("Configuración SaaS guardada correctamente.");
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || "No se pudo guardar la configuración SaaS.");
      alert(error?.message || "No se pudo guardar la configuración SaaS.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const readiness = useMemo(() => {
    let score = 100;
    if (!settings.logo_url) score -= 8;
    if (!settings.company_name) score -= 8;
    if (!settings.rnc) score -= 5;
    if (!settings.email) score -= 5;
    if (!settings.address) score -= 5;
    if (settings.profit_margin_default < settings.profit_margin_minimum) score -= 12;
    if (!settings.inventory_negative_stock_block) score -= 10;
    if (!settings.audit_log_enabled) score -= 10;
    if (!settings.role_admin_permissions.includes("configuracion")) score -= 10;
    if (!settings.pdf_header_title) score -= 5;
    return Math.max(0, score);
  }, [settings]);

  const tabs = [
    { id: "empresa", label: "Empresa", icon: <Building2 size={16} /> },
    { id: "branding", label: "Logo / Branding", icon: <Palette size={16} /> },
    { id: "usuarios", label: "Usuarios y permisos", icon: <Users size={16} /> },
    { id: "finanzas", label: "Moneda / impuestos", icon: <Banknote size={16} /> },
    { id: "costos", label: "Costos y márgenes", icon: <Percent size={16} /> },
    { id: "ia", label: "Reglas IA", icon: <Sparkles size={16} /> },
    { id: "cnc", label: "CNC / producción", icon: <Cpu size={16} /> },
    { id: "pdf", label: "Plantillas PDF", icon: <FileText size={16} /> },
    { id: "seguridad", label: "Seguridad", icon: <Lock size={16} /> },
  ];

  return (
    <main className="min-h-screen bg-[#020817] p-4 text-white md:p-6">
      <div className="mx-auto w-full max-w-[1780px] space-y-5">
        <section className="rounded-3xl border border-cyan-900/50 bg-gradient-to-br from-[#081421] via-[#0b1830] to-[#111b3f] p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 md:flex">
                <Settings size={34} />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.30em] text-cyan-300">
                  <BadgeCheck size={14} />
                  SaaS Ready
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                  Centro SaaS Maestro
                </h1>
                <p className="mt-2 max-w-5xl text-sm text-slate-300">
                  Control central antes de vender el sistema: logo, usuarios, permisos, empresa, moneda, impuestos, costos, IA, CNC y plantillas PDF.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={loadSettings}
                disabled={loading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-5 text-sm font-black text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                Actualizar
              </button>

              <button
                onClick={saveSettings}
                disabled={saving}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Guardar Centro SaaS
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">
            {loading ? <Loader2 className="mr-2 inline animate-spin" size={16} /> : null}
            {message}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Kpi title="SaaS Readiness" value={`${readiness}%`} subtitle="Preparación para vender" icon={<ShieldCheck />} tone={readiness >= 85 ? "green" : "amber"} />
          <Kpi title="Módulos críticos" value="14" subtitle="Controlados por permisos" icon={<Database />} tone="cyan" />
          <Kpi title="ITBIS" value={`${settings.itbis_rate}%`} subtitle="Impuesto base" icon={<Percent />} tone="purple" />
          <Kpi title="Margen mínimo" value={`${settings.profit_margin_minimum}%`} subtitle="Protección utilidad" icon={<Banknote />} tone="green" />
          <Kpi title="Modo mantenimiento" value={settings.maintenance_mode ? "ON" : "OFF"} subtitle="Control global" icon={<Lock />} tone={settings.maintenance_mode ? "red" : "green"} />
        </section>

        <section className="rounded-3xl border border-cyan-900/45 bg-[#07111f] p-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition",
                  tab === t.id
                    ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/30"
                    : "text-slate-400 hover:bg-slate-900 hover:text-cyan-100"
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {tab === "empresa" ? (
          <Grid>
            <Panel title="Empresa" subtitle="Identidad comercial legal." icon={<Building2 className="text-cyan-300" />}>
              <Field label="Nombre empresa" value={settings.company_name} onChange={(v) => setSettings({ ...settings, company_name: v })} />
              <Field label="Marca / sistema" value={settings.brand_name} onChange={(v) => setSettings({ ...settings, brand_name: v })} />
              <Field label="RNC" value={settings.rnc} onChange={(v) => setSettings({ ...settings, rnc: v })} />
              <Field label="Teléfono" value={settings.phone} onChange={(v) => setSettings({ ...settings, phone: v })} />
              <Field label="WhatsApp" value={settings.whatsapp} onChange={(v) => setSettings({ ...settings, whatsapp: v })} />
              <Field label="Email" value={settings.email} onChange={(v) => setSettings({ ...settings, email: v })} />
              <Field label="Instagram" value={settings.instagram} onChange={(v) => setSettings({ ...settings, instagram: v })} />
              <TextArea label="Dirección" value={settings.address} onChange={(v) => setSettings({ ...settings, address: v })} />
            </Panel>

            <Panel title="Numeración" subtitle="Prefijos para documentos." icon={<FileText className="text-emerald-300" />}>
              <Field label="Prefijo factura" value={settings.invoice_prefix} onChange={(v) => setSettings({ ...settings, invoice_prefix: v.toUpperCase() })} />
              <Field label="Prefijo cotización" value={settings.quote_prefix} onChange={(v) => setSettings({ ...settings, quote_prefix: v.toUpperCase() })} />
              <Field label="Prefijo proyecto" value={settings.project_prefix} onChange={(v) => setSettings({ ...settings, project_prefix: v.toUpperCase() })} />
              <TextArea label="Condición de pago por defecto" value={settings.default_payment_terms} onChange={(v) => setSettings({ ...settings, default_payment_terms: v })} />
            </Panel>
          </Grid>
        ) : null}

        {tab === "branding" ? (
          <Grid>
            <Panel title="Logo y colores" subtitle="Branding configurable para SaaS." icon={<Palette className="text-cyan-300" />}>
              <Field label="URL Logo" value={settings.logo_url} onChange={(v) => setSettings({ ...settings, logo_url: v })} />
              <Field label="URL Favicon" value={settings.favicon_url} onChange={(v) => setSettings({ ...settings, favicon_url: v })} />
              <Field label="Color primario" value={settings.primary_color} onChange={(v) => setSettings({ ...settings, primary_color: v })} />
              <Field label="Color secundario" value={settings.secondary_color} onChange={(v) => setSettings({ ...settings, secondary_color: v })} />
            </Panel>

            <Panel title="Vista previa" subtitle="Cómo se verá la marca." icon={<Image className="text-emerald-300" />}>
              <div className="rounded-3xl border border-slate-800 bg-[#030817] p-6">
                <div className="flex items-center gap-4">
                  {settings.logo_url ? (
                    <img src={settings.logo_url} className="h-16 w-16 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-700 text-3xl font-black">
                      R
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">{settings.brand_name}</p>
                    <h3 className="text-2xl font-black">{settings.company_name}</h3>
                    <p className="text-sm text-slate-400">{settings.email}</p>
                  </div>
                </div>
              </div>
            </Panel>
          </Grid>
        ) : null}

        {tab === "usuarios" ? (
          <Grid>
            <Panel title="Roles y permisos" subtitle="Control base para vender como SaaS." icon={<Users className="text-cyan-300" />}>
              <PermissionEditor label="Administrador" values={settings.role_admin_permissions} onChange={(v) => setSettings({ ...settings, role_admin_permissions: v })} />
              <PermissionEditor label="Gerente" values={settings.role_manager_permissions} onChange={(v) => setSettings({ ...settings, role_manager_permissions: v })} />
              <PermissionEditor label="Producción" values={settings.role_production_permissions} onChange={(v) => setSettings({ ...settings, role_production_permissions: v })} />
              <PermissionEditor label="Campo / Instalación" values={settings.role_field_permissions} onChange={(v) => setSettings({ ...settings, role_field_permissions: v })} />
              <PermissionEditor label="RRHH" values={settings.role_rrhh_permissions} onChange={(v) => setSettings({ ...settings, role_rrhh_permissions: v })} />
            </Panel>

            <Panel title="Seguridad SaaS" subtitle="Reglas empresariales." icon={<KeyRound className="text-amber-300" />}>
              <Toggle label="Auditoría de cambios activa" checked={settings.audit_log_enabled} onChange={(v) => setSettings({ ...settings, audit_log_enabled: v })} />
              <Toggle label="Bloquear stock negativo" checked={settings.inventory_negative_stock_block} onChange={(v) => setSettings({ ...settings, inventory_negative_stock_block: v })} />
              <Toggle label="Modo mantenimiento global" checked={settings.maintenance_mode} onChange={(v) => setSettings({ ...settings, maintenance_mode: v })} />
              <TextArea label="Mensaje mantenimiento" value={settings.maintenance_message} onChange={(v) => setSettings({ ...settings, maintenance_message: v })} />
            </Panel>
          </Grid>
        ) : null}

        {tab === "finanzas" ? (
          <Grid>
            <Panel title="Moneda e impuestos" subtitle="Parámetros financieros globales." icon={<Banknote className="text-emerald-300" />}>
              <Field label="Moneda" value={settings.currency} onChange={(v) => setSettings({ ...settings, currency: v.toUpperCase() })} />
              <NumberField label="ITBIS %" value={settings.itbis_rate} onChange={(v) => setSettings({ ...settings, itbis_rate: v })} />
              <NumberField label="Margen por defecto %" value={settings.profit_margin_default} onChange={(v) => setSettings({ ...settings, profit_margin_default: v })} />
              <NumberField label="Margen mínimo %" value={settings.profit_margin_minimum} onChange={(v) => setSettings({ ...settings, profit_margin_minimum: v })} />
            </Panel>

            <Panel title="Resumen financiero" subtitle="Configuración actual." icon={<Percent className="text-cyan-300" />}>
              <Info label="Moneda" value={settings.currency} />
              <Info label="ITBIS" value={`${settings.itbis_rate}%`} />
              <Info label="Margen por defecto" value={`${settings.profit_margin_default}%`} />
              <Info label="Margen mínimo recomendado" value={`${settings.profit_margin_minimum}%`} />
            </Panel>
          </Grid>
        ) : null}

        {tab === "costos" ? (
          <Grid>
            <Panel title="Costos base" subtitle="Costos que alimentan cotización, producción y CEO." icon={<Banknote className="text-emerald-300" />}>
              <NumberField label="Mano de obra estimada %" value={settings.labor_percent_default} onChange={(v) => setSettings({ ...settings, labor_percent_default: v })} />
              <NumberField label="Corte RD$ / pie lineal" value={settings.cut_price_per_linear_foot} onChange={(v) => setSettings({ ...settings, cut_price_per_linear_foot: v })} />
              <NumberField label="Canteo RD$ / metro" value={settings.edge_price_per_meter} onChange={(v) => setSettings({ ...settings, edge_price_per_meter: v })} />
              <NumberField label="Instalación %" value={settings.installation_percent_default} onChange={(v) => setSettings({ ...settings, installation_percent_default: v })} />
              <NumberField label="Transporte %" value={settings.transport_percent_default} onChange={(v) => setSettings({ ...settings, transport_percent_default: v })} />
            </Panel>

            <Panel title="Tableros" subtitle="Costo y desperdicio base." icon={<Database className="text-purple-300" />}>
              <NumberField label="Costo hoja 4x8" value={settings.sheet_4x8_cost} onChange={(v) => setSettings({ ...settings, sheet_4x8_cost: v })} />
              <NumberField label="Costo hoja 7x8" value={settings.sheet_7x8_cost} onChange={(v) => setSettings({ ...settings, sheet_7x8_cost: v })} />
              <NumberField label="Desperdicio %" value={settings.waste_percent} onChange={(v) => setSettings({ ...settings, waste_percent: v })} />
              <Info label="Hoja 4x8 actual" value={currency(settings.sheet_4x8_cost, settings.currency)} />
              <Info label="Hoja 7x8 actual" value={currency(settings.sheet_7x8_cost, settings.currency)} />
            </Panel>
          </Grid>
        ) : null}

        {tab === "ia" ? (
          <Grid>
            <Panel title="Reglas IA Diseño" subtitle="IA solo para render y aprobación visual." icon={<Sparkles className="text-cyan-300" />}>
              <Toggle label="IA Render activa" checked={settings.ai_render_enabled} onChange={(v) => setSettings({ ...settings, ai_render_enabled: v })} />
              <Toggle label="Requiere aprobación cliente" checked={settings.ai_require_client_approval} onChange={(v) => setSettings({ ...settings, ai_require_client_approval: v })} />
              <Toggle label="Generar módulos visuales" checked={settings.ai_auto_generate_modules} onChange={(v) => setSettings({ ...settings, ai_auto_generate_modules: v })} />
              <Toggle label="Generar BOM automático" checked={settings.ai_auto_generate_bom} onChange={(v) => setSettings({ ...settings, ai_auto_generate_bom: v })} />
              <Select label="Calidad IA" value={settings.ai_quality_mode} options={["rapido", "pro", "ultra"]} onChange={(v) => setSettings({ ...settings, ai_quality_mode: v as any })} />
            </Panel>

            <Panel title="Arquitectura correcta" subtitle="Separación limpia del flujo." icon={<ShieldCheck className="text-emerald-300" />}>
              <Info label="Cotización" value="Precio y alcance" />
              <Info label="IA Diseño" value="Render + aprobación visual" />
              <Info label="Producción" value="BOM, corte, canteo, ensamblaje" />
              <Info label="CEO" value="Utilidad real" />
            </Panel>
          </Grid>
        ) : null}

        {tab === "cnc" ? (
          <Grid>
            <Panel title="CNC y producción" subtitle="Parámetros para corte, nesting y QR." icon={<Cpu className="text-cyan-300" />}>
              <Field label="Máquina CNC" value={settings.cnc_machine_name} onChange={(v) => setSettings({ ...settings, cnc_machine_name: v })} />
              <Field label="Broca" value={settings.cnc_bit_name} onChange={(v) => setSettings({ ...settings, cnc_bit_name: v })} />
              <Field label="Formato exportación" value={settings.cnc_export_format} onChange={(v) => setSettings({ ...settings, cnc_export_format: v })} />
              <NumberField label="Separación corte mm" value={settings.cut_gap_mm} onChange={(v) => setSettings({ ...settings, cut_gap_mm: v })} />
              <NumberField label="Ancho tablero CNC mm" value={settings.cnc_board_width_mm} onChange={(v) => setSettings({ ...settings, cnc_board_width_mm: v })} />
              <NumberField label="Alto tablero CNC mm" value={settings.cnc_board_height_mm} onChange={(v) => setSettings({ ...settings, cnc_board_height_mm: v })} />
            </Panel>

            <Panel title="Automatización producción" subtitle="Reglas críticas." icon={<Wrench className="text-amber-300" />}>
              <Toggle label="BOM automático en producción" checked={settings.production_auto_bom} onChange={(v) => setSettings({ ...settings, production_auto_bom: v })} />
              <Toggle label="Etiquetas QR activas" checked={settings.qr_labels_enabled} onChange={(v) => setSettings({ ...settings, qr_labels_enabled: v })} />
              <Toggle label="Bloquear stock negativo" checked={settings.inventory_negative_stock_block} onChange={(v) => setSettings({ ...settings, inventory_negative_stock_block: v })} />
            </Panel>
          </Grid>
        ) : null}

        {tab === "pdf" ? (
          <Grid>
            <Panel title="Plantillas PDF" subtitle="Cotización, factura, producción y nómina." icon={<FileText className="text-cyan-300" />}>
              <Field label="Título PDF" value={settings.pdf_header_title} onChange={(v) => setSettings({ ...settings, pdf_header_title: v })} />
              <TextArea label="Texto pie PDF" value={settings.pdf_footer_text} onChange={(v) => setSettings({ ...settings, pdf_footer_text: v })} />
              <Select label="Estilo plantilla" value={settings.pdf_template_style} options={["premium_dark", "classic_white", "blue_corporate"]} onChange={(v) => setSettings({ ...settings, pdf_template_style: v as any })} />
              <Toggle label="Mostrar logo" checked={settings.pdf_show_logo} onChange={(v) => setSettings({ ...settings, pdf_show_logo: v })} />
              <Toggle label="Mostrar QR" checked={settings.pdf_show_qr} onChange={(v) => setSettings({ ...settings, pdf_show_qr: v })} />
            </Panel>

            <Panel title="Uso en módulos" subtitle="Plantillas conectables." icon={<FileText className="text-emerald-300" />}>
              <Info label="Cotizaciones" value="PDF comercial" />
              <Info label="Producción" value="Orden + piezas + QR" />
              <Info label="Instalación" value="Checklist" />
              <Info label="Nómina" value="Recibos empleados" />
            </Panel>
          </Grid>
        ) : null}

        {tab === "seguridad" ? (
          <Grid>
            <Panel title="Seguridad y mantenimiento" subtitle="Control de operación SaaS." icon={<Lock className="text-red-300" />}>
              <Toggle label="Auditoría de cambios" checked={settings.audit_log_enabled} onChange={(v) => setSettings({ ...settings, audit_log_enabled: v })} />
              <Toggle label="Modo mantenimiento" checked={settings.maintenance_mode} onChange={(v) => setSettings({ ...settings, maintenance_mode: v })} />
              <TextArea label="Mensaje mantenimiento" value={settings.maintenance_message} onChange={(v) => setSettings({ ...settings, maintenance_message: v })} />
            </Panel>

            <Panel title="Checklist SaaS" subtitle="Antes de vender." icon={<CheckCircle2 className="text-emerald-300" />}>
              <Checklist ok={!!settings.logo_url} label="Logo configurado" />
              <Checklist ok={!!settings.company_name} label="Empresa configurada" />
              <Checklist ok={settings.audit_log_enabled} label="Auditoría activa" />
              <Checklist ok={settings.inventory_negative_stock_block} label="Stock negativo bloqueado" />
              <Checklist ok={settings.pdf_show_logo} label="PDF con marca" />
              <Checklist ok={settings.role_admin_permissions.includes("configuracion")} label="Admin controla configuración" />
            </Panel>
          </Grid>
        ) : null}
      </div>
    </main>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">{children}</section>;
}

function Panel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10">
          {icon}
        </div>
        <div>
          <h2 className="text-2xl font-black">{title}</h2>
          {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Kpi({
  title,
  value,
  subtitle,
  icon,
  tone = "cyan",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  tone?: "cyan" | "green" | "red" | "amber" | "purple";
}) {
  const tones: Record<string, string> = {
    cyan: "border-cyan-400/25 bg-cyan-500/10 text-cyan-300",
    green: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
    red: "border-red-400/25 bg-red-500/10 text-red-300",
    amber: "border-amber-400/25 bg-amber-500/10 text-amber-300",
    purple: "border-purple-400/25 bg-purple-500/10 text-purple-300",
  };

  return (
    <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] via-[#07111f] to-[#030817] p-5 shadow-xl shadow-black/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{title}</p>
          <h3 className="mt-3 text-2xl font-black text-white">{value}</h3>
          {subtitle ? <p className="mt-2 text-xs text-slate-400">{subtitle}</p> : null}
        </div>
        <div className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", tones[tone])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <input type="number" value={Number(value || 0)} onChange={(e) => onChange(Number(e.target.value))} className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={4} className="w-full resize-none rounded-2xl border border-slate-700 bg-[#030817] px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-400" />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400">
        {options.map((op) => <option key={op} value={op}>{op}</option>)}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-[#030817] p-4 text-left">
      <span className="font-black text-white">{label}</span>
      <span className={cx("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase", checked ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-red-400/30 bg-red-500/10 text-red-300")}>
        {checked ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
        {checked ? "ON" : "OFF"}
      </span>
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#030817] px-4 py-3">
      <span className="text-sm font-bold text-slate-400">{label}</span>
      <span className="text-right text-sm font-black text-white">{value}</span>
    </div>
  );
}

function Checklist({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-[#030817] p-4">
      <span className="font-black text-white">{label}</span>
      <span className={cx("rounded-full border px-3 py-1 text-xs font-black", ok ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-amber-400/30 bg-amber-500/10 text-amber-300")}>
        {ok ? "OK" : "PENDIENTE"}
      </span>
    </div>
  );
}

function PermissionEditor({ label, values, onChange }: { label: string; values: PermissionKey[]; onChange: (v: PermissionKey[]) => void }) {
  function toggle(key: PermissionKey) {
    if (values.includes(key)) onChange(values.filter((v) => v !== key));
    else onChange([...values, key]);
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#030817] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-black text-white">{label}</p>
        <span className="text-xs font-black text-cyan-300">{values.length}/{ALL_PERMISSIONS.length}</span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {ALL_PERMISSIONS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => toggle(p.key)}
            className={cx(
              "rounded-xl border px-3 py-2 text-left text-xs font-black",
              values.includes(p.key)
                ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-100"
                : "border-slate-800 bg-slate-950 text-slate-500"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
