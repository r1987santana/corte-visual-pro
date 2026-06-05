"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Edit3,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Supplier = {
  id: string;
  name?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  category?: string | null;
  materials?: string | null;
  credit_limit?: number | null;
  balance?: number | null;
  total_purchases?: number | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

type SupplierForm = {
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  materials: string;
  credit_limit: string;
};

const emptyForm: SupplierForm = {
  name: "",
  contact_name: "",
  phone: "",
  email: "",
  address: "",
  category: "Materiales",
  materials: "",
  credit_limit: "0",
};

const categories = [
  "Materiales",
  "Melamina",
  "Herrajes",
  "Canteo",
  "CNC",
  "Herramientas",
  "Transporte",
  "Servicios",
  "Otro",
];

export default function ProveedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(
        `Error cargando proveedores: ${error.message}\n\nSi la tabla no existe, dime "SQL PROVEEDORES" y te doy el SQL completo.`
      );
      setSuppliers([]);
      setLoading(false);
      return;
    }

    setSuppliers((data || []) as Supplier[]);
    setLoading(false);
  }

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return suppliers;

    return suppliers.filter((supplier) => {
      const text = [
        supplier.name,
        supplier.company_name,
        supplier.contact_name,
        supplier.phone,
        supplier.whatsapp,
        supplier.email,
        supplier.address,
        supplier.category,
        supplier.materials,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [suppliers, search]);

  const totals = useMemo(() => {
    const totalSuppliers = suppliers.length;
    const activeSuppliers = suppliers.filter(
      (supplier) => supplier.is_active !== false
    ).length;

    const totalPurchases = suppliers.reduce(
      (sum, supplier) => sum + Number(supplier.total_purchases || 0),
      0
    );

    const totalBalance = suppliers.reduce(
      (sum, supplier) => sum + Number(supplier.balance || 0),
      0
    );

    return {
      totalSuppliers,
      activeSuppliers,
      totalPurchases,
      totalBalance,
    };
  }, [suppliers]);

  function money(value?: number | null) {
    return `RD$${Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function normalizeForm() {
    return {
      name: form.name.trim().toUpperCase(),
      company_name: form.name.trim().toUpperCase(),
      contact_name: form.contact_name.trim() || null,
      phone: form.phone.trim(),
      whatsapp: form.phone.trim(),
      email: form.email.trim().toLowerCase() || null,
      address: form.address.trim() || null,
      category: form.category || "Materiales",
      materials: form.materials.trim() || null,
      credit_limit: Number(form.credit_limit || 0),
      is_active: true,
    };
  }

  async function saveSupplier() {
    const payload = normalizeForm();

    if (!payload.name) {
      alert("Escribe el nombre del proveedor.");
      return;
    }

    setSaving(true);

    if (editingSupplier) {
      const { error } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", editingSupplier.id);

      if (error) {
        alert(`Error actualizando proveedor: ${error.message}`);
        setSaving(false);
        return;
      }

      alert("✅ Proveedor actualizado correctamente");
    } else {
      const { error } = await supabase.from("suppliers").insert(payload);

      if (error) {
        alert(`Error creando proveedor: ${error.message}`);
        setSaving(false);
        return;
      }

      alert("✅ Proveedor creado correctamente");
    }

    setForm(emptyForm);
    setEditingSupplier(null);
    setSaving(false);
    await loadSuppliers();
  }

  function startEdit(supplier: Supplier) {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name || supplier.company_name || "",
      contact_name: supplier.contact_name || "",
      phone: supplier.phone || supplier.whatsapp || "",
      email: supplier.email || "",
      address: supplier.address || "",
      category: supplier.category || "Materiales",
      materials: supplier.materials || "",
      credit_limit: String(supplier.credit_limit || 0),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEdit() {
    setEditingSupplier(null);
    setForm(emptyForm);
  }

  async function deleteSupplier(supplier: Supplier) {
    const ok = confirm(
      `¿Seguro que quieres eliminar el proveedor "${
        supplier.name || supplier.company_name || "Sin nombre"
      }"?`
    );

    if (!ok) return;

    const { error } = await supabase
      .from("suppliers")
      .delete()
      .eq("id", supplier.id);

    if (error) {
      alert(`Error eliminando proveedor: ${error.message}`);
      return;
    }

    alert("✅ Proveedor eliminado");
    await loadSuppliers();
  }

  return (
    <div className="min-h-screen bg-[#020617] p-6 text-white">
      <div className="mx-auto max-w-[1600px]">
        <section className="overflow-hidden rounded-[34px] border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-[#07111f] to-[#020617] p-8 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-cyan-200">
                <Truck size={15} />
                RD WOOD SYSTEM
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight lg:text-5xl">
                Proveedores PRO
              </h1>

              <p className="mt-3 max-w-3xl text-sm font-medium text-slate-400">
                Registro de suplidores, materiales, contactos, crédito, compras
                y balance pendiente.
              </p>
            </div>

            <button
              onClick={loadSuppliers}
              disabled={loading}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-7 py-4 text-sm font-black uppercase tracking-wide text-slate-950 shadow-xl transition hover:scale-[1.02] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <RefreshCw size={18} />
              )}
              Actualizar
            </button>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Proveedores"
            value={totals.totalSuppliers}
            icon={<Truck size={24} />}
            color="cyan"
          />

          <StatCard
            title="Activos"
            value={totals.activeSuppliers}
            icon={<CheckCircle2 size={24} />}
            color="emerald"
          />

          <StatCard
            title="Compras"
            value={money(totals.totalPurchases)}
            icon={<WalletCards size={24} />}
            color="blue"
          />

          <StatCard
            title="Balance"
            value={money(totals.totalBalance)}
            icon={<AlertTriangle size={24} />}
            color="orange"
          />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[540px_1fr]">
          <div className="rounded-[32px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                  {editingSupplier ? "Editar proveedor" : "Nuevo proveedor"}
                </div>
                <h2 className="mt-2 text-2xl font-black">
                  {editingSupplier
                    ? editingSupplier.name || editingSupplier.company_name
                    : "Registrar proveedor"}
                </h2>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                {editingSupplier ? <Edit3 size={24} /> : <Plus size={24} />}
              </div>
            </div>

            <div className="space-y-4">
              <InputField
                label="Proveedor / Empresa"
                icon={<Building2 size={17} />}
                value={form.name}
                placeholder="Ejemplo: MADERAS DOMINICANAS"
                onChange={(value) => setForm({ ...form, name: value })}
              />

              <InputField
                label="Persona contacto"
                icon={<UserRound size={17} />}
                value={form.contact_name}
                placeholder="Nombre del vendedor o encargado"
                onChange={(value) =>
                  setForm({ ...form, contact_name: value })
                }
              />

              <InputField
                label="Teléfono / WhatsApp"
                icon={<Phone size={17} />}
                value={form.phone}
                placeholder="Ejemplo: 8090000000"
                onChange={(value) => setForm({ ...form, phone: value })}
              />

              <InputField
                label="Email"
                icon={<Mail size={17} />}
                value={form.email}
                placeholder="proveedor@email.com"
                onChange={(value) => setForm({ ...form, email: value })}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField
                  label="Categoría"
                  icon={<Package size={17} />}
                  value={form.category}
                  options={categories}
                  onChange={(value) => setForm({ ...form, category: value })}
                />

                <InputField
                  label="Crédito aprobado"
                  icon={<WalletCards size={17} />}
                  value={form.credit_limit}
                  placeholder="0"
                  type="number"
                  onChange={(value) =>
                    setForm({ ...form, credit_limit: value })
                  }
                />
              </div>

              <TextAreaField
                label="Materiales / Servicios"
                icon={<Package size={17} />}
                value={form.materials}
                placeholder="Ejemplo: Melamina 18mm, MDF, canteo PVC, bisagras, correderas..."
                onChange={(value) => setForm({ ...form, materials: value })}
              />

              <InputField
                label="Dirección"
                icon={<MapPin size={17} />}
                value={form.address}
                placeholder="Dirección del proveedor"
                onChange={(value) => setForm({ ...form, address: value })}
              />

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={saveSupplier}
                  disabled={saving}
                  className="inline-flex flex-1 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-4 text-sm font-black uppercase tracking-wide text-white shadow-xl shadow-cyan-950/30 transition hover:scale-[1.01] disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : editingSupplier ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <Plus size={18} />
                  )}
                  {editingSupplier ? "Guardar cambios" : "Crear proveedor"}
                </button>

                {editingSupplier && (
                  <button
                    onClick={cancelEdit}
                    className="rounded-2xl border border-slate-700 bg-slate-950 px-6 py-4 text-sm font-black uppercase text-slate-300 transition hover:border-red-500/40 hover:text-red-300"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                  Base de datos
                </div>
                <h2 className="mt-2 text-2xl font-black">
                  Lista de proveedores
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Control de suplidores, teléfonos, crédito, materiales y precios.
                </p>
              </div>

              <div className="relative w-full lg:w-[360px]">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar proveedor..."
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-slate-800 bg-slate-950">
                <Loader2 className="animate-spin text-cyan-300" size={42} />
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center">
                <Truck className="text-slate-600" size={54} />
                <h3 className="mt-4 text-xl font-black">No hay proveedores</h3>
                <p className="mt-2 max-w-md text-sm text-slate-500">
                  Registra tus suplidores para conectar compras, inventario,
                  costos y producción.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSuppliers.map((supplier) => (
                  <SupplierCard
                    key={supplier.id}
                    supplier={supplier}
                    money={money}
                    onEdit={() => startEdit(supplier)}
                    onDelete={() => deleteSupplier(supplier)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "cyan" | "emerald" | "orange" | "blue";
}) {
  const styles = {
    cyan: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
    emerald: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    orange: "text-orange-300 bg-orange-500/10 border-orange-500/20",
    blue: "text-blue-300 bg-blue-500/10 border-blue-500/20",
  };

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
            {title}
          </div>
          <div className="mt-4 text-3xl font-black text-white">{value}</div>
        </div>

        <div
          className={`flex h-13 w-13 items-center justify-center rounded-2xl border ${styles[color]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function InputField({
  label,
  icon,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        <span className="text-cyan-300">{icon}</span>
        {label}
      </label>

      <input
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
      />
    </div>
  );
}

function SelectField({
  label,
  icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        <span className="text-cyan-300">{icon}</span>
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({
  label,
  icon,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        <span className="text-cyan-300">{icon}</span>
        {label}
      </label>

      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
      />
    </div>
  );
}

function SupplierCard({
  supplier,
  money,
  onEdit,
  onDelete,
}: {
  supplier: Supplier;
  money: (value?: number | null) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const balance = Number(supplier.balance || 0);
  const phone = supplier.phone || supplier.whatsapp || "";
  const name = supplier.name || supplier.company_name || "Proveedor sin nombre";

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 transition hover:border-cyan-500/40 hover:bg-slate-900/70">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="truncate text-xl font-black text-white">{name}</h3>

            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-black uppercase text-cyan-300">
              {supplier.category || "Materiales"}
            </span>

            {supplier.is_active === false ? (
              <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-300">
                Inactivo
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase text-emerald-300">
                Activo
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-2 text-sm text-slate-400 md:grid-cols-2">
            <InfoLine icon={<UserRound size={15} />} value={supplier.contact_name || "Sin contacto"} />
            <InfoLine icon={<Phone size={15} />} value={phone || "Sin teléfono"} />
            <InfoLine icon={<Mail size={15} />} value={supplier.email || "Sin email"} />
            <InfoLine icon={<MapPin size={15} />} value={supplier.address || "Sin dirección"} />
          </div>

          {supplier.materials && (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-[#020617] p-4">
              <div className="mb-1 text-[11px] font-black uppercase tracking-widest text-slate-500">
                Materiales / Servicios
              </div>
              <div className="text-sm font-bold text-slate-300">
                {supplier.materials}
              </div>
            </div>
          )}
        </div>

        <div className="grid min-w-[280px] grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-[#020617] p-4">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">
              Compras
            </div>
            <div className="mt-2 text-lg font-black text-white">
              {money(supplier.total_purchases)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#020617] p-4">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">
              Balance
            </div>
            <div
              className={`mt-2 text-lg font-black ${
                balance > 0 ? "text-orange-300" : "text-emerald-300"
              }`}
            >
              {money(balance)}
            </div>
          </div>

          <button
            onClick={onEdit}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500"
          >
            <Edit3 size={16} />
            Editar
          </button>

          <button
            onClick={onDelete}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-500"
          >
            <Trash2 size={16} />
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoLine({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-cyan-300">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}
