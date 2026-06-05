"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, BadgeCheck, Brain, Camera, CheckCircle2, Loader2,
  RefreshCw, Save, Search, ShieldCheck, Trash2, UserRound, Users, Video
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  employee_code?: string | null;
  full_name: string;
  identification?: string | null;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
  status?: string | null;
  photo_url?: string | null;
};

type FaceProfile = {
  id: string;
  employee_id: string;
  embedding: number[];
  samples_json?: any;
  samples_count?: number | null;
  photo_url?: string | null;
  model_name?: string | null;
  quality_score?: number | null;
  status?: string | null;
  updated_at?: string | null;
};

const MODEL_URL = "https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js/weights";
const REQUIRED_SAMPLES = 3;

function date(value: any) {
  if (!value) return "-";
  try { return new Date(value).toLocaleString("es-DO"); } catch { return "-"; }
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

async function uploadFaceImage(employeeId: string, dataUrl: string, index: number) {
  const blob = await fetch(dataUrl).then((res) => res.blob());
  const path = `${employeeId}/face-profile/${Date.now()}-${index}.jpg`;

  const { error } = await supabase.storage.from("employee-attendance").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });

  if (error) throw error;
  const { data } = supabase.storage.from("employee-attendance").getPublicUrl(path);
  return data.publicUrl;
}

function averageEmbeddings(embeddings: number[][]) {
  if (!embeddings.length) return [];
  const length = embeddings[0].length;
  const avg = new Array(length).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < length; i++) avg[i] += Number(embedding[i] || 0);
  }

  return avg.map((v) => v / embeddings.length);
}

function distance(a: number[], b: number[]) {
  if (!a.length || !b.length || a.length !== b.length) return 999;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function qualityFromSamples(samples: number[][]) {
  if (samples.length < 2) return 70;
  const avg = averageEmbeddings(samples);
  const distances = samples.map((s) => distance(avg, s));
  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  return Math.round(Math.max(0, Math.min(100, 100 - mean * 220)));
}

export default function RegistroFacialEmpleadosPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [profiles, setProfiles] = useState<FaceProfile[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");

  const [faceapi, setFaceapi] = useState<any>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [lastDetection, setLastDetection] = useState("");
  const [samples, setSamples] = useState<number[][]>([]);
  const [samplePhotos, setSamplePhotos] = useState<string[]>([]);

  const selectedEmployee = employees.find((e) => e.id === selectedId) || null;
  const selectedProfile = profiles.find((p) => p.employee_id === selectedId && p.status !== "inactivo") || null;

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.employee_code, e.full_name, e.identification, e.position, e.department, e.phone, e.status]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [employees, search]);

  const registeredCount = profiles.filter((p) => p.status !== "inactivo").length;

  async function loadAll() {
    setLoading(true);
    setMessage("");
    try {
      const [empRes, profileRes] = await Promise.all([
        supabase.from("employees").select("*").order("full_name", { ascending: true }),
        supabase.from("employee_face_profiles").select("*").order("updated_at", { ascending: false }),
      ]);

      if (empRes.error) throw empRes.error;
      if (profileRes.error) throw profileRes.error;

      const empData = (empRes.data || []) as Employee[];
      setEmployees(empData);
      setProfiles((profileRes.data || []) as FaceProfile[]);
      if (!selectedId && empData[0]) setSelectedId(empData[0].id);
    } catch (error: any) {
      setMessage(error.message || "Error cargando empleados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    async function boot() {
      try {
        setMessage("Cargando modelos faciales...");
        const api = await import("@vladmandic/face-api");
        setFaceapi(api);
        await Promise.all([
          api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          api.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
        setMessage("✅ Modelos faciales cargados.");
      } catch {
        setMessage("No se pudieron cargar los modelos desde CDN. Revisa internet o abre F12 → Console para ver el error.");
      }
    }
    boot();
  }, []);

  useEffect(() => {
    setSamples([]);
    setSamplePhotos([]);
    setLastDetection("");
  }, [selectedId]);

  async function startCamera() {
    if (!videoRef.current) return;
    try {
      setMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOn(true);
      setMessage("✅ Cámara activa.");
    } catch {
      setMessage("No se pudo abrir la cámara. Revisa permisos del navegador/tableta.");
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

  async function detectFaceDescriptor() {
    if (!faceapi || !modelsLoaded || !videoRef.current) {
      throw new Error("Modelos faciales no cargados todavía.");
    }

    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.55 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) throw new Error("No se detectó un rostro claro. Mira al frente y mejora la luz.");

    const box = detection.detection.box;
    const videoArea = (videoRef.current.videoWidth || 640) * (videoRef.current.videoHeight || 480);
    const ratio = (box.width * box.height) / videoArea;

    if (ratio < 0.05) throw new Error("Rostro muy lejos. Acércate.");
    if (ratio > 0.65) throw new Error("Rostro demasiado cerca. Aléjate.");

    return Array.from(detection.descriptor).map(Number);
  }

  async function captureSample() {
    if (!selectedEmployee) return setMessage("Selecciona un empleado.");
    if (!cameraOn) return setMessage("Activa la cámara primero.");

    setSaving(true);
    setMessage("");

    try {
      const descriptor = await detectFaceDescriptor();
      const photo = captureFrame();

      const nextSamples = [...samples, descriptor].slice(0, REQUIRED_SAMPLES);
      const nextPhotos = [...samplePhotos, photo].slice(0, REQUIRED_SAMPLES);

      setSamples(nextSamples);
      setSamplePhotos(nextPhotos);
      setLastDetection(`Muestra capturada correctamente (${nextSamples.length}/${REQUIRED_SAMPLES}).`);
    } catch (error: any) {
      setLastDetection(error.message || "No se pudo capturar el rostro.");
    } finally {
      setSaving(false);
    }
  }

  async function saveFaceProfile() {
    if (!selectedEmployee) return setMessage("Selecciona un empleado.");
    if (samples.length < REQUIRED_SAMPLES) return setMessage(`Debes capturar ${REQUIRED_SAMPLES} muestras faciales.`);

    setSaving(true);
    setMessage("");

    try {
      const average = averageEmbeddings(samples);
      const quality = qualityFromSamples(samples);

      if (quality < 65) {
        const ok = window.confirm(`La calidad es ${quality}%. Recomendado mínimo 65%. ¿Guardar de todas formas?`);
        if (!ok) return;
      }

      const uploadedPhotos: string[] = [];
      for (let i = 0; i < samplePhotos.length; i++) {
        uploadedPhotos.push(await uploadFaceImage(selectedEmployee.id, samplePhotos[i], i + 1));
      }

      const payload = {
        employee_id: selectedEmployee.id,
        embedding: average,
        samples_json: samples,
        samples_count: samples.length,
        photo_url: uploadedPhotos[0] || selectedEmployee.photo_url || null,
        model_name: "face-api.js / tinyFaceDetector + faceRecognitionNet",
        quality_score: quality,
        status: "activo",
        updated_at: new Date().toISOString(),
      };

      if (selectedProfile) {
        const { error } = await supabase.from("employee_face_profiles").update(payload).eq("employee_id", selectedEmployee.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employee_face_profiles").insert(payload);
        if (error) throw error;
      }

      await supabase.from("employees").update({ photo_url: uploadedPhotos[0] || selectedEmployee.photo_url || null }).eq("id", selectedEmployee.id);

      setMessage(`✅ Rostro registrado correctamente. Calidad: ${quality}%.`);
      setSamples([]);
      setSamplePhotos([]);
      await loadAll();
    } catch (error: any) {
      setMessage(error.message || "Error guardando perfil facial.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile() {
    if (!selectedEmployee) return;
    if (!window.confirm(`¿Inactivar el registro facial de ${selectedEmployee.full_name}?`)) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("employee_face_profiles")
        .update({ status: "inactivo", updated_at: new Date().toISOString() })
        .eq("employee_id", selectedEmployee.id);

      if (error) throw error;
      setMessage("Registro facial inactivado.");
      await loadAll();
    } catch (error: any) {
      setMessage(error.message || "Error inactivando registro facial.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020817] p-4 text-white md:p-6">
      <div className="mx-auto w-full max-w-[1720px] space-y-5">
        <section className="rounded-3xl border border-cyan-900/50 bg-gradient-to-br from-[#081421] via-[#0b1830] to-[#111b3f] p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 md:flex">
                <Brain size={34} />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.30em] text-cyan-300">
                  <BadgeCheck size={14} /> FASE 8.2.2
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Registro Facial de Empleados</h1>
                <p className="mt-2 max-w-4xl text-sm text-slate-300">
                  Captura 3 muestras faciales por empleado para habilitar asistencia por reconocimiento facial sin PIN.
                </p>
              </div>
            </div>

            <button
              onClick={loadAll}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-5 text-sm font-black text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">{message}</div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi title="Empleados" value={employees.length} subtitle="Base RRHH" icon={<Users />} tone="cyan" />
          <Kpi title="Rostros registrados" value={registeredCount} subtitle="Listos para ponchar" icon={<ShieldCheck />} tone="green" />
          <Kpi title="Pendientes" value={Math.max(0, employees.length - registeredCount)} subtitle="Falta registrar rostro" icon={<AlertTriangle />} tone="amber" />
          <Kpi title="Modelos IA" value={modelsLoaded ? "ON" : "OFF"} subtitle="face-api.js local" icon={<Brain />} tone={modelsLoaded ? "green" : "red"} />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[440px_1fr_420px]">
          <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
            <h2 className="text-2xl font-black">Empleados</h2>
            <p className="mb-4 text-sm text-slate-400">Selecciona empleado para registrar rostro.</p>

            <div className="relative mb-4">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar empleado..."
                className="w-full rounded-2xl border border-slate-700 bg-[#030817] py-4 pl-11 pr-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div className="max-h-[760px] space-y-3 overflow-auto pr-1">
              {filteredEmployees.map((employee) => {
                const profile = profiles.find((p) => p.employee_id === employee.id && p.status !== "inactivo");
                return (
                  <button
                    key={employee.id}
                    onClick={() => setSelectedId(employee.id)}
                    className={cx(
                      "w-full rounded-2xl border p-4 text-left transition",
                      selectedId === employee.id ? "border-cyan-400 bg-cyan-500/10" : "border-slate-800 bg-[#030817] hover:border-cyan-500/40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                        {employee.photo_url ? <img src={employee.photo_url} className="h-full w-full object-cover" /> : <UserRound />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black">{employee.full_name}</p>
                        <p className="truncate text-xs text-slate-400">{employee.employee_code || "Sin código"} · {employee.position || "Sin cargo"}</p>
                        <p className="truncate text-xs text-slate-500">{employee.department || "Sin departamento"}</p>
                      </div>
                      {profile ? <CheckCircle2 className="shrink-0 text-emerald-300" size={20} /> : <AlertTriangle className="shrink-0 text-amber-300" size={20} />}
                    </div>
                  </button>
                );
              })}
              {!filteredEmployees.length ? <Empty text="No hay empleados." /> : null}
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-2xl font-black"><Video className="text-cyan-300" /> Cámara facial</h2>
                  <p className="text-sm text-slate-400">Usa buena iluminación y rostro al frente.</p>
                </div>

                {!cameraOn ? (
                  <button onClick={startCamera} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">
                    <Camera size={18} /> Activar cámara
                  </button>
                ) : (
                  <button onClick={stopCamera} className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white">
                    Apagar cámara
                  </button>
                )}
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-black">
                <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                {!cameraOn ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-center">
                    <div>
                      <Camera className="mx-auto mb-3 text-slate-500" size={64} />
                      <p className="font-black text-slate-300">Cámara apagada</p>
                      <p className="text-sm text-slate-500">Activa la cámara para capturar muestras.</p>
                    </div>
                  </div>
                ) : null}
              </div>

              {lastDetection ? (
                <div className="mt-4 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">{lastDetection}</div>
              ) : null}

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                <button
                  onClick={captureSample}
                  disabled={!cameraOn || !modelsLoaded || saving || !selectedEmployee || samples.length >= REQUIRED_SAMPLES}
                  className="inline-flex items-center justify-center gap-3 rounded-2xl bg-cyan-600 px-6 py-4 text-sm font-black uppercase text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
                  Capturar muestra {Math.min(samples.length + 1, REQUIRED_SAMPLES)}/{REQUIRED_SAMPLES}
                </button>

                <button
                  onClick={saveFaceProfile}
                  disabled={samples.length < REQUIRED_SAMPLES || saving || !selectedEmployee}
                  className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-6 py-4 text-sm font-black uppercase text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Guardar rostro
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-black"><BadgeCheck className="text-cyan-300" /> Muestras capturadas</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="rounded-2xl border border-slate-800 bg-[#030817] p-3 text-center">
                    {samplePhotos[index] ? (
                      <img src={samplePhotos[index]} className="h-36 w-full rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-slate-700 text-slate-600">Muestra {index + 1}</div>
                    )}
                    <p className="mt-2 text-xs font-black text-slate-400">Muestra {index + 1}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => { setSamples([]); setSamplePhotos([]); setLastDetection(""); }}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-[#030817] px-5 py-3 text-sm font-black text-slate-200 hover:bg-white/5"
              >
                <Trash2 size={18} /> Limpiar muestras
              </button>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-black"><UserRound className="text-cyan-300" /> Empleado seleccionado</h2>

              {!selectedEmployee ? <Empty text="Selecciona un empleado." /> : (
                <div className="text-center">
                  <div className="mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-3xl border border-cyan-400/30 bg-cyan-500/10">
                    {selectedEmployee.photo_url ? <img src={selectedEmployee.photo_url} className="h-full w-full object-cover" /> : <UserRound size={64} className="text-cyan-300" />}
                  </div>

                  <h3 className="mt-4 text-2xl font-black">{selectedEmployee.full_name}</h3>
                  <p className="text-sm text-slate-400">{selectedEmployee.employee_code || "Sin código"}</p>
                  <p className="text-sm text-slate-400">{selectedEmployee.position || "Sin cargo"} · {selectedEmployee.department || "Sin departamento"}</p>

                  {selectedProfile ? (
                    <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-left">
                      <p className="font-black text-emerald-300">Rostro registrado</p>
                      <p className="mt-1 text-sm text-slate-300">Calidad: {selectedProfile.quality_score || 0}%</p>
                      <p className="text-sm text-slate-300">Muestras: {selectedProfile.samples_count || 0}</p>
                      <p className="text-xs text-slate-500">Actualizado: {date(selectedProfile.updated_at)}</p>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-left">
                      <p className="font-black text-amber-300">Sin rostro registrado</p>
                      <p className="mt-1 text-sm text-slate-300">Captura 3 muestras para habilitar ponche facial.</p>
                    </div>
                  )}

                  {selectedProfile ? (
                    <button
                      onClick={deleteProfile}
                      disabled={saving}
                      className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm font-black uppercase text-red-200 hover:bg-red-500/20 disabled:opacity-60"
                    >
                      <Trash2 size={18} /> Inactivar registro facial
                    </button>
                  ) : null}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-black"><ShieldCheck className="text-cyan-300" /> Reglas de captura</h2>
              <div className="space-y-3 text-sm text-slate-300">
                <Rule ok={modelsLoaded} text="Modelos de IA cargados" />
                <Rule ok={cameraOn} text="Cámara activa" />
                <Rule ok={Boolean(selectedEmployee)} text="Empleado seleccionado" />
                <Rule ok={samples.length >= REQUIRED_SAMPLES} text="3 muestras capturadas" />
              </div>

              <div className="mt-5 rounded-2xl border border-slate-800 bg-[#030817] p-4 text-sm text-slate-400">
                <p className="font-black text-cyan-300">Consejos</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Buena iluminación frontal.</li>
                  <li>Rostro completo visible.</li>
                  <li>Sin gorra, lentes oscuros ni mascarilla.</li>
                  <li>Captura 3 posiciones ligeramente distintas.</li>
                </ul>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Kpi({ title, value, subtitle, icon, tone = "cyan" }: { title: string; value: string | number; subtitle?: string; icon: React.ReactNode; tone?: "cyan" | "green" | "amber" | "red"; }) {
  const tones: Record<string, string> = {
    cyan: "border-cyan-400/25 bg-cyan-500/10 text-cyan-300",
    green: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-400/25 bg-amber-500/10 text-amber-300",
    red: "border-red-400/25 bg-red-500/10 text-red-300",
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

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-700 bg-[#020617] p-6 text-center text-sm font-bold text-slate-500">{text}</div>;
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-[#030817] p-3">
      {ok ? <CheckCircle2 className="text-emerald-300" size={18} /> : <AlertTriangle className="text-amber-300" size={18} />}
      <span className={ok ? "font-bold text-emerald-200" : "font-bold text-amber-200"}>{text}</span>
    </div>
  );
}
