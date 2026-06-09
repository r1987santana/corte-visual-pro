import jsPDF from "jspdf";

export type TechnicalVisitReportData = {
  ticketCode?: string;
  issueTitle?: string;
  issueDescription?: string;
  clientName?: string;
  clientPhone?: string;
  scheduledAt?: string | null;
  routeAddress?: string | null;
  visitStatus?: string;
  diagnosis?: string;
  solutionApplied?: string;
  partsUsed?: string;
  signatureName?: string;
  signatureImage?: string;
  signatureAccepted?: boolean;
  rating?: number;
  photos?: Array<{ photo_stage: string; photo_url: string }>;
};

const safe = (v?: string | null) => (v && v.trim() ? v : "N/D");

function wrapped(doc: jsPDF, text: string, x: number, y: number, w: number) {
  const lines = doc.splitTextToSize(text || "N/D", w);
  doc.text(lines, x, y);
  return y + lines.length * 6;
}

export function generateTechnicalVisitPDF(data: TechnicalVisitReportData) {
  const doc = new jsPDF("p", "mm", "letter");
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 16;

  doc.setFillColor(2, 8, 23);
  doc.rect(0, 0, pageW, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("RD Wood System", margin, y);
  y += 8;
  doc.setFontSize(11);
  doc.text("Reporte Técnico de Visita / Postventa", margin, y);

  doc.setTextColor(0, 0, 0);
  y = 44;
  doc.setFontSize(15);
  doc.text(`Ticket: ${safe(data.ticketCode)}`, margin, y);
  y += 10;

  doc.setFontSize(11);
  const rows = [
    ["Cliente", safe(data.clientName)],
    ["Teléfono", safe(data.clientPhone)],
    ["Fecha", data.scheduledAt ? new Date(data.scheduledAt).toLocaleString("es-DO") : "N/D"],
    ["Dirección", safe(data.routeAddress)],
    ["Estado", safe(data.visitStatus)],
    ["Problema", safe(data.issueTitle)],
  ];

  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    y = wrapped(doc, value, margin + 38, y, 140);
    y += 2;
  });

  const sections = [
    ["Descripción del problema", safe(data.issueDescription)],
    ["Diagnóstico técnico", safe(data.diagnosis)],
    ["Solución aplicada", safe(data.solutionApplied)],
    ["Piezas / materiales utilizados", safe(data.partsUsed)],
  ];

  sections.forEach(([title, body]) => {
    if (y > 245) { doc.addPage(); y = 18; }
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    y = wrapped(doc, body, margin, y, 180);
  });

  if (y > 220) { doc.addPage(); y = 18; }
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Firma y satisfacción", margin, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Recibido por: ${safe(data.signatureName)}`, margin, y); y += 7;
  doc.text(`Acepta solución: ${data.signatureAccepted ? "Sí" : "No"}`, margin, y); y += 7;
  doc.text(`Satisfacción: ${data.rating || 0}/5`, margin, y); y += 8;

  if (data.signatureImage) {
    try { doc.addImage(data.signatureImage, "PNG", margin, y, 70, 28); y += 34; } catch {}
  }

  const photos = data.photos || [];
  if (photos.length) {
    doc.addPage(); y = 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Evidencia fotográfica", margin, y);
    y += 10;

    for (const photo of photos.slice(0, 8)) {
      if (y > 235) { doc.addPage(); y = 18; }
      doc.setFontSize(10);
      doc.text(`Etapa: ${photo.photo_stage}`, margin, y);
      y += 4;
      try { doc.addImage(photo.photo_url, "JPEG", margin, y, 80, 55); y += 62; }
      catch {
        try { doc.addImage(photo.photo_url, "PNG", margin, y, 80, 55); y += 62; }
        catch { doc.text("No se pudo incrustar esta imagen.", margin, y + 4); y += 12; }
      }
    }
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`RD Wood System · Reporte automático · Página ${i}/${total}`, margin, pageH - 10);
  }

  return doc;
}

export function buildWhatsAppMessage(data: TechnicalVisitReportData) {
  return [
    `Hola ${safe(data.clientName)},`,
    "",
    "Tu visita técnica de RD Wood System fue completada.",
    `Ticket: ${safe(data.ticketCode)}`,
    `Problema: ${safe(data.issueTitle)}`,
    `Satisfacción registrada: ${data.rating || 0}/5`,
    "",
    "Gracias por confiar en RD Wood System."
  ].join("\n");
}

export function openWhatsApp(phone: string | undefined, message: string) {
  const cleanPhone = (phone || "").replace(/[^0-9]/g, "");
  const encoded = encodeURIComponent(message);
  const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  window.open(url, "_blank");
}
