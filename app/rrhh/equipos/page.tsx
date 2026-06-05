"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Factory,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  ShieldCheck,
  Truck,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  employee_code?: string | null;
  full_name: string;
  department?: string | null;
  position?: string | null;
  status?: string | null;
  phone?: string | null;
};

type TeamMember = {
  id?: string;
  employee_id?: string | null;
  employee_code?: string | null;
  employee_name: string;
  department?: string | null;
  position?: string | null;
  role_in_team: "maestro" | "ayudante" | "chofer" | "supervisor" | "qa";
  active?: boolean | null;
};

type OperationalTeam = {
  id: string;
  team_code: string;
  team_name: string;
  work_area: WorkArea;
  department?: string | null;
  shift?: string | null;
  status?: "activo" | "pausado" | "inactivo" | null;
  is_initial_combo?: boolean | null;
  notes?: string | null;
  active_members?: number | null;
  members?: TeamMember[] | string | null;
  created_at?: string | null;
};

type WorkArea =
  | "corte"
  | "canteo"
  | "ensamble_limpieza"
  | "corte_ensamble_limpieza"
  | "transporte"
  | "instalacion"
  | "qa"
  | "almacen";

type TeamForm = {
  id: string;
  team_code: string;
  team_name: string;
  work_area: WorkArea;
  shift: string;
  status: "activo" | "pausado" | "inactivo";
  leaderId: string;
  helperId: string;
  notes: string;
};

const areaOptions: Array<{
  value: WorkArea;
  label: string;
  department: string;
  description: string;
}> = [
  {
    value: "corte_ensamble_limpieza",
    label: "Corte + Ensamble + Limpieza",
    department: "Produccion",
    description: "Modo inicial: el mismo equipo corta, ensambla y limpia.",
  },
  {
    value: "instalacion",
    label: "Instalacion",
    department: "Campo",
    description: "Equipo de 2 personas para montaje en obra.",
  },
  {
    value: "corte",
    label: "Corte",
    department: "Corte y CNC",
    description: "Equipo dedicado a sierra/CNC cuando se separe la planta.",
  },
  {
    value: "canteo",
    label: "Canteo",
    department: "Produccion",
    description: "Equipo de canteo y terminacion de bordes.",
  },
  {
    value: "ensamble_limpieza",
    label: "Ensamble + Limpieza",
    department: "Produccion",
    description: "Armado, limpieza final y predespacho.",
  },
  {
    value: "transporte",
    label: "Transporte",
    department: "Logistica",
    description: "Chofer y ayudante para carga, ruta y entrega.",
  },
];

const emptyForm: TeamForm = {
  id: "",
  team_code: "EQ-INICIO-001",
  team_name: "Equipo 1 - Corte + Ensamble + Limpieza",
  work_area: "corte_ensamble_limpieza",
  shift: "diurno",
  status: "activo",
  leaderId: "",
  helperId: "",
  notes: "Arranque operativo: el mismo equipo corta, ensambla y limpia hasta separar posiciones.",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function norm(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function errorText(error: unknown) {
  if (!error) return "Error desconocido.";
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "Error desconocido.");
  }
  return JSON.stringify(error);
}

function parseMembers(value: OperationalTeam["members"]): TeamMember[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function areaLabel(value: WorkArea) {
  return areaOptions.find((area) => area.value === value)?.label || value;
}

function areaDepartment(value: WorkArea) {
  return areaOptions.find((area) => area.value === value)?.department || "Produccion";
}

function roleLabels(area: WorkArea) {
  if (area === "transporte") {
    return { leader: "Chofer / Maestro", helper: "Ayudante de transporte", leaderRole: "chofer" as const };
  }
  return { leader: "Maestro", helper: "Ayudante", leaderRole: "maestro" as const };
}

function codeForArea(area: WorkArea) {
  const prefix: Record<WorkArea, string> = {
    corte: "CORTE",
    canteo: "CANTO",
    ensamble_limpieza: "ENS",
    corte_ensamble_limpieza: "INICIO",
    transporte: "TRANS",
    instalacion: "INST",
    qa: "QA",
    almacen: "ALM",
  };
  return `EQ-${prefix[area]}-${String(Date.now()).slice(-5)}`;
}

function statusClass(status?: string | null) {
  const value = norm(status);
  if (value.includes("activo")) return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
  if (value.includes("pausado")) return "border-amber-400/30 bg-amber-500/15 text-amber-200";
  return "border-slate-500/30 bg-slate-500/15 text-slate-300";
}

function Kpi({
  title,
  value,
  icon,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-cyan-400/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.26em] text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-black text-white">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
          {icon}
        </span>
      </div>
    </div>
  );
}

export default function RRHHEquiposOperativosPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teams, setTeams] = useState<OperationalTeam[]>([]);
  const [form, setForm] = useState<TeamForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [setupMissing, setSetupMissing] = useState(false);
  const [search, setSearch] = useState("");

  const activeEmployees = useMemo(
    () => employees.filter((employee) => !norm(employee.status).includes("inactivo")),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const q = norm(search);
    if (!q) return activeEmployees;
    return activeEmployees.filter((employee) =>
      [
        employee.full_name,
        employee.employee_code,
        employee.department,
        employee.position,
        employee.phone,
      ].some((item) => norm(item).includes(q))
    );
  }, [activeEmployees, search]);

  const stats = useMemo(() => {
    const active = teams.filter((team) => team.status === "activo").length;
    const combo = teams.filter((team) => team.is_initial_combo).length;
    const complete = teams.filter((team) => Number(team.active_members || parseMembers(team.members).length) >= 2).length;
    return { active, combo, complete };
  }, [teams]);

  const selectedArea = areaOptions.find((area) => area.value === form.work_area) || areaOptions[0];
  const roles = roleLabels(form.work_area);

  async function loadData() {
    setLoading(true);
    setSetupMissing(false);
    setMessage("");

    const employeeResult = await supabase
      .from("employees")
      .select("id, employee_code, full_name, department, position, status, phone")
      .order("full_name", { ascending: true });

    if (employeeResult.error) {
      setMessage(`Error cargando empleados: ${errorText(employeeResult.error)}`);
    } else {
      setEmployees((employeeResult.data || []) as Employee[]);
    }

    const teamResult = await supabase
      .from("v_operational_teams_detail")
      .select("*")
      .order("created_at", { ascending: false });

    if (teamResult.error) {
      setSetupMissing(true);
      setTeams([]);
      setMessage(
        "Falta ejecutar el SQL de equipos operativos. Corre scripts/equipos-operativos.sql en Supabase y vuelve a actualizar."
      );
    } else {
      setTeams((teamResult.data || []) as OperationalTeam[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateForm(patch: Partial<TeamForm>) {
    setForm((current) => {
      const next = { ...current, ...patch };
      if (patch.work_area && !current.id) {
        next.team_code = patch.work_area === "corte_ensamble_limpieza" ? "EQ-INICIO-001" : codeForArea(patch.work_area);
        next.team_name = `Equipo 1 - ${areaLabel(patch.work_area)}`;
      }
      return next;
    });
  }

  function clearForm() {
    setForm({
      ...emptyForm,
      team_code: codeForArea("corte_ensamble_limpieza"),
    });
    setMessage("");
  }

  function editTeam(team: OperationalTeam) {
    const members = parseMembers(team.members);
    const leader =
      members.find((member) => ["maestro", "chofer", "supervisor", "qa"].includes(member.role_in_team)) || members[0];
    const helper = members.find((member) => member.employee_id !== leader?.employee_id) || members[1];

    setForm({
      id: team.id,
      team_code: team.team_code,
      team_name: team.team_name,
      work_area: team.work_area,
      shift: team.shift || "diurno",
      status: team.status || "activo",
      leaderId: leader?.employee_id || "",
      helperId: helper?.employee_id || "",
      notes: team.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveTeam() {
    setMessage("");

    const leader = employees.find((employee) => employee.id === form.leaderId);
    const helper = employees.find((employee) => employee.id === form.helperId);

    if (!leader || !helper) {
      setMessage("Selecciona las dos personas del equipo antes de guardar.");
      return;
    }

    if (leader.id === helper.id) {
      setMessage("Un equipo necesita dos personas diferentes.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        team_code: (form.team_code || codeForArea(form.work_area)).trim(),
        team_name: (form.team_name || `Equipo 1 - ${areaLabel(form.work_area)}`).trim(),
        work_area: form.work_area,
        department: areaDepartment(form.work_area),
        shift: form.shift || "diurno",
        status: form.status,
        is_initial_combo: form.work_area === "corte_ensamble_limpieza",
        notes: form.notes || null,
      };

      const teamResult = form.id
        ? await supabase.from("operational_teams").update(payload).eq("id", form.id).select("*").single()
        : await supabase
            .from("operational_teams")
            .upsert(payload, { onConflict: "team_code" })
            .select("*")
            .single();

      if (teamResult.error) throw teamResult.error;

      const team = teamResult.data as OperationalTeam;
      const deleteResult = await supabase.from("operational_team_members").delete().eq("team_id", team.id);
      if (deleteResult.error) throw deleteResult.error;

      const insertResult = await supabase.from("operational_team_members").insert([
        {
          team_id: team.id,
          employee_id: leader.id,
          employee_name: leader.full_name,
          employee_code: leader.employee_code || null,
          department: leader.department || null,
          position: leader.position || null,
          role_in_team: roles.leaderRole,
          active: true,
        },
        {
          team_id: team.id,
          employee_id: helper.id,
          employee_name: helper.full_name,
          employee_code: helper.employee_code || null,
          department: helper.department || null,
          position: helper.position || null,
          role_in_team: "ayudante",
          active: true,
        },
      ]);

      if (insertResult.error) throw insertResult.error;

      setMessage(`Equipo guardado: ${team.team_code} - ${team.team_name}.`);
      setForm((current) => ({ ...current, id: team.id }));
      await loadData();
    } catch (error) {
      setMessage(`Error guardando equipo: ${errorText(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleTeamStatus(team: OperationalTeam) {
    const nextStatus = team.status === "activo" ? "pausado" : "activo";
    setMessage("");

    const { error } = await supabase.from("operational_teams").update({ status: nextStatus }).eq("id", team.id);

    if (error) {
      setMessage(`Error actualizando estado: ${errorText(error)}`);
      return;
    }

    setMessage(`Equipo ${team.team_code} ahora esta ${nextStatus}.`);
    await loadData();
  }

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96)_48%,rgba(30,64,175,0.34))] p-6 shadow-2xl shadow-black/30 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
                <Users size={16} />
                RRHH - Equipos operativos
              </span>
              <h1 className="mt-5 text-4xl font-black tracking-tight text-white lg:text-6xl">Configuracion de equipos</h1>
              <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-300">
                Selecciona desde RRHH las dos personas por equipo. Para la prueba inicial, el equipo de corte tambien
                ensambla y limpia hasta separar la planta por roles definitivos.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={clearForm}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10"
              >
                <Plus size={18} />
                Nuevo equipo
              </button>
              <button
                type="button"
                onClick={loadData}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/20"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                Actualizar
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <div
            className={cx(
              "rounded-2xl border px-4 py-3 text-sm font-bold",
              setupMissing
                ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                : message.toLowerCase().includes("error")
                  ? "border-red-400/30 bg-red-500/10 text-red-100"
                  : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
            )}
          >
            {setupMissing ? <AlertTriangle className="mr-2 inline" size={18} /> : <CheckCircle2 className="mr-2 inline" size={18} />}
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Kpi title="Empleados RRHH" value={activeEmployees.length} subtitle="Disponibles para formar equipos" icon={<UserCheck size={20} />} />
          <Kpi title="Equipos activos" value={stats.active} subtitle="Listos para produccion/campo" icon={<ShieldCheck size={20} />} />
          <Kpi title="Equipos completos" value={stats.complete} subtitle="2 personas asignadas" icon={<Users size={20} />} />
          <Kpi title="Modo inicial" value={stats.combo} subtitle="Corte + ensamble + limpieza" icon={<Factory size={20} />} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.5rem] border border-cyan-400/15 bg-slate-950/70 p-5 shadow-2xl shadow-black/20">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Equipo operativo</p>
                <h2 className="mt-2 text-2xl font-black text-white">Asignacion de 2 personas</h2>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                <Wrench size={22} />
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-slate-500">Codigo</span>
                <input
                  value={form.team_code}
                  onChange={(event) => updateForm({ team_code: event.target.value.toUpperCase() })}
                  className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition focus:border-cyan-300"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-slate-500">Turno</span>
                <select
                  value={form.shift}
                  onChange={(event) => updateForm({ shift: event.target.value })}
                  className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition [color-scheme:dark] focus:border-cyan-300"
                >
                  <option value="diurno">Diurno</option>
                  <option value="nocturno">Nocturno</option>
                  <option value="mixto">Mixto</option>
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-slate-500">Nombre del equipo</span>
                <input
                  value={form.team_name}
                  onChange={(event) => updateForm({ team_name: event.target.value })}
                  className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition focus:border-cyan-300"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-slate-500">Area de trabajo</span>
                <select
                  value={form.work_area}
                  onChange={(event) => updateForm({ work_area: event.target.value as WorkArea })}
                  className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition [color-scheme:dark] focus:border-cyan-300"
                >
                  {areaOptions.map((area) => (
                    <option key={area.value} value={area.value}>
                      {area.label}
                    </option>
                  ))}
                </select>
                <span className="block rounded-2xl border border-cyan-400/15 bg-cyan-500/5 px-4 py-3 text-xs font-semibold text-cyan-100">
                  {selectedArea.description}
                </span>
              </label>
              <label className="space-y-2">
                <span className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-slate-500">{roles.leader}</span>
                <select
                  value={form.leaderId}
                  onChange={(event) => updateForm({ leaderId: event.target.value })}
                  className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition [color-scheme:dark] focus:border-cyan-300"
                >
                  <option value="">Seleccionar persona</option>
                  {activeEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name} - {employee.position || "Sin posicion"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-slate-500">{roles.helper}</span>
                <select
                  value={form.helperId}
                  onChange={(event) => updateForm({ helperId: event.target.value })}
                  className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition [color-scheme:dark] focus:border-cyan-300"
                >
                  <option value="">Seleccionar persona</option>
                  {activeEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name} - {employee.position || "Sin posicion"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-slate-500">Notas operativas</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateForm({ notes: event.target.value })}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300"
                  placeholder="Ej.: este equipo cubre corte, ensamble y limpieza durante el arranque."
                />
              </label>
            </div>

            <button
              type="button"
              onClick={saveTeam}
              disabled={saving || setupMissing}
              className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-sm font-black text-white shadow-xl shadow-cyan-950/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Guardar equipo operativo
            </button>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-white">Empleados disponibles</h3>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-black text-slate-300">
                  {filteredEmployees.length}
                </span>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar empleado, posicion o area..."
                className="mb-3 h-11 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 text-sm font-semibold text-white outline-none focus:border-cyan-300"
              />
              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                {filteredEmployees.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => updateForm(form.leaderId ? { helperId: employee.id } : { leaderId: employee.id })}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-left transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-white">{employee.full_name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {employee.employee_code || "Sin codigo"} - {employee.department || "Sin area"} - {employee.position || "Sin posicion"}
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[0.65rem] font-black uppercase text-emerald-200">
                        {employee.status || "activo"}
                      </span>
                    </div>
                  </button>
                ))}
                {!filteredEmployees.length ? (
                  <p className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
                    No hay empleados activos para asignar.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-cyan-400/15 bg-slate-950/70 p-5 shadow-2xl shadow-black/20">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Mapa operativo</p>
                <h2 className="mt-2 text-2xl font-black text-white">Equipos configurados</h2>
              </div>
              <div className="flex gap-2 text-cyan-300">
                <Scissors size={21} />
                <Truck size={21} />
                <Factory size={21} />
              </div>
            </div>

            {loading ? (
              <div className="grid min-h-[28rem] place-items-center rounded-2xl border border-slate-800 bg-slate-950">
                <div className="text-center">
                  <Loader2 className="mx-auto animate-spin text-cyan-300" size={34} />
                  <p className="mt-3 text-sm font-bold text-slate-400">Cargando equipos...</p>
                </div>
              </div>
            ) : teams.length ? (
              <div className="space-y-4">
                {teams.map((team) => {
                  const members = parseMembers(team.members);
                  return (
                    <article
                      key={team.id}
                      className={cx(
                        "rounded-3xl border p-5 transition",
                        team.is_initial_combo
                          ? "border-cyan-400/40 bg-cyan-500/10"
                          : "border-slate-800 bg-slate-900/60"
                      )}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.2em] text-cyan-200">
                              {team.team_code}
                            </span>
                            <span className={cx("rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase", statusClass(team.status))}>
                              {team.status || "activo"}
                            </span>
                            {team.is_initial_combo ? (
                              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[0.68rem] font-black uppercase text-amber-200">
                                Arranque
                              </span>
                            ) : null}
                          </div>
                          <h3 className="mt-3 text-2xl font-black text-white">{team.team_name}</h3>
                          <p className="mt-1 text-sm font-semibold text-slate-400">
                            {areaLabel(team.work_area)} - {team.department || areaDepartment(team.work_area)} - {team.shift || "diurno"}
                          </p>
                          {team.notes ? <p className="mt-3 text-sm leading-6 text-slate-300">{team.notes}</p> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editTeam(team)}
                            className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-500/20"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleTeamStatus(team)}
                            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-black text-slate-200 transition hover:bg-slate-800"
                          >
                            {team.status === "activo" ? "Pausar" : "Activar"}
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {members.map((member) => (
                          <div key={member.id || member.employee_id} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                            <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-cyan-300">
                              {member.role_in_team}
                            </p>
                            <p className="mt-2 text-lg font-black text-white">{member.employee_name}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {member.employee_code || "Sin codigo"} - {member.department || "Sin area"} - {member.position || "Sin posicion"}
                            </p>
                          </div>
                        ))}
                        {!members.length ? (
                          <p className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm font-bold text-amber-100 md:col-span-2">
                            Equipo creado sin miembros. Editalo y asigna dos personas.
                          </p>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-[28rem] place-items-center rounded-2xl border border-dashed border-cyan-400/20 bg-cyan-500/5 p-8 text-center">
                <div>
                  <Users className="mx-auto text-cyan-300" size={38} />
                  <h3 className="mt-4 text-xl font-black text-white">Sin equipos operativos</h3>
                  <p className="mt-2 max-w-md text-sm font-semibold text-slate-400">
                    Ejecuta el SQL de equipos y guarda el Equipo 1 para iniciar la prueba final con RRHH, produccion y campo conectados.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
