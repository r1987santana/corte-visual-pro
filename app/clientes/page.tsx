"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Edit3,
  FileText,
  Gift,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  CLIENT_LEGAL_DOCUMENT_TYPES,
  type ClientLegalDocumentType,
  formatClientLegalDocument,
  getClientLegalDocumentFromRecord,
  mergeClientLegalDocumentIntoNotes,
  normalizeClientDocumentType,
} from "@/lib/clientLegalDocument";

type Client = {
  id: string;
  name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  client_document?: string | null;
  document_number?: string | null;
  document_type?: string | null;
  referral_code?: string | null;
  referred_by_code?: string | null;
  referred_by_client_id?: string | null;
  referral_bonus_balance?: number | null;
  created_at?: string | null;
  total_sales?: number | null;
  balance?: number | null;
};

type ClientForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  document_type: ClientLegalDocumentType;
  document_number: string;
};

const emptyForm: ClientForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  document_type: "cedula",
  document_number: "",
};

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(`Error cargando clientes: ${error.message}`);
      setClients([]);
      setLoading(false);
      return;
    }

    setClients((data || []) as Client[]);
    setLoading(false);
  }

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return clients;

    return clients.filter((client) => {
      const text = [
        client.name,
        client.phone,
        client.whatsapp,
        client.email,
        client.address,
        formatClientLegalDocument(getClientLegalDocumentFromRecord(client), ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [clients, search]);

  const totals = useMemo(() => {
    const totalClients = clients.length;

    const totalSales = clients.reduce(
      (sum, client) => sum + Number(client.total_sales || 0),
      0
    );

    const totalBalance = clients.reduce(
      (sum, client) => sum + Number(client.balance || 0),
      0
    );

    const clientsWithDebt = clients.filter(
      (client) => Number(client.balance || 0) > 0
    ).length;

    return {
      totalClients,
      totalSales,
      totalBalance,
      clientsWithDebt,
    };
  }, [clients]);

  function money(value?: number | null) {
    return `RD$${Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function normalizeForm() {
    const documentType = normalizeClientDocumentType(form.document_type);
    const documentNumber = form.document_number.trim().toUpperCase();

    return {
      name: form.name.trim().toUpperCase(),
      phone: form.phone.trim(),
      whatsapp: form.phone.trim(),
      email: form.email.trim().toLowerCase() || null,
      address: form.address.trim() || null,
      notes: mergeClientLegalDocumentIntoNotes(
        editingClient?.notes,
        documentType,
        documentNumber
      ),
    };
  }

  async function saveClient() {
    const payload = normalizeForm();

    if (!payload.name) {
      alert("Escribe el nombre del cliente.");
      return;
    }

    setSaving(true);

    if (editingClient) {
      const { error } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", editingClient.id);

      if (error) {
        alert(`Error actualizando cliente: ${error.message}`);
        setSaving(false);
        return;
      }

      alert("✅ Cliente actualizado correctamente");
    } else {
      const { error } = await supabase.from("clients").insert(payload);

      if (error) {
        alert(`Error creando cliente: ${error.message}`);
        setSaving(false);
        return;
      }

      alert("✅ Cliente creado correctamente");
    }

    setForm(emptyForm);
    setEditingClient(null);
    setSaving(false);
    await loadClients();
  }

  function startEdit(client: Client) {
    const legalDocument = getClientLegalDocumentFromRecord(client);

    setEditingClient(client);
    setForm({
      name: client.name || "",
      phone: client.phone || client.whatsapp || "",
      email: client.email || "",
      address: client.address || "",
      document_type: legalDocument?.type || "cedula",
      document_number: legalDocument?.number || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEdit() {
    setEditingClient(null);
    setForm(emptyForm);
  }

  async function deleteClient(client: Client) {
    const ok = confirm(
      `¿Seguro que quieres eliminar el cliente "${client.name || "Sin nombre"}"?`
    );

    if (!ok) return;

    const { error } = await supabase.from("clients").delete().eq("id", client.id);

    if (error) {
      alert(`Error eliminando cliente: ${error.message}`);
      return;
    }

    alert("✅ Cliente eliminado");
    await loadClients();
  }

  return (
    <div className="min-h-screen bg-[#020617] p-6 text-white">
      <div className="mx-auto max-w-[1600px]">
        <section className="overflow-hidden rounded-[34px] border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-[#07111f] to-[#020617] p-8 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-cyan-200">
                <UsersRound size={15} />
                RD WOOD SYSTEM
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight lg:text-5xl">
                Clientes PRO
              </h1>

              <p className="mt-3 max-w-3xl text-sm font-medium text-slate-400">
                Registro de clientes, contacto, historial comercial, crédito y
                control de cuentas por cobrar.
              </p>
            </div>

            <button
              onClick={loadClients}
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
            title="Clientes"
            value={totals.totalClients}
            icon={<UsersRound size={24} />}
            color="cyan"
          />

          <StatCard
            title="Ventas registradas"
            value={money(totals.totalSales)}
            icon={<WalletCards size={24} />}
            color="emerald"
          />

          <StatCard
            title="Por cobrar"
            value={money(totals.totalBalance)}
            icon={<AlertTriangle size={24} />}
            color="orange"
          />

          <StatCard
            title="Clientes con deuda"
            value={totals.clientsWithDebt}
            icon={<UserRound size={24} />}
            color="red"
          />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[520px_1fr]">
          <div className="rounded-[32px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                  {editingClient ? "Editar cliente" : "Nuevo cliente"}
                </div>
                <h2 className="mt-2 text-2xl font-black">
                  {editingClient ? editingClient.name : "Registrar cliente"}
                </h2>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                {editingClient ? <Edit3 size={24} /> : <Plus size={24} />}
              </div>
            </div>

            <div className="space-y-4">
              <InputField
                label="Nombre"
                icon={<UserRound size={17} />}
                value={form.name}
                placeholder="Ejemplo: RUBEN SANTANA"
                onChange={(value) => setForm({ ...form, name: value })}
              />

              <InputField
                label="Teléfono / WhatsApp"
                icon={<Phone size={17} />}
                value={form.phone}
                placeholder="Ejemplo: 8090000000"
                onChange={(value) => setForm({ ...form, phone: value })}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[170px_1fr]">
                <div>
                  <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    <span className="text-cyan-300">
                      <FileText size={17} />
                    </span>
                    Tipo doc.
                  </label>
                  <select
                    value={form.document_type}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        document_type: normalizeClientDocumentType(event.target.value),
                      })
                    }
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                  >
                    {CLIENT_LEGAL_DOCUMENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <InputField
                  label="Cedula / Pasaporte / RNC"
                  icon={<FileText size={17} />}
                  value={form.document_number}
                  placeholder="Numero legal del cliente"
                  onChange={(value) => setForm({ ...form, document_number: value })}
                />
              </div>

              <InputField
                label="Email"
                icon={<Mail size={17} />}
                value={form.email}
                placeholder="cliente@email.com"
                onChange={(value) => setForm({ ...form, email: value })}
              />

              <InputField
                label="Dirección"
                icon={<MapPin size={17} />}
                value={form.address}
                placeholder="Dirección del cliente"
                onChange={(value) => setForm({ ...form, address: value })}
              />

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={saveClient}
                  disabled={saving}
                  className="inline-flex flex-1 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-4 text-sm font-black uppercase tracking-wide text-white shadow-xl shadow-cyan-950/30 transition hover:scale-[1.01] disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : editingClient ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <Plus size={18} />
                  )}
                  {editingClient ? "Guardar cambios" : "Crear cliente"}
                </button>

                {editingClient && (
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
                <h2 className="mt-2 text-2xl font-black">Lista de clientes</h2>
              </div>

              <div className="relative w-full lg:w-[360px]">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar cliente..."
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-slate-800 bg-slate-950">
                <Loader2 className="animate-spin text-cyan-300" size={42} />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center">
                <UsersRound className="text-slate-600" size={54} />
                <h3 className="mt-4 text-xl font-black">No hay clientes</h3>
                <p className="mt-2 max-w-md text-sm text-slate-500">
                  Crea tu primer cliente para conectar ventas, proyectos,
                  cotizaciones y producción.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredClients.map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    money={money}
                    onEdit={() => startEdit(client)}
                    onDelete={() => deleteClient(client)}
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
  color: "cyan" | "emerald" | "orange" | "red";
}) {
  const styles = {
    cyan: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
    emerald: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    orange: "text-orange-300 bg-orange-500/10 border-orange-500/20",
    red: "text-red-300 bg-red-500/10 border-red-500/20",
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

      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
      />
    </div>
  );
}

function ClientCard({
  client,
  money,
  onEdit,
  onDelete,
}: {
  client: Client;
  money: (value?: number | null) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const balance = Number(client.balance || 0);
  const phone = client.phone || client.whatsapp || "";
  const legalDocument = getClientLegalDocumentFromRecord(client);
  const referralCode =
    client.referral_code ||
    `RDW-${String(client.id || "CLIENTE").replace(/-/g, "").slice(0, 10).toUpperCase()}`;

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 transition hover:border-cyan-500/40 hover:bg-slate-900/70">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="truncate text-xl font-black text-white">
              {client.name || "Cliente sin nombre"}
            </h3>

            {balance > 0 ? (
              <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-300">
                Deuda activa
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase text-emerald-300">
                Al día
              </span>
            )}

            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-black uppercase text-cyan-200">
              Referido {referralCode}
            </span>
          </div>

          <div className="mt-3 grid gap-2 text-sm text-slate-400 md:grid-cols-2">
            <InfoLine icon={<Phone size={15} />} value={phone || "Sin teléfono"} />
            <InfoLine icon={<Mail size={15} />} value={client.email || "Sin email"} />
            <InfoLine
              icon={<FileText size={15} />}
              value={formatClientLegalDocument(legalDocument)}
            />
            <InfoLine
              icon={<MapPin size={15} />}
              value={client.address || "Sin dirección"}
            />
            <InfoLine
              icon={<Building2 size={15} />}
              value={`Creado: ${
                client.created_at
                  ? new Date(client.created_at).toLocaleDateString("es-DO")
                  : "-"
              }`}
            />
            <InfoLine
              icon={<Gift size={15} />}
              value={`Bono referidos: ${money(client.referral_bonus_balance)}`}
            />
            <InfoLine
              icon={<UsersRound size={15} />}
              value={client.referred_by_code ? `Referido por ${client.referred_by_code}` : "Sin referidor"}
            />
          </div>
        </div>

        <div className="grid min-w-[260px] grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-[#020617] p-4">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">
              Ventas
            </div>
            <div className="mt-2 text-lg font-black text-white">
              {money(client.total_sales)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#020617] p-4">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">
              Deuda
            </div>
            <div
              className={`mt-2 text-lg font-black ${
                balance > 0 ? "text-red-300" : "text-emerald-300"
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
