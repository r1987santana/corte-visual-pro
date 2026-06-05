"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SignaturePad from "@/components/SignaturePad";
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  Clock,
  FileDown,
  FileText,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  Save,
  Star,
  User,
  Wrench,
} from "lucide-react";
import {
  buildWhatsAppMessage,
  generateTechnicalVisitPDF,
  openWhatsApp,
} from "@/lib/pdf/technical-visit-report";

type Ticket = {
  ticket_code?: string;
  issue_title?: string;
  issue_description?: string;
  client_name?: string;
  client_phone?: string;
};

type VisitPhoto = {
  id: string;
  visit_id: string;
  photo_stage: "antes" | "durante" | "despues";
  photo_url: string;
  created_at: string;
};

type Visit = {
  id: string;
  ticket_id: string;
  visit_status: string;
  scheduled_at: string | null;
  route_address: string | null;
  solution_applied: string | null;
  diagnosis: string | null;
  parts_used: string | null;
  client_signature_name: string | null;
  client_signature_accepted: boolean | null;
  client_signature_image: string | null;
  customer_rating: number | null;
  ticket?: Ticket;
};

export default function TechnicianVisitPage() {
  const params = useParams();
  const router = useRouter();
  const visitId = params.visit_id as string;

  const [visit, setVisit] = useState<Visit | null>(null);
  const [photos, setPhotos] = useState<VisitPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [diagnosis, setDiagnosis] = useState("");
  const [solution, setSolution] = useState("");
  const [partsUsed, setPartsUsed] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [signatureAccepted, setSignatureAccepted] = useState(false);
  const [signatureImage, setSignatureImage] = useState("");
  const [rating, setRating] = useState(5);

  useEffect(() => {
    if (visitId) loadVisit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  async function loadVisit() {
    setLoading(true);

    const { data: visitData, error: visitError } = await supabase
      .from("after_sales_service_visits")
      .select(`
        id,
        ticket_id,
        visit_status,
        scheduled_at,
        route_address,
        solution_applied,
        diagnosis,
        parts_used,
        client_signature_name,
        client_signature_accepted,
        client_signature_image,
        customer_rating
      `)
      .eq("id", visitId)
      .single();

    if (visitError || !visitData) {
      alert(visitError?.message || "Visita no encontrada");
      setLoading(false);
      return;
    }

    const { data: ticketData } = await supabase
      .from("after_sales_tickets")
      .select(`
        ticket_code,
        issue_title,
        issue_description,
        client_name,
        client_phone
      `)
      .eq("id", visitData.ticket_id)
      .single();

    const { data: photosData } = await supabase
      .from("after_sales_visit_photos")
      .select("*")
      .eq("visit_id", visitId)
      .order("created_at", { ascending: false });

    setPhotos((photosData || []) as VisitPhoto[]);
    setVisit({ ...visitData, ticket: ticketData || undefined });

    setDiagnosis(visitData.diagnosis || "");
    setSolution(visitData.solution_applied || "");
    setPartsUsed(visitData.parts_used || "");
    setSignatureName(visitData.client_signature_name || "");
    setSignatureAccepted(Boolean(visitData.client_signature_accepted));
    setSignatureImage(visitData.client_signature_image || "");
    setRating(visitData.customer_rating || 5);

    setLoading(false);
  }

  async function saveVisit(status?: string) {
    if (!visit) return;

    setSaving(true);

    const { error } = await supabase
      .from("after_sales_service_visits")
      .update({
        diagnosis,
        solution_applied: solution,
        parts_used: partsUsed,
        client_signature_name: signatureName,
        client_signature_accepted: signatureAccepted,
        client_signature_image: signatureImage,
        customer_rating: rating,
        visit_status: status || visit.visit_status,
        completed_at: status === "completada" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", visit.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    await loadVisit();
    alert(status === "completada" ? "Visita completada" : "Guardado correctamente");
  }

  async function updateStatus(status: string) {
    await saveVisit(status);
  }

  function buildReportData() {
    const ticket = visit?.ticket || {};

    return {
      ticketCode: ticket.ticket_code,
      issueTitle: ticket.issue_title,
      issueDescription: ticket.issue_description,
      clientName: ticket.client_name,
      clientPhone: ticket.client_phone,
      scheduledAt: visit?.scheduled_at,
      routeAddress: visit?.route_address,
      visitStatus: visit?.visit_status,
      diagnosis,
      solutionApplied: solution,
      partsUsed,
      signatureName,
      signatureImage,
      signatureAccepted,
      rating,
      photos,
    };
  }

  async function generatePdf() {
    const doc = generateTechnicalVisitPDF(buildReportData());
    const ticketCode = visit?.ticket?.ticket_code || "visita-tecnica";
    doc.save(`${ticketCode}-reporte-tecnico.pdf`);

    if (visit?.id) {
      await supabase
        .from("after_sales_service_visits")
        .update({
          report_pdf_generated_at: new Date().toISOString(),
          report_pdf_status: "generado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", visit.id);
    }
  }

  async function sendWhatsAppReport() {
    const data = buildReportData();
    const message = buildWhatsAppMessage(data);

    openWhatsApp(data.clientPhone, message);

    if (visit?.id) {
      await supabase
        .from("after_sales_service_visits")
        .update({
          report_pdf_sent_whatsapp_at: new Date().toISOString(),
          report_pdf_status: "enviado_whatsapp",
          report_whatsapp_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", visit.id);
    }
  }

  async function closeVisitAndTicket() {
    if (!visit?.id) return;

    const ok = confirm("¿Cerrar la visita y también el ticket de postventa?");
    if (!ok) return;

    await saveVisit("completada");

    const { error } = await supabase.rpc("close_after_sales_visit_and_ticket", {
      p_visit_id: visit.id,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await loadVisit();
    alert("Visita y ticket cerrados correctamente.");
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      const files = Array.from(e.target.files || []);
      if (!visit?.id) return alert("No se encontró la visita.");
      if (files.length === 0) return;

      const stage = prompt("Tipo de foto: antes, durante o despues", "antes")?.toLowerCase();

      if (!stage || !["antes", "durante", "despues"].includes(stage)) {
        alert("Tipo de foto inválido.");
        return;
      }

      for (const file of files) {
        const base64: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const { error } = await supabase.from("after_sales_visit_photos").insert({
          visit_id: visit.id,
          photo_stage: stage,
          photo_url: base64,
        });

        if (error) throw error;
      }

      const { data: photosData } = await supabase
        .from("after_sales_visit_photos")
        .select("*")
        .eq("visit_id", visit.id)
        .order("created_at", { ascending: false });

      setPhotos((photosData || []) as VisitPhoto[]);
      e.target.value = "";

      alert("Fotos guardadas correctamente.");
    } catch (error: any) {
      alert(error.message || "Error al guardar fotos.");
    }
  }

  function openPhotoInput() {
    document.getElementById("photoInput")?.click();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020817] text-white flex items-center justify-center">
        <div className="text-center">
          <Wrench className="w-12 h-12 mx-auto mb-4 text-cyan-400 animate-pulse" />
          <h2 className="text-3xl font-bold">Cargando visita...</h2>
        </div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="min-h-screen bg-[#020817] text-white flex items-center justify-center">
        <h2 className="text-3xl font-bold">Visita no encontrada</h2>
      </div>
    );
  }

  const ticket = visit.ticket || {};

  return (
    <div className="min-h-screen bg-[#020817] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          onClick={() => router.push("/tecnico")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
          <h1 className="text-4xl font-bold mb-2">
            {ticket.ticket_code || "Visita Técnica"}
          </h1>
          <p className="text-slate-400 text-lg">{ticket.issue_title || "Sin título"}</p>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <InfoCard icon={<User />} title="Cliente" value={ticket.client_name || "No definido"} />
          <InfoCard icon={<Phone />} title="Teléfono" value={ticket.client_phone || "No definido"} />
          <InfoCard
            icon={<Clock />}
            title="Fecha programada"
            value={visit.scheduled_at ? new Date(visit.scheduled_at).toLocaleString("es-DO") : "No definida"}
          />
          <InfoCard icon={<MapPin />} title="Dirección" value={visit.route_address || "No especificada"} />
          <InfoCard icon={<FileText />} title="Estado" value={visit.visit_status || "programada"} />
          <InfoCard icon={<Wrench />} title="ID Visita" value={visit.id} />
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <h2 className="text-xl font-bold mb-3">Descripción del problema</h2>
          <p className="text-slate-300">
            {ticket.issue_description || "Sin descripción registrada."}
          </p>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-2xl font-bold">Ejecución técnica</h2>

          <textarea
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="Diagnóstico técnico..."
            className="w-full h-28 bg-slate-950 border border-slate-700 rounded-2xl p-4 outline-none"
          />

          <textarea
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            placeholder="Solución aplicada..."
            className="w-full h-28 bg-slate-950 border border-slate-700 rounded-2xl p-4 outline-none"
          />

          <textarea
            value={partsUsed}
            onChange={(e) => setPartsUsed(e.target.value)}
            placeholder="Piezas / materiales utilizados..."
            className="w-full h-24 bg-slate-950 border border-slate-700 rounded-2xl p-4 outline-none"
          />
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">Evidencia fotográfica</h2>

            <button
              type="button"
              onClick={openPhotoInput}
              className="bg-purple-600 hover:bg-purple-700 rounded-xl px-5 py-3 font-semibold flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Tomar / subir fotos
            </button>
          </div>

          <input
            id="photoInput"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={handlePhotoUpload}
          />

          {photos.length === 0 ? (
            <div className="border border-dashed border-slate-700 rounded-2xl p-8 text-center text-slate-400">
              No hay fotos registradas para esta visita.
            </div>
          ) : (
            <div className="space-y-6">
              {(["antes", "durante", "despues"] as const).map((stage) => {
                const stagePhotos = photos.filter((p) => p.photo_stage === stage);
                if (stagePhotos.length === 0) return null;

                return (
                  <div key={stage} className="space-y-3">
                    <h3 className="text-cyan-400 font-bold uppercase tracking-wider">
                      Fotos {stage}
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {stagePhotos.map((photo) => (
                        <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={photo.photo_url}
                            alt={`Foto ${stage}`}
                            className="w-full h-40 object-cover rounded-xl border border-slate-700 hover:scale-105 transition-transform"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-2xl font-bold">Firma y satisfacción</h2>

          <input
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder="Nombre de quien recibe"
            className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 outline-none"
          />

          <SignaturePad
            onSave={(dataUrl) => {
              setSignatureImage(dataUrl);
              alert("Firma capturada correctamente.");
            }}
          />

          {signatureImage && (
            <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
              <p className="mb-2 text-sm text-cyan-400 font-bold">Firma guardada</p>
              <img src={signatureImage} alt="Firma del cliente" className="max-h-32 rounded-xl border border-slate-800" />
            </div>
          )}

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={signatureAccepted}
              onChange={(e) => setSignatureAccepted(e.target.checked)}
            />
            Cliente acepta la solución realizada
          </label>

          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} onClick={() => setRating(n)}>
                <Star className={`w-7 h-7 ${n <= rating ? "text-yellow-400 fill-yellow-400" : "text-slate-600"}`} />
              </button>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <h2 className="text-2xl font-bold mb-6">Acciones</h2>

          <div className="grid md:grid-cols-4 gap-4 mb-4">
            <button
              type="button"
              onClick={generatePdf}
              className="bg-slate-700 hover:bg-slate-600 rounded-xl p-4 font-bold flex items-center justify-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              PDF
            </button>

            <button
              type="button"
              onClick={sendWhatsAppReport}
              className="bg-emerald-600 hover:bg-emerald-500 rounded-xl p-4 font-bold flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>

            <button
              type="button"
              onClick={closeVisitAndTicket}
              className="bg-red-600 hover:bg-red-500 rounded-xl p-4 font-bold flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Cerrar Ticket
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => saveVisit()}
              className="bg-amber-500 text-black rounded-xl p-4 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              Guardar
            </button>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <button onClick={() => updateStatus("en_ruta")} className="bg-blue-600 rounded-xl p-4 font-semibold">
              En Ruta
            </button>

            <button onClick={() => updateStatus("en_sitio")} className="bg-cyan-600 rounded-xl p-4 font-semibold">
              En Sitio
            </button>

            <button onClick={openPhotoInput} className="bg-purple-600 rounded-xl p-4 font-semibold flex items-center justify-center gap-2">
              <Camera className="w-4 h-4" />
              Fotos
            </button>

            <button disabled={saving} onClick={() => updateStatus("completada")} className="bg-green-600 rounded-xl p-4 font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              <CheckCircle className="w-4 h-4" />
              Completar
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center gap-2 text-cyan-400 mb-2">
        <div className="w-5 h-5">{icon}</div>
        <span className="text-sm uppercase tracking-wider">{title}</span>
      </div>
      <div className="text-lg font-semibold break-words">{value}</div>
    </div>
  );
}