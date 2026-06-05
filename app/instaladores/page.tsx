"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "@/lib/supabase";

type ProductionOrder = {
  id: string;
  client_name: string | null;
  phone: string | null;
  project_type: string | null;
  total: number | null;
  status: string | null;
  created_at: string;
};

type CuttingPiece = {
  id: string;
  work_order_id: string;
  piece_name: string | null;
  width_mm: number | null;
  height_mm: number | null;
  material: string | null;
  sheet_number: number | null;
  qr_code: string | null;
  production_status: string | null;
};

type Instalacion = {
  id: string;
  orden_id: string | null;
  tecnico: string | null;
  fecha: string | null;
  estado: string | null;
  hora_salida: string | null;
  hora_llegada: string | null;
  hora_finalizacion: string | null;
  cliente_firma: string | null;
  observaciones: string | null;
  created_at: string;
};

type InstalacionDetalle = {
  id: string;
  instalacion_id: string | null;
  pieza_id: string | null;
  estado: string | null;
  observacion: string | null;
  created_at: string;
};

type InstalacionFoto = {
  id: string;
  instalacion_id: string | null;
  url: string | null;
  tipo: string | null;
  created_at: string;
};

const money = (v: any) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
  }).format(Number(v || 0));

const num = (v: any) =>
  new Intl.NumberFormat("es-DO", {
    maximumFractionDigits: 2,
  }).format(Number(v || 0));

const today = () => new Date().toISOString().slice(0, 10);

function cleanPhone(value: any) {
  let phone = String(value || "").replace(/\D/g, "");
  if (!phone) return "";
  if (phone.length === 10) phone = "1" + phone;
  return phone;
}

export default function InstaladoresProPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [pieces, setPieces] = useState<CuttingPiece[]>([]);
  const [instalaciones, setInstalaciones] = useState<Instalacion[]>([]);
  const [detalles, setDetalles] = useState<InstalacionDetalle[]>([]);
  const [fotos, setFotos] = useState<InstalacionFoto[]>([]);

  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedInstalacionId, setSelectedInstalacionId] = useState("");

  const [tecnico, setTecnico] = useState("Instalador");
  const [observaciones, setObservaciones] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [fotoTipo, setFotoTipo] = useState("antes");
  const [fotoUrl, setFotoUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const selectedInstalacion = instalaciones.find((i) => i.id === selectedInstalacionId);

  const orderPieces = useMemo(() => {
    if (!selectedOrderId) return [];
    return pieces.filter((p) => p.work_order_id === selectedOrderId);
  }, [pieces, selectedOrderId]);

  const instalacionDetalles = useMemo(() => {
    if (!selectedInstalacionId) return [];
    return detalles.filter((d) => d.instalacion_id === selectedInstalacionId);
  }, [detalles, selectedInstalacionId]);

  const instalacionFotos = useMemo(() => {
    if (!selectedInstalacionId) return [];
    return fotos.filter((f) => f.instalacion_id === selectedInstalacionId);
  }, [fotos, selectedInstalacionId]);

  const stats = useMemo(() => {
    const total = instalacionDetalles.length;
    const instaladas = instalacionDetalles.filter((d) => d.estado === "instalada").length;
    const faltantes = instalacionDetalles.filter((d) => d.estado === "faltante").length;
    const danadas = instalacionDetalles.filter((d) => d.estado === "dañada").length;
    const pendientes = instalacionDetalles.filter((d) => !d.estado || d.estado === "pendiente").length;
    const avance = total > 0 ? Math.round((instaladas / total) * 100) : 0;

    return { total, instaladas, faltantes, danadas, pendientes, avance };
  }, [instalacionDetalles]);

  const dashboard = useMemo(() => {
    const abiertas = instalaciones.filter((i) => i.estado !== "cerrada").length;
    const cerradas = instalaciones.filter((i) => i.estado === "cerrada").length;
    const enObra = instalaciones.filter((i) => i.estado === "en obra").length;
    const hoy = instalaciones.filter((i) => i.fecha === today()).length;

    return { abiertas, cerradas, enObra, hoy };
  }, [instalaciones]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      const last = instalaciones.find((i) => i.orden_id === selectedOrderId);
      if (last) {
        setSelectedInstalacionId(last.id);
        setObservaciones(last.observaciones || "");
      } else {
        setSelectedInstalacionId("");
        setObservaciones("");
      }
    }
  }, [selectedOrderId, instalaciones]);

  async function loadAll() {
    setLoading(true);

    const [ordersRes, piecesRes, insRes, detRes, fotosRes] = await Promise.all([
      supabase
        .from("production_orders")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("cutting_pieces")
        .select("*")
        .order("sheet_number", { ascending: true }),

      supabase
        .from("instalaciones")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("instalaciones_detalle")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("instalaciones_fotos")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (ordersRes.error) alert("Error órdenes: " + ordersRes.error.message);
    if (piecesRes.error) alert("Error piezas: " + piecesRes.error.message);
    if (insRes.error) alert("Error instalaciones: " + insRes.error.message);
    if (detRes.error) alert("Error detalle instalación: " + detRes.error.message);
    if (fotosRes.error) alert("Error fotos instalación: " + fotosRes.error.message);

    setOrders((ordersRes.data || []) as ProductionOrder[]);
    setPieces((piecesRes.data || []) as CuttingPiece[]);
    setInstalaciones((insRes.data || []) as Instalacion[]);
    setDetalles((detRes.data || []) as InstalacionDetalle[]);
    setFotos((fotosRes.data || []) as InstalacionFoto[]);

    setLoading(false);
  }

  async function crearInstalacion() {
    if (!selectedOrderId) {
      alert("Selecciona una orden.");
      return;
    }

    if (orderPieces.length === 0) {
      alert("Esta orden no tiene piezas de corte cargadas.");
      return;
    }

    const existente = instalaciones.find(
      (i) => i.orden_id === selectedOrderId && i.estado !== "cerrada"
    );

    if (existente) {
      setSelectedInstalacionId(existente.id);
      alert("Esta orden ya tiene una instalación abierta.");
      return;
    }

    const insRes = await supabase
      .from("instalaciones")
      .insert({
        orden_id: selectedOrderId,
        tecnico,
        fecha: today(),
        estado: "pendiente",
        observaciones: "",
      })
      .select()
      .single();

    if (insRes.error) {
      alert("Error creando instalación: " + insRes.error.message);
      return;
    }

    const detallePayload = orderPieces.map((p) => ({
      instalacion_id: insRes.data.id,
      pieza_id: p.id,
      estado: "pendiente",
      observacion: "",
    }));

    const detRes = await supabase.from("instalaciones_detalle").insert(detallePayload);

    if (detRes.error) {
      alert("Instalación creada, pero error creando detalle: " + detRes.error.message);
      return;
    }

    await supabase
      .from("production_orders")
      .update({ status: "Programada para instalación" })
      .eq("id", selectedOrderId);

    alert("Instalación creada con checklist de piezas.");
    setSelectedInstalacionId(insRes.data.id);
    await loadAll();
  }

  async function marcarTiempo(campo: "hora_salida" | "hora_llegada" | "hora_finalizacion", estado: string) {
    if (!selectedInstalacionId) {
      alert("Selecciona o crea una instalación.");
      return;
    }

    const update: any = {
      [campo]: new Date().toISOString(),
      estado,
      tecnico,
      observaciones,
    };

    const { error } = await supabase
      .from("instalaciones")
      .update(update)
      .eq("id", selectedInstalacionId);

    if (error) {
      alert("Error actualizando instalación: " + error.message);
      return;
    }

    if (selectedOrderId) {
      await supabase
        .from("production_orders")
        .update({ status: estado === "cerrada" ? "Instalado" : estado })
        .eq("id", selectedOrderId);
    }

    await loadAll();
  }

  async function actualizarPieza(detalle: InstalacionDetalle, estado: string, observacion = "") {
    const { error } = await supabase
      .from("instalaciones_detalle")
      .update({
        estado,
        observacion,
      })
      .eq("id", detalle.id);

    if (error) {
      alert("Error actualizando pieza: " + error.message);
      return;
    }

    await loadAll();
  }

  async function procesarQR(codigoManual?: string) {
    if (!selectedInstalacionId) {
      alert("Selecciona una instalación.");
      return;
    }

    const clean = String(codigoManual || scanCode).trim().toLowerCase();

    if (!clean) {
      alert("Escanea o escribe un código.");
      return;
    }

    const pieza = orderPieces.find((p) => {
      const qr = String(p.qr_code || "").toLowerCase();
      const id = String(p.id || "").toLowerCase();
      const name = String(p.piece_name || "").toLowerCase();
      return qr === clean || id === clean || qr.includes(clean) || clean.includes(id) || clean.includes(name) || name.includes(clean);
    });

    if (!pieza) {
      alert("No encontré esa pieza en esta orden.");
      return;
    }

    const detalle = instalacionDetalles.find((d) => d.pieza_id === pieza.id);

    if (!detalle) {
      alert("La pieza existe, pero no está en el checklist de instalación.");
      return;
    }

    await actualizarPieza(detalle, "instalada", "Instalada por QR / escaneo");
    setScanCode("");
  }

  async function guardarObservaciones() {
    if (!selectedInstalacionId) {
      alert("Selecciona una instalación.");
      return;
    }

    const { error } = await supabase
      .from("instalaciones")
      .update({ observaciones, tecnico })
      .eq("id", selectedInstalacionId);

    if (error) {
      alert("Error guardando observaciones: " + error.message);
      return;
    }

    alert("Observaciones guardadas.");
    await loadAll();
  }

  async function agregarFoto() {
    if (!selectedInstalacionId) {
      alert("Selecciona una instalación.");
      return;
    }

    if (!fotoUrl.trim()) {
      alert("Pega una URL de foto.");
      return;
    }

    const { error } = await supabase.from("instalaciones_fotos").insert({
      instalacion_id: selectedInstalacionId,
      tipo: fotoTipo,
      url: fotoUrl.trim(),
    });

    if (error) {
      alert("Error guardando foto: " + error.message);
      return;
    }

    setFotoUrl("");
    await loadAll();
  }

  async function guardarFirma(base64: string) {
    if (!selectedInstalacionId) {
      alert("Selecciona una instalación.");
      return;
    }

    const { error } = await supabase
      .from("instalaciones")
      .update({ cliente_firma: base64 })
      .eq("id", selectedInstalacionId);

    if (error) {
      alert("Error guardando firma: " + error.message);
      return;
    }

    alert("Firma guardada.");
    await loadAll();
  }

  function enviarWhatsAppCliente() {
    if (!selectedOrder) {
      alert("Selecciona una orden.");
      return;
    }

    const telefono = cleanPhone(selectedOrder.phone);

    if (!telefono) {
      alert("El cliente no tiene teléfono registrado.");
      return;
    }

    const mensaje = `Hola ${selectedOrder.client_name || "cliente"}, su instalación de ${selectedOrder.project_type || "proyecto"} ha sido finalizada.

Resumen:
- Piezas instaladas: ${stats.instaladas}
- Pendientes: ${stats.pendientes}
- Faltantes: ${stats.faltantes}
- Dañadas: ${stats.danadas}
- Avance: ${stats.avance}%

Observaciones:
${observaciones || selectedInstalacion?.observaciones || "Sin observaciones"}

Gracias por confiar en RD Wood System.`;

    window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`, "_blank");
  }

  async function generarReportePDF() {
    if (!selectedInstalacionId || !selectedOrder) {
      alert("Selecciona una instalación.");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 26, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("RD Wood System", 12, 11);
    doc.setFontSize(11);
    doc.text("Reporte de Instalación / Entrega", 12, 19);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(18);
    doc.text(`Cliente: ${selectedOrder.client_name || "-"}`, 12, 40);

    doc.setFontSize(10);
    doc.text(`Proyecto: ${selectedOrder.project_type || "-"}`, 12, 50);
    doc.text(`Teléfono: ${selectedOrder.phone || "-"}`, 12, 56);
    doc.text(`Técnico: ${selectedInstalacion?.tecnico || tecnico}`, 12, 62);
    doc.text(`Estado instalación: ${selectedInstalacion?.estado || "-"}`, 12, 68);
    doc.text(`Fecha: ${selectedInstalacion?.fecha || "-"}`, 12, 74);

    doc.text(`Salida: ${selectedInstalacion?.hora_salida ? new Date(selectedInstalacion.hora_salida).toLocaleString("es-DO") : "-"}`, 110, 50);
    doc.text(`Llegada: ${selectedInstalacion?.hora_llegada ? new Date(selectedInstalacion.hora_llegada).toLocaleString("es-DO") : "-"}`, 110, 56);
    doc.text(`Finalización: ${selectedInstalacion?.hora_finalizacion ? new Date(selectedInstalacion.hora_finalizacion).toLocaleString("es-DO") : "-"}`, 110, 62);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen", 12, 88);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Total piezas: ${stats.total}`, 12, 96);
    doc.text(`Instaladas: ${stats.instaladas}`, 55, 96);
    doc.text(`Pendientes: ${stats.pendientes}`, 95, 96);
    doc.text(`Faltantes: ${stats.faltantes}`, 140, 96);
    doc.text(`Dañadas: ${stats.danadas}`, 175, 96);

    let y = 112;
    doc.setFont("helvetica", "bold");
    doc.text("Checklist de piezas", 12, y);
    y += 8;

    doc.setFontSize(8);
    doc.text("Pieza", 12, y);
    doc.text("Medida", 82, y);
    doc.text("Material", 112, y);
    doc.text("Estado", 158, y);
    doc.line(12, y + 3, 198, y + 3);
    y += 9;

    doc.setFont("helvetica", "normal");

    instalacionDetalles.forEach((d) => {
      const p = piezaPorId(d.pieza_id);

      if (y > 270) {
        doc.addPage();
        y = 18;
      }

      doc.text(String(p?.piece_name || d.pieza_id || "-").slice(0, 34), 12, y);
      doc.text(p ? `${p.width_mm}x${p.height_mm}` : "-", 82, y);
      doc.text(String(p?.material || "-").slice(0, 20), 112, y);
      doc.text(String(d.estado || "pendiente"), 158, y);
      y += 7;
    });

    if (y > 230) {
      doc.addPage();
      y = 18;
    }

    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Observaciones", 12, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const obs = doc.splitTextToSize(observaciones || selectedInstalacion?.observaciones || "-", 180);
    doc.text(obs, 12, y);
    y += Math.min(obs.length * 5 + 10, 45);

    doc.setFont("helvetica", "bold");
    doc.text("Firma del cliente", 12, y);
    y += 6;

    if (selectedInstalacion?.cliente_firma) {
      doc.addImage(selectedInstalacion.cliente_firma, "PNG", 12, y, 70, 28);
    } else {
      doc.rect(12, y, 70, 28);
      doc.setFont("helvetica", "normal");
      doc.text("Sin firma registrada", 16, y + 15);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Este documento sirve como evidencia de entrega e instalación.", 12, 292);

    doc.save(`reporte-instalacion-${selectedOrder.client_name || "cliente"}.pdf`);
  }

  async function cerrarInstalacion() {
    if (!selectedInstalacionId) {
      alert("Selecciona una instalación.");
      return;
    }

    if (stats.faltantes > 0 || stats.danadas > 0) {
      const ok = confirm(
        "Hay piezas faltantes o dañadas. ¿Quieres cerrar de todas formas?"
      );
      if (!ok) return;
    }

    if (!selectedInstalacion?.cliente_firma) {
      const ok = confirm("No hay firma del cliente. ¿Cerrar de todas formas?");
      if (!ok) return;
    }

    await marcarTiempo("hora_finalizacion", "cerrada");
    alert("Instalación cerrada.");
  }

  function piezaPorId(id: string | null) {
    return orderPieces.find((p) => p.id === id);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <section className="rounded-[28px] border bg-white p-6 shadow-sm">
          <p className="text-xs font-black tracking-[0.45em] text-blue-700">
            RD WOOD SYSTEM
          </p>

          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black">Instaladores PRO</h1>
              <p className="text-sm text-slate-500">
                Salida · llegada · checklist QR · fotos · firma cliente · cierre de obra
              </p>
            </div>

            <button
              onClick={loadAll}
              className="rounded-2xl bg-blue-700 px-6 py-3 text-sm font-black text-white"
            >
              {loading ? "Cargando..." : "Actualizar"}
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          <Card title="Instalaciones abiertas" value={dashboard.abiertas} />
          <Card title="En obra" value={dashboard.enObra} />
          <Card title="Instalaciones hoy" value={dashboard.hoy} />
          <Card title="Cerradas" value={dashboard.cerradas} ok />
          <Card title="Avance actual" value={`${stats.avance}%`} ok={stats.avance === 100} />
        </section>

        <section className="grid gap-4 md:grid-cols-6">
          <Card title="Piezas" value={stats.total} />
          <Card title="Instaladas" value={stats.instaladas} ok />
          <Card title="Pendientes" value={stats.pendientes} />
          <Card title="Faltantes" value={stats.faltantes} danger={stats.faltantes > 0} />
          <Card title="Dañadas" value={stats.danadas} danger={stats.danadas > 0} />
          <Card title="Avance" value={`${stats.avance}%`} ok={stats.avance === 100} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-5">
            <Panel title="Orden e instalación">
              <div className="grid gap-3">
                <label>
                  <span className="label">Orden de producción</span>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="input"
                  >
                    <option value="">Seleccionar orden</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.client_name || "Cliente"} — {o.project_type || "Proyecto"} — {money(o.total)} — {o.status || "-"}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="label">Técnico / Equipo</span>
                  <input
                    value={tecnico}
                    onChange={(e) => setTecnico(e.target.value)}
                    className="input"
                  />
                </label>

                {selectedOrder && (
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-xs font-black text-slate-500">CLIENTE</p>
                    <h3 className="text-xl font-black">{selectedOrder.client_name || "-"}</h3>
                    <p className="text-sm text-slate-500">
                      Proyecto: {selectedOrder.project_type || "-"} · Tel: {selectedOrder.phone || "-"}
                    </p>
                    <p className="text-sm text-slate-500">
                      Estado: <b>{selectedOrder.status || "-"}</b>
                    </p>
                  </div>
                )}

                <button
                  onClick={crearInstalacion}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
                >
                  Crear instalación / checklist
                </button>
              </div>
            </Panel>

            <Panel title="Control de tiempo">
              <div className="grid gap-3 md:grid-cols-3">
                <button
                  onClick={() => marcarTiempo("hora_salida", "en ruta")}
                  className="rounded-2xl bg-blue-700 px-4 py-3 text-sm font-black text-white"
                >
                  Salida taller
                </button>
                <button
                  onClick={() => marcarTiempo("hora_llegada", "en obra")}
                  className="rounded-2xl bg-orange-600 px-4 py-3 text-sm font-black text-white"
                >
                  Llegué a obra
                </button>
                <button
                  onClick={cerrarInstalacion}
                  className="rounded-2xl bg-green-700 px-4 py-3 text-sm font-black text-white"
                >
                  Finalizar
                </button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <button
                  onClick={generarReportePDF}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
                >
                  Reporte PDF
                </button>

                <button
                  onClick={enviarWhatsAppCliente}
                  className="rounded-2xl bg-green-700 px-4 py-3 text-sm font-black text-white"
                >
                  WhatsApp cliente
                </button>
              </div>

              {selectedInstalacion && (
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                  <Info label="Estado" value={selectedInstalacion.estado || "-"} />
                  <Info label="Fecha" value={selectedInstalacion.fecha || "-"} />
                  <Info label="Salida" value={selectedInstalacion.hora_salida ? new Date(selectedInstalacion.hora_salida).toLocaleString("es-DO") : "-"} />
                  <Info label="Llegada" value={selectedInstalacion.hora_llegada ? new Date(selectedInstalacion.hora_llegada).toLocaleString("es-DO") : "-"} />
                  <Info label="Finalización" value={selectedInstalacion.hora_finalizacion ? new Date(selectedInstalacion.hora_finalizacion).toLocaleString("es-DO") : "-"} />
                </div>
              )}
            </Panel>

            <Panel title="Escáner QR instalación">
              <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                <input
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  placeholder="Escanea o pega código de pieza..."
                  className="input"
                />
                <button
                  onClick={() => procesarQR()}
                  className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white"
                >
                  Procesar QR
                </button>
              </div>

              <div className="mt-4">
                <QRScanner
                  onScan={(text) => {
                    setScanCode(text);
                    procesarQR(text);
                  }}
                />
              </div>
            </Panel>

            <Panel title="Fotos de instalación">
              <div className="grid gap-3 md:grid-cols-[140px_1fr_160px]">
                <select
                  value={fotoTipo}
                  onChange={(e) => setFotoTipo(e.target.value)}
                  className="input"
                >
                  <option value="antes">Antes</option>
                  <option value="durante">Durante</option>
                  <option value="despues">Después</option>
                  <option value="problema">Problema</option>
                </select>

                <input
                  value={fotoUrl}
                  onChange={(e) => setFotoUrl(e.target.value)}
                  placeholder="Pega URL de imagen / evidencia"
                  className="input"
                />

                <button
                  onClick={agregarFoto}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
                >
                  Guardar foto
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {instalacionFotos.map((f) => (
                  <a
                    href={f.url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    key={f.id}
                    className="rounded-2xl border bg-slate-50 p-3 text-sm"
                  >
                    <b>{f.tipo}</b>
                    <p className="break-all text-xs text-slate-500">{f.url}</p>
                  </a>
                ))}
              </div>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel title="Checklist industrial de piezas">
              <div className="mb-4">
                <div className="h-5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-green-600"
                    style={{ width: `${stats.avance}%` }}
                  />
                </div>
                <p className="mt-2 text-sm font-black text-green-700">
                  Avance instalación: {stats.avance}%
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <th className="p-3">Pieza</th>
                      <th>Medida</th>
                      <th>Material</th>
                      <th>Hoja</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>

                  <tbody>
                    {instalacionDetalles.map((d) => {
                      const p = piezaPorId(d.pieza_id);

                      return (
                        <tr key={d.id} className="border-b">
                          <td className="p-3 font-black">{p?.piece_name || d.pieza_id || "-"}</td>
                          <td>{p ? `${p.width_mm} x ${p.height_mm} mm` : "-"}</td>
                          <td>{p?.material || "-"}</td>
                          <td>{p?.sheet_number || "-"}</td>
                          <td>
                            <Status text={d.estado || "pendiente"} />
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => actualizarPieza(d, "instalada", "Instalada manual")}
                                className="rounded-xl bg-green-600 px-3 py-2 text-xs font-black text-white"
                              >
                                Instalada
                              </button>
                              <button
                                onClick={() => actualizarPieza(d, "faltante", "Reportada faltante")}
                                className="rounded-xl bg-yellow-600 px-3 py-2 text-xs font-black text-white"
                              >
                                Faltante
                              </button>
                              <button
                                onClick={() => actualizarPieza(d, "dañada", "Reportada dañada")}
                                className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white"
                              >
                                Dañada
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {instalacionDetalles.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-10 text-center text-slate-500">
                          Crea una instalación para ver el checklist.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Observaciones y firma del cliente">
              <label>
                <span className="label">Observaciones</span>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="input min-h-[110px]"
                  placeholder="Notas, faltantes, daños, condiciones de obra..."
                />
              </label>

              <button
                onClick={guardarObservaciones}
                className="mt-3 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
              >
                Guardar observaciones
              </button>

              <div className="mt-5">
                <SignaturePad onSave={guardarFirma} />
              </div>

              {selectedInstalacion?.cliente_firma && (
                <div className="mt-5 rounded-2xl border bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-black">Firma guardada</p>
                  <img
                    src={selectedInstalacion.cliente_firma}
                    alt="Firma del cliente"
                    className="max-h-32 rounded-xl bg-white"
                  />
                </div>
              )}
            </Panel>
          </div>
        </section>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 16px;
          border: 1px solid #dbe3ef;
          padding: 13px 14px;
          outline: none;
          background: white;
          font-size: 14px;
        }

        .input:focus {
          border-color: #0f172a;
          box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
        }

        .label {
          margin-bottom: 4px;
          display: block;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          color: #64748b;
        }

        @media (max-width: 768px) {
          main {
            padding: 10px !important;
          }

          h1 {
            font-size: 28px !important;
          }

          table {
            font-size: 12px;
          }

          button {
            min-height: 44px;
          }
        }
      `}</style>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 border-b pb-3 text-xl font-black">{title}</h2>
      {children}
    </section>
  );
}

function Card({
  title,
  value,
  danger,
  ok,
}: {
  title: string;
  value: any;
  danger?: boolean;
  ok?: boolean;
}) {
  return (
    <div
      className={`rounded-[24px] border bg-white p-4 shadow-sm ${
        danger ? "border-red-200" : ok ? "border-green-200" : "border-slate-200"
      }`}
    >
      <p
        className={`text-xs font-black uppercase ${
          danger ? "text-red-600" : ok ? "text-green-700" : "text-slate-500"
        }`}
      >
        {title}
      </p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border bg-white p-3">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function Status({ text }: { text: string }) {
  const value = String(text || "pendiente");
  const cls =
    value === "instalada" || value === "cerrada"
      ? "bg-green-100 text-green-700"
      : value === "faltante"
      ? "bg-yellow-100 text-yellow-700"
      : value === "dañada"
      ? "bg-red-100 text-red-700"
      : "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>
      {value}
    </span>
  );
}

function SignaturePad({ onSave }: { onSave: (base64: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  function getPoint(e: any) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();

    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function start(e: any) {
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = getPoint(e);
  }

  function move(e: any) {
    e.preventDefault();
    if (!drawingRef.current || !canvasRef.current || !lastRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const p = getPoint(e);

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    lastRef.current = p;
  }

  function end() {
    drawingRef.current = false;
    lastRef.current = null;
  }

  function clear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function save() {
    const canvas = canvasRef.current!;
    const base64 = canvas.toDataURL("image/png");
    onSave(base64);
  }

  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <p className="mb-2 text-sm font-black">Firma digital del cliente</p>

      <canvas
        ref={canvasRef}
        width={900}
        height={260}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        className="h-[180px] w-full rounded-xl border bg-white"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={save}
          className="rounded-xl bg-green-700 px-4 py-2 text-xs font-black text-white"
        >
          Guardar firma
        </button>
        <button
          onClick={clear}
          className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}

function QRScanner({ onScan }: { onScan: (text: string) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef("");

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let timer: number | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    async function startScanner() {
      try {
        setScannerError("");

        const Detector = (window as any).BarcodeDetector;
        if (!Detector) {
          setScannerError(
            "Este navegador no soporta escaneo QR nativo. Usa el input manual."
          );
          setEnabled(false);
          return;
        }

        const detector = new Detector({ formats: ["qr_code"] });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        timer = window.setInterval(async () => {
          const video = videoRef.current;
          if (!active || !video || !ctx || video.readyState < 2) return;

          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const codes = await detector.detect(canvas);
          const decodedText = codes?.[0]?.rawValue;
          if (!decodedText) return;

          const nowKey = `${decodedText}-${Math.floor(Date.now() / 2500)}`;
          if (lastScanRef.current === nowKey) return;

          lastScanRef.current = nowKey;
          onScan(decodedText);
        }, 450);
      } catch (error: any) {
        setScannerError(
          error?.message ||
            "No se pudo abrir la cámara. Revisa permisos o usa el input manual."
        );
      }
    }

    startScanner();

    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [enabled, onScan]);

  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black">Escáner QR con cámara</p>
          <p className="text-xs text-slate-500">
            Puedes usar cámara o escribir el código manualmente.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setScannerError("");
            setEnabled((value) => !value);
          }}
          className={`rounded-2xl px-4 py-2 text-xs font-black text-white ${
            enabled ? "bg-red-600" : "bg-green-600"
          }`}
        >
          {enabled ? "Apagar cámara" : "Activar cámara"}
        </button>
      </div>

      {enabled && (
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-64 w-full overflow-hidden rounded-xl bg-black object-cover"
        />
      )}

      {scannerError && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
          {scannerError}
        </p>
      )}
    </div>
  );
}
