"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  IdCard,
  Loader2,
  Mail,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  employee_code?: string | null;
  full_name: string;
  identification?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
  position?: string | null;
  department?: string | null;
  hire_date?: string | null;
  birth_date?: string | null;
  salary?: number | null;
  salary_type?: string | null;
  hourly_rate?: number | null;
  status?: string | null;
  qr_code?: string | null;
  pin_code?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  photo_url?: string | null;
  vacation_days_per_year?: number | null;
  vacation_balance?: number | null;
  notes?: string | null;
  created_at?: string | null;
};

type EmployeeDocument = {
  id: string;
  employee_id: string;
  document_type?: string | null;
  document_name?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  notes?: string | null;
  uploaded_by?: string | null;
  created_at?: string | null;
};

type Attendance = {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in?: string | null;
  check_out?: string | null;
  status?: string | null;
  late_minutes?: number | null;
  worked_minutes?: number | null;
  overtime_minutes?: number | null;
};

type LeaveRequest = {
  id: string;
  employee_id: string;
  request_type: string;
  start_date: string;
  end_date: string;
  total_days?: number | null;
  status: string;
};

type Evaluation = {
  id: string;
  employee_id: string;
  final_score: number;
  period_name?: string | null;
  evaluation_date?: string | null;
};

const departments = [
  "Producción",
  "CNC",
  "Canteo",
  "Armado",
  "Instalación",
  "Transporte",
  "Diseño",
  "Ventas",
  "Compras",
  "Administración",
  "Finanzas",
  "RRHH",
];

const positions = [
  "Canteador Maestro",
  "Canteador Ayudante",
  "Ensamblador Maestro",
  "Ensamblador Ayudante",
  "Chofer / Transporte Maestro",
  "Ayudante de Transporte",
  "Instalador Maestro",
  "Instalador Ayudante",
  "Verificador QA",
  "Entrega Final",
  "Diseñador",
  "Vendedor",
  "Comprador",
  "Supervisor Producción",
  "Gerente",
  "Administrativo",
  "Cajera",
  "Contador",
  "RRHH",
];

const docTypes = [
  "Cédula",
  "Contrato",
  "Certificado médico",
  "Cuenta bancaria",
  "Licencia",
  "Capacitación",
  "Amonestación",
  "Otro",
];

const money = (value: any) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const today = () => new Date().toISOString().slice(0, 10);

function n(value: any) {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

function norm(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function date(value: any) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("es-DO");
  } catch {
    return "-";
  }
}

function cx(...classes: Array<string | null | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function buildQrPayload(employee: Employee) {
  return JSON.stringify({
    app: "RD_WOOD_SYSTEM",
    type: "EMPLOYEE_ATTENDANCE",
    employee_id: employee.id,
    employee_code: employee.employee_code,
    qr_code: employee.qr_code,
  });
}

function statusTone(value?: string | null) {
  const v = norm(value);
  if (v.includes("activo") || v.includes("aprob") || v.includes("presente")) {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
  }
  if (v.includes("inactivo") || v.includes("cancel") || v.includes("salida")) {
    return "border-red-400/30 bg-red-500/10 text-red-300";
  }
  return "border-amber-400/30 bg-amber-500/10 text-amber-300";
}

async function uploadEmployeeFile(employeeId: string, folder: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${employeeId}/${folder}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from("employee-files").upload(path, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });

  if (error) throw error;

  const { data } = supabase.storage.from("employee-files").getPublicUrl(path);

  return {
    url: data.publicUrl,
    name: file.name,
    type: file.type,
  };
}

export default function RRHHEmpleadosMaestroPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);

  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [qrPreview, setQrPreview] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    identification: "",
    phone: "",
    email: "",
    address: "",
    emergency_contact: "",
    emergency_phone: "",
    position: "Canteador Maestro",
    department: "Producción",
    hire_date: today(),
    birth_date: "",
    salary: "0",
    salary_type: "mensual",
    hourly_rate: "0",
    status: "activo",
    pin_code: "",
    bank_name: "",
    bank_account: "",
    vacation_days_per_year: "14",
    vacation_balance: "0",
    notes: "",
  });

  const [docForm, setDocForm] = useState({
    document_type: "Cédula",
    document_name: "",
    notes: "",
  });

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedId) || null,
    [employees, selectedId]
  );

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [
        e.employee_code,
        e.full_name,
        e.identification,
        e.phone,
        e.email,
        e.position,
        e.department,
        e.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [employees, search]);

  const selectedDocs = documents.filter((d) => d.employee_id === selectedId);
  const selectedAttendance = attendance.filter((a) => a.employee_id === selectedId);
  const selectedLeaves = leaves.filter((l) => l.employee_id === selectedId);
  const selectedEvaluations = evaluations.filter((e) => e.employee_id === selectedId);

  const stats = useMemo(() => {
    const active = employees.filter((e) => norm(e.status || "activo").includes("activo")).length;
    const inactive = employees.filter((e) => norm(e.status).includes("inactivo")).length;
    const payrollMonthly = employees
      .filter((e) => norm(e.status || "activo").includes("activo"))
      .reduce((acc, e) => acc + n(e.salary), 0);
    const withDocs = new Set(documents.map((d) => d.employee_id)).size;
    return {
      total: employees.length,
      active,
      inactive,
      payrollMonthly,
      withDocs,
    };
  }, [employees, documents]);

  async function loadAll() {
    setLoading(true);
    setMessage("");

    try {
      const [empRes, docRes, attRes, leaveRes, evalRes] = await Promise.all([
        supabase.from("employees").select("*").order("created_at", { ascending: false }),
        supabase.from("employee_documents").select("*").order("created_at", { ascending: false }),
        supabase
          .from("employee_attendance")
          .select("*")
          .order("attendance_date", { ascending: false })
          .limit(300),
        supabase.from("employee_leave_requests").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("employee_evaluations").select("*").order("created_at", { ascending: false }).limit(200),
      ]);

      if (empRes.error) throw empRes.error;

      setEmployees((empRes.data || []) as Employee[]);
      setDocuments((docRes.data || []) as EmployeeDocument[]);
      setAttendance((attRes.data || []) as Attendance[]);
      setLeaves((leaveRes.data || []) as LeaveRequest[]);
      setEvaluations((evalRes.data || []) as Evaluation[]);

      const first = (empRes.data || [])[0] as Employee | undefined;
      if (!selectedId && first) selectEmployee(first);
    } catch (error: any) {
      setMessage(error.message || "Error cargando empleados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectEmployee(employee: Employee) {
    setSelectedId(employee.id);
    setPhotoFile(null);
    setDocFile(null);

    setForm({
      full_name: employee.full_name || "",
      identification: employee.identification || "",
      phone: employee.phone || "",
      email: employee.email || "",
      address: employee.address || "",
      emergency_contact: employee.emergency_contact || "",
      emergency_phone: employee.emergency_phone || "",
      position: employee.position || "Canteador Maestro",
      department: employee.department || "Producción",
      hire_date: employee.hire_date || today(),
      birth_date: employee.birth_date || "",
      salary: String(employee.salary || 0),
      salary_type: employee.salary_type || "mensual",
      hourly_rate: String(employee.hourly_rate || 0),
      status: employee.status || "activo",
      pin_code: employee.pin_code || "",
      bank_name: employee.bank_name || "",
      bank_account: employee.bank_account || "",
      vacation_days_per_year: String(employee.vacation_days_per_year || 14),
      vacation_balance: String(employee.vacation_balance || 0),
      notes: employee.notes || "",
    });

    try {
      const qr = await QRCode.toDataURL(buildQrPayload(employee), {
        width: 320,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      setQrPreview(qr);
    } catch {
      setQrPreview("");
    }
  }

  function clearForm() {
    setSelectedId("");
    setQrPreview("");
    setPhotoFile(null);
    setDocFile(null);
    setForm({
      full_name: "",
      identification: "",
      phone: "",
      email: "",
      address: "",
      emergency_contact: "",
      emergency_phone: "",
      position: "Canteador Maestro",
      department: "Producción",
      hire_date: today(),
      birth_date: "",
      salary: "0",
      salary_type: "mensual",
      hourly_rate: "0",
      status: "activo",
      pin_code: "",
      bank_name: "",
      bank_account: "",
      vacation_days_per_year: "14",
      vacation_balance: "0",
      notes: "",
    });
  }

  function update(key: keyof typeof form, value: string) {
    setForm({ ...form, [key]: value });
  }

  async function saveEmployee() {
    if (!form.full_name.trim()) {
      setMessage("Escribe el nombre completo del empleado.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      let photoUrl = selectedEmployee?.photo_url || null;

      if (selectedId && photoFile) {
        const fileData = await uploadEmployeeFile(selectedId, "photo", photoFile);
        photoUrl = fileData.url;
      }

      const payload = {
        full_name: form.full_name.trim(),
        identification: form.identification.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        emergency_contact: form.emergency_contact.trim() || null,
        emergency_phone: form.emergency_phone.trim() || null,
        position: form.position || null,
        department: form.department || null,
        hire_date: form.hire_date || null,
        birth_date: form.birth_date || null,
        salary: Number(form.salary || 0),
        salary_type: form.salary_type || "mensual",
        hourly_rate: Number(form.hourly_rate || 0),
        status: form.status || "activo",
        pin_code: form.pin_code.trim() || null,
        bank_name: form.bank_name.trim() || null,
        bank_account: form.bank_account.trim() || null,
        vacation_days_per_year: Number(form.vacation_days_per_year || 14),
        vacation_balance: Number(form.vacation_balance || 0),
        notes: form.notes.trim() || null,
        photo_url: photoUrl,
      };

      if (selectedId) {
        const { error } = await supabase.from("employees").update(payload).eq("id", selectedId);
        if (error) throw error;
        setMessage("Empleado actualizado correctamente.");
      } else {
        const { data, error } = await supabase.from("employees").insert(payload).select("*").single();
        if (error) throw error;
        setSelectedId(data.id);
        setMessage("Empleado creado correctamente.");
      }

      setPhotoFile(null);
      await loadAll();
    } catch (error: any) {
      setMessage(error.message || "Error guardando empleado.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhotoOnly(file: File) {
    if (!selectedId) {
      setMessage("Primero guarda o selecciona un empleado.");
      return;
    }

    setSaving(true);

    try {
      const fileData = await uploadEmployeeFile(selectedId, "photo", file);
      const { error } = await supabase.from("employees").update({ photo_url: fileData.url }).eq("id", selectedId);
      if (error) throw error;

      setMessage("Foto del empleado actualizada.");
      await loadAll();
    } catch (error: any) {
      setMessage(error.message || "Error subiendo foto.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument() {
    if (!selectedId) {
      setMessage("Selecciona o guarda un empleado primero.");
      return;
    }

    if (!docFile) {
      setMessage("Selecciona un archivo para subir.");
      return;
    }

    setSaving(true);

    try {
      const fileData = await uploadEmployeeFile(selectedId, "documents", docFile);
      const { error } = await supabase.from("employee_documents").insert({
        employee_id: selectedId,
        document_type: docForm.document_type,
        document_name: docForm.document_name || docFile.name,
        file_url: fileData.url,
        file_name: fileData.name,
        file_type: fileData.type,
        notes: docForm.notes || null,
        uploaded_by: "RD WOOD USER",
      });

      if (error) throw error;

      setDocFile(null);
      setDocForm({ document_type: "Cédula", document_name: "", notes: "" });
      setMessage("Documento cargado correctamente.");
      await loadAll();
    } catch (error: any) {
      setMessage(error.message || "Error subiendo documento.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(employee: Employee) {
    const newStatus = norm(employee.status).includes("inactivo") ? "activo" : "inactivo";
    const ok = window.confirm(`¿Cambiar estado de ${employee.full_name} a ${newStatus}?`);
    if (!ok) return;

    const { error } = await supabase.from("employees").update({ status: newStatus }).eq("id", employee.id);
    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`Empleado marcado como ${newStatus}.`);
    await loadAll();
  }

  async function deleteDocument(id: string) {
    if (!window.confirm("¿Eliminar este documento?")) return;

    const { error } = await supabase.from("employee_documents").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Documento eliminado.");
    await loadAll();
  }

  async function downloadQrCard() {
    if (!selectedEmployee) return;

    const qr = qrPreview || (await QRCode.toDataURL(buildQrPayload(selectedEmployee), { width: 320, margin: 1 }));

    const html = `
      <html>
      <head>
        <title>Carnet ${selectedEmployee.full_name}</title>
        <style>
          body { font-family: Arial; background:#020817; color:white; display:flex; align-items:center; justify-content:center; min-height:100vh; }
          .card { width:380px; border:1px solid #22d3ee55; border-radius:28px; padding:24px; background:linear-gradient(135deg,#07111f,#0b1830); box-shadow:0 30px 80px #0008; }
          .brand { color:#22d3ee; letter-spacing:5px; font-size:11px; font-weight:900; }
          h1 { font-size:24px; margin:12px 0 4px; }
          .muted { color:#94a3b8; font-size:13px; }
          .qr { background:white; padding:14px; border-radius:18px; margin-top:20px; }
          .qr img { width:100%; display:block; }
          .code { margin-top:18px; font-weight:900; color:#5eead4; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="brand">RD WOOD SYSTEM</div>
          <h1>${selectedEmployee.full_name}</h1>
          <div class="muted">${selectedEmployee.position || ""} · ${selectedEmployee.department || ""}</div>
          <div class="code">${selectedEmployee.employee_code || ""}</div>
          <div class="qr"><img src="${qr}" /></div>
          <p class="muted">Carnet QR para asistencia y control interno.</p>
        </div>
        <script>window.print()</script>
      </body>
      </html>
    `;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }

  const avgScore =
    selectedEvaluations.length > 0
      ? selectedEvaluations.reduce((acc, e) => acc + n(e.final_score), 0) / selectedEvaluations.length
      : 0;

  return (
    <main className="min-h-screen bg-[#020817] p-4 text-white md:p-6">
      <div className="mx-auto w-full max-w-[1720px] space-y-5">
        <section className="rounded-3xl border border-cyan-900/50 bg-gradient-to-br from-[#081421] via-[#0b1830] to-[#111b3f] p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 md:flex">
                <Users size={34} />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.30em] text-cyan-300">
                  <BadgeCheck size={14} /> FASE 8.1
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                  Módulo Maestro de Empleados
                </h1>
                <p className="mt-2 max-w-4xl text-sm text-slate-300">
                  Expediente completo, QR, documentos, salario, contacto, vacaciones y trazabilidad del empleado.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={clearForm}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-[#030817] px-5 text-sm font-black text-slate-200 hover:bg-white/5"
              >
                <Plus size={18} />
                Nuevo
              </button>

              <button
                onClick={loadAll}
                disabled={loading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-5 text-sm font-black text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                Actualizar
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">
            {message}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi title="Empleados" value={stats.total} subtitle={`${stats.active} activos`} icon={<Users />} tone="cyan" />
          <Kpi title="Inactivos" value={stats.inactive} subtitle="Bajas / suspendidos" icon={<XCircle />} tone={stats.inactive ? "red" : "green"} />
          <Kpi title="Nómina mensual" value={money(stats.payrollMonthly)} subtitle="Base salarial activa" icon={<Banknote />} tone="green" />
          <Kpi title="Con documentos" value={stats.withDocs} subtitle="Expedientes con archivos" icon={<FileText />} tone="purple" />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[460px_1fr_420px]">
          <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Empleados</h2>
                <p className="text-sm text-slate-400">Selecciona o busca un expediente.</p>
              </div>
              <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-300">
                {filteredEmployees.length}
              </span>
            </div>

            <div className="relative mb-4">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, cédula, cargo..."
                className="w-full rounded-2xl border border-slate-700 bg-[#030817] py-4 pl-11 pr-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div className="max-h-[760px] space-y-3 overflow-auto pr-1">
              {filteredEmployees.map((employee) => (
                <button
                  key={employee.id}
                  onClick={() => selectEmployee(employee)}
                  className={cx(
                    "w-full rounded-2xl border p-4 text-left transition",
                    selectedId === employee.id
                      ? "border-cyan-400 bg-cyan-500/10"
                      : "border-slate-800 bg-[#030817] hover:border-cyan-500/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                      {employee.photo_url ? (
                        <img src={employee.photo_url} className="h-full w-full object-cover" />
                      ) : (
                        <UserRound />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">{employee.full_name}</p>
                      <p className="truncate text-xs text-slate-400">
                        {employee.employee_code || "Sin código"} · {employee.position || "Sin cargo"}
                      </p>
                      <p className="truncate text-xs text-slate-500">{employee.department || "Sin departamento"}</p>
                    </div>
                    <span className={cx("shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase", statusTone(employee.status))}>
                      {employee.status || "activo"}
                    </span>
                  </div>
                </button>
              ))}

              {!filteredEmployees.length ? <Empty text="No hay empleados para mostrar." /> : null}
            </div>
          </div>

          <div className="space-y-5">
            <Section title="Expediente del empleado" subtitle="Datos principales y laborales." icon={<IdCard />}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Input label="Nombre completo" value={form.full_name} onChange={(v) => update("full_name", v)} />
                <Input label="Cédula / identificación" value={form.identification} onChange={(v) => update("identification", v)} />
                <Input label="Teléfono" value={form.phone} onChange={(v) => update("phone", v)} />
                <Input label="Email" value={form.email} onChange={(v) => update("email", v)} />
                <Input label="Dirección" value={form.address} onChange={(v) => update("address", v)} />
                <Input label="Contacto emergencia" value={form.emergency_contact} onChange={(v) => update("emergency_contact", v)} />
                <Input label="Teléfono emergencia" value={form.emergency_phone} onChange={(v) => update("emergency_phone", v)} />
                <Select label="Departamento" value={form.department} options={departments} onChange={(v) => update("department", v)} />
                <Select label="Cargo" value={form.position} options={positions} onChange={(v) => update("position", v)} />
                <Input label="Fecha ingreso" type="date" value={form.hire_date} onChange={(v) => update("hire_date", v)} />
                <Input label="Fecha nacimiento" type="date" value={form.birth_date} onChange={(v) => update("birth_date", v)} />
                <Select label="Estado" value={form.status} options={["activo", "inactivo", "suspendido", "salida"]} onChange={(v) => update("status", v)} />
              </div>
            </Section>

            <Section title="Compensación y banco" subtitle="Datos para nómina dominicana." icon={<CreditCard />}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Input label="Salario" type="number" value={form.salary} onChange={(v) => update("salary", v)} />
                <Select label="Tipo salario" value={form.salary_type} options={["mensual", "quincenal", "semanal", "por_hora"]} onChange={(v) => update("salary_type", v)} />
                <Input label="Tarifa por hora" type="number" value={form.hourly_rate} onChange={(v) => update("hourly_rate", v)} />
                <Input label="PIN asistencia" value={form.pin_code} onChange={(v) => update("pin_code", v)} />
                <Input label="Banco" value={form.bank_name} onChange={(v) => update("bank_name", v)} />
                <Input label="Cuenta bancaria" value={form.bank_account} onChange={(v) => update("bank_account", v)} />
                <Input label="Días vacaciones/año" type="number" value={form.vacation_days_per_year} onChange={(v) => update("vacation_days_per_year", v)} />
                <Input label="Balance vacaciones" type="number" value={form.vacation_balance} onChange={(v) => update("vacation_balance", v)} />
              </div>
            </Section>

            <Section title="Notas internas" icon={<FileText />}>
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={4}
                className="w-full resize-none rounded-2xl border border-slate-700 bg-[#030817] p-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                placeholder="Notas del expediente, observaciones, historial laboral..."
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={saveEmployee}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-4 text-sm font-black uppercase text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Guardar empleado
                </button>

                {selectedEmployee ? (
                  <button
                    onClick={() => toggleStatus(selectedEmployee)}
                    className="inline-flex items-center justify-center gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-6 py-4 text-sm font-black uppercase text-red-200 hover:bg-red-500/20"
                  >
                    <Trash2 size={18} />
                    Activar / Inactivar
                  </button>
                ) : null}
              </div>
            </Section>
          </div>

          <div className="space-y-5">
            <Section title="Foto y QR" subtitle="Carnet digital para asistencia." icon={<QrCode />}>
              <div className="rounded-3xl border border-slate-800 bg-[#030817] p-5 text-center">
                <div className="mx-auto flex h-40 w-40 items-center justify-center overflow-hidden rounded-3xl border border-cyan-400/30 bg-cyan-500/10">
                  {selectedEmployee?.photo_url ? (
                    <img src={selectedEmployee.photo_url} className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={70} className="text-cyan-300" />
                  )}
                </div>

                <h3 className="mt-4 text-xl font-black">{selectedEmployee?.full_name || "Nuevo empleado"}</h3>
                <p className="text-sm text-slate-400">{selectedEmployee?.employee_code || "Código se genera al guardar"}</p>

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setPhotoFile(file);
                    if (file) uploadPhotoOnly(file);
                  }}
                />

                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-200 hover:bg-cyan-500/20"
                >
                  <Camera size={18} />
                  Subir foto
                </button>

                {qrPreview ? (
                  <div className="mt-5 rounded-3xl border border-slate-800 bg-white p-4">
                    <img src={qrPreview} className="mx-auto h-52 w-52" />
                  </div>
                ) : (
                  <div className="mt-5 rounded-3xl border border-dashed border-slate-700 bg-[#020617] p-8 text-sm text-slate-500">
                    Selecciona un empleado para ver QR.
                  </div>
                )}

                <button
                  onClick={downloadQrCard}
                  disabled={!selectedEmployee}
                  className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  <Download size={18} />
                  Imprimir carnet QR
                </button>
              </div>
            </Section>

            <Section title="Indicadores del empleado" icon={<ShieldCheck />}>
              <div className="grid gap-3">
                <Mini title="Asistencias registradas" value={selectedAttendance.length} icon={<Clock />} />
                <Mini title="Solicitudes vacaciones" value={selectedLeaves.length} icon={<CalendarIcon />} />
                <Mini title="Evaluación promedio" value={`${avgScore.toFixed(1)}%`} icon={<CheckCircle2 />} />
                <Mini title="Documentos" value={selectedDocs.length} icon={<FileText />} />
              </div>
            </Section>

            <Section title="Documentos" subtitle="Cédula, contrato, licencia, certificados." icon={<UploadCloud />}>
              <div className="space-y-3">
                <Select label="Tipo documento" value={docForm.document_type} options={docTypes} onChange={(v) => setDocForm({ ...docForm, document_type: v })} />
                <Input label="Nombre documento" value={docForm.document_name} onChange={(v) => setDocForm({ ...docForm, document_name: v })} />

                <input
                  type="file"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="w-full rounded-2xl border border-slate-700 bg-[#030817] p-4 text-sm font-bold text-white"
                />

                <textarea
                  value={docForm.notes}
                  onChange={(e) => setDocForm({ ...docForm, notes: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-2xl border border-slate-700 bg-[#030817] p-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                  placeholder="Notas del documento..."
                />

                <button
                  onClick={uploadDocument}
                  disabled={saving || !selectedId}
                  className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-600 px-5 py-4 text-sm font-black uppercase text-white disabled:opacity-60"
                >
                  <UploadCloud size={18} />
                  Subir documento
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {selectedDocs.map((doc) => (
                  <div key={doc.id} className="rounded-2xl border border-slate-800 bg-[#030817] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <a href={doc.file_url || "#"} target="_blank" className="min-w-0">
                        <p className="truncate font-black text-cyan-300">{doc.document_name || doc.file_name}</p>
                        <p className="text-xs text-slate-400">{doc.document_type} · {date(doc.created_at)}</p>
                      </a>
                      <button onClick={() => deleteDocument(doc.id)} className="text-red-300 hover:text-red-200">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}

                {!selectedDocs.length ? <Empty text="Sin documentos cargados." /> : null}
              </div>
            </Section>
          </div>
        </section>
      </div>
    </main>
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
  tone?: "cyan" | "green" | "red" | "purple";
}) {
  const tones: Record<string, string> = {
    cyan: "border-cyan-400/25 bg-cyan-500/10 text-cyan-300",
    green: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
    red: "border-red-400/25 bg-red-500/10 text-red-300",
    purple: "border-purple-400/25 bg-purple-500/10 text-purple-300",
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] via-[#07111f] to-[#030817] p-5 shadow-xl shadow-black/30">
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

function Section({
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
      <div className="mb-5">
        <h2 className="flex items-center gap-2 text-xl font-black text-white">
          <span className="text-cyan-300">{icon}</span>
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
      />
    </div>
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
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
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

function Mini({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#030817] p-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{title}</p>
        <p className="mt-1 text-xl font-black text-white">{value}</p>
      </div>
      <div className="text-cyan-300">{icon}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-[#020617] p-6 text-center text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}

function CalendarIcon() {
  return <Clock />;
}
