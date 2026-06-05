"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Car,
  CheckCircle2,
  Edit3,
  Loader2,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Vehicle = {
  id?: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  vehicle_type?: string | null;
  color?: string | null;
  capacity_notes?: string | null;
  insurance_expiration?: string | null;
  registration_expiration?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Driver = {
  id?: string;
  full_name: string;
  phone?: string | null;
  document_id?: string | null;
  license_number?: string | null;
  license_expiration?: string | null;
  assigned_vehicle_id?: string | null;
  status?: string | null;
  emergency_contact?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const emptyVehicle: Vehicle = {
  plate: "",
  brand: "",
  model: "",
  vehicle_type: "camioneta",
  color: "",
  capacity_notes: "",
  insurance_expiration: "",
  registration_expiration: "",
  status: "disponible",
  notes: "",
};

const emptyDriver: Driver = {
  full_name: "",
  phone: "",
  document_id: "",
  license_number: "",
  license_expiration: "",
  assigned_vehicle_id: "",
  status: "activo",
  emergency_contact: "",
  notes: "",
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function statusColor(status?: string | null) {
  const s = clean(status).toLowerCase();
  if (["activo", "disponible"].includes(s)) return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  if (["en ruta", "asignado", "ocupado"].includes(s)) return "bg-cyan-500/10 text-cyan-300 border-cyan-500/30";
  if (["mantenimiento", "vencido", "suspendido", "inactivo"].includes(s)) return "bg-rose-500/10 text-rose-300 border-rose-500/30";
  return "bg-slate-700/30 text-slate-300 border-slate-700";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("es-DO");
  } catch {
    return value;
  }
}

function isExpired(value?: string | null) {
  if (!value) return false;
  const d = new Date(value + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export default function LogisticaMaestrosPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicleForm, setVehicleForm] = useState<Vehicle>(emptyVehicle);
  const [driverForm, setDriverForm] = useState<Driver>(emptyDriver);
  const [activeTab, setActiveTab] = useState<"drivers" | "vehicles">("drivers");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const [vehiclesRes, driversRes] = await Promise.all([
        supabase.from("logistics_vehicles").select("*").order("created_at", { ascending: false }),
        supabase.from("logistics_drivers").select("*").order("created_at", { ascending: false }),
      ]);

      if (vehiclesRes.error) throw vehiclesRes.error;
      if (driversRes.error) throw driversRes.error;

      setVehicles((vehiclesRes.data || []) as Vehicle[]);
      setDrivers((driversRes.data || []) as Driver[]);
    } catch (error: any) {
      console.error(error);
      setMessage(`⚠️ Error cargando maestros: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  }

  const vehicleById = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach((v) => v.id && map.set(v.id, v));
    return map;
  }, [vehicles]);

  const filteredDrivers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return drivers;
    return drivers.filter((d) =>
      [d.full_name, d.phone, d.document_id, d.license_number, d.status, vehicleById.get(d.assigned_vehicle_id || "")?.plate]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [drivers, search, vehicleById]);

  const filteredVehicles = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      [v.plate, v.brand, v.model, v.vehicle_type, v.color, v.status, v.capacity_notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [vehicles, search]);

  async function saveVehicle() {
    if (!vehicleForm.plate.trim()) {
      alert("La placa es obligatoria.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        plate: vehicleForm.plate.trim().toUpperCase(),
        brand: vehicleForm.brand || null,
        model: vehicleForm.model || null,
        vehicle_type: vehicleForm.vehicle_type || "camioneta",
        color: vehicleForm.color || null,
        capacity_notes: vehicleForm.capacity_notes || null,
        insurance_expiration: vehicleForm.insurance_expiration || null,
        registration_expiration: vehicleForm.registration_expiration || null,
        status: vehicleForm.status || "disponible",
        notes: vehicleForm.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (vehicleForm.id) {
        const { error } = await supabase.from("logistics_vehicles").update(payload).eq("id", vehicleForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("logistics_vehicles").insert(payload);
        if (error) throw error;
      }

      setVehicleForm(emptyVehicle);
      await loadData();
      setMessage("✅ Vehículo guardado correctamente.");
    } catch (error: any) {
      alert(error?.message || error);
    } finally {
      setSaving(false);
    }
  }

  async function saveDriver() {
    if (!driverForm.full_name.trim()) {
      alert("El nombre del chofer es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        full_name: driverForm.full_name.trim(),
        phone: driverForm.phone || null,
        document_id: driverForm.document_id || null,
        license_number: driverForm.license_number || null,
        license_expiration: driverForm.license_expiration || null,
        assigned_vehicle_id: driverForm.assigned_vehicle_id || null,
        status: driverForm.status || "activo",
        emergency_contact: driverForm.emergency_contact || null,
        notes: driverForm.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (driverForm.id) {
        const { error } = await supabase.from("logistics_drivers").update(payload).eq("id", driverForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("logistics_drivers").insert(payload);
        if (error) throw error;
      }

      setDriverForm(emptyDriver);
      await loadData();
      setMessage("✅ Chofer guardado correctamente.");
    } catch (error: any) {
      alert(error?.message || error);
    } finally {
      setSaving(false);
    }
  }

  async function deleteVehicle(id?: string) {
    if (!id) return;
    if (!confirm("¿Eliminar este vehículo?")) return;
    const { error } = await supabase.from("logistics_vehicles").delete().eq("id", id);
    if (error) alert(error.message);
    await loadData();
  }

  async function deleteDriver(id?: string) {
    if (!id) return;
    if (!confirm("¿Eliminar este chofer?")) return;
    const { error } = await supabase.from("logistics_drivers").delete().eq("id", id);
    if (error) alert(error.message);
    await loadData();
  }

  const stats = useMemo(() => {
    return {
      drivers: drivers.length,
      activeDrivers: drivers.filter((d) => clean(d.status).toLowerCase() === "activo").length,
      vehicles: vehicles.length,
      availableVehicles: vehicles.filter((v) => clean(v.status).toLowerCase() === "disponible").length,
      alerts:
        vehicles.filter((v) => isExpired(v.insurance_expiration) || isExpired(v.registration_expiration)).length +
        drivers.filter((d) => isExpired(d.license_expiration)).length,
    };
  }, [drivers, vehicles]);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <section className="rounded-[32px] border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950 p-8 shadow-2xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">RD WOOD SYSTEM · LOGÍSTICA</p>
            <h1 className="mt-3 text-5xl font-black tracking-tight">Maestro de Choferes y Vehículos</h1>
            <p className="mt-3 max-w-4xl text-sm text-slate-300">
              Control de choferes, vehículos, vencimientos, disponibilidad y asignación para Transporte PRO.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 font-black text-slate-950 disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
            ACTUALIZAR
          </button>
        </div>
      </section>

      {message ? <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">{message}</div> : null}

      <section className="mt-6 grid gap-4 md:grid-cols-5">
        <Stat title="Choferes" value={stats.drivers} icon={<UserRound size={20} />} />
        <Stat title="Choferes activos" value={stats.activeDrivers} icon={<BadgeCheck size={20} />} />
        <Stat title="Vehículos" value={stats.vehicles} icon={<Truck size={20} />} />
        <Stat title="Disponibles" value={stats.availableVehicles} icon={<CheckCircle2 size={20} />} />
        <Stat title="Alertas" value={stats.alerts} icon={<AlertTriangle size={20} />} danger={stats.alerts > 0} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Registro maestro</h2>
              <p className="mt-1 text-sm text-slate-400">Agrega o edita choferes y vehículos.</p>
            </div>

            <div className="flex rounded-2xl border border-slate-800 bg-slate-950 p-1">
              <button
                onClick={() => setActiveTab("drivers")}
                className={`rounded-xl px-4 py-2 text-sm font-black ${activeTab === "drivers" ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}
              >
                Choferes
              </button>
              <button
                onClick={() => setActiveTab("vehicles")}
                className={`rounded-xl px-4 py-2 text-sm font-black ${activeTab === "vehicles" ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}
              >
                Vehículos
              </button>
            </div>
          </div>

          {activeTab === "drivers" ? (
            <div className="mt-5 space-y-4">
              <Input label="Nombre del chofer" value={driverForm.full_name} onChange={(v) => setDriverForm({ ...driverForm, full_name: v })} icon={<UserRound size={16} />} />
              <Input label="Teléfono" value={driverForm.phone || ""} onChange={(v) => setDriverForm({ ...driverForm, phone: v })} icon={<Phone size={16} />} />
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Cédula / documento" value={driverForm.document_id || ""} onChange={(v) => setDriverForm({ ...driverForm, document_id: v })} />
                <Input label="Licencia" value={driverForm.license_number || ""} onChange={(v) => setDriverForm({ ...driverForm, license_number: v })} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Vence licencia" type="date" value={driverForm.license_expiration || ""} onChange={(v) => setDriverForm({ ...driverForm, license_expiration: v })} />
                <Select label="Estado" value={driverForm.status || "activo"} onChange={(v) => setDriverForm({ ...driverForm, status: v })} options={["activo", "en ruta", "suspendido", "inactivo"]} />
              </div>
              <Select
                label="Vehículo asignado"
                value={driverForm.assigned_vehicle_id || ""}
                onChange={(v) => setDriverForm({ ...driverForm, assigned_vehicle_id: v })}
                options={["", ...vehicles.map((v) => String(v.id || ""))]}
                renderLabel={(id) => (id ? `${vehicleById.get(id)?.plate || id} · ${vehicleById.get(id)?.brand || ""} ${vehicleById.get(id)?.model || ""}` : "Sin vehículo asignado")}
              />
              <Input label="Contacto emergencia" value={driverForm.emergency_contact || ""} onChange={(v) => setDriverForm({ ...driverForm, emergency_contact: v })} />
              <Textarea label="Notas" value={driverForm.notes || ""} onChange={(v) => setDriverForm({ ...driverForm, notes: v })} />

              <div className="grid gap-3 md:grid-cols-2">
                <button onClick={() => setDriverForm(emptyDriver)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 px-5 py-4 font-black text-slate-300">
                  <X size={18} /> Limpiar
                </button>
                <button onClick={saveDriver} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 py-4 font-black text-slate-950 disabled:opacity-50">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Guardar chofer
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <Input label="Placa" value={vehicleForm.plate} onChange={(v) => setVehicleForm({ ...vehicleForm, plate: v })} icon={<Car size={16} />} />
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Marca" value={vehicleForm.brand || ""} onChange={(v) => setVehicleForm({ ...vehicleForm, brand: v })} />
                <Input label="Modelo" value={vehicleForm.model || ""} onChange={(v) => setVehicleForm({ ...vehicleForm, model: v })} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Select label="Tipo" value={vehicleForm.vehicle_type || "camioneta"} onChange={(v) => setVehicleForm({ ...vehicleForm, vehicle_type: v })} options={["camioneta", "camión pequeño", "camión", "van", "motor", "otro"]} />
                <Input label="Color" value={vehicleForm.color || ""} onChange={(v) => setVehicleForm({ ...vehicleForm, color: v })} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Vence seguro" type="date" value={vehicleForm.insurance_expiration || ""} onChange={(v) => setVehicleForm({ ...vehicleForm, insurance_expiration: v })} />
                <Input label="Vence matrícula / revista" type="date" value={vehicleForm.registration_expiration || ""} onChange={(v) => setVehicleForm({ ...vehicleForm, registration_expiration: v })} />
              </div>
              <Select label="Estado" value={vehicleForm.status || "disponible"} onChange={(v) => setVehicleForm({ ...vehicleForm, status: v })} options={["disponible", "en ruta", "mantenimiento", "inactivo"]} />
              <Textarea label="Capacidad / uso" value={vehicleForm.capacity_notes || ""} onChange={(v) => setVehicleForm({ ...vehicleForm, capacity_notes: v })} />
              <Textarea label="Notas" value={vehicleForm.notes || ""} onChange={(v) => setVehicleForm({ ...vehicleForm, notes: v })} />

              <div className="grid gap-3 md:grid-cols-2">
                <button onClick={() => setVehicleForm(emptyVehicle)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 px-5 py-4 font-black text-slate-300">
                  <X size={18} /> Limpiar
                </button>
                <button onClick={saveVehicle} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 py-4 font-black text-slate-950 disabled:opacity-50">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Guardar vehículo
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Listado</h2>
              <p className="mt-1 text-sm text-slate-400">Busca, edita o elimina registros.</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
              <Search size={18} className="text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="bg-transparent text-sm font-bold outline-none placeholder:text-slate-500" />
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-slate-800 p-8 text-center text-slate-400">Cargando...</div>
            ) : activeTab === "drivers" ? (
              filteredDrivers.length ? (
                filteredDrivers.map((driver) => {
                  const assigned = vehicleById.get(driver.assigned_vehicle_id || "");
                  return (
                    <div key={driver.id} className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-black text-cyan-300">{driver.full_name}</h3>
                          <p className="mt-1 text-sm text-slate-400">{driver.phone || "Sin teléfono"}</p>
                          <p className="mt-1 text-xs text-slate-500">Licencia: {driver.license_number || "—"} · Vence: {formatDate(driver.license_expiration)}</p>
                          <p className="mt-1 text-xs text-slate-500">Vehículo: {assigned ? `${assigned.plate} · ${assigned.brand || ""} ${assigned.model || ""}` : "Sin asignar"}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-2 text-xs font-black uppercase ${statusColor(driver.status)}`}>{driver.status || "activo"}</span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={() => { setActiveTab("drivers"); setDriverForm(driver); }} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-slate-950"><Edit3 size={15} /> Editar</button>
                        <button onClick={() => deleteDriver(driver.id)} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-black text-white"><Trash2 size={15} /> Eliminar</button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <Empty text="No hay choferes registrados." />
              )
            ) : filteredVehicles.length ? (
              filteredVehicles.map((vehicle) => (
                <div key={vehicle.id} className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black text-cyan-300">{vehicle.plate}</h3>
                      <p className="mt-1 text-sm text-slate-400">{vehicle.brand || ""} {vehicle.model || ""} · {vehicle.vehicle_type || "vehículo"}</p>
                      <p className="mt-1 text-xs text-slate-500">Seguro: {formatDate(vehicle.insurance_expiration)} · Matrícula/Revista: {formatDate(vehicle.registration_expiration)}</p>
                      <p className="mt-1 text-xs text-slate-500">{vehicle.capacity_notes || "Sin capacidad registrada"}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-2 text-xs font-black uppercase ${statusColor(vehicle.status)}`}>{vehicle.status || "disponible"}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => { setActiveTab("vehicles"); setVehicleForm(vehicle); }} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-slate-950"><Edit3 size={15} /> Editar</button>
                    <button onClick={() => deleteVehicle(vehicle.id)} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-black text-white"><Trash2 size={15} /> Eliminar</button>
                  </div>
                </div>
              ))
            ) : (
              <Empty text="No hay vehículos registrados." />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ title, value, icon, danger }: { title: string; value: string | number; icon: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`rounded-[28px] border p-6 shadow-2xl shadow-black/30 ${danger ? "border-rose-500/30 bg-rose-500/10" : "border-slate-800 bg-[#07111f]"}`}>
      <div className="flex items-center justify-between text-cyan-300">
        {icon}
        <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{title}</div>
      </div>
      <div className="mt-4 text-3xl font-black text-white">{value}</div>
    </div>
  );
}

function Input({ label, value, onChange, icon, type = "text" }: { label: string; value: string; onChange: (value: string) => void; icon?: React.ReactNode; type?: string }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 focus-within:border-cyan-400">
        {icon ? <div className="text-cyan-300">{icon}</div> : null}
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-500" />
      </div>
    </div>
  );
}

function Select({ label, value, options, onChange, renderLabel }: { label: string; value: string; options: string[]; onChange: (value: string) => void; renderLabel?: (value: string) => string }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400">
        {options.map((option) => (
          <option key={option || "empty"} value={option}>{renderLabel ? renderLabel(option) : option}</option>
        ))}
      </select>
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label>
      <textarea value={value} rows={4} onChange={(event) => onChange(event.target.value)} className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
      <Plus className="mx-auto mb-3 text-slate-700" size={36} />
      {text}
    </div>
  );
}
