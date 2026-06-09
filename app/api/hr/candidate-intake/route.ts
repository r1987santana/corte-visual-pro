import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/security/api-guard";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

function text(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function numberValue(value: FormDataEntryValue | null) {
  const parsed = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function candidateCode() {
  const day = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CAND-${day}-${suffix}`;
}

function candidateNotes(formData: FormData) {
  const lines = [
    ["Posicion deseada", text(formData.get("desired_position"))],
    ["Direccion", text(formData.get("address"))],
    ["Disponibilidad", text(formData.get("availability"))],
    ["Horario disponible", text(formData.get("schedule"))],
    ["Nivel academico", text(formData.get("education_level"))],
    ["Habilidades", text(formData.get("skills"))],
    ["Referencia", text(formData.get("reference_name"))],
    ["Telefono referencia", text(formData.get("reference_phone"))],
    ["Mensaje", text(formData.get("notes"))],
  ].filter(([, value]) => value);

  return lines.map(([label, value]) => `${label}: ${value}`).join("\n");
}

async function recalculateApplicationScore(supabase: any, applicationId: string) {
  const attempts = [
    supabase.rpc("hr_ats_recalculate_application_score", { p_application_id: applicationId }),
    supabase.rpc("calculate_application_score", { p_application_id: applicationId }),
  ];

  const results = await Promise.allSettled(attempts);
  const firstOk = results.find((result) => result.status === "fulfilled" && !result.value?.error);
  if (!firstOk) {
    console.warn("No se pudo recalcular score ATS para aplicacion publica.", applicationId);
  }
}

async function uploadCv(file: File | null, candidateName: string) {
  if (!file || file.size <= 0) return "";
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("El archivo no puede pasar de 8 MB.");
  }

  const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "pdf";
  const safeName = candidateName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "candidato";
  const path = `candidate-intake/${Date.now()}-${safeName}.${extension}`;

  const supabase = getServiceSupabase();
  const { error } = await supabase.storage.from("employee-files").upload(path, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });

  if (error) throw new Error(`No se pudo subir el CV: ${error.message}`);
  const { data } = supabase.storage.from("employee-files").getPublicUrl(path);
  return data.publicUrl;
}

export async function GET(req: Request) {
  try {
    const limit = checkRateLimit(req, {
      key: "hr-candidate-jobs",
      limit: 240,
      windowMs: 60 * 1000,
    });
    if (!limit.allowed) return rateLimitResponse(limit);

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("hr_job_openings")
      .select("id,code,title,department,position_title,employment_type,location,status,min_salary,max_salary,requirements,benefits")
      .eq("status", "abierta")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ ok: true, jobs: data || [] });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "No se pudieron cargar las vacantes." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ipLimit = checkRateLimit(req, {
      key: "hr-candidate-post-ip",
      limit: 12,
      windowMs: 60 * 60 * 1000,
    });
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit);

    const formData = await req.formData();
    const honeypot = text(formData.get("website"));
    if (honeypot) {
      return NextResponse.json({ ok: true, message: "Solicitud recibida." });
    }

    const fullName = text(formData.get("full_name"));
    const phone = text(formData.get("phone"));
    const email = text(formData.get("email"));
    let desiredPosition = text(formData.get("desired_position"));
    const jobId = text(formData.get("job_opening_id"));

    if (!fullName) {
      return NextResponse.json({ ok: false, error: "Escribe tu nombre completo." }, { status: 400 });
    }

    if (!phone && !email) {
      return NextResponse.json({ ok: false, error: "Necesitamos telefono o correo para contactarte." }, { status: 400 });
    }

    const contactLimit = checkRateLimit(req, {
      key: `hr-candidate-contact:${email || phone}`,
      limit: 4,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!contactLimit.allowed) return rateLimitResponse(contactLimit);

    const supabase = getServiceSupabase();

    if (!desiredPosition && jobId) {
      const { data: job, error: jobError } = await supabase
        .from("hr_job_openings")
        .select("title,position_title")
        .eq("id", jobId)
        .maybeSingle();

      if (jobError) throw jobError;
      desiredPosition = text(job?.position_title || job?.title || "");
    }

    if (!desiredPosition) {
      return NextResponse.json({ ok: false, error: "Selecciona el puesto que buscas." }, { status: 400 });
    }

    const cvFile = formData.get("cv_file");
    const cvUrl =
      cvFile instanceof File
        ? await uploadCv(cvFile, fullName)
        : text(formData.get("cv_url"));

    const notes = candidateNotes(formData);

    const { data: candidate, error: candidateError } = await supabase
      .from("hr_candidates")
      .insert({
        candidate_code: candidateCode(),
        full_name: fullName,
        email: email || null,
        phone: phone || null,
        source: "portal_candidatos",
        current_position: desiredPosition || text(formData.get("current_position")) || null,
        years_experience: numberValue(formData.get("years_experience")),
        expected_salary: numberValue(formData.get("expected_salary")),
        city: text(formData.get("city")) || null,
        cv_url: cvUrl || null,
        portfolio_url: text(formData.get("portfolio_url")) || null,
        status: "activo",
        ai_score: 0,
        notes: notes || null,
      })
      .select("id,candidate_code,full_name")
      .single();

    if (candidateError) throw candidateError;

    let application = null;
    if (jobId) {
      const { data: app, error: appError } = await supabase
        .from("hr_applications")
        .insert({
          job_opening_id: jobId,
          candidate_id: candidate.id,
          stage: "nuevo",
          status: "activo",
          match_score: 50,
          final_score: 50,
          salary_fit_score: 0,
          experience_score: 0,
          culture_score: 0,
          notes: "Aplicacion creada desde el formulario publico de captacion.",
        })
        .select("id")
        .single();

      if (appError) throw appError;
      application = app;

      await recalculateApplicationScore(supabase, app.id);
    }

    return NextResponse.json({
      ok: true,
      message: "Solicitud recibida. RRHH revisara tu perfil.",
      candidate,
      application,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "No se pudo registrar la solicitud." }, { status: 500 });
  }
}
