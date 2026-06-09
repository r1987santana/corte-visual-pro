import jsPDF from "jspdf";

export function generateVisitReport(data: any) {
  const doc = new jsPDF("p", "mm", "letter");
  doc.text("Reporte de Visita Técnica", 14, 20);
  return doc;
}
