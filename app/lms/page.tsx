"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Medal,
  PlayCircle,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Tab = "dashboard" | "cursos" | "inscripciones" | "certificados" | "competencias" | "examenes";

type Dashboard = {
  active_courses: number;
  lessons: number;
  enrollments: number;
  completed_enrollments: number;
  active_certificates: number;
  avg_progress: number;
  avg_score: number;
  certificates_expiring_soon: number;
};

type Course = {
  id: string;
  code: string;
  title: string;
  category: string | null;
  department: string | null;
  target_position: string | null;
  description: string | null;
  competency_code: string | null;
  competency_name: string | null;
  level: string;
  duration_hours: number;
  passing_score: number;
  certificate_valid_months: number;
  status: string;
  lessons_count: number;
  enrollments_count: number;
  completed_count: number;
};

type Enrollment = {
  id: string;
  course_id: string;
  employee_id: string;
  course_code: string;
  course_title: string;
  category: string | null;
  course_department: string | null;
  level: string;
  duration_hours: number;
  passing_score: number;
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
  category: string | null;
  issued_at: string;
  expires_at: string | null;
  final_score: number;
  token: string;
  status: string;
};

type Competency = {
  employee_id: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position: string | null;
  competency_code: string;
  competency_name: string;
  category: string | null;
  certificates_count: number;
  best_score: number | null;
  latest_expiration: string | null;
  competency_status: string;
};

type Exam = {
  id: string;
  course_code: string;
  course_title: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  attempt_number: number;
  score: number;
  passed: boolean;
  submitted_at: string;
};

function statusClass(value?: string | null) {
  if (["activo", "completado", "vigente", "certificado"].includes(value || "")) return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
  if (["asignado", "en_progreso", "pendiente"].includes(value || "")) return "border-blue-400/30 bg-blue-500/15 text-blue-300";
  if (["vencido", "cancelado", "anulado"].includes(value || "")) return "border-red-400/30 bg-red-500/15 text-red-300";
  return "border-slate-500/30 bg-slate-500/15 text-slate-300";
}

export default function LMSProPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard>({
    active_courses: 0,
    lessons: 0,
    enrollments: 0,
    completed_enrollments: 0,
    active_certificates: 0,
    avg_progress: 0,
    avg_score: 0,
    certificates_expiring_soon: 0,
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");

      const [dashRes, courseRes, enrollRes, certRes, compRes, examRes] = await Promise.all([
        supabase.from("v_hr_lms_dashboard").select("*").maybeSingle(),
        supabase.from("v_hr_lms_courses_detail").select("*").order("title"),
        supabase.from("v_hr_lms_enrollments_detail").select("*").order("enrolled_at", { ascending: false }),
        supabase.from("v_hr_lms_certificates_detail").select("*").order("issued_at", { ascending: false }),
        supabase.from("v_hr_lms_competency_matrix").select("*").order("employee_name"),
        supabase.from("v_hr_lms_exam_attempts_detail").select("*").order("submitted_at", { ascending: false }),
      ]);

      if (dashRes.error) throw dashRes.error;
      if (courseRes.error) throw courseRes.error;
      if (enrollRes.error) throw enrollRes.error;
      if (certRes.error) throw certRes.error;
      if (compRes.error) throw compRes.error;
      if (examRes.error) throw examRes.error;

      if (dashRes.data) setDashboard(dashRes.data as Dashboard);
      setCourses((courseRes.data || []) as Course[]);
      setEnrollments((enrollRes.data || []) as Enrollment[]);
      setCertificates((certRes.data || []) as Certificate[]);
      setCompetencies((compRes.data || []) as Competency[]);
      setExams((examRes.data || []) as Exam[]);
    } catch (error: any) {
      setMessage(error.message || "Error cargando LMS Pro.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredEnrollments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrollments;
    return enrollments.filter((e) =>
      [e.employee_code, e.employee_name, e.department, e.position, e.course_code, e.course_title, e.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [enrollments, search]);

  async function completeEnrollment(enrollment: Enrollment) {
    try {
      setLoading(true);

      const { data: lessons, error: lessonErr } = await supabase
        .from("hr_lms_progress")
        .select("lesson_id")
        .eq("enrollment_id", enrollment.id);

      if (lessonErr) throw lessonErr;

      for (const lesson of lessons || []) {
        const { error } = await supabase.rpc("hr_lms_complete_lesson", {
          p_enrollment_id: enrollment.id,
          p_lesson_id: lesson.lesson_id,
        });
        if (error) throw error;
      }

      await supabase
        .from("hr_lms_enrollments")
        .update({ final_score: Math.max(Number(enrollment.final_score || 0), Number(enrollment.passing_score || 80)) })
        .eq("id", enrollment.id);

      const { error: certErr } = await supabase.rpc("hr_lms_issue_certificate", {
        p_enrollment_id: enrollment.id,
      });
      if (certErr) throw certErr;

      setMessage("Curso completado y certificado generado.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo completar el curso.");
    } finally {
      setLoading(false);
    }
  }

  function printCertificate(c: Certificate) {
    const html = `
      <html>
      <head>
        <title>${c.certificate_code}</title>
        <style>
          body{font-family:Arial;margin:40px;color:#0f172a;background:#f8fafc}
          .cert{border:8px solid #1d4ed8;border-radius:28px;padding:42px;max-width:920px;margin:auto;background:white;text-align:center}
          .brand{letter-spacing:6px;color:#2563eb;font-weight:800}
          h1{font-size:42px;margin:20px 0}
          h2{font-size:30px;margin:10px 0}
          .muted{color:#475569}
          .score{font-size:28px;font-weight:900;color:#059669}
          .footer{margin-top:40px;font-size:12px;color:#64748b}
        </style>
      </head>
      <body>
        <div class="cert">
          <div class="brand">RD WOOD SYSTEM PRO</div>
          <h1>Certificado de Capacitación</h1>
          <p class="muted">Se certifica que</p>
          <h2>${c.employee_name}</h2>
          <p class="muted">ha completado satisfactoriamente el curso</p>
          <h2>${c.course_title}</h2>
          <p class="score">Score: ${Number(c.final_score || 0).toFixed(1)}</p>
          <p>Código: <b>${c.certificate_code}</b></p>
          <p>Válido hasta: <b>${c.expires_at || "N/A"}</b></p>
          <div class="footer">Token de validación: ${c.token}</div>
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
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "cursos", label: "Cursos", icon: BookOpen },
    { id: "inscripciones", label: "Inscripciones", icon: Users },
    { id: "certificados", label: "Certificados", icon: Award },
    { id: "competencias", label: "Competencias", icon: Target },
    { id: "examenes", label: "Exámenes", icon: ClipboardCheck },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300">RD Wood System</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-5xl">
                LMS Pro · Universidad Corporativa
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Fase 23: cursos, lecciones, inscripciones, exámenes, certificados digitales y matriz de competencias.
              </p>
            </div>

            <button
              onClick={loadData}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-500"
            >
              <RefreshCw size={18} />
              Actualizar
            </button>
          </div>
        </section>

        {message && (
          <div className="mb-4 rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
            {message}
          </div>
        )}

        {loading && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            Procesando...
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-8">
          <Kpi title="Cursos activos" value={dashboard.active_courses} icon={<BookOpen size={20} />} />
          <Kpi title="Lecciones" value={dashboard.lessons} icon={<PlayCircle size={20} />} />
          <Kpi title="Inscripciones" value={dashboard.enrollments} icon={<Users size={20} />} />
          <Kpi title="Completados" value={dashboard.completed_enrollments} icon={<CheckCircle2 size={20} />} />
          <Kpi title="Certificados" value={dashboard.active_certificates} icon={<Award size={20} />} />
          <Kpi title="Progreso" value={`${Number(dashboard.avg_progress || 0).toFixed(1)}%`} icon={<BarChart3 size={20} />} />
          <Kpi title="Score" value={Number(dashboard.avg_score || 0).toFixed(1)} icon={<Trophy size={20} />} />
          <Kpi title="Vencen pronto" value={dashboard.certificates_expiring_soon} icon={<ShieldCheck size={20} />} />
        </section>

        <section className="mb-6 flex gap-2 overflow-x-auto rounded-3xl border border-white/10 bg-white/5 p-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id as Tab)}
                className={`flex min-w-max items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${
                  active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </section>

        {tab === "inscripciones" && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empleado, curso, departamento..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </div>
        )}

        {tab === "dashboard" && (
          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="Últimas inscripciones" icon={<GraduationCap size={20} />}>
              <div className="space-y-3">
                {enrollments.slice(0, 8).map((e) => (
                  <EnrollmentCard key={e.id} item={e} onComplete={completeEnrollment} />
                ))}
                {!enrollments.length && <p className="text-sm text-slate-400">No hay inscripciones.</p>}
              </div>
            </Panel>

            <Panel title="Cursos activos" icon={<BookOpen size={20} />}>
              <div className="space-y-3">
                {courses.slice(0, 8).map((c) => <CourseCard key={c.id} item={c} />)}
                {!courses.length && <p className="text-sm text-slate-400">No hay cursos.</p>}
              </div>
            </Panel>
          </section>
        )}

        {tab === "cursos" && (
          <Panel title="Catálogo de cursos" icon={<BookOpen size={20} />}>
            <div className="grid gap-3 lg:grid-cols-2">
              {courses.map((c) => <CourseCard key={c.id} item={c} />)}
            </div>
          </Panel>
        )}

        {tab === "inscripciones" && (
          <Panel title="Inscripciones y progreso" icon={<Users size={20} />}>
            <div className="space-y-3">
              {filteredEnrollments.map((e) => (
                <EnrollmentCard key={e.id} item={e} onComplete={completeEnrollment} />
              ))}
            </div>
          </Panel>
        )}

        {tab === "certificados" && (
          <Panel title="Certificados digitales" icon={<Award size={20} />}>
            <div className="space-y-3">
              {certificates.map((c) => (
                <div key={c.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{c.certificate_code} · {c.employee_name}</p>
                      <p className="text-xs text-slate-400">{c.course_code} · {c.course_title}</p>
                      <p className="mt-2 text-sm text-slate-300">Score {Number(c.final_score || 0).toFixed(1)} · vence {c.expires_at || "N/A"}</p>
                      <p className="mt-1 text-xs text-slate-500">Token: {c.token}</p>
                    </div>
                    <div className="flex flex-col gap-2 lg:items-end">
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(c.status)}`}>
                        {c.status}
                      </span>
                      <button
                        onClick={() => printCertificate(c)}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500"
                      >
                        <Printer size={14} />
                        Imprimir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!certificates.length && <p className="text-sm text-slate-400">No hay certificados.</p>}
            </div>
          </Panel>
        )}

        {tab === "competencias" && (
          <Panel title="Matriz de competencias" icon={<Target size={20} />}>
            <div className="space-y-3">
              {competencies.map((c) => (
                <div key={`${c.employee_id}-${c.competency_code}`} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{c.employee_code} · {c.employee_name}</p>
                      <p className="text-xs text-slate-400">{c.department} · {c.position}</p>
                      <p className="mt-2 text-sm text-white">{c.competency_code} · {c.competency_name}</p>
                      <p className="mt-1 text-xs text-slate-500">Mejor score: {c.best_score || 0} · vence {c.latest_expiration || "N/A"}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(c.competency_status)}`}>
                      {c.competency_status}
                    </span>
                  </div>
                </div>
              ))}
              {!competencies.length && <p className="text-sm text-slate-400">No hay competencias.</p>}
            </div>
          </Panel>
        )}

        {tab === "examenes" && (
          <Panel title="Intentos de examen" icon={<ClipboardCheck size={20} />}>
            <div className="space-y-3">
              {exams.map((x) => (
                <div key={x.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{x.employee_code} · {x.employee_name}</p>
                      <p className="text-xs text-slate-400">{x.course_code} · {x.course_title}</p>
                      <p className="mt-2 text-sm text-slate-300">Intento #{x.attempt_number}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${x.passed ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300" : "border-red-400/30 bg-red-500/15 text-red-300"}`}>
                      {Number(x.score || 0).toFixed(1)} · {x.passed ? "aprobado" : "falló"}
                    </span>
                  </div>
                </div>
              ))}
              {!exams.length && <p className="text-sm text-slate-400">No hay exámenes todavía.</p>}
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function CourseCard({ item }: { item: Course }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-black">{item.code} · {item.title}</p>
          <p className="text-xs text-slate-400">{item.department || "General"} · {item.target_position || "Todo el equipo"} · {item.level}</p>
          <p className="mt-2 text-sm text-slate-300">{item.description}</p>
          <p className="mt-1 text-xs text-slate-500">
            {item.lessons_count} lecciones · {item.duration_hours} h · pass {item.passing_score}%
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>
          {item.status}
        </span>
      </div>
    </div>
  );
}

function EnrollmentCard({ item, onComplete }: { item: Enrollment; onComplete: (e: Enrollment) => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <p className="font-black">{item.employee_code} · {item.employee_name}</p>
          <p className="text-xs text-slate-400">{item.department} · {item.position}</p>
          <p className="mt-2 text-sm text-white">{item.course_code} · {item.course_title}</p>
          <p className="mt-1 text-xs text-slate-400">
            {item.lessons_completed}/{item.lessons_total} lecciones · vence {item.due_date || "N/A"} · score {Number(item.final_score || 0).toFixed(1)}
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${Number(item.progress_percent || 0)}%` }} />
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
          <p className="text-2xl font-black text-emerald-300">{Number(item.progress_percent || 0).toFixed(0)}%</p>
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>
            {item.status}
          </span>
          {item.status !== "completado" && (
            <button
              onClick={() => onComplete(item)}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-500"
            >
              Completar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ title, value, icon }: { title: string; value: any; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
        {icon}
      </div>
      <p className="text-xs uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
          {icon}
        </div>
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}
