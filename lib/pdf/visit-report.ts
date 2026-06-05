import jsPDF from "jspdf";

export function generateVisitReport(data: any) {
  const doc = new jsPDF();
  doc.text("Reporte de Visita Técnica", 14, 20);
  return doc;
}
