"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Crown,
  Eye,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  User2,
  UserCog,
  Users,
  X,
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
  | "usuarios"
  | "agenda";

type AppUser = {
  id?: string;
  full_name: string;
  email: string;
  role_key: string;
  role_label: string;
  permissions: PermissionKey[];
  status: "activo" | "inactivo" | "bloqueado";
  department?: string | null;
  phone?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_login_at?: string | null;
};

type SaasSettings = {
  company_name?: string;
  brand_name?: string;
  role_admin_permissions?: PermissionKey[];
  role_manager_permissions?: PermissionKey[];
  role_production_permissions?: PermissionKey[];
  role_field_permissions?: PermissionKey[];
  role_rrhh_permissions?: PermissionKey[];
};

const ALL_PERMISSIONS: { key: PermissionKey; label: string; group: string }[] = [
  { key: "dashboard_ceo", label: "Dashboard CEO", group: "Dirección" },
  { key: "agenda", label: "Agenda", group: "Comercial" },
  { key: "ventas", label: "Ventas", group: "Comercial" },
  { key: "cotizador", label: "Cotizador", group: "Comercial" },
  { key: "inventario", label: "Inventario", group: "Operación" },
  { key: "compras", label: "Compras", group: "Operación" },
  { key: "ia_diseno", label: "IA Diseño", group: "Diseño" },
  { key: "produccion", label: "Producción", group: "Producción" },
  { key: "corte", label: "Optimización Corte", group: "Producción" },
  { key: "transporte", label: "Transporte", group: "Campo" },
  { key: "instalacion", label: "Instalación", group: "Campo" },
  { key: "verificacion", label: "Verificación", group: "Campo" },
  { key: "rrhh", label: "RRHH", group: "Administración" },
  { key: "portal_empleado", label: "Portal Empleado", group: "RRHH" },
  { key: "usuarios", label: "Usuarios", group: "Administración" },
  { key: "configuracion", label: "Configuración", group: "Administración" },
];

const ROLE_PRESETS: Record<string, { label: string; permissions: PermissionKey[] }> = {
  admin: {
    label: "Administrador",
    permissions: ALL_PERMISSIONS.map((p) => p.key),
  },
  gerente: {
    label: "Gerente",
    permissions: [
      "dashboard_ceo",
      "agenda",
      "ventas",
      "cotizador",
      "inventario",
      "compras",
      "ia_diseno",
      "produccion",
      "corte",
      "transporte",
      "instalacion",
      "verificacion",
      "rrhh",
      "portal_empleado",
    ],
  },
  ventas: {
    label: "Ventas",
    permissions: ["agenda", "ventas", "cotizador"],
  },
  diseno: {
    label: "Diseño IA",
    permissions: ["agenda", "cotizador", "ia_diseno"],
  },
  produccion: {
    label: "Producción",
    permissions: ["inventario", "produccion", "corte"],
  },
  campo: {
    label: "Campo / Instalación",
    permissions: ["transporte", "instalacion", "verificacion"],
  },
  rrhh: {
    label: "RRHH",
    permissions: ["rrhh", "portal_empleado"],
  },
  empleado: {
    label: "Empleado",
    permissions: ["portal_empleado"],
  },
  solo_lectura: {
    label: "Solo Lectura",
    permissions: ["dashboard_ceo"],
  },
};

const EMPTY_FORM: AppUser = {
  full_name: "",
  email: "",
  role_key: "ventas",
  role_label: "Ventas",
  permissions: ROLE_PRESETS.ventas.permissions,
  status: "activo",
  department: "Ventas",
  phone: "",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("es-DO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

export default function UsuariosSaasProPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [settings, setSettings] = useState<SaasSettings>({});
  const [form, setForm] = useState<AppUser>(EMPTY_FORM);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadEverything() {
    setLoading(true);

    try {
      await Promise.all([loadSettings(), loadUsers()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    const { data } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "saas_master")
      .maybeSingle();

    if (data?.setting_value) {
      setSettings(data.setting_value as SaasSettings);
    }
  }

  async function loadUsers() {
    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(
        `Error cargando usuarios: ${error.message}\n\nEjecuta el SQL incluido en esta fase.`
      );
      setUsers([]);
      return;
    }

    const normalized = (data || []).map((u: any) => ({
      id: u.id,
      full_name: u.full_name || u.name || "",
      email: u.email || "",
      role_key: u.role_key || normalizeOldRole(u.role) || "ventas",
      role_label:
        u.role_label ||
        ROLE_PRESETS[u.role_key || normalizeOldRole(u.role) || "ventas"]?.label ||
        u.role ||
        "Ventas",
      permissions: normalizePermissions(u.permissions),
      status: normalizeStatus(u.status),
      department: u.department || "",
      phone: u.phone || "",
      created_at: u.created_at,
      updated_at: u.updated_at,
      last_login_at: u.last_login_at,
    })) as AppUser[];

    setUsers(normalized);
  }

  useEffect(() => {
    loadEverything();
  }, []);

  function applyRole(roleKey: string) {
    const preset = ROLE_PRESETS[roleKey] || ROLE_PRESETS.ventas;

    setForm((current) => ({
      ...current,
      role_key: roleKey,
      role_label: preset.label,
      permissions: preset.permissions,
      department:
        roleKey === "produccion"
          ? "Producción"
          : roleKey === "campo"
          ? "Campo"
          : roleKey === "rrhh"
          ? "RRHH"
          : roleKey === "diseno"
          ? "Diseño"
          : roleKey === "ventas"
          ? "Ventas"
          : current.department || "Administración",
    }));
  }

  function togglePermission(key: PermissionKey) {
    setForm((current) => {
      const exists = current.permissions.includes(key);
      return {
        ...current,
        permissions: exists
          ? current.permissions.filter((p) => p !== key)
          : [...current.permissions, key],
      };
    });
  }

  async function saveUser() {
    if (!form.full_name.trim() || !form.email.trim()) {
      alert("Completa nombre y email.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        full_name: form.full_name.trim(),
        name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        role_key: form.role_key,
        role_label: form.role_label,
        role: form.role_label,
        permissions: form.permissions,
        status: form.status,
        department: form.department || null,
        phone: form.phone || null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from("app_users")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;

        await createAuditLog("usuarios", "update", "app_users", editingId, null, payload);
        alert("✅ Usuario actualizado");
      } else {
        const { data, error } = await supabase
          .from("app_users")
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        await createAuditLog("usuarios", "create", "app_users", data?.id, null, payload);
        alert("✅ Usuario creado");
      }

      resetForm();
      await loadUsers();
    } catch (error: any) {
      console.error(error);
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(user: AppUser, status: AppUser["status"]) {
    if (!user.id) return;

    const { error } = await supabase
      .from("app_users")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      alert(error.message);
      return;
    }

    await createAuditLog("usuarios", "status_change", "app_users", user.id, { status: user.status }, { status });
    await loadUsers();
  }

  async function deleteUser(user: AppUser) {
    if (!user.id) return;

    const ok = confirm(`¿Eliminar usuario ${user.full_name}?`);
    if (!ok) return;

    const { error } = await supabase.from("app_users").delete().eq("id", user.id);

    if (error) {
      alert(error.message);
      return;
    }

    await createAuditLog("usuarios", "delete", "app_users", user.id, user, null);
    await loadUsers();
  }

  function editUser(user: AppUser) {
    setEditingId(user.id || null);
    setForm({
      ...user,
      permissions: user.permissions || [],
      status: user.status || "activo",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return users.filter((user) => {
      const text = [
        user.full_name,
        user.email,
        user.role_label,
        user.department,
        user.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = q ? text.includes(q) : true;
      const matchesRole = roleFilter === "todos" ? true : user.role_key === roleFilter;
      const matchesStatus = statusFilter === "todos" ? true : user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((u) => u.role_key === "admin").length,
      active: users.filter((u) => u.status === "activo").length,
      blocked: users.filter((u) => u.status === "bloqueado").length,
    };
  }, [users]);

  const companyName = settings.company_name || "Santana Group";
  const brandName = settings.brand_name || "RD Wood System";

  return (
    <main className="min-h-screen bg-[#020817] p-4 text-white md:p-6">
      <div className="mx-auto w-full max-w-[1780px] space-y-5">
        <section className="rounded-3xl border border-cyan-900/50 bg-gradient-to-br from-[#081421] via-[#0b1830] to-[#111b3f] p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 md:flex">
                <Users size={34} />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.30em] text-cyan-300">
                  <BadgeCheck size={14} />
                  SaaS Access Control
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                  Usuarios & Permisos SaaS PRO
                </h1>
                <p className="mt-2 max-w-5xl text-sm text-slate-300">
                  Control empresarial de usuarios, roles, permisos por módulo y auditoría base para {brandName} / {companyName}.
                </p>
              </div>
            </div>

            <button
              onClick={loadEverything}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-5 text-sm font-black text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Kpi title="Usuarios" value={stats.total} subtitle="Cuentas registradas" icon={<Users />} tone="cyan" />
          <Kpi title="Administradores" value={stats.admins} subtitle="Control total" icon={<Crown />} tone="purple" />
          <Kpi title="Activos" value={stats.active} subtitle="Operando" icon={<ShieldCheck />} tone="green" />
          <Kpi title="Bloqueados" value={stats.blocked} subtitle="Sin acceso" icon={<Lock />} tone={stats.blocked ? "red" : "green"} />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[520px_1fr]">
          <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                  {editingId ? <Pencil size={22} /> : <Plus size={22} />}
                </div>
                <div>
                  <h2 className="text-2xl font-black">
                    {editingId ? "Editar usuario" : "Nuevo usuario"}
                  </h2>
                  <p className="text-sm text-slate-400">
                    Crea acceso con permisos SaaS.
                  </p>
                </div>
              </div>

              {editingId ? (
                <button
                  onClick={resetForm}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-black text-slate-300 hover:border-red-400 hover:text-red-200"
                >
                  Cancelar
                </button>
              ) : null}
            </div>

            <div className="space-y-4">
              <Field
                label="Nombre completo"
                value={form.full_name}
                onChange={(v) => setForm((current) => ({ ...current, full_name: v }))}
              />

              <Field
                label="Email"
                value={form.email}
                onChange={(v) => setForm((current) => ({ ...current, email: v }))}
              />

              <Field
                label="Teléfono"
                value={form.phone || ""}
                onChange={(v) => setForm((current) => ({ ...current, phone: v }))}
              />

              <Field
                label="Departamento"
                value={form.department || ""}
                onChange={(v) => setForm((current) => ({ ...current, department: v }))}
              />

              <Select
                label="Rol"
                value={form.role_key}
                options={Object.entries(ROLE_PRESETS).map(([key, value]) => ({
                  value: key,
                  label: value.label,
                }))}
                onChange={applyRole}
              />

              <Select
                label="Estado"
                value={form.status}
                options={[
                  { value: "activo", label: "Activo" },
                  { value: "inactivo", label: "Inactivo" },
                  { value: "bloqueado", label: "Bloqueado" },
                ]}
                onChange={(v) =>
                  setForm((current) => ({
                    ...current,
                    status: v as AppUser["status"],
                  }))
                }
              />

              <PermissionMatrix
                values={form.permissions}
                onToggle={togglePermission}
              />

              <button
                onClick={saveUser}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black uppercase tracking-wide text-white shadow-xl transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {editingId ? "Actualizar usuario" : "Guardar usuario"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-2xl font-black">Directorio de usuarios</h2>
                <p className="text-sm text-slate-400">
                  Control de acceso, estado, permisos y auditoría.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:w-[760px]">
                <label className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar usuario..."
                    className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] pl-11 pr-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                  />
                </label>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="h-12 rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                >
                  <option value="todos">Todos los roles</option>
                  {Object.entries(ROLE_PRESETS).map(([key, role]) => (
                    <option key={key} value={key}>
                      {role.label}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-12 rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="bloqueado">Bloqueado</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[480px] items-center justify-center">
                <Loader2 className="animate-spin text-cyan-300" size={44} />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 p-12 text-center">
                <Users className="mx-auto mb-4 text-slate-600" size={54} />
                <p className="text-lg font-black text-white">No hay usuarios</p>
                <p className="mt-2 text-sm text-slate-500">
                  Crea el primer usuario para activar el control SaaS.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <UserCard
                    key={user.id || user.email}
                    user={user}
                    onView={() => setSelectedUser(user)}
                    onEdit={() => editUser(user)}
                    onDelete={() => deleteUser(user)}
                    onStatus={(status) => updateStatus(user, status)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm font-bold text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle size={22} />
            <p>
              Recomendación PRO: el siguiente paso es conectar estos permisos con middleware / guardias de ruta para que cada usuario solo vea los módulos autorizados.
            </p>
          </div>
        </section>
      </div>

      {selectedUser ? (
        <UserModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      ) : null}
    </main>
  );
}

function normalizeOldRole(role?: string) {
  if (!role) return "ventas";
  const r = role.toLowerCase();
  if (r.includes("admin")) return "admin";
  if (r.includes("supervisor") || r.includes("gerente")) return "gerente";
  if (r.includes("producción") || r.includes("produccion")) return "produccion";
  if (r.includes("vendedor") || r.includes("venta")) return "ventas";
  if (r.includes("diseñ")) return "diseno";
  if (r.includes("empleado")) return "empleado";
  return "ventas";
}

function normalizeStatus(status?: string): AppUser["status"] {
  const s = String(status || "activo").toLowerCase();
  if (s === "activo" || s === "active" || s === "activa") return "activo";
  if (s === "bloqueado" || s === "blocked") return "bloqueado";
  return "inactivo";
}

function normalizePermissions(raw: any): PermissionKey[] {
  if (!Array.isArray(raw)) return [];

  const map: Record<string, PermissionKey> = {
    dashboard: "dashboard_ceo",
    inventario: "inventario",
    compras: "compras",
    producción: "produccion",
    produccion: "produccion",
    corte: "corte",
    ventas: "ventas",
    interno: "dashboard_ceo",
    historial: "dashboard_ceo",
    usuarios: "usuarios",
    "ia diseño": "ia_diseno",
    "ia diseno": "ia_diseno",
    cnc: "corte",
    configuración: "configuracion",
    configuracion: "configuracion",
    "portal empleado": "portal_empleado",
    portal_empleado: "portal_empleado",
  };

  return Array.from(
    new Set(
      raw
        .map((p) => String(p).trim().toLowerCase())
        .map((p) => map[p] || p)
        .filter((p): p is PermissionKey => ALL_PERMISSIONS.some((x) => x.key === p))
    )
  );
}

async function createAuditLog(
  module: string,
  action: string,
  entityType: string,
  entityId?: string,
  oldData?: any,
  newData?: any
) {
  try {
    await supabase.from("audit_logs").insert({
      module,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      old_data: oldData || null,
      new_data: newData || null,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("Audit log skipped", error);
  }
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
  subtitle: string;
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
          <p className="mt-2 text-xs text-slate-400">{subtitle}</p>
        </div>
        <div className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", tones[tone])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.20em] text-slate-400">{label}</span>
      <input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.20em] text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PermissionMatrix({
  values,
  onToggle,
}: {
  values: PermissionKey[];
  onToggle: (permission: PermissionKey) => void;
}) {
  const groups = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.group)));

  return (
    <div>
      <div className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
        Permisos del sistema
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group} className="rounded-2xl border border-slate-800 bg-[#020817] p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
              {group}
            </p>

            <div className="flex flex-wrap gap-2">
              {ALL_PERMISSIONS.filter((p) => p.group === group).map((permission) => {
                const active = values.includes(permission.key);

                return (
                  <button
                    key={permission.key}
                    type="button"
                    onClick={() => onToggle(permission.key)}
                    className={cx(
                      "rounded-xl border px-3 py-2 text-xs font-black transition",
                      active
                        ? "border-cyan-400/40 bg-cyan-500/20 text-cyan-100"
                        : "border-slate-700 bg-slate-950 text-slate-500 hover:border-slate-500"
                    )}
                  >
                    {permission.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserCard({
  user,
  onView,
  onEdit,
  onDelete,
  onStatus,
}: {
  user: AppUser;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatus: (status: AppUser["status"]) => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-[#030817] p-5">
      <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
              <User2 size={26} />
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-xl font-black">{user.full_name}</h3>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                <Mail size={14} />
                {user.email}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge status={user.status} />
            <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-xs font-black text-violet-300">
              {user.role_label}
            </span>
            {user.department ? (
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-black text-slate-300">
                {user.department}
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {user.permissions.slice(0, 10).map((permission) => (
              <span
                key={permission}
                className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100"
              >
                {ALL_PERMISSIONS.find((p) => p.key === permission)?.label || permission}
              </span>
            ))}
            {user.permissions.length > 10 ? (
              <span className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-black text-slate-300">
                +{user.permissions.length - 10}
              </span>
            ) : null}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Creado: {formatDate(user.created_at)} · Último login: {formatDate(user.last_login_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={onView} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-xs font-black text-cyan-100">
            <Eye size={16} />
            Ver
          </button>
          <button onClick={onEdit} className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs font-black text-amber-100">
            <Pencil size={16} />
            Editar
          </button>
          {user.status === "activo" ? (
            <button onClick={() => onStatus("bloqueado")} className="inline-flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs font-black text-red-100">
              <Lock size={16} />
              Bloquear
            </button>
          ) : (
            <button onClick={() => onStatus("activo")} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-xs font-black text-emerald-100">
              <CheckCircle2 size={16} />
              Activar
            </button>
          )}
          <button onClick={onDelete} className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-xs font-black text-white">
            <Trash2 size={16} />
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AppUser["status"] }) {
  const styles = {
    activo: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    inactivo: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    bloqueado: "border-red-400/30 bg-red-500/10 text-red-300",
  };

  return (
    <span className={cx("rounded-full border px-3 py-1 text-xs font-black uppercase", styles[status])}>
      {status}
    </span>
  );
}

function UserModal({ user, onClose }: { user: AppUser; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl border border-cyan-900/50 bg-[#07111f] p-6 shadow-2xl shadow-black">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black">{user.full_name}</h2>
            <p className="mt-1 text-sm text-slate-400">{user.email}</p>
          </div>

          <button onClick={onClose} className="rounded-2xl border border-slate-700 bg-slate-950 p-3 text-slate-300">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Info label="Rol" value={user.role_label} />
          <Info label="Estado" value={user.status} />
          <Info label="Departamento" value={user.department || "-"} />
          <Info label="Teléfono" value={user.phone || "-"} />
          <Info label="Creado" value={formatDate(user.created_at)} />
          <Info label="Actualizado" value={formatDate(user.updated_at)} />
        </div>

        <div className="mt-5 rounded-2xl border border-slate-800 bg-[#030817] p-4">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Permisos asignados
          </p>
          <div className="flex flex-wrap gap-2">
            {user.permissions.map((permission) => (
              <span key={permission} className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100">
                {ALL_PERMISSIONS.find((p) => p.key === permission)?.label || permission}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#030817] p-4">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 font-black text-white">{value}</p>
    </div>
  );
}
