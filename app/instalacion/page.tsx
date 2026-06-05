
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  QrCode,
  RefreshCw,
  Save,
  Search,
  Send,
  Truck,
  UploadCloud,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { registerOperationalCompensationEvents } from "@/lib/rrhh/operational-compensation";

type InstallationTeam = {
  id?: string;
  team_name: string;
  leader_name?: string | null;
  leader_phone?: string | null;
  installer_1_name?: string | null;
  installer_1_phone?: string | null;
  installer_2_name?: string | null;
  installer_2_phone?: string | null;
  status?: string | null;
  notes?: string | null;
};

type Handoff = {
  id?: string;
  order_code: string;
  module_name: string;
  client_name?: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  project_name?: string | null;
  handoff_status?: string | null;
  delivered_by?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  gps_accuracy?: number | null;
  notes?: string | null;
  delivered_at?: string | null;
  created_at?: string | null;
};

type TransportEvent = {
  id?: string;
  order_code: string;
  module_name: string;
  client_name?: string | null;
  project_name?: string | null;
  event_type?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle?: string | null;
  location_text?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  gps_accuracy?: number | null;
  notes?: string | null;
  created_at?: string | null;
};

type TransportPhoto = {
  id?: string;
  order_code: string;
  module_name: string;
  photo_url: string;
  photo_type?: string | null;
  uploaded_by?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type Assignment = {
  id?: string;
  order_code: string;
  module_name: string;
  project_name?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  installer_1_name?: string | null;
  installer_1_phone?: string | null;
  installer_2_name?: string | null;
  installer_2_phone?: string | null;
  assignment_status?: string | null;
  qa_status?: string | null;
  notes?: string | null;
  assigned_at?: string | null;
  started_at?: string | null;
  installed_at?: string | null;
  updated_at?: string | null;
};

type InstallationScan = {
  id?: string;
  order_code?: string | null;
  module_code?: string | null;
  module_name?: string | null;
  qr_value?: string | null;
  installer_name?: string | null;
  installer_1_name?: string | null;
  installer_2_name?: string | null;
  scan_status?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  installed_at?: string | null;
};

type InstallModule = {
  key: string;
  order_code: string;
  module_name: string;
  project_name: string;
  client_name: string;
  client_phone: string;
  client_address: string;
  driver_name: string;
  driver_phone: string;
  vehicle: string;
  gps_lat?: number | null;
  gps_lng?: number | null;
  gps_accuracy?: number | null;
  handoff?: Handoff | null;
  latestTransport?: TransportEvent | null;
  photos: TransportPhoto[];
  assignment?: Assignment | null;
  scans: InstallationScan[];
  status: string;
  statusLabel: string;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function keyOf(orderCode: string, moduleName: string) {
  return `${orderCode || "SIN-ORDEN"}__${moduleName || "SIN-MODULO"}`;
}

function phoneClean(value: string) {
  let phone = clean(value).replace(/\D/g, "");
  if (phone.length === 10) phone = `1${phone}`;
  return phone;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-DO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function latestByDate<T extends { created_at?: string | null }>(rows: T[]) {
  return [...rows].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;
}

function isTeamActive(team?: InstallationTeam | null) {
  return clean(team?.status).toLowerCase() === "activo";
}

async function safeLoadTable(table: string) {
  try {
    const { data, error } = await supabase.from(table).select("*").limit(1000);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

async function uploadInstallPhoto(orderCode: string, moduleName: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const safeModule = moduleName.replace(/\s+/g, "-").replace(/[^\w-]/g, "");
  const path = `instalacion/${orderCode}/${safeModule}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("project-files").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });

  if (error) throw error;

  const { data } = supabase.storage.from("project-files").getPublicUrl(path);
  return data.publicUrl;
}

export default function InstalacionPage() {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [transportEvents, setTransportEvents] = useState<TransportEvent[]>([]);
  const [transportPhotos, setTransportPhotos] = useState<TransportPhoto[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teams, setTeams] = useState<InstallationTeam[]>([]);
  const [scans, setScans] = useState<InstallationScan[]>([]);

  const [selectedKey, setSelectedKey] = useState("");
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("todos");

  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [notes, setNotes] = useState("");
  const [scanStatus, setScanStatus] = useState("instalado");
  const [photoNotes, setPhotoNotes] = useState("");

  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsMessage, setGpsMessage] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadData();
    getGps();
  }, []);

  async function getGps() {
    setGpsMessage("");

    if (!navigator.geolocation) {
      setGpsMessage("GPS no disponible.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };

        setGps(next);
        setGpsMessage(`GPS capturado: ${next.lat.toFixed(6)}, ${next.lng.toFixed(6)}`);
      },
      (err) => setGpsMessage(`GPS no disponible: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const [handoffRows, eventRows, photoRows, assignmentRows, teamRows, scanRows] = await Promise.all([
        safeLoadTable("installation_handoffs"),
        safeLoadTable("transport_module_events"),
        safeLoadTable("transport_module_photos"),
        safeLoadTable("installation_assignments"),
        safeLoadTable("installation_teams"),
        safeLoadTable("project_installation_scans"),
      ]);

      setHandoffs(handoffRows as Handoff[]);
      setTransportEvents(eventRows as TransportEvent[]);
      setTransportPhotos(photoRows as TransportPhoto[]);
      setAssignments(assignmentRows as Assignment[]);
      setTeams(teamRows as InstallationTeam[]);
      setScans(scanRows as InstallationScan[]);
    } catch (error: any) {
      setMessage(`⚠️ Error cargando instalación: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  }

  const teamById = useMemo(() => {
    const map = new Map<string, InstallationTeam>();
    teams.forEach((team) => team.id && map.set(team.id, team));
    return map;
  }, [teams]);

  const activeTeams = useMemo(() => teams.filter(isTeamActive), [teams]);

  const modules = useMemo<InstallModule[]>(() => {
    const baseMap = new Map<string, InstallModule>();

    for (const handoff of handoffs) {
      const orderCode = handoff.order_code || "SIN-ORDEN";
      const moduleName = handoff.module_name || "Sin módulo";
      const key = keyOf(orderCode, moduleName);

      const moduleEvents = transportEvents.filter((event) => event.order_code === orderCode && event.module_name === moduleName);
      const latestTransport = latestByDate(moduleEvents);
      const modulePhotos = transportPhotos.filter((photo) => photo.order_code === orderCode && photo.module_name === moduleName);
      const assignment = assignments.find((a) => a.order_code === orderCode && a.module_name === moduleName) || null;
      const moduleScans = scans.filter((s) => s.order_code === orderCode || s.module_code === `${orderCode}-${moduleName}` || s.module_name === moduleName);

      const status = assignment?.assignment_status || (moduleScans.length > 0 ? "instalado" : handoff.handoff_status || "pendiente_instalacion");

      baseMap.set(key, {
        key,
        order_code: orderCode,
        module_name: moduleName,
        project_name: clean(handoff.project_name || latestTransport?.project_name) || "Proyecto",
        client_name: clean(handoff.client_name || latestTransport?.client_name) || "Cliente",
        client_phone: clean(handoff.client_phone) || "",
        client_address: clean(handoff.client_address || latestTransport?.location_text) || "",
        driver_name: clean(handoff.driver_name || handoff.delivered_by || latestTransport?.driver_name) || "Chofer",
        driver_phone: clean(handoff.driver_phone || latestTransport?.driver_phone) || "",
        vehicle: clean(handoff.vehicle || latestTransport?.vehicle) || "Vehículo N/A",
        gps_lat: handoff.gps_lat || latestTransport?.gps_lat,
        gps_lng: handoff.gps_lng || latestTransport?.gps_lng,
        gps_accuracy: handoff.gps_accuracy || latestTransport?.gps_accuracy,
        handoff,
        latestTransport,
        photos: modulePhotos,
        assignment,
        scans: moduleScans,
        status,
        statusLabel: status === "instalado" ? "Instalado" : status === "en_instalacion" ? "En instalación" : status === "asignado" ? "Asignado" : "Pendiente instalación",
      });
    }

    const q = search.toLowerCase().trim();
    return Array.from(baseMap.values())
      .filter((m) => orderFilter === "todos" || m.order_code === orderFilter)
      .filter((m) => {
        if (!q) return true;
        return `${m.order_code} ${m.module_name} ${m.project_name} ${m.client_name} ${m.client_phone} ${m.client_address}`.toLowerCase().includes(q);
      })
      .sort((a, b) => a.order_code.localeCompare(b.order_code));
  }, [handoffs, transportEvents, transportPhotos, assignments, scans, search, orderFilter]);

  const orders = useMemo(() => Array.from(new Set(modules.map((m) => m.order_code))).sort(), [modules]);
  const selectedModule = modules.find((m) => m.key === selectedKey) || modules[0] || null;

  useEffect(() => {
    if (!selectedKey && modules[0]?.key) setSelectedKey(modules[0].key);
  }, [modules, selectedKey]);

  useEffect(() => {
    if (!selectedModule) return;
    setSelectedTeamId(selectedModule.assignment?.team_id || "");
    setNotes(selectedModule.assignment?.notes || "");
  }, [selectedModule?.key]);

  const selectedTeam = selectedTeamId ? teamById.get(selectedTeamId) || null : null;

  const stats = useMemo(() => {
    return {
      modules: modules.length,
      assigned: modules.filter((m) => m.assignment?.team_id).length,
      pending: modules.filter((m) => !m.assignment?.team_id).length,
      installed: modules.filter((m) => m.status === "instalado").length,
      photos: modules.reduce((sum, m) => sum + m.photos.length + m.scans.filter((s) => s.photo_url).length, 0),
    };
  }, [modules]);

  async function assignTeam(module: InstallModule) {
    if (!selectedTeam) {
      alert("Selecciona un equipo de instalación.");
      return;
    }

    if (!isTeamActive(selectedTeam)) {
      alert("Este equipo no está activo.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const payload = {
        order_code: module.order_code,
        module_name: module.module_name,
        project_name: module.project_name,
        client_name: module.client_name,
        client_phone: module.client_phone || null,
        client_address: module.client_address || null,
        team_id: selectedTeam.id,
        team_name: selectedTeam.team_name,
        installer_1_name: selectedTeam.installer_1_name || selectedTeam.leader_name || null,
        installer_1_phone: selectedTeam.installer_1_phone || selectedTeam.leader_phone || null,
        installer_2_name: selectedTeam.installer_2_name || null,
        installer_2_phone: selectedTeam.installer_2_phone || null,
        assignment_status: "asignado",
        assigned_by: "Supervisor Instalación",
        notes: notes || null,
        updated_at: nowIso(),
      };

      const { error } = await supabase
        .from("installation_assignments")
        .upsert(payload, { onConflict: "order_code,module_name" });

      if (error) throw error;

      await saveInstallEvent(module, "equipo_asignado", "Equipo asignado", null);

      await loadData();
      setMessage("✅ Equipo asignado correctamente.");
    } catch (error: any) {
      alert(`Error asignando equipo: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  async function startInstallation(module: InstallModule) {
    if (!module.assignment?.team_id && !selectedTeamId) {
      alert("Asigna un equipo de 2 instaladores antes de iniciar.");
      return;
    }

    setSaving(true);
    try {
      await supabase
        .from("installation_assignments")
        .update({ assignment_status: "en_instalacion", started_at: nowIso(), updated_at: nowIso() })
        .eq("order_code", module.order_code)
        .eq("module_name", module.module_name);

      await saveInstallEvent(module, "inicio_instalacion", "Instalación iniciada", null);
      await loadData();
      setMessage("✅ Instalación iniciada.");
    } catch (error: any) {
      alert(error?.message || error);
    } finally {
      setSaving(false);
    }
  }

  async function markInstalled(module: InstallModule, file?: File | null) {
    if (!module.assignment?.team_id && !selectedTeamId) {
      alert("Asigna un equipo antes de marcar instalado.");
      return;
    }

    if (!gps) {
      alert("Captura GPS antes de marcar instalado.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      let photoUrl = "";

      if (file) {
        photoUrl = await uploadInstallPhoto(module.order_code, module.module_name, file);
      }

      const team = selectedTeam || teamById.get(module.assignment?.team_id || "") || null;

      const { error: scanError } = await supabase.from("project_installation_scans").insert({
        order_code: module.order_code,
        module_code: `${module.order_code}-${module.module_name}`,
        module_name: module.module_name,
        qr_value: `${module.order_code}-${module.module_name}`,
        installer_name: team?.team_name || module.assignment?.team_name || null,
        team_id: team?.id || module.assignment?.team_id || null,
        installer_1_name: team?.installer_1_name || module.assignment?.installer_1_name || null,
        installer_2_name: team?.installer_2_name || module.assignment?.installer_2_name || null,
        scan_status: scanStatus || "instalado",
        photo_url: photoUrl || null,
        notes: photoNotes || notes || null,
        gps_lat: gps.lat,
        gps_lng: gps.lng,
        gps_accuracy: gps.accuracy || null,
        installed_at: nowIso(),
      });

      if (scanError) throw scanError;

      await supabase
        .from("installation_assignments")
        .update({ assignment_status: "instalado", installed_at: nowIso(), updated_at: nowIso() })
        .eq("order_code", module.order_code)
        .eq("module_name", module.module_name);

      await supabase
        .from("assembly_module_checks")
        .update({ assembly_status: "instalado", updated_at: nowIso() })
        .eq("order_code", module.order_code)
        .eq("module_name", module.module_name);

      await saveInstallEvent(module, "modulo_instalado", "Módulo instalado", photoUrl || null);

      await registerOperationalCompensationEvents({
        supabase,
        orderCode: module.order_code,
        moduleName: module.module_name,
        projectName: module.project_name,
        sourceModule: "instalacion",
        participants: [
          {
            name: team?.installer_1_name || module.assignment?.installer_1_name || team?.leader_name,
            roleKey: "instalacion_maestro",
            department: "Instalacion",
            position: "Instalador Maestro",
          },
          {
            name: team?.installer_2_name || module.assignment?.installer_2_name,
            roleKey: "instalacion_ayudante",
            department: "Instalacion",
            position: "Instalador Ayudante",
          },
        ],
        notes: "Modulo instalado con GPS, QR y evidencia.",
      });

      setPhotoNotes("");
      if (photoInputRef.current) photoInputRef.current.value = "";
      await loadData();
      setMessage("✅ Módulo instalado registrado.");
    } catch (error: any) {
      alert(`Error registrando instalación: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveInstallEvent(module: InstallModule, eventType: string, eventStatus: string, photoUrl: string | null) {
    const team = selectedTeam || teamById.get(module.assignment?.team_id || "") || null;

    const { error } = await supabase.from("installation_module_events").insert({
      order_code: module.order_code,
      module_name: module.module_name,
      event_type: eventType,
      event_status: eventStatus,
      team_id: team?.id || module.assignment?.team_id || null,
      team_name: team?.team_name || module.assignment?.team_name || null,
      installer_1_name: team?.installer_1_name || module.assignment?.installer_1_name || null,
      installer_2_name: team?.installer_2_name || module.assignment?.installer_2_name || null,
      gps_lat: gps?.lat || null,
      gps_lng: gps?.lng || null,
      gps_accuracy: gps?.accuracy || null,
      photo_url: photoUrl,
      notes: notes || photoNotes || null,
      updated_at: nowIso(),
    });

    if (error) throw error;
  }

  function openWhatsAppClient(module: InstallModule) {
    const phone = phoneClean(module.client_phone);
    if (!phone) {
      alert("Este cliente no tiene teléfono registrado.");
      return;
    }

    const text = `Hola ${module.client_name}, somos RD Wood System.

Su proyecto está en fase de instalación.

Proyecto: ${module.project_name}
Módulo: ${module.module_name}
Orden: ${module.order_code}
Equipo: ${selectedTeam?.team_name || module.assignment?.team_name || "Pendiente de asignar"}
Instaladores: ${
      selectedTeam
        ? `${selectedTeam.installer_1_name || "-"} / ${selectedTeam.installer_2_name || "-"}`
        : `${module.assignment?.installer_1_name || "-"} / ${module.assignment?.installer_2_name || "-"}`
    }
Dirección: ${module.client_address || "Sin dirección registrada"}
GPS: ${gps ? `https://maps.google.com/?q=${gps.lat},${gps.lng}` : "No capturado"}

Notas: ${notes || "Sin notas"}`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-[#020617] p-6 text-white">
      <Header onRefresh={loadData} />

      {message ? (
        <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">
          {message}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-5">
        <Stat title="Módulos" value={stats.modules} />
        <Stat title="Asignados" value={stats.assigned} />
        <Stat title="Pendientes" value={stats.pending} />
        <Stat title="Instalados" value={stats.installed} />
        <Stat title="Fotos" value={stats.photos} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black">Módulos para instalación</h2>
              <p className="text-sm text-slate-400">Recibe desde Transporte: cliente, dirección, chofer, vehículo y fotos.</p>
            </div>

            <select
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value)}
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold"
            >
              <option value="todos">Todas las órdenes</option>
              {orders.map((order) => (
                <option key={order} value={order}>
                  {order}
                </option>
              ))}
            </select>
          </div>

          <div className="relative mb-5">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar orden, cliente, módulo..."
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
            />
          </div>

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <Loader2 className="animate-spin text-cyan-300" size={44} />
            </div>
          ) : modules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
              No hay módulos entregados desde transporte.
            </div>
          ) : (
            <div className="space-y-4">
              {modules.map((module) => (
                <button
                  key={module.key}
                  onClick={() => setSelectedKey(module.key)}
                  className={[
                    "w-full rounded-3xl border p-5 text-left transition",
                    selectedModule?.key === module.key
                      ? "border-cyan-400 bg-cyan-500/10"
                      : "border-slate-800 bg-slate-950 hover:border-cyan-500/40",
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">{module.order_code}</div>
                      <h3 className="mt-2 text-xl font-black text-white">{module.module_name}</h3>
                      <p className="mt-1 text-sm text-slate-400">{module.project_name}</p>
                      <p className="text-sm text-slate-500">{module.client_name}</p>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1">
                          <Phone size={12} /> {module.client_phone || "Sin teléfono"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1">
                          <MapPin size={12} /> {module.client_address || "Sin dirección"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="rounded-full bg-slate-800 px-4 py-2 text-xs font-black uppercase text-cyan-300">
                        {module.statusLabel}
                      </span>
                      <ArrowRight className="text-cyan-300" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
          {!selectedModule ? (
            <EmptySelect />
          ) : (
            <>
              <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Módulo seleccionado</div>
                <h2 className="mt-2 text-3xl font-black">{selectedModule.module_name}</h2>
                <p className="mt-1 text-sm text-slate-300">{selectedModule.project_name}</p>
                <p className="text-sm text-slate-500">{selectedModule.client_name} · {selectedModule.order_code}</p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <InfoBox icon={<UserRound size={16} />} label="Cliente" value={selectedModule.client_name} />
                  <InfoBox icon={<Phone size={16} />} label="Teléfono" value={selectedModule.client_phone || "Sin teléfono"} />
                  <InfoBox icon={<MapPin size={16} />} label="Dirección" value={selectedModule.client_address || "Sin dirección"} />
                  <InfoBox icon={<Truck size={16} />} label="Transporte" value={`${selectedModule.driver_name} · ${selectedModule.vehicle}`} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <button onClick={() => assignTeam(selectedModule)} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 py-4 font-black text-slate-950 disabled:opacity-50">
                  <UsersRound size={18} /> Asignar equipo
                </button>
                <button onClick={() => startInstallation(selectedModule)} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-4 font-black text-white disabled:opacity-50">
                  <Wrench size={18} /> Iniciar
                </button>
                <button onClick={() => photoInputRef.current?.click()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-slate-950 disabled:opacity-50">
                  <CheckCircle2 size={18} /> Instalar + foto
                </button>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950 p-5">
                <h3 className="mb-4 flex items-center gap-2 text-xl font-black">
                  <UsersRound className="text-cyan-300" /> Equipo de instalación
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <SelectTeam
                    label="Equipo"
                    value={selectedTeamId}
                    teams={activeTeams}
                    onChange={setSelectedTeamId}
                  />
                  <Select
                    label="Estado"
                    value={scanStatus}
                    options={["instalado", "pendiente_ajuste", "problema", "reinstalar"]}
                    onChange={setScanStatus}
                  />
                </div>

                {selectedTeam ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <InfoBox icon={<UserRound size={16} />} label="Instalador 1" value={`${selectedTeam.installer_1_name || selectedTeam.leader_name || "—"} · ${selectedTeam.installer_1_phone || selectedTeam.leader_phone || ""}`} />
                    <InfoBox icon={<UserRound size={16} />} label="Instalador 2" value={`${selectedTeam.installer_2_name || "—"} · ${selectedTeam.installer_2_phone || ""}`} />
                  </div>
                ) : null}

                <Textarea label="Notas de instalación" value={notes} onChange={setNotes} />

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
                    <p className="font-black text-cyan-300">GPS instalación</p>
                    <p className="mt-1">
                      {gps ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)} · ±${Math.round(gps.accuracy || 0)}m` : gpsMessage || "GPS no capturado"}
                    </p>
                  </div>

                  <button onClick={getGps} className="rounded-2xl bg-white px-5 py-4 font-black text-slate-950">Capturar GPS</button>
                  <button onClick={() => openWhatsAppClient(selectedModule)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white">
                    <Send size={18} /> WhatsApp cliente
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950 p-5">
                <h3 className="mb-4 flex items-center gap-2 text-xl font-black">
                  <Camera className="text-cyan-300" /> Evidencia de instalación
                </h3>

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => markInstalled(selectedModule, e.target.files?.[0])}
                />

                <Input label="Nota de la foto" value={photoNotes} onChange={setPhotoNotes} />

                <button onClick={() => photoInputRef.current?.click()} disabled={saving} className="mt-4 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-500/50 bg-cyan-500/10 px-5 py-8 text-center font-black text-cyan-200 disabled:opacity-50">
                  <Camera size={28} />
                  <span className="mt-2">Tomar foto del módulo instalado</span>
                  <span className="mt-1 text-xs text-slate-400">En celular abre cámara trasera.</span>
                </button>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {selectedModule.photos.map((photo) => (
                    <a key={photo.id || photo.photo_url} href={photo.photo_url} target="_blank" className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                      <img src={photo.photo_url} alt="Foto transporte" className="h-40 w-full object-cover" />
                      <div className="p-3">
                        <p className="text-xs font-black text-cyan-300">Transporte · {photo.photo_type || "foto"}</p>
                        <p className="text-xs text-slate-400">{photo.notes || "Sin nota"}</p>
                      </div>
                    </a>
                  ))}

                  {selectedModule.scans.filter((s) => s.photo_url).map((scan) => (
                    <a key={scan.id || scan.photo_url || ""} href={scan.photo_url || "#"} target="_blank" className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                      <img src={scan.photo_url || ""} alt="Foto instalación" className="h-40 w-full object-cover" />
                      <div className="p-3">
                        <p className="text-xs font-black text-emerald-300">Instalación · {scan.scan_status || "instalado"}</p>
                        <p className="text-xs text-slate-400">{scan.notes || "Sin nota"}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950 p-5">
                <h3 className="mb-4 flex items-center gap-2 text-xl font-black">
                  <Clock className="text-cyan-300" /> Historial instalación
                </h3>

                {selectedModule.scans.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">Sin registros todavía.</div>
                ) : (
                  <div className="space-y-3">
                    {selectedModule.scans.map((scan) => (
                      <div key={scan.id || `${scan.module_code}-${scan.installed_at}`} className="rounded-2xl border border-slate-800 bg-[#020617] p-4">
                        <p className="font-black text-cyan-300">{scan.module_code || scan.qr_value || selectedModule.module_name}</p>
                        <p className="text-sm text-slate-400">{scan.installer_name || scan.installer_1_name || "Equipo"} · {scan.scan_status || "instalado"}</p>
                        <p className="text-xs text-slate-500">{formatDate(scan.installed_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function Header({ onRefresh }: { onRefresh: () => void }) {
  return (
    <section className="rounded-[34px] border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-[#07111f] to-blue-900 p-8 shadow-2xl shadow-black/40">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-500/10 text-cyan-300">
            <Wrench size={38} />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">RD WOOD SYSTEM · INSTALACIÓN PRO</div>
            <h1 className="mt-2 text-4xl font-black lg:text-5xl">Instalación Campo PRO</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-300">
              Recibe módulos desde transporte, asigna equipos de 2 instaladores, registra GPS, fotos, avance y evidencia.
            </p>
          </div>
        </div>

        <button onClick={onRefresh} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-7 py-4 text-sm font-black uppercase tracking-wide text-slate-950">
          <RefreshCw size={18} />
          Actualizar
        </button>
      </div>
    </section>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
      <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{title}</div>
      <div className="mt-4 text-3xl font-black text-white">{value}</div>
    </div>
  );
}

function InfoBox({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
        {icon || null}
        {label}
      </div>
      <div className="mt-2 text-sm font-black text-white">{value || "—"}</div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400">
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function SelectTeam({ label, value, teams, onChange }: { label: string; value: string; teams: InstallationTeam[]; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400">
        <option value="">Selecciona equipo</option>
        {teams.map((team) => (
          <option key={team.id || team.team_name} value={team.id || ""}>
            {team.team_name} · {team.installer_1_name || team.leader_name || "Instalador 1"} / {team.installer_2_name || "Instalador 2"}
          </option>
        ))}
      </select>
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="mt-4">
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label>
      <textarea value={value} rows={4} onChange={(event) => onChange(event.target.value)} className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />
    </div>
  );
}

function EmptySelect() {
  return (
    <div className="flex min-h-[620px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center">
      <Wrench className="text-slate-600" size={76} />
      <h3 className="mt-5 text-2xl font-black">Selecciona un módulo</h3>
      <p className="mt-2 text-sm text-slate-500">Selecciona un módulo entregado desde transporte.</p>
    </div>
  );
}
