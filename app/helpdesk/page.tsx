"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredUser } from "@/lib/saas/auth-client";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Factory,
  Hammer,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  Wrench,
} from "lucide-react";

type RequestRow = {
  id: string;
  request_code: string | null;
  title: string;
  description: string | null;
  request_type: string;
  department: string;
  priority: string;
  status: string;
  project_id: string | null;
  project_name: string | null;
  client_name: string | null;
  requested_by: string | null;
  assigned_to: string | null;
  approved_by: string | null;
  cost_center: string | null;
  estimated_cost: number | null;
  real_cost: number | null;
  required_date: string | null;
  created_at: string | null;
  items_count?: number;
  items_total_cost?: number;
  operational_flag?: string;
};

type RequestItem = {
  id?: string;
  item_name: string;
  item_type: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  notes: string;
};

type ProjectRow = {
  id: string;
  project_name?: string | null;
  client_name?: string | null;
  name?: string | null;
  code?: string | null;
  source_table?: string | null;
};

type InventoryRow = {
  id: string;
  item_name?: string | null;
  name?: string | null;
  product_name?: string | null;
  unit?: string | null;
  stock?: number | null;
  quantity?: number | null;
  cost_price?: number | null;
  unit_cost?: number | null;
  cost?: number | null;
};

const REQUEST_TYPES = [
  { value: "solicitud_trabajo", label: "Solicitud de trabajo", icon: <Hammer size={16} /> },
  { value: "requisicion_almacen", label: "Requisición almacén", icon: <PackageCheck size={16} /> },
  { value: "faltante_proyecto", label: "Faltante de proyecto", icon: <AlertTriangle size={16} /> },
  { value: "compra_requerida", label: "Requisición compra", icon: <ShoppingCart size={16} /> },
  { value: "mantenimiento", label: "Mantenimiento", icon: <Wrench size={16} /> },
  { value: "soporte_operativo", label: "Soporte operativo", icon: <Factory size={16} /> },
];

const DEPARTMENTS = [
  "Administración",
  "Ventas",
  "Diseño",
  "Producción",
  "Corte",
  "CNC",
  "Almacén",
  "Compras",
  "Transporte",
  "Instalación",
  "Postventa",
  "RRHH",
];

const DEPARTMENT_OPTIONS = Array.from(
  new Set([
    ...DEPARTMENTS,
    "Administracion",
    "Diseno",
    "Produccion",
    "Centro de Requisiciones",
    "Almacen",
    "Instalacion",
    "Mantenimiento",
  ])
);

const COST_CENTERS = [
  { value: "", label: "Seleccionar centro de costo" },
  { value: "administracion", label: "Administracion" },
  { value: "comercial", label: "Comercial / Ventas" },
  { value: "diseno", label: "Diseno" },
  { value: "produccion", label: "Produccion" },
  { value: "corte_cnc", label: "Corte y CNC" },
  { value: "centro_requisiciones", label: "Centro de Requisiciones" },
  { value: "compras", label: "Compras" },
  { value: "transporte", label: "Transporte" },
  { value: "instalacion", label: "Instalacion" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "postventa_garantia", label: "Postventa / Garantia" },
  { value: "rrhh", label: "RRHH" },
  { value: "proyecto", label: "Proyecto relacionado" },
];

const STATUS = [
  "abierta",
  "pendiente",
  "en_proceso",
  "aprobada",
  "despachada",
  "cerrada",
  "cancelada",
];

const MODULES_BY_TYPE: Record<string, {
  eyebrow: string;
  title: string;
  subtitle: string;
  defaultDepartment: string;
  defaultAssignee: string;
  targetLabel: string;
  targetHref: string;
  requiresProject?: boolean;
}> = {
  compra_requerida: {
    eyebrow: "Compras internas",
    title: "Requisición de Compra",
    subtitle: "El usuario solicita una compra y la solicitud queda lista para seguimiento en el módulo de Compras.",
    defaultDepartment: "Compras",
    defaultAssignee: "Compras",
    targetLabel: "Abrir Compras",
    targetHref: "/compras",
  },
  requisicion_almacen: {
    eyebrow: "Centro de requisiciones",
    title: "Requisición de Centro de Requisiciones",
    subtitle: "Solicitudes de materiales, herramientas o consumibles que el Centro de Requisiciones debe reservar, despachar o marcar como faltante.",
    defaultDepartment: "Almacén",
    defaultAssignee: "Almacén",
    targetLabel: "Abrir Centro de Requisiciones",
    targetHref: "/inventario-inteligente/requisiciones",
  },
  faltante_proyecto: {
    eyebrow: "Costo por proyecto",
    title: "Faltantes de Proyecto",
    subtitle: "Registra materiales faltantes contra un proyecto para sumar el costo real y dar seguimiento operativo.",
    defaultDepartment: "Producción",
    defaultAssignee: "Producción / Compras",
    targetLabel: "Abrir Proyectos",
    targetHref: "/proyectos",
    requiresProject: true,
  },
  mantenimiento: {
    eyebrow: "Gerencia de mantenimiento",
    title: "Solicitudes de Mantenimiento",
    subtitle: "Cada departamento reporta necesidades de mantenimiento para seguimiento del gerente responsable.",
    defaultDepartment: "Mantenimiento",
    defaultAssignee: "Gerente de mantenimiento",
    targetLabel: "Abrir Mantenimiento",
    targetHref: "/assets?tab=mantenimiento",
  },
};

const DEFAULT_MODULE = {
  eyebrow: "Helpdesk operativo",
  title: "Solicitudes Internas PRO",
  subtitle: "Bandeja general de requisiciones de compra, almacén, faltantes de proyecto y mantenimiento.",
  defaultDepartment: "Producción",
  defaultAssignee: "",
  targetLabel: "Bandeja general",
  targetHref: "/helpdesk",
};

const emptyItem = (): RequestItem => ({
  item_name: "",
  item_type: "material",
  quantity: 1,
  unit: "unidad",
  unit_cost: 0,
  notes: "",
});

function money(value: any) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function safeDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("es-DO");
  } catch {
    return "-";
  }
}

function labelType(value: string) {
  return REQUEST_TYPES.find((t) => t.value === value)?.label || value;
}

function HelpdeskSolicitudesInternasPage({ forcedType }: { forcedType?: string } = {}) {
  const searchParams = useSearchParams();
  const routeType = forcedType || searchParams.get("type") || "todos";
  const lockedType = REQUEST_TYPES.some((type) => type.value === routeType) ? routeType : "todos";
  const isModuleLocked = lockedType !== "todos";
  const moduleConfig = MODULES_BY_TYPE[lockedType] || DEFAULT_MODULE;

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RequestRow | null>(null);
  const [selectedItems, setSelectedItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUserName, setCurrentUserName] = useState("Usuario");

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestType, setRequestType] = useState("requisicion_almacen");
  const [department, setDepartment] = useState("Producción");
  const [priority, setPriority] = useState("media");
  const [status, setStatus] = useState("abierta");
  const [projectId, setProjectId] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [items, setItems] = useState<RequestItem[]>([emptyItem()]);

  useEffect(() => {
    const storedUser = getStoredUser();
    const name = storedUser?.full_name || storedUser?.email || "Usuario";
    setCurrentUserName(name);
    setRequestedBy((current) => current || name);
    loadAll();
  }, []);

  useEffect(() => {
    if (!isModuleLocked) return;
    setFilterType(lockedType);
    setRequestType(lockedType);
    setDepartment(moduleConfig.defaultDepartment);
    setAssignedTo(moduleConfig.defaultAssignee);
  }, [isModuleLocked, lockedType, moduleConfig.defaultAssignee, moduleConfig.defaultDepartment]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadRequests(), loadProjects(), loadInventory()]);
    setLoading(false);
  }

  async function loadRequests() {
    const { data, error } = await supabase
      .from("v_helpdesk_requests_pro")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Error cargando solicitudes: " + error.message);
      return;
    }

    setRequests((data || []) as RequestRow[]);
  }

  async function loadProjects() {
    try {
      const tables = ["project_contracts", "production_orders", "furniture_projects", "projects"];
      const loaded: ProjectRow[] = [];
      const seen = new Set<string>();

      for (const table of tables) {
        const { data, error } = await supabase.from(table).select("*").limit(120);
        if (error || !Array.isArray(data)) continue;

        for (const row of data as any[]) {
          if (!row?.id || seen.has(String(row.id))) continue;
          seen.add(String(row.id));
          loaded.push({
            id: String(row.id),
            source_table: table,
            code: row.contract_code || row.order_code || row.quote_no || row.code || null,
            project_name: row.project_name || row.name || row.project || row.title || "Proyecto",
            client_name: row.client_name || row.customer_name || row.client || "",
            name: row.name || row.project_name || "",
          });
        }
      }

      setProjects(loaded);
    } catch {
      setProjects([]);
    }
  }

  async function loadInventory() {
    const tables = ["inventory_items", "inventory", "productos"];

    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select("*").limit(120);
        if (!error && Array.isArray(data)) {
          setInventory(data as InventoryRow[]);
          return;
        }
      } catch {}
    }

    setInventory([]);
  }

  async function loadRequestItems(requestId: string) {
    const { data, error } = await supabase
      .from("helpdesk_request_items")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    if (error) {
      alert("Error cargando items: " + error.message);
      return;
    }

    setSelectedItems((data || []) as RequestItem[]);
  }

  function clearForm() {
    setSelectedRequest(null);
    setSelectedItems([]);
    setTitle("");
    setDescription("");
    setRequestType(isModuleLocked ? lockedType : "requisicion_almacen");
    setDepartment(isModuleLocked ? moduleConfig.defaultDepartment : "Producción");
    setPriority("media");
    setStatus("abierta");
    setProjectId("");
    setRequestedBy(currentUserName);
    setAssignedTo(isModuleLocked ? moduleConfig.defaultAssignee : "");
    setCostCenter("");
    setRequiredDate("");
    setItems([emptyItem()]);
  }

  function selectRequest(row: RequestRow) {
    setSelectedRequest(row);
    setTitle(row.title || "");
    setDescription(row.description || "");
    setRequestType(row.request_type || "solicitud_trabajo");
    setDepartment(row.department || "Producción");
    setPriority(row.priority || "media");
    setStatus(row.status || "abierta");
    setProjectId(row.project_id || "");
    setRequestedBy(row.requested_by || "");
    setAssignedTo(row.assigned_to || "");
    setCostCenter(row.cost_center || "");
    setRequiredDate(row.required_date || "");
    loadRequestItems(row.id);
  }

  function updateItem(index: number, field: keyof RequestItem, value: any) {
    setItems((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: field === "quantity" || field === "unit_cost" ? Number(value || 0) : value,
            }
          : item
      )
    );
  }

  function addItemFromInventory(inv: InventoryRow) {
    const name = inv.item_name || inv.product_name || inv.name || "Artículo";
    const unit = inv.unit || "unidad";
    const unitCost = Number(inv.cost_price || inv.unit_cost || inv.cost || 0);

    setItems((current) => [
      ...current,
      {
        item_name: name,
        item_type: "material",
        quantity: 1,
        unit,
        unit_cost: unitCost,
        notes: `Desde inventario. Stock: ${Number(inv.stock ?? inv.quantity ?? 0)}`,
      },
    ]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  const selectedProject = projects.find((p) => p.id === projectId) || null;

  const formTotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0), 0),
    [items]
  );

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();

    return requests.filter((r) => {
      const matchesSearch =
        !q ||
        [
          r.request_code,
          r.title,
          r.description,
          r.department,
          r.project_name,
          r.client_name,
          r.requested_by,
          r.assigned_to,
          r.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      const selectedType = isModuleLocked ? lockedType : filterType;
      const matchesType = selectedType === "todos" || r.request_type === selectedType;
      const matchesStatus = filterStatus === "todos" || r.status === filterStatus;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [requests, search, filterType, filterStatus, isModuleLocked, lockedType]);

  const kpis = useMemo(() => {
    const scoped = isModuleLocked ? requests.filter((r) => r.request_type === lockedType) : requests;
    const open = scoped.filter((r) => ["abierta", "pendiente", "en_proceso"].includes(r.status)).length;
    const critical = scoped.filter((r) => r.priority === "critica").length;
    const warehouse = scoped.filter((r) => r.request_type === "requisicion_almacen").length;
    const missing = scoped.filter((r) => r.request_type === "faltante_proyecto").length;
    const cost = scoped.reduce((sum, r) => sum + Number(r.items_total_cost || r.estimated_cost || 0), 0);

    return { total: scoped.length, open, critical, warehouse, missing, cost };
  }, [requests, isModuleLocked, lockedType]);

  async function applyMissingCostToProject(effectiveType: string) {
    if (effectiveType !== "faltante_proyecto" || !selectedProject?.source_table || formTotal <= 0) return;

    try {
      const { data } = await supabase
        .from(selectedProject.source_table)
        .select("*")
        .eq("id", selectedProject.id)
        .maybeSingle();

      if (!data) return;

      const row = data as any;
      const currentCost = Number(row.real_cost || row.total_cost || row.cost_total || row.estimated_cost || 0);
      const nextCost = currentCost + formTotal;
      const costFields = ["real_cost", "total_cost", "cost_total", "estimated_cost"];

      for (const field of costFields) {
        if (row[field] === undefined && field !== "real_cost") continue;
        const { error } = await supabase
          .from(selectedProject.source_table)
          .update({ [field]: nextCost } as any)
          .eq("id", selectedProject.id);

        if (!error) return;
      }
    } catch {
      // La solicitud queda registrada aunque la tabla del proyecto no tenga campo de costo compatible.
    }
  }

  async function saveRequest() {
    if (!title.trim()) {
      alert("Escribe el título de la solicitud.");
      return;
    }

    const effectiveType = isModuleLocked ? lockedType : requestType;
    const cleanItems = items.filter((item) => item.item_name.trim() && Number(item.quantity || 0) > 0);

    if (["requisicion_almacen", "faltante_proyecto", "compra_requerida"].includes(effectiveType) && cleanItems.length === 0) {
      alert("Agrega al menos un item solicitado.");
      return;
    }

    if (MODULES_BY_TYPE[effectiveType]?.requiresProject && !projectId) {
      alert("Selecciona el proyecto relacionado para cargar ese faltante al costo del proyecto.");
      return;
    }

    if (!costCenter) {
      alert("Selecciona el centro de costo para poder auditar el gasto en reportes.");
      return;
    }

    if (!assignedTo) {
      alert("Selecciona el departamento asignado para darle seguimiento.");
      return;
    }

    setSaving(true);

    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        request_type: effectiveType,
        department,
        priority,
        status,
        project_id: projectId || null,
        project_name: selectedProject?.project_name || selectedProject?.name || "",
        client_name: selectedProject?.client_name || "",
        requested_by: currentUserName,
        assigned_to: assignedTo,
        cost_center: costCenter,
        estimated_cost: formTotal,
        real_cost: formTotal,
        required_date: requiredDate || null,
      };

      let requestId = selectedRequest?.id || "";

      if (selectedRequest?.id) {
        const { error } = await supabase
          .from("helpdesk_requests")
          .update(payload)
          .eq("id", selectedRequest.id);

        if (error) throw error;

        const { error: deleteError } = await supabase
          .from("helpdesk_request_items")
          .delete()
          .eq("request_id", selectedRequest.id);

        if (deleteError) throw deleteError;
      } else {
        const { data, error } = await supabase
          .from("helpdesk_requests")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        requestId = data.id;
      }

      if (cleanItems.length > 0) {
        const insertItems = cleanItems.map((item) => ({
          request_id: requestId,
          item_name: item.item_name.trim(),
          item_type: item.item_type || "material",
          quantity: Number(item.quantity || 0),
          unit: item.unit || "unidad",
          unit_cost: Number(item.unit_cost || 0),
          notes: item.notes || "",
        }));

        const { error: itemsError } = await supabase
          .from("helpdesk_request_items")
          .insert(insertItems);

        if (itemsError) throw itemsError;
      }

      await supabase.from("helpdesk_request_comments").insert({
        request_id: requestId,
        author_name: currentUserName || "Sistema",
        comment: selectedRequest ? "Solicitud actualizada." : "Solicitud creada.",
      });

      if (!selectedRequest?.id) {
        await applyMissingCostToProject(effectiveType);
      }

      await loadRequests();
      clearForm();
      alert("✅ Solicitud guardada correctamente.");
    } catch (error: any) {
      alert("Error guardando solicitud: " + (error?.message || error));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(row: RequestRow, nextStatus: string) {
    const payload: any = { status: nextStatus };

    if (nextStatus === "aprobada") payload.approved_at = new Date().toISOString();
    if (nextStatus === "cerrada") payload.closed_at = new Date().toISOString();

    const { error } = await supabase
      .from("helpdesk_requests")
      .update(payload)
      .eq("id", row.id);

    if (error) {
      alert("Error cambiando estado: " + error.message);
      return;
    }

    await supabase.from("helpdesk_request_comments").insert({
      request_id: row.id,
      author_name: "Sistema",
      comment: `Estado cambiado a ${nextStatus}.`,
    });

    await loadRequests();
  }

  async function deleteRequest(row: RequestRow) {
    if (!confirm(`¿Eliminar solicitud ${row.request_code || row.title}?`)) return;

    const { error } = await supabase
      .from("helpdesk_requests")
      .delete()
      .eq("id", row.id);

    if (error) {
      alert("Error eliminando solicitud: " + error.message);
      return;
    }

    if (selectedRequest?.id === row.id) clearForm();
    await loadRequests();
  }

  return (
    <main className="min-h-screen bg-[#020817] px-5 py-6 text-white lg:px-6">
      <div className="mx-auto max-w-[1700px] space-y-5">
        <section className="relative overflow-hidden rounded-[1.6rem] border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 shadow-2xl shadow-cyan-950/20">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                <ClipboardList size={16} />
                {moduleConfig.eyebrow}
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
                {moduleConfig.title}
              </h1>
              <p className="mt-2 max-w-4xl text-sm font-bold leading-6 text-slate-300">
                {moduleConfig.subtitle}
              </p>
            </div>

            <button
              onClick={loadAll}
              disabled={loading}
              className="inline-flex h-12 min-w-[150px] items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-slate-950 hover:bg-cyan-50 disabled:opacity-60"
            >
              <RefreshCw className={loading ? "animate-spin" : ""} size={18} />
              Actualizar
            </button>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Kpi label="Solicitudes" value={kpis.total} icon={<ClipboardList />} />
          <Kpi label="Abiertas" value={kpis.open} icon={<Clock3 />} />
          <Kpi label="Críticas" value={kpis.critical} icon={<AlertTriangle />} accent="text-red-300" />
          <Kpi label="Centro Req." value={kpis.warehouse} icon={<PackageCheck />} accent="text-emerald-300" />
          <Kpi label="Faltantes" value={kpis.missing} icon={<Factory />} accent="text-amber-300" />
          <Kpi label="Costo estimado" value={money(kpis.cost)} icon={<Building2 />} accent="text-cyan-300" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-[#07111f] p-5 shadow-xl shadow-black/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">
                    {selectedRequest ? "Editar solicitud" : "Nueva solicitud"}
                  </h2>
                  <p className="text-xs font-bold text-slate-500">
                    Requisiciones y necesidades operativas.
                  </p>
                </div>
                <button
                  onClick={clearForm}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-black text-slate-300 hover:border-cyan-400"
                >
                  Nueva
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <Input label="Título" value={title} onChange={setTitle} placeholder="Ej: Faltan bisagras para proyecto TV" />

                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Tipo"
                    value={requestType}
                    onChange={setRequestType}
                    options={REQUEST_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                    disabled={isModuleLocked}
                  />
                  <Select label="Prioridad" value={priority} onChange={setPriority} options={[
                    { value: "baja", label: "Baja" },
                    { value: "media", label: "Media" },
                    { value: "alta", label: "Alta" },
                    { value: "critica", label: "Crítica" },
                  ]} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Select label="Departamento solicitante" value={department} onChange={setDepartment} options={DEPARTMENT_OPTIONS.map((d) => ({ value: d, label: d }))} />
                  <Select label="Estado" value={status} onChange={setStatus} options={STATUS.map((s) => ({ value: s, label: s }))} />
                </div>

                <Select
                  label="Proyecto relacionado"
                  value={projectId}
                  onChange={setProjectId}
                  options={[
                    { value: "", label: "Sin proyecto / gasto operativo" },
                    ...projects.map((p) => ({
                      value: p.id,
                      label: `${p.code ? `${p.code} - ` : ""}${p.project_name || p.name || "Proyecto"} - ${p.client_name || "Cliente"}`,
                    })),
                  ]}
                />

                <div className="grid grid-cols-2 gap-3">
                  <ReadOnlyField label="Solicitado por" value={requestedBy || currentUserName} />
                  <Select label="Asignado a departamento" value={assignedTo} onChange={setAssignedTo} options={[
                    { value: "", label: "Seleccionar departamento" },
                    ...DEPARTMENT_OPTIONS.map((d) => ({ value: d, label: d })),
                  ]} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Select label="Centro de costo" value={costCenter} onChange={setCostCenter} options={COST_CENTERS} />
                  <Input label="Fecha requerida" type="date" value={requiredDate} onChange={setRequiredDate} />
                </div>

                <label className="block">
                  <div className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Descripción</div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-24 w-full rounded-xl border border-slate-700 bg-[#020817] px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-400"
                    placeholder="Explica la necesidad, urgencia o detalle del trabajo..."
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#07111f] p-5 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Items solicitados</h2>
                  <p className="text-xs font-bold text-slate-500">Materiales, herramientas o servicios.</p>
                </div>
                <button
                  onClick={() => setItems((current) => [...current, emptyItem()])}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-black text-slate-950"
                >
                  <Plus size={14} /> Item
                </button>
              </div>

              <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <div key={index} className="rounded-xl border border-slate-800 bg-[#020817] p-3">
                    <Input label="Item" value={item.item_name} onChange={(v) => updateItem(index, "item_name", v)} placeholder="Ej: Bisagra DTC soft close" />
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <Input label="Cant." type="number" value={String(item.quantity)} onChange={(v) => updateItem(index, "quantity", v)} />
                      <Input label="Unidad" value={item.unit} onChange={(v) => updateItem(index, "unit", v)} />
                      <Input label="Costo" type="number" value={String(item.unit_cost)} onChange={(v) => updateItem(index, "unit_cost", v)} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-emerald-300">
                        {money(Number(item.quantity || 0) * Number(item.unit_cost || 0))}
                      </span>
                      <button
                        onClick={() => removeItem(index)}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-500/15 px-2 py-1 text-[11px] font-black text-red-300"
                      >
                        <Trash2 size={12} /> Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {inventory.length > 0 && (
                <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                    Inventario rápido
                  </div>
                  <div className="max-h-[150px] space-y-2 overflow-y-auto pr-1">
                    {inventory.slice(0, 20).map((inv) => (
                      <button
                        key={inv.id}
                        onClick={() => addItemFromInventory(inv)}
                        className="w-full rounded-lg border border-slate-800 bg-[#020817] px-3 py-2 text-left text-xs font-bold text-slate-300 hover:border-cyan-500"
                      >
                        <div className="truncate text-white">
                          {inv.item_name || inv.product_name || inv.name || "Artículo"}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Stock: {Number(inv.stock ?? inv.quantity ?? 0)} · {money(inv.cost_price || inv.unit_cost || inv.cost || 0)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Total</span>
                <span className="text-lg font-black text-white">{money(formTotal)}</span>
              </div>

              <button
                onClick={saveRequest}
                disabled={saving}
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 text-sm font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                <Send size={18} />
                {saving ? "Guardando..." : selectedRequest ? "Actualizar solicitud" : "Crear solicitud"}
              </button>
            </div>
          </aside>

          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-[#07111f] p-5 shadow-xl shadow-black/20">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Bandeja de solicitudes</h2>
                  <p className="text-xs font-bold text-slate-500">
                    Control operativo de necesidades internas.
                  </p>
                </div>
                <div className="flex flex-col gap-2 md:flex-row">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar..."
                      className="h-11 w-full rounded-xl border border-slate-700 bg-[#020817] pl-10 pr-3 text-sm font-bold text-white outline-none focus:border-cyan-400 md:w-72"
                    />
                  </div>
                  {isModuleLocked ? (
                    <div className="flex h-11 items-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 text-sm font-black text-cyan-200">
                      {labelType(lockedType)}
                    </div>
                  ) : (
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="h-11 rounded-xl border border-slate-700 bg-[#020817] px-3 text-sm font-bold text-white outline-none"
                    >
                      <option value="todos">Todos los tipos</option>
                      {REQUEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  )}
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="h-11 rounded-xl border border-slate-700 bg-[#020817] px-3 text-sm font-bold text-white outline-none"
                  >
                    <option value="todos">Todos los estados</option>
                    {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-slate-950/90 text-[10px] uppercase tracking-[0.22em] text-slate-500">
                    <tr>
                      <th className="p-4 text-left">Solicitud</th>
                      <th className="p-4 text-left">Tipo</th>
                      <th className="p-4 text-left">Depto / costo</th>
                      <th className="p-4 text-left">Proyecto</th>
                      <th className="p-4 text-left">Costo</th>
                      <th className="p-4 text-left">Estado</th>
                      <th className="p-4 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          No hay solicitudes.
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => selectRequest(row)}
                          className="cursor-pointer border-t border-slate-800 transition hover:bg-cyan-500/5"
                        >
                          <td className="p-4">
                            <div className="font-black text-white">{row.request_code || "SI"}</div>
                            <div className="mt-1 max-w-[320px] truncate text-xs font-bold text-slate-400">{row.title}</div>
                            <div className="mt-1 text-[10px] text-slate-600">{safeDate(row.created_at)}</div>
                          </td>
                          <td className="p-4 text-slate-300">{labelType(row.request_type)}</td>
                          <td className="p-4">
                            <div className="font-bold text-slate-300">{row.department}</div>
                            <div className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
                              {row.cost_center || "Sin centro"}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="max-w-[220px] truncate text-slate-300">
                              {row.project_name || "Gasto operativo"}
                            </div>
                            <div className="text-xs text-slate-600">{row.client_name || ""}</div>
                          </td>
                          <td className="p-4 font-black text-emerald-300">
                            {money(row.items_total_cost || row.estimated_cost || 0)}
                          </td>
                          <td className="p-4">
                            <StatusPill status={row.status} priority={row.priority} />
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  changeStatus(row, "aprobada");
                                }}
                                className="rounded-lg bg-cyan-500/15 px-2 py-1 text-[11px] font-black text-cyan-300"
                              >
                                Aprobar
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  changeStatus(row, "despachada");
                                }}
                                className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-black text-emerald-300"
                              >
                                Despachar
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteRequest(row);
                                }}
                                className="rounded-lg bg-red-500/15 px-2 py-1 text-[11px] font-black text-red-300"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedRequest && (
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                      Detalle seleccionado
                    </div>
                    <h3 className="mt-1 text-2xl font-black">{selectedRequest.title}</h3>
                  </div>
                  <button
                    onClick={() => changeStatus(selectedRequest, "cerrada")}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                  >
                    <CheckCircle2 size={16} /> Cerrar
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Mini label="Código" value={selectedRequest.request_code || "-"} />
                  <Mini label="Tipo" value={labelType(selectedRequest.request_type)} />
                  <Mini label="Estado" value={selectedRequest.status} />
                  <Mini label="Centro costo" value={selectedRequest.cost_center || "-"} />
                  <Mini label="Asignado depto." value={selectedRequest.assigned_to || "-"} />
                  <Mini label="Solicitante" value={selectedRequest.requested_by || "-"} />
                </div>

                <a
                  href={
                    selectedRequest.request_type === "faltante_proyecto" && selectedRequest.project_id
                      ? `/proyectos/${selectedRequest.project_id}`
                      : MODULES_BY_TYPE[selectedRequest.request_type]?.targetHref || moduleConfig.targetHref
                  }
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-4 text-xs font-black text-cyan-100 hover:bg-cyan-500/25"
                >
                  {MODULES_BY_TYPE[selectedRequest.request_type]?.targetLabel || moduleConfig.targetLabel}
                </a>

                <div className="mt-4 overflow-hidden rounded-xl border border-cyan-500/20">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-950/80 text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                      <tr>
                        <th className="p-3 text-left">Item</th>
                        <th className="p-3 text-left">Cantidad</th>
                        <th className="p-3 text-left">Costo</th>
                        <th className="p-3 text-left">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-5 text-center text-slate-500">Sin items.</td>
                        </tr>
                      ) : (
                        selectedItems.map((item, index) => (
                          <tr key={index} className="border-t border-cyan-500/10">
                            <td className="p-3">{item.item_name}</td>
                            <td className="p-3">{item.quantity} {item.unit}</td>
                            <td className="p-3">{money(item.unit_cost)}</td>
                            <td className="p-3 font-black text-emerald-300">{money(Number(item.quantity || 0) * Number(item.unit_cost || 0))}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

export default function HelpdeskPage() {
  return <HelpdeskSolicitudesInternasPage />;
}

function Kpi({ label, value, icon, accent = "text-cyan-300" }: { label: string; value: any; icon: any; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07111f] p-4 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{label}</div>
        <div className={accent}>{icon}</div>
      </div>
      <div className="mt-3 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder = "", type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-slate-700 bg-[#020817] px-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="block">
      <div className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="flex h-10 w-full items-center rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm font-black text-cyan-100">
        {value || "Usuario"}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-slate-700 bg-[#020817] px-3 text-sm font-bold text-white outline-none focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function StatusPill({ status, priority }: { status: string; priority: string }) {
  const isCritical = priority === "critica";
  const cls =
    status === "cerrada"
      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
      : status === "despachada"
      ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-300"
      : isCritical
      ? "border-red-400/30 bg-red-500/15 text-red-300"
      : "border-amber-400/30 bg-amber-500/15 text-amber-300";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black capitalize ${cls}`}>
      {status}
    </span>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-[#020817] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">{label}</div>
      <div className="mt-1 font-black text-white">{value}</div>
    </div>
  );
}
