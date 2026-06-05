"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, BadgeCheck, Camera, CheckCircle2, Clock,
  Loader2, LogIn, LogOut, RefreshCw, ShieldCheck, UserCheck, UserRound,
  Users, Video
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  employee_code?: string | null;
  full_name: string;
  department?: string | null;
  position?: string | null;
  status?: string | null;
  photo_url?: string | null;
};

type FaceProfile = {
  id: string;
  employee_id: string;
  embedding: number[];
  samples_count?: number | null;
  quality_score?: number | null;
  status?: string | null;
  employees?: Employee;
};

type AttendanceEvent = {
  id: string;
  employee_id: string;
  event_type: string;
  event_label?: string | null;
  confidence_score?: number | null;
  photo_url?: string | null;
  device_name?: string | null;
  location_text?: string | null;
  created_at: string;
  employees?: Employee;
};

const MODEL_URL = "https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js/weights";
const MATCH_THRESHOLD = 0.72;
const MIN_CONFIDENCE = 55;
const AUTO_SCAN_MS = 2000;
const COOLDOWN_MS = 60000;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function time(value: any) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "-";
  }
}

function distance(a: number[], b: number[]) {
  if (!a.length || !b.length || a.length !== b.length) return 999;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Number(a[i]) - Number(b[i]);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function confidenceFromDistance(d: number) {
  return Math.max(0, Math.min(100, Math.round((100 - d * 120) * 10) / 10));
}

function nextEventType(last?: string | null) {
  if (!last) return "check_in";
  if (last === "check_in") return "lunch_out";
  if (last === "lunch_out") return "lunch_in";
  if (last === "lunch_in") return "check_out";
  return "check_in";
}

function eventLabel(type: string) {
  const labels: Record<string, string> = {
    check_in: "Entrada",
    lunch_out: "Salida almuerzo",
    lunch_in: "Regreso almuerzo",
    check_out: "Salida",
  };
  return labels[type] || type;
}

function eventIcon(type: string) {
  if (type === "check_in" || type === "lunch_in") return <LogIn size={20} />;
  return <LogOut size={20} />;
}

async function uploadAttendancePhoto(employeeId: string, dataUrl: string) {
  const blob = await fetch(dataUrl).then((res) => res.blob());
  const path = `${employeeId}/attendance/${todayISO()}-${Date.now()}.jpg`;

  const { error } = await supabase.storage.from("employee-attendance").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("employee-attendance").getPublicUrl(path);
  return data.publicUrl;
}

export default function EstacionPoncheFacialTabletaPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanningRef = useRef(false);
  const lastPunchRef = useRef<Record<string, number>>({});

  const [faceapi, setFaceapi] = useState<any>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [autoMode, setAutoMode] = useState(true);

  const [profiles, setProfiles] = useState<FaceProfile[]>([]);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingPunch, setSavingPunch] = useState(false);
  const [message, setMessage] = useState("Inicializando estación facial...");
  const [lastMatch, setLastMatch] = useState<{
    employee: Employee;
    confidence: number;
    event_type: string;
    photo_url?: string;
  } | null>(null);

  const todayEvents = events.filter((e) => String(e.created_at).slice(0, 10) === todayISO());

  const stats = useMemo(() => {
    const employeeIds = new Set(todayEvents.map((e) => e.employee_id));
    const checkIns = todayEvents.filter((e) => e.event_type === "check_in").length;
    const checkOuts = todayEvents.filter((e) => e.event_type === "check_out").length;
    const lunches = todayEvents.filter((e) => e.event_type === "lunch_out" || e.event_type === "lunch_in").length;
    return { registeredFaces: profiles.length, present: employeeIds.size, checkIns, checkOuts, lunches };
  }, [profiles, todayEvents]);

  async function loadData() {
    setLoading(true);
    try {
      const [profilesRes, eventsRes] = await Promise.all([
        supabase.from("employee_face_profiles").select("*, employees(*)").eq("status", "activo"),
        supabase
          .from("employee_attendance_events")
          .select("*, employees(*)")
          .gte("created_at", `${todayISO()}T00:00:00`)
          .order("created_at", { ascending: false })
          .limit(120),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (eventsRes.error) throw eventsRes.error;

      setProfiles((profilesRes.data || []) as FaceProfile[]);
      setEvents((eventsRes.data || []) as AttendanceEvent[]);
    } catch (error: any) {
      setMessage(error.message || "Error cargando datos de asistencia.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function boot() {
      try {
        setMessage("Cargando modelos IA...");
        const api = await import("@vladmandic/face-api");
        setFaceapi(api);

        await Promise.all([
          api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          api.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        setModelsLoaded(true);
        setMessage("Modelos IA cargados. Estación lista.");
        await loadData();
      } catch {
        setMessage("No se pudieron cargar los modelos IA. Revisa internet o CDN.");
      }
    }
    boot();
  }, []);

  useEffect(() => {
    if (modelsLoaded) startCamera();
    return () => stopCamera();
  }, [modelsLoaded]);

  useEffect(() => {
    if (!cameraOn || !modelsLoaded || !autoMode) return;
    const id = window.setInterval(() => scanAndPunch(), AUTO_SCAN_MS);
    return () => window.clearInterval(id);
  }, [cameraOn, modelsLoaded, autoMode, profiles, events]);

  async function startCamera() {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOn(true);
      setMessage("Estación activa. Mire la cámara para ponchar.");
    } catch {
      setMessage("No se pudo abrir la cámara. Revisa permisos de la tableta.");
    }
  }

  function stopCamera() {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return "";

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  async function detectDescriptor() {
    if (!faceapi || !videoRef.current) throw new Error("IA no lista.");
    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.55 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;

    const box = detection.detection.box;
    const videoArea = (videoRef.current.videoWidth || 640) * (videoRef.current.videoHeight || 480);
    const ratio = (box.width * box.height) / videoArea;
    if (ratio < 0.035 || ratio > 0.75) return null;

    return Array.from(detection.descriptor).map(Number);
  }

  function findBestMatch(descriptor: number[]) {
    let best: { profile: FaceProfile; d: number; confidence: number } | null = null;
    for (const profile of profiles) {
      const embedding = Array.isArray(profile.embedding) ? profile.embedding.map(Number) : [];
      const d = distance(descriptor, embedding);
      const confidence = confidenceFromDistance(d);
      if (!best || d < best.d) best = { profile, d, confidence };
    }
    if (!best) return null;
    if (best.d > MATCH_THRESHOLD || best.confidence < MIN_CONFIDENCE) return null;
    return best;
  }

  function lastEventForEmployee(employeeId: string) {
    return [...events]
      .filter((e) => e.employee_id === employeeId && String(e.created_at).slice(0, 10) === todayISO())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  }

  async function scanAndPunch() {
    if (scanningRef.current || savingPunch || !cameraOn || !modelsLoaded) return;
    if (!profiles.length) {
      setMessage("No hay rostros registrados para ponchar.");
      return;
    }

    scanningRef.current = true;
    try {
      const descriptor = await detectDescriptor();
      if (!descriptor) {
        setMessage("Esperando rostro claro frente a la cámara...");
        return;
      }

      const match = findBestMatch(descriptor);
      if (!match || !match.profile.employees) {
        setMessage("Rostro no reconocido. Registre el rostro en RRHH.");
        return;
      }

      const employee = match.profile.employees;
      const lastTime = lastPunchRef.current[employee.id] || 0;
      const now = Date.now();

      if (now - lastTime < COOLDOWN_MS) {
        setMessage(`Ponche reciente de ${employee.full_name}. Espere unos segundos.`);
        return;
      }

      await registerPunch(employee, match.confidence);
      lastPunchRef.current[employee.id] = now;
    } catch (error: any) {
      setMessage(error.message || "Error escaneando rostro.");
    } finally {
      scanningRef.current = false;
    }
  }

  async function registerPunch(employee: Employee, confidence: number) {
    setSavingPunch(true);

    try {
      const last = lastEventForEmployee(employee.id);
      const event_type = nextEventType(last?.event_type);

      // 1) Guardamos primero el ponche en la base de datos.
      //    Esto evita que un fallo subiendo la foto bloquee la asistencia.
      const payload = {
        employee_id: employee.id,
        event_type,
        event_label: eventLabel(event_type),
        confidence_score: confidence,
        photo_url: null,
        device_name: navigator.userAgent.slice(0, 180),
        location_text: "Estación facial RD Wood",
      };

      const { data, error } = await supabase
        .from("employee_attendance_events")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Error guardando ponche:", error);
        throw error;
      }

      // 2) Intentamos subir la foto después.
      //    Si falla el bucket, el ponche ya quedó guardado.
      let photo_url: string | null = null;

      try {
        const photoData = captureFrame();
        photo_url = photoData ? await uploadAttendancePhoto(employee.id, photoData) : null;

        if (photo_url && data?.id) {
          const { error: updateError } = await supabase
            .from("employee_attendance_events")
            .update({ photo_url })
            .eq("id", data.id);

          if (updateError) {
            console.warn("Ponche guardado, pero no se pudo actualizar la foto:", updateError);
          }
        }
      } catch (photoError) {
        console.warn("Ponche guardado, pero no se pudo subir la foto:", photoError);
      }

      console.log("Ponche guardado correctamente:", data);

      setLastMatch({
        employee,
        confidence,
        event_type,
        photo_url: photo_url || undefined,
      });

      setMessage(
        `✅ ${eventLabel(event_type)} registrada: ${employee.full_name} (${confidence.toFixed(1)}%)`
      );

      await loadData();
    } catch (error: any) {
      console.error("Error en registerPunch:", error);
      setMessage(error?.message || "No se pudo registrar el ponche.");
      alert(error?.message || "No se pudo registrar el ponche.");
    } finally {
      setSavingPunch(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020817] p-4 text-white md:p-6">
      <div className="mx-auto w-full max-w-[1760px] space-y-5">
        <section className="rounded-3xl border border-cyan-900/50 bg-gradient-to-br from-[#081421] via-[#0b1830] to-[#111b3f] p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 md:flex">
                <Video size={34} />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.30em] text-cyan-300">
                  <BadgeCheck size={14} /> FASE 8.2.3
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Estación de Ponche Facial</h1>
                <p className="mt-2 max-w-4xl text-sm text-slate-300">
                  Modo tableta: reconocimiento facial automático sin PIN para entrada, almuerzo y salida.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setAutoMode(!autoMode)}
                className={cx("inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black", autoMode ? "bg-emerald-600 text-white" : "border border-slate-700 bg-[#030817] text-slate-200")}
              >
                <Activity size={18} />
                {autoMode ? "Auto ON" : "Auto OFF"}
              </button>

              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-5 text-sm font-black text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                Actualizar
              </button>
            </div>
          </div>
        </section>

        <div className={cx(
          "rounded-2xl border p-4 text-sm font-black",
          message.includes("✅") ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" :
          message.includes("No") || message.includes("Error") ? "border-amber-400/30 bg-amber-500/10 text-amber-100" :
          "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
        )}>
          {savingPunch ? <Loader2 className="mr-2 inline animate-spin" size={16} /> : null}
          {message}
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi title="Modelos IA" value={modelsLoaded ? "ON" : "OFF"} subtitle="face-api.js" icon={<ShieldCheck />} tone={modelsLoaded ? "green" : "red"} />
          <Kpi title="Cámara" value={cameraOn ? "ON" : "OFF"} subtitle="Tableta kiosko" icon={<Camera />} tone={cameraOn ? "green" : "red"} />
          <Kpi title="Rostros" value={stats.registeredFaces} subtitle="Registrados" icon={<Users />} tone="cyan" />
          <Kpi title="Presentes hoy" value={stats.present} subtitle={`${stats.checkIns} entradas`} icon={<UserCheck />} tone="green" />
          <Kpi title="Ponches hoy" value={todayEvents.length} subtitle={`${stats.checkOuts} salidas · ${stats.lunches} almuerzo`} icon={<Clock />} tone="purple" />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
          <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-black"><Camera className="text-cyan-300" /> Cámara de ponche</h2>
                <p className="text-sm text-slate-400">El empleado solo debe mirar la cámara.</p>
              </div>

              <div className="flex gap-2">
                {!cameraOn ? (
                  <button onClick={startCamera} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Activar cámara</button>
                ) : (
                  <button onClick={stopCamera} className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white">Apagar cámara</button>
                )}

                <button
                  onClick={scanAndPunch}
                  disabled={!modelsLoaded || !cameraOn || savingPunch}
                  className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  Escanear ahora
                </button>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-black">
              <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />

              {!cameraOn ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/75 text-center">
                  <div>
                    <Camera className="mx-auto mb-3 text-slate-500" size={70} />
                    <p className="font-black text-slate-300">Cámara apagada</p>
                  </div>
                </div>
              ) : null}

              {lastMatch ? (
                <div className="absolute bottom-5 left-5 right-5 rounded-3xl border border-emerald-400/40 bg-emerald-950/90 p-5 shadow-2xl">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-emerald-400/40 bg-emerald-500/10">
                      {lastMatch.employee.photo_url ? <img src={lastMatch.employee.photo_url} className="h-full w-full object-cover" /> : <UserRound className="text-emerald-300" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-2xl font-black text-white">{lastMatch.employee.full_name}</p>
                      <p className="text-sm text-emerald-200">{eventLabel(lastMatch.event_type)} registrada · Confianza {lastMatch.confidence.toFixed(1)}%</p>
                    </div>
                    <CheckCircle2 className="text-emerald-300" size={44} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-black"><ShieldCheck className="text-cyan-300" /> Estado de estación</h2>
              <div className="space-y-3">
                <Rule ok={modelsLoaded} text="Modelos IA cargados" />
                <Rule ok={cameraOn} text="Cámara activa" />
                <Rule ok={autoMode} text="Modo automático activo" />
                <Rule ok={profiles.length > 0} text={`${profiles.length} rostro(s) registrados`} />
              </div>

              <div className="mt-5 rounded-2xl border border-slate-800 bg-[#030817] p-4 text-sm text-slate-400">
                <p className="font-black text-cyan-300">Secuencia automática</p>
                <p className="mt-2">Entrada → Salida almuerzo → Regreso almuerzo → Salida.</p>
              </div>
            </section>

            <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-black"><Clock className="text-cyan-300" /> Últimos ponches</h2>
              <div className="max-h-[620px] space-y-3 overflow-auto pr-1">
                {todayEvents.map((e) => (
                  <div key={e.id} className="rounded-2xl border border-slate-800 bg-[#030817] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-500/10 text-cyan-300">{eventIcon(e.event_type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black">{e.employees?.full_name || e.employee_id}</p>
                        <p className="text-xs text-slate-400">{eventLabel(e.event_type)} · {time(e.created_at)} · {Number(e.confidence_score || 0).toFixed(1)}%</p>
                      </div>
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-300">OK</span>
                    </div>
                  </div>
                ))}
                {!todayEvents.length ? <Empty text="Aún no hay ponches hoy." /> : null}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Kpi({ title, value, subtitle, icon, tone = "cyan" }: { title: string; value: string | number; subtitle?: string; icon: React.ReactNode; tone?: "cyan" | "green" | "red" | "purple"; }) {
  const tones: Record<string, string> = {
    cyan: "border-cyan-400/25 bg-cyan-500/10 text-cyan-300",
    green: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
    red: "border-red-400/25 bg-red-500/10 text-red-300",
    purple: "border-purple-400/25 bg-purple-500/10 text-purple-300",
  };

  return (
    <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] via-[#07111f] to-[#030817] p-5 shadow-xl shadow-black/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{title}</p>
          <h3 className="mt-3 text-2xl font-black text-white">{value}</h3>
          {subtitle ? <p className="mt-2 text-xs text-slate-400">{subtitle}</p> : null}
        </div>
        <div className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", tones[tone])}>{icon}</div>
      </div>
    </div>
  );
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-[#030817] p-3">
      {ok ? <CheckCircle2 className="text-emerald-300" size={18} /> : <AlertTriangle className="text-amber-300" size={18} />}
      <span className={ok ? "font-bold text-emerald-200" : "font-bold text-amber-200"}>{text}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-700 bg-[#020617] p-6 text-center text-sm font-bold text-slate-500">{text}</div>;
}
