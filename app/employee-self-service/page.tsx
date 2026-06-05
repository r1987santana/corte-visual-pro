"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Award,
  BadgeCheck,
  Banknote,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileSignature,
  FileText,
  GraduationCap,
  IdCard,
  Inbox,
  Mail,
  PenLine,
  Phone,
  Plane,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getStoredUser } from "@/lib/saas/auth-client";

type Tab = "dashboard" | "perfil" | "solicitudes" | "documentos" | "recibos" | "cursos" | "certificados";

type Dashboard = {
  active_employees: number;
  pending_requests: number;
  vacation_requests: number;
  available_documents: number;
  pending_signatures: number;
  signed_documents: number;
  pending_courses: number;
  active_certificates: number;
  compliance_alerts: number;
};

type Employee = {
  employee_id: string;
  employee_code: string | null;
  employee_name: string;
  identification: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  photo_url: string | null;
  position: string | null;
  department: string | null;
  hire_date: string | null;
  salary: number;
  salary_type: string | null;
  payment_method: string | null;
  bank_name: string | null;
  bank_account: string | null;
  vacation_days_per_year: number | null;
  vacation_balance: number | null;
  status: string;
};

type RequestRow = {
  id: string;
  request_code: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position: string | null;
  request_type: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  total_days: number;
  status: string;
  response_notes: string | null;
  created_at: string;
};

type DocRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position: string | null;
  document_code: string;
  document_type: string;
  title: string;
  description: string | null;
  source_table: string | null;
  source_id: string | null;
  requires_signature: boolean;
  signed_at: string | null;
  status: string;
  created_at: string;
};

type Enrollment = {
  id: string;
  course_code: string;
  course_title: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position: string | null;
  due_date: string | null;
  progress_percent: number;
  final_score: number;
  status: string;
  lessons_total: number;
  lessons_completed: number;
};

type Certificate = {
  id: string;
  certificate_code: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position: string | null;
  course_code: string;
  course_title: string;
  issued_at: string;
  expires_at: string | null;
  final_score: number;
  token: string;
  status: string;
};

const emptyDashboard: Dashboard = {
  active_employees: 0,
  pending_requests: 0,
  vacation_requests: 0,
  available_documents: 0,
  pending_signatures: 0,
  signed_documents: 0,
  pending_courses: 0,
  active_certificates: 0,
  compliance_alerts: 0,
};

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(n || 0));

function formatDate(value?: string | null) {
  if (!value) return "No definido";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function normalizeStatus(value?: string | null) {
  return String(value || "pendiente").replaceAll("_", " ");
}

function statusClass(value?: string | null) {
  const status = String(value || "").toLowerCase();
  if (["activo", "aprobada", "completada", "completado", "disponible", "firmado", "vigente"].includes(status)) {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
  }
  if (["pendiente", "pendiente_firma", "asignado", "en_progreso"].includes(status)) {
    return "border-amber-400/30 bg-amber-500/15 text-amber-200";
  }
  if (["rechazada", "vencido", "cancelada"].includes(status)) {
    return "border-red-400/30 bg-red-500/15 text-red-200";
  }
  return "border-slate-500/30 bg-slate-500/15 text-slate-200";
}

export default function EmployeeSelfServicePage({ initialTab = "dashboard" }: { initialTab?: Tab } = {}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [canSwitchEmployee, setCanSwitchEmployee] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");

      const activeUser = getStoredUser();
      const roleKey = String(activeUser?.role_key || "").toLowerCase();
      const canManage =
        activeUser?.permissions?.includes("rrhh") ||
        ["admin", "administrador", "super_admin"].includes(roleKey);

      setCanSwitchEmployee(Boolean(canManage));

      let employeeQuery: any = supabase.from("v_hr_ess_employee_profile").select("*").order("employee_name");
      if (!canManage && activeUser?.email) {
        employeeQuery = employeeQuery.eq("email", activeUser.email).limit(1);
      }

      const [dashRes, empRes] = await Promise.all([
        canManage ? supabase.from("v_hr_ess_dashboard").select("*").maybeSingle() : Promise.resolve({ data: null, error: null }),
        employeeQuery,
      ]);

      if (canManage && dashRes.error) throw dashRes.error;
      if (empRes.error) throw empRes.error;

      const nextEmployees = (empRes.data || []) as Employee[];
      const selected =
        (canManage && selectedEmployeeId
          ? nextEmployees.find((employee) => employee.employee_id === selectedEmployeeId)
          : null) || nextEmployees[0];

      if (!selected) {
        setEmployees([]);
        setSelectedEmployeeId("");
        setRequests([]);
        setDocs([]);
        setEnrollments([]);
        setCertificates([]);
        setDashboard(emptyDashboard);
        setMessage("No encontramos un empleado vinculado a este usuario.");
        return;
      }

      let reqQuery: any = supabase.from("v_hr_ess_requests_detail").select("*").order("created_at", { ascending: false });
      let docQuery: any = supabase.from("v_hr_ess_documents_detail").select("*").order("created_at", { ascending: false });
      let enrQuery: any = supabase.from("v_hr_lms_enrollments_detail").select("*").order("enrolled_at", { ascending: false });
      let certQuery: any = supabase.from("v_hr_lms_certificates_detail").select("*").order("issued_at", { ascending: false });

      if (!canManage) {
        reqQuery = reqQuery.eq("employee_id", selected.employee_id);
        docQuery = docQuery.eq("employee_id", selected.employee_id);
        if (selected.employee_code) {
          enrQuery = enrQuery.eq("employee_code", selected.employee_code);
          certQuery = certQuery.eq("employee_code", selected.employee_code);
        }
      }

      const [reqRes, docRes, enrRes, certRes] = await Promise.all([reqQuery, docQuery, enrQuery, certQuery]);

      if (reqRes.error) throw reqRes.error;
      if (docRes.error) throw docRes.error;
      if (enrRes.error) throw enrRes.error;
      if (certRes.error) throw certRes.error;

      const nextRequests = (reqRes.data || []) as RequestRow[];
      const nextDocs = (docRes.data || []) as DocRow[];
      const nextEnrollments = (enrRes.data || []) as Enrollment[];
      const nextCertificates = (certRes.data || []) as Certificate[];

      setEmployees(nextEmployees);
      setSelectedEmployeeId(selected.employee_id);
      setRequests(nextRequests);
      setDocs(nextDocs);
      setEnrollments(nextEnrollments);
      setCertificates(nextCertificates);

      if (canManage && dashRes.data) {
        setDashboard(dashRes.data as Dashboard);
      } else {
        setDashboard({
          active_employees: 1,
          pending_requests: nextRequests.filter((row) => row.status === "pendiente").length,
          vacation_requests: nextRequests.filter((row) => row.request_type === "vacaciones").length,
          available_documents: nextDocs.length,
          pending_signatures: nextDocs.filter((row) => row.requires_signature && !row.signed_at).length,
          signed_documents: nextDocs.filter((row) => row.signed_at).length,
          pending_courses: nextEnrollments.filter((row) => ["asignado", "en_progreso", "pendiente"].includes(row.status)).length,
          active_certificates: nextCertificates.filter((row) => row.status === "vigente").length,
          compliance_alerts: 0,
        });
      }
    } catch (error: any) {
      setMessage(error.message || "Error cargando Portal del Empleado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedEmployee = employees.find((employee) => employee.employee_id === selectedEmployeeId) || employees[0];

  const myRequests = useMemo(
    () => requests.filter((row) => !selectedEmployee?.employee_id || row.employee_id === selectedEmployee.employee_id),
    [requests, selectedEmployee]
  );

  const myDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = docs.filter((row) => !selectedEmployee?.employee_id || row.employee_id === selectedEmployee.employee_id);
    if (!q) return rows;
    return rows.filter((row) =>
      [row.document_code, row.title, row.document_type, row.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [docs, search, selectedEmployee]);

  const myReceipts = myDocs.filter((row) => row.document_type === "recibo");
  const myCourses = enrollments.filter((row) => !selectedEmployee?.employee_code || row.employee_code === selectedEmployee.employee_code);
  const myCertificates = certificates.filter((row) => !selectedEmployee?.employee_code || row.employee_code === selectedEmployee.employee_code);

  const pendingDocs = myDocs.filter((row) => row.requires_signature && !row.signed_at);
  const latestDocs = myDocs.slice(0, 4);
  const latestRequests = myRequests.slice(0, 4);
  const nextCourse = myCourses.find((row) => row.status !== "completado") || myCourses[0];

  async function createVacationRequest() {
    if (!selectedEmployee) return;
    try {
      setLoading(true);
      const start = new Date();
      start.setDate(start.getDate() + 15);
      const end = new Date();
      end.setDate(end.getDate() + 17);

      const { error } = await supabase.rpc("hr_ess_create_request", {
        p_employee_id: selectedEmployee.employee_id,
        p_request_type: "vacaciones",
        p_title: "Solicitud de vacaciones desde portal",
        p_start_date: start.toISOString().slice(0, 10),
        p_end_date: end.toISOString().slice(0, 10),
      });

      if (error) throw error;
      setMessage("Solicitud de vacaciones creada para revision de RRHH.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo crear la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  async function createDocumentRequest() {
    if (!selectedEmployee) return;
    try {
      setLoading(true);
      const { error } = await supabase.rpc("hr_ess_create_request", {
        p_employee_id: selectedEmployee.employee_id,
        p_request_type: "documento",
        p_title: "Solicitud de carta laboral",
        p_start_date: null,
        p_end_date: null,
      });

      if (error) throw error;
      setMessage("Solicitud de documento enviada a RRHH.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo crear la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  async function signDocument(doc: DocRow) {
    if (!selectedEmployee) return;
    try {
      setLoading(true);
      const { error } = await supabase.rpc("hr_ess_sign_document", {
        p_employee_id: selectedEmployee.employee_id,
        p_document_id: doc.id,
        p_signature_name: selectedEmployee.employee_name,
      });

      if (error) throw error;
      setMessage("Documento firmado digitalmente.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo firmar el documento.");
    } finally {
      setLoading(false);
    }
  }

  function printDoc(doc: DocRow) {
    const html = `
      <html>
      <head>
        <title>${doc.document_code}</title>
        <style>
          body{font-family:Arial;margin:40px;color:#111;background:#f8fafc}
          .box{border:1px solid #ddd;border-radius:18px;padding:28px;max-width:760px;margin:auto;background:white}
          .brand{letter-spacing:4px;color:#0f766e;font-weight:800}
          h1{margin:10px 0;font-size:28px}
          .muted{color:#555;font-size:13px}
          .status{font-size:18px;font-weight:900}
        </style>
      </head>
      <body>
        <div class="box">
          <div class="brand">RD WOOD SYSTEM PRO</div>
          <h1>${doc.title}</h1>
          <p class="muted">${doc.document_code} - ${doc.document_type}</p>
          <p><b>Empleado:</b> ${doc.employee_code || ""} - ${doc.employee_name}</p>
          <p><b>Departamento:</b> ${doc.department || "N/A"} - ${doc.position || "N/A"}</p>
          <p>${doc.description || ""}</p>
          <p class="status">Estado: ${normalizeStatus(doc.status)}</p>
          <p class="muted">Firma: ${doc.signed_at || "Pendiente"}</p>
        </div>
        <script>window.print()</script>
      </body>
      </html>
    `;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  const nav = [
    { id: "dashboard", label: "Resumen", icon: BarChart3 },
    { id: "perfil", label: "Perfil", icon: User },
    { id: "solicitudes", label: "Solicitudes", icon: Inbox },
    { id: "documentos", label: "Documentos", icon: FileText },
    { id: "recibos", label: "Recibos", icon: Receipt },
    { id: "cursos", label: "Cursos", icon: BookOpen },
    { id: "certificados", label: "Certificados", icon: Award },
  ] as const;

  return (
    <main className="min-h-screen bg-[#050914] text-white">
      <div className="mx-auto max-w-[1500px] px-4 py-6 lg:px-6">
        <section className="relative mb-6 overflow-hidden rounded-[28px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.20),transparent_35%),linear-gradient(135deg,#071827,#101845_72%,#07111f)] p-6 shadow-2xl lg:p-8">
          <div className="absolute right-10 top-8 hidden h-28 w-28 rounded-full border border-cyan-300/20 lg:block" />
          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.35em] text-cyan-200">
                Portal RRHH conectado
              </p>
              <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-white lg:text-6xl">
                Portal del Empleado PRO
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 lg:text-base">
                Un solo acceso para expediente, solicitudes, documentos, recibos, capacitacion,
                certificados y firma digital. Toda la informacion viene desde RRHH.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
              <div className="flex items-center gap-4">
                <Avatar employee={selectedEmployee} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-2xl font-black">{selectedEmployee?.employee_name || "Empleado"}</p>
                  <p className="truncate text-sm text-slate-300">
                    {selectedEmployee?.employee_code || "Sin codigo"} - {selectedEmployee?.department || "Sin departamento"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniStat label="Vacaciones" value={`${selectedEmployee?.vacation_balance || 0} dias`} />
                <MiniStat label="Firma pend." value={pendingDocs.length} />
              </div>
            </div>
          </div>
        </section>

        {message && (
          <div className="mb-4 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100">
            {message}
          </div>
        )}

        {canSwitchEmployee && (
          <section className="mb-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.25em] text-cyan-200">
              Vista administrativa RRHH
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(event) => setSelectedEmployeeId(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none"
            >
              {employees.map((employee) => (
                <option key={employee.employee_id} value={employee.employee_id}>
                  {employee.employee_code || "SIN-COD"} - {employee.employee_name} - {employee.department || "Sin departamento"}
                </option>
              ))}
            </select>
          </section>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Kpi title="Solicitudes" value={dashboard.pending_requests} icon={<Inbox size={18} />} tone="cyan" />
          <Kpi title="Documentos" value={dashboard.available_documents} icon={<FileText size={18} />} tone="blue" />
          <Kpi title="Por firmar" value={dashboard.pending_signatures} icon={<FileSignature size={18} />} tone="amber" />
          <Kpi title="Firmados" value={dashboard.signed_documents} icon={<PenLine size={18} />} tone="green" />
          <Kpi title="Cursos" value={dashboard.pending_courses} icon={<BookOpen size={18} />} tone="violet" />
          <Kpi title="Certificados" value={dashboard.active_certificates} icon={<Award size={18} />} tone="green" />
          <Kpi title="Vacaciones" value={dashboard.vacation_requests} icon={<Plane size={18} />} tone="blue" />
          <Kpi title="Alertas" value={dashboard.compliance_alerts} icon={<ShieldCheck size={18} />} tone="amber" />
        </section>

        <section className="sticky top-0 z-10 mb-6 flex gap-2 overflow-x-auto rounded-3xl border border-white/10 bg-[#07111f]/95 p-2 backdrop-blur">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex min-w-max items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                  active ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
          <button
            onClick={loadData}
            disabled={loading}
            className="ml-auto flex min-w-max items-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </section>

        {tab === "dashboard" && (
          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Panel title="Centro del empleado" icon={<BriefcaseBusiness size={20} />}>
              <div className="grid gap-4 md:grid-cols-2">
                <ActionCard title="Solicitar vacaciones" text="Crea la solicitud y RRHH la recibe para aprobacion." icon={<Plane size={20} />} onClick={createVacationRequest} />
                <ActionCard title="Pedir carta laboral" text="Genera una solicitud formal de documento laboral." icon={<FileText size={20} />} onClick={createDocumentRequest} />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Info label="Departamento" value={selectedEmployee?.department || "Sin departamento"} icon={<BriefcaseBusiness size={18} />} />
                <Info label="Puesto" value={selectedEmployee?.position || "Sin puesto"} icon={<IdCard size={18} />} />
                <Info label="Telefono" value={selectedEmployee?.phone || "No registrado"} icon={<Phone size={18} />} />
                <Info label="Correo" value={selectedEmployee?.email || "No registrado"} icon={<Mail size={18} />} />
              </div>
            </Panel>

            <Panel title="Pendientes importantes" icon={<Clock3 size={20} />}>
              <div className="space-y-3">
                {pendingDocs.slice(0, 3).map((doc) => (
                  <DocumentCard key={doc.id} item={doc} onSign={signDocument} onPrint={printDoc} compact />
                ))}
                {!pendingDocs.length && (
                  <EmptyState title="Todo al dia" text="No tienes documentos pendientes de firma." />
                )}
              </div>
            </Panel>

            <Panel title="Ultimos documentos" icon={<FileText size={20} />}>
              <div className="space-y-3">
                {latestDocs.map((doc) => (
                  <DocumentCard key={doc.id} item={doc} onSign={signDocument} onPrint={printDoc} compact />
                ))}
                {!latestDocs.length && <EmptyState title="Sin documentos" text="RRHH aun no ha publicado documentos para este empleado." />}
              </div>
            </Panel>

            <Panel title="Actividad reciente" icon={<CalendarDays size={20} />}>
              <div className="space-y-3">
                {latestRequests.map((request) => (
                  <RequestCard key={request.id} item={request} />
                ))}
                {!latestRequests.length && <EmptyState title="Sin solicitudes" text="No hay vacaciones, cartas o procesos recientes." />}
              </div>
            </Panel>

            <Panel title="Capacitacion activa" icon={<GraduationCap size={20} />}>
              {nextCourse ? <CourseCard item={nextCourse} /> : <EmptyState title="Sin cursos" text="No hay cursos asignados por RRHH." />}
            </Panel>

            <Panel title="Ultimo certificado" icon={<BadgeCheck size={20} />}>
              {myCertificates[0] ? <CertificateCard item={myCertificates[0]} /> : <EmptyState title="Sin certificados" text="Cuando completes cursos, tus certificados apareceran aqui." />}
            </Panel>
          </section>
        )}

        {tab === "perfil" && selectedEmployee && (
          <Panel title="Expediente conectado a RRHH" icon={<User size={20} />}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Info label="Empleado" value={`${selectedEmployee.employee_code || "SIN-COD"} - ${selectedEmployee.employee_name}`} icon={<User size={18} />} />
              <Info label="Cedula / documento" value={selectedEmployee.identification || "No registrado"} icon={<IdCard size={18} />} />
              <Info label="Departamento" value={selectedEmployee.department || "Sin departamento"} icon={<BriefcaseBusiness size={18} />} />
              <Info label="Puesto" value={selectedEmployee.position || "Sin puesto"} icon={<BriefcaseBusiness size={18} />} />
              <Info label="Telefono" value={selectedEmployee.phone || "No registrado"} icon={<Phone size={18} />} />
              <Info label="Correo" value={selectedEmployee.email || "No registrado"} icon={<Mail size={18} />} />
              <Info label="Direccion" value={selectedEmployee.address || "No registrada"} icon={<IdCard size={18} />} />
              <Info label="Ingreso" value={formatDate(selectedEmployee.hire_date)} icon={<CalendarDays size={18} />} />
              <Info label="Estado" value={normalizeStatus(selectedEmployee.status)} icon={<ShieldCheck size={18} />} />
              <Info label="Salario" value={money(selectedEmployee.salary)} icon={<Wallet size={18} />} />
              <Info label="Metodo pago" value={selectedEmployee.payment_method || "No registrado"} icon={<Banknote size={18} />} />
              <Info label="Banco / cuenta" value={`${selectedEmployee.bank_name || "N/A"} ${selectedEmployee.bank_account || ""}`.trim()} icon={<Receipt size={18} />} />
            </div>
          </Panel>
        )}

        {tab === "solicitudes" && (
          <Panel title="Solicitudes a RRHH" icon={<Inbox size={20} />}>
            <div className="mb-5 grid gap-3 md:grid-cols-2">
              <ActionCard title="Solicitar vacaciones" text="RRHH recibe fechas sugeridas y procesa aprobacion." icon={<Plane size={20} />} onClick={createVacationRequest} />
              <ActionCard title="Solicitar documento" text="Carta laboral, constancia o documento interno." icon={<FileText size={20} />} onClick={createDocumentRequest} />
            </div>
            <div className="space-y-3">
              {myRequests.map((request) => (
                <RequestCard key={request.id} item={request} />
              ))}
              {!myRequests.length && <EmptyState title="No hay solicitudes" text="Crea una solicitud y quedara conectada a RRHH." />}
            </div>
          </Panel>
        )}

        {tab === "documentos" && (
          <Panel title="Documentos y firma digital" icon={<FileText size={20} />}>
            <SearchBox value={search} onChange={setSearch} placeholder="Buscar documento, estado o tipo..." />
            <div className="mt-4 space-y-3">
              {myDocs.map((doc) => (
                <DocumentCard key={doc.id} item={doc} onSign={signDocument} onPrint={printDoc} />
              ))}
              {!myDocs.length && <EmptyState title="Sin documentos" text="No hay documentos publicados para este empleado." />}
            </div>
          </Panel>
        )}

        {tab === "recibos" && (
          <Panel title="Recibos de nomina" icon={<Receipt size={20} />}>
            <div className="space-y-3">
              {myReceipts.map((doc) => (
                <DocumentCard key={doc.id} item={doc} onSign={signDocument} onPrint={printDoc} />
              ))}
              {!myReceipts.length && <EmptyState title="Sin recibos" text="Los recibos publicados por RRHH apareceran aqui." />}
            </div>
          </Panel>
        )}

        {tab === "cursos" && (
          <Panel title="Cursos asignados" icon={<BookOpen size={20} />}>
            <div className="grid gap-4 xl:grid-cols-2">
              {myCourses.map((course) => (
                <CourseCard key={course.id} item={course} />
              ))}
              {!myCourses.length && <EmptyState title="Sin cursos" text="No hay capacitaciones asignadas por RRHH." />}
            </div>
          </Panel>
        )}

        {tab === "certificados" && (
          <Panel title="Certificados activos" icon={<Award size={20} />}>
            <div className="grid gap-4 xl:grid-cols-2">
              {myCertificates.map((certificate) => (
                <CertificateCard key={certificate.id} item={certificate} />
              ))}
              {!myCertificates.length && <EmptyState title="Sin certificados" text="Los certificados emitidos por RRHH/LMS apareceran aqui." />}
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Avatar({ employee }: { employee?: Employee }) {
  if (employee?.photo_url) {
    return <img src={employee.photo_url} alt={employee.employee_name} className="h-16 w-16 rounded-2xl object-cover" />;
  }
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/15 text-2xl font-black text-cyan-100">
      {(employee?.employee_name || "E").slice(0, 1)}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function Kpi({ title, value, icon, tone }: { title: string; value: ReactNode; icon: ReactNode; tone: "cyan" | "blue" | "green" | "amber" | "violet" }) {
  const tones = {
    cyan: "border-cyan-300/20 bg-cyan-500/10 text-cyan-200",
    blue: "border-blue-300/20 bg-blue-500/10 text-blue-200",
    green: "border-emerald-300/20 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-300/20 bg-amber-500/10 text-amber-200",
    violet: "border-violet-300/20 bg-violet-500/10 text-violet-200",
  };
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-xl">
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border ${tones[tone]}`}>{icon}</div>
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">{title}</p>
      <p className="mt-1 truncate text-2xl font-black">{value}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.92))] p-5 shadow-2xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
          {icon}
        </div>
        <h2 className="text-2xl font-black tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Info({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/75 p-4">
      <div className="mb-2 flex items-center gap-2 text-cyan-200">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">{label}</p>
      </div>
      <p className="break-words text-base font-black text-white">{value}</p>
    </div>
  );
}

function ActionCard({ title, text, icon, onClick }: { title: string; text: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-left transition hover:-translate-y-0.5 hover:bg-cyan-400/15"
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950">
        {icon}
      </div>
      <p className="text-lg font-black text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{text}</p>
    </button>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
      <Search size={18} className="text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
      />
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/50 p-6 text-center">
      <CheckCircle2 className="mx-auto mb-3 text-emerald-300" size={26} />
      <p className="font-black text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{text}</p>
    </div>
  );
}

function RequestCard({ item }: { item: RequestRow }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="break-words font-black text-white">{item.request_code} - {item.title}</p>
          <p className="text-xs font-semibold text-slate-400">
            {normalizeStatus(item.request_type)} - {formatDate(item.start_date)} a {formatDate(item.end_date)}
          </p>
          {item.description && <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>}
          {item.response_notes && <p className="mt-2 text-sm leading-6 text-emerald-200">{item.response_notes}</p>}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusClass(item.status)}`}>
          {normalizeStatus(item.status)}
        </span>
      </div>
    </div>
  );
}

function DocumentCard({
  item,
  onSign,
  onPrint,
  compact = false,
}: {
  item: DocRow;
  onSign: (doc: DocRow) => void;
  onPrint: (doc: DocRow) => void;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="break-words font-black text-white">{item.document_code}</p>
          <p className="text-xs font-semibold text-slate-400">{normalizeStatus(item.document_type)} - {item.title}</p>
          {!compact && item.description && <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>}
          <p className="mt-2 text-xs font-semibold text-slate-500">Firma: {item.signed_at ? formatDate(item.signed_at) : "Pendiente"}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <span className={`rounded-full border px-3 py-2 text-xs font-black uppercase ${statusClass(item.status)}`}>
            {normalizeStatus(item.status)}
          </span>
          <button onClick={() => onPrint(item)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500">
            <Download size={14} />
            Imprimir
          </button>
          {item.requires_signature && item.status !== "firmado" && (
            <button onClick={() => onSign(item)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-500">
              <FileSignature size={14} />
              Firmar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CourseCard({ item }: { item: Enrollment }) {
  const progress = Math.min(100, Math.max(0, Number(item.progress_percent || 0)));
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="break-words text-lg font-black text-white">{item.course_code} - {item.course_title}</p>
          <p className="text-xs font-semibold text-slate-400">Vence: {formatDate(item.due_date)}</p>
          <p className="mt-2 text-sm text-slate-300">
            {item.lessons_completed}/{item.lessons_total} lecciones - score {Number(item.final_score || 0).toFixed(1)}
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-cyan-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="min-w-[110px] text-left lg:text-right">
          <p className="text-3xl font-black text-cyan-200">{progress.toFixed(0)}%</p>
          <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-black uppercase ${statusClass(item.status)}`}>
            {normalizeStatus(item.status)}
          </span>
        </div>
      </div>
    </div>
  );
}

function CertificateCard({ item }: { item: Certificate }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="break-words text-lg font-black text-white">{item.certificate_code}</p>
          <p className="text-xs font-semibold text-slate-400">{item.course_code} - {item.course_title}</p>
          <p className="mt-2 text-sm text-slate-300">
            Emitido {formatDate(item.issued_at)} - vence {formatDate(item.expires_at)} - score {Number(item.final_score || 0).toFixed(1)}
          </p>
          <p className="mt-2 break-all text-xs text-slate-500">Token: {item.token}</p>
        </div>
        <span className={`rounded-full border px-3 py-2 text-xs font-black uppercase ${statusClass(item.status)}`}>
          {normalizeStatus(item.status)}
        </span>
      </div>
    </div>
  );
}
