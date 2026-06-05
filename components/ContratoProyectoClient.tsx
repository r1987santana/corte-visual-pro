"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ClipboardSignature,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  ShieldCheck,
  Signature,
  AlertTriangle,
  Copy,
  ExternalLink,
  Lock,
  MessageCircle,
  Unlock,
  CreditCard,
  UploadCloud,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  formatClientLegalDocument,
  getClientLegalDocumentFromRecord,
  type ClientLegalDocument,
} from "@/lib/clientLegalDocument";

type AnyRow = any;

function money(value: any) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function n(value: any) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitHardwareLighting(materials: AnyRow = {}) {
  const hardwareRaw = String(materials.hardware || "").trim();
  const lightsRaw = String(materials.lights || materials.lighting || materials.electrical || "").trim();

  if (lightsRaw && lightsRaw !== hardwareRaw) {
    return { hardware: hardwareRaw, lights: lightsRaw };
  }

  const parts = hardwareRaw
    .split(/\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const lightParts = parts.filter((part) => /luz|luces|led|iluminaci[oó]n|elect/i.test(part));
  const hardwareParts = parts.filter((part) => !/luz|luces|led|iluminaci[oó]n|elect/i.test(part));

  return {
    hardware: hardwareParts.length ? hardwareParts.join(", ") : hardwareRaw,
    lights: lightParts.join(", "),
  };
}

function contractPaymentInfo(contract: AnyRow | null) {
  const total = n(contract?.total_amount);
  const credit = n(contract?.credit_applied);
  const initial60 = n(contract?.initial_60) || total * 0.6;
  const initialPaid = n(contract?.initial_paid || contract?.paid_amount || contract?.amount_paid);
  const initialDue = Math.max(initial60 - initialPaid, 0);
  const delivery20 = n(contract?.delivery_20) || total * 0.2;
  const final20 = n(contract?.final_20) || total * 0.2;
  const finalPaid = n(contract?.final_paid);
  const finalDue = Math.max(final20 - credit - finalPaid, 0);

  return {
    total,
    credit,
    initial60,
    initialPaid,
    initialDue,
    delivery20,
    final20,
    finalDue,
    initialCovered: total > 0 && initialDue <= 0,
  };
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function createPortalToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function clientPortalUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/portal-cliente/${token}`;
}

function normalizeWhatsappPhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

function portalWhatsappUrl(contract: AnyRow, portalUrl: string) {
  const phone = normalizeWhatsappPhone(contract?.client_phone);
  const clientName = contract?.client_name ? ` ${contract.client_name}` : "";
  const message =
    `Hola${clientName}, este es tu portal privado de RD Wood System:\n\n` +
    `${portalUrl}\n\n` +
    "Ahi puedes ver el render aprobado por ti, contrato, pagos y avance del proyecto. " +
    "Por ahora lo abrimos desde este enlace hasta que la app este disponible en Play Store.";

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function contractLegalDocument(contract: AnyRow | null): ClientLegalDocument | null {
  if (!contract) return null;

  return (
    getClientLegalDocumentFromRecord(contract) ||
    getClientLegalDocumentFromRecord({
      client_document: contract.approved_materials?.client_document,
      document_type: contract.approved_materials?.client_document_type,
    }) ||
    contract._client_legal_document ||
    null
  );
}

export default function ContratoProyectoClient() {
  const [contracts, setContracts] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [supportFile, setSupportFile] = useState<File | null>(null);
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("quote_id");

  useEffect(() => {
    loadContracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  async function loadContracts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("project_contracts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    let rows = data || [];

    const clientIds = Array.from(
      new Set(rows.map((contract: AnyRow) => contract.client_id).filter(Boolean))
    );

    if (clientIds.length) {
      const { data: clientRows } = await supabase
        .from("clients")
        .select("id,notes")
        .in("id", clientIds);

      const legalByClientId = new Map<string, ClientLegalDocument>();

      (clientRows || []).forEach((client: AnyRow) => {
        const legalDocument = getClientLegalDocumentFromRecord(client);
        if (client.id && legalDocument) {
          legalByClientId.set(String(client.id), legalDocument);
        }
      });

      rows = rows.map((contract: AnyRow) => ({
        ...contract,
        _client_legal_document:
          contractLegalDocument(contract) ||
          legalByClientId.get(String(contract.client_id)) ||
          null,
      }));
    }

    setContracts(rows);

    if (quoteId && rows.length) {
      const matched = rows.find((contract: AnyRow) => String(contract.quote_id) === String(quoteId));
      setSelected(matched || rows[0]);
    } else if (!selected && rows.length) {
      setSelected(rows[0]);
    }

    setLoading(false);
  }

  function applyPortalState(contractId: string, patch: AnyRow) {
    setSelected((prev: AnyRow | null) => (prev?.id === contractId ? { ...prev, ...patch } : prev));
    setContracts((prev) => prev.map((contract) => (contract.id === contractId ? { ...contract, ...patch } : contract)));
  }

  async function ensureClientPortal(contract: AnyRow | null = selected) {
    if (!contract?.id) {
      throw new Error("Selecciona un contrato.");
    }

    const token = contract.client_portal_token || createPortalToken();
    const portalUrl = contract.client_portal_url || clientPortalUrl(token);
    const portalPatch = {
      client_portal_token: token,
      client_portal_url: portalUrl,
      portal_enabled: true,
      portal_enabled_at: contract.portal_enabled_at || new Date().toISOString(),
    };

    const { error } = await supabase.from("project_contracts").update(portalPatch).eq("id", contract.id);
    if (error) throw error;

    applyPortalState(contract.id, portalPatch);
    return portalUrl;
  }

  async function openClientPortal() {
    setPortalBusy(true);
    try {
      const portalUrl = await ensureClientPortal();
      window.open(portalUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      alert(error?.message || "No se pudo generar el portal cliente.");
    } finally {
      setPortalBusy(false);
    }
  }

  async function copyClientPortalLink() {
    setPortalBusy(true);
    try {
      const portalUrl = await ensureClientPortal();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(portalUrl);
        alert("Link del portal cliente copiado.");
      } else {
        window.prompt("Copia este link del portal cliente:", portalUrl);
      }
    } catch (error: any) {
      alert(error?.message || "No se pudo copiar el link del portal.");
    } finally {
      setPortalBusy(false);
    }
  }

  async function sendClientPortalWhatsapp() {
    if (!selected) {
      alert("Selecciona un contrato.");
      return;
    }

    setPortalBusy(true);
    try {
      const portalUrl = await ensureClientPortal(selected);
      window.open(portalWhatsappUrl(selected, portalUrl), "_blank", "noopener,noreferrer");
    } catch (error: any) {
      alert(error?.message || "No se pudo abrir WhatsApp con el portal.");
    } finally {
      setPortalBusy(false);
    }
  }

  async function acceptContract() {
    if (!selected?.id) {
      alert("Selecciona un contrato.");
      return;
    }

    if (!contractLegalDocument(selected)?.number) {
      alert("Falta la cedula, pasaporte o RNC del cliente. Completa el documento legal antes de firmar el contrato.");
      return;
    }

    if (!signature.trim()) {
      alert("Escribe el nombre del cliente como firma/aceptación.");
      return;
    }

    if (!confirm("¿Confirmas que el cliente acepta el contrato, render, medidas, materiales y plan de pagos?")) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.rpc("accept_project_contract", {
        p_contract_id: selected.id,
        p_client_signature: signature.trim(),
      });

      if (error) throw error;

      await loadContracts();
      alert("✅ Contrato aceptado y firmado.");
    } catch (error: any) {
      alert(error?.message || "Error aceptando contrato.");
    } finally {
      setSaving(false);
    }
  }


  async function uploadSupportFile(contractId: string) {
    if (!supportFile) {
      return {
        support_url: null,
        support_name: null,
        support_path: null,
      };
    }

    const safeName = supportFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `payment-supports/contracts/${contractId}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from("payment-supports")
      .upload(path, supportFile, {
        upsert: true,
        contentType: supportFile.type || "application/octet-stream",
      });

    if (error) throw error;

    const { data } = supabase.storage.from("payment-supports").getPublicUrl(path);

    return {
      support_url: data.publicUrl,
      support_name: supportFile.name,
      support_path: path,
    };
  }

  async function registerInitialPayment() {
    if (!selected?.id) {
      alert("Selecciona un contrato.");
      return;
    }

    const amount = Number(paymentAmount || 0);

    if (!amount || amount <= 0) {
      alert("Coloca un monto válido.");
      return;
    }

    if (paymentMethod.toLowerCase() !== "efectivo" && !supportFile) {
      alert("Para métodos diferentes a efectivo debes subir soporte.");
      return;
    }

    setSaving(true);

    try {
      const support = await uploadSupportFile(selected.id);

      const { data, error } = await supabase.rpc("register_contract_initial_payment", {
        p_contract_id: selected.id,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_reference_external: paymentReference || null,
        p_support_url: support.support_url,
        p_support_name: support.support_name,
        p_support_path: support.support_path,
        p_notes: paymentNotes || null,
      });

      if (error) throw error;

      setPaymentOpen(false);
      setSupportFile(null);
      setPaymentReference("");
      setPaymentNotes("");
      await loadContracts();

      const incomeCode = data?.income_code || "ING";

      // =====================================================
      // ACTIVAR PORTAL CLIENTE AUTOMÁTICO AL CUBRIR EL 60%
      // El abono de medicion/render se reserva para el 20% final, no para el inicial.
      // =====================================================
      let portalUrlForReceipt = selected.client_portal_url || "";
      let portalWasEnabledNow = false;

      try {
        const paymentInfo = contractPaymentInfo(selected);
        const totalProject = paymentInfo.total;
        const initialRequired = paymentInfo.initial60;
        const paidTowardInitial = paymentInfo.initialPaid + amount;
        const shouldEnablePortal = totalProject > 0 && paidTowardInitial >= initialRequired;

        if (shouldEnablePortal) {
          const token = selected.client_portal_token || createPortalToken();
          const portalUrl = selected.client_portal_url || clientPortalUrl(token);

          const { error: portalError } = await supabase
            .from("project_contracts")
            .update({
              client_portal_token: token,
              client_portal_url: portalUrl,
              portal_enabled: true,
              portal_enabled_at: selected.portal_enabled_at || new Date().toISOString(),
            })
            .eq("id", selected.id);

          if (portalError) throw portalError;

          portalUrlForReceipt = portalUrl;
          portalWasEnabledNow = !selected.portal_enabled;

          setSelected((prev: AnyRow | null) =>
            prev
              ? {
                  ...prev,
                  client_portal_token: token,
                  client_portal_url: portalUrl,
                  portal_enabled: true,
                  portal_enabled_at: prev.portal_enabled_at || new Date().toISOString(),
                }
              : prev
          );

          setContracts((prev) =>
            prev.map((contract) =>
              contract.id === selected.id
                ? {
                    ...contract,
                    client_portal_token: token,
                    client_portal_url: portalUrl,
                    portal_enabled: true,
                    portal_enabled_at: contract.portal_enabled_at || new Date().toISOString(),
                  }
                : contract
            )
          );
        }
      } catch (portalError) {
        console.error("Error creando portal cliente:", portalError);
        alert("Pago registrado, pero no se pudo activar el portal cliente automáticamente. Revisa las columnas del portal en project_contracts.");
      }

      const receiptHtml = `
        <html>
          <head>
            <title>RECIBO ${incomeCode}</title>
            <style>
              body { margin: 0; padding: 22px; font-family: Arial, sans-serif; color: #111; background: #fff; }
              .page { max-width: 880px; margin: 0 auto; }
              .copy { border: 1.5px solid #111; border-radius: 16px; padding: 18px; margin-bottom: 18px; page-break-inside: avoid; }
              .copy.client { border-color: #005c99; }
              .copy.cash { border-color: #078a4f; }
              .top { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
              .brand { letter-spacing: 5px; color: #005c99; font-weight: 900; font-size: 11px; }
              h1 { margin: 6px 0 0; font-size: 24px; }
              .stamp { border-radius: 999px; padding: 7px 12px; font-size: 11px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; background: #f3f7fb; color: #005c99; border: 1px solid #b7d7ee; white-space: nowrap; }
              .copy.cash .stamp { background: #effaf4; color: #078a4f; border-color: #9bd7b8; }
              .muted { color: #555; margin-top: 5px; font-size: 12px; }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; margin-top: 14px; }
              .field { border-bottom: 1px solid #e5e5e5; padding-bottom: 7px; }
              .label { font-weight: 900; color: #555; text-transform: uppercase; font-size: 10px; letter-spacing: 0.08em; }
              .value { margin-top: 3px; font-weight: 800; font-size: 13px; }
              .amount { margin-top: 14px; border-radius: 14px; background: #f6f8fb; border: 1px solid #ddd; padding: 14px; display: flex; justify-content: space-between; align-items: center; }
              .total { font-size: 28px; font-weight: 900; color: #078a4f; }
              .note { margin-top: 12px; padding: 10px 12px; border-left: 4px solid #005c99; background: #f3f7fb; font-size: 12px; line-height: 1.35; }
              .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; margin-top: 30px; }
              .line { border-top: 1px solid #111; padding-top: 7px; text-align: center; font-size: 12px; }
              .cut { text-align: center; color: #777; font-size: 11px; margin: 6px 0 18px; }
              @media print { body { padding: 8mm; } .copy { margin-bottom: 10mm; } .cut { margin: 2mm 0 6mm; } }
            </style>
          </head>
          <body>
            <div class="page">
              ${["COPIA CLIENTE", "SOPORTE CAJA"].map((copyLabel, index) => `
                <section class="copy ${index === 0 ? "client" : "cash"}">
                  <div class="top">
                    <div>
                      <div class="brand">RDSS SANTANA GROUP</div>
                      <h1>RECIBO DE INGRESO</h1>
                      <p class="muted">Pago inicial registrado para contrato / producción.</p>
                    </div>
                    <div class="stamp">${copyLabel}</div>
                  </div>

                  <div class="grid">
                    <div class="field"><div class="label">Código ingreso</div><div class="value">${incomeCode}</div></div>
                    <div class="field"><div class="label">Fecha</div><div class="value">${new Date().toLocaleString("es-DO")}</div></div>
                    <div class="field"><div class="label">Cliente</div><div class="value">${selected.client_name || "-"}</div></div>
                    <div class="field"><div class="label">Teléfono</div><div class="value">${selected.client_phone || "-"}</div></div>
                    <div class="field"><div class="label">Contrato</div><div class="value">${selected.contract_code || "-"}</div></div>
                    <div class="field"><div class="label">Proyecto</div><div class="value">${selected.project_name || "-"}</div></div>
                    <div class="field"><div class="label">Método de pago</div><div class="value">${paymentMethod}</div></div>
                    <div class="field"><div class="label">Referencia</div><div class="value">${paymentReference || "-"}</div></div>
                    <div class="field"><div class="label">Soporte</div><div class="value">${support.support_name || "-"}</div></div>
                    <div class="field"><div class="label">Concepto</div><div class="value">Pago inicial 60% / contrato firmado</div></div>
                  </div>

                  <div class="amount">
                    <div class="label">Monto recibido</div>
                    <div class="total">${money(amount)}</div>
                  </div>

                  ${portalUrlForReceipt ? `
                    <div class="note" style="border-left-color:#6d28d9;background:#f5f3ff;">
                      <b>Portal privado del cliente activo:</b><br/>
                      <span style="font-size:13px;word-break:break-all;">${portalUrlForReceipt}</span><br/>
                      El cliente podrá consultar su render aprobado, contrato, pagos, avance de producción, fotos, instalación y entrega.
                    </div>
                  ` : ""}

                  <div class="note">
                    Este ingreso queda registrado y rastreable para el cuadre diario de caja. La copia de caja debe archivarse con el soporte de pago cuando aplique.
                  </div>

                  <div class="sign">
                    <div class="line">Cliente / Pagador</div>
                    <div class="line">Caja / RD Wood System</div>
                  </div>
                </section>
                ${index === 0 ? `<div class="cut">✂ cortar aquí — copia cliente arriba / soporte caja abajo</div>` : ""}
              `).join("")}
            </div>
            <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 500); };</script>
          </body>
        </html>
      `;

      const receiptWindow = window.open("", "_blank", "width=900,height=900");

      if (receiptWindow) {
        receiptWindow.document.write(receiptHtml);
        receiptWindow.document.close();
      } else {
        alert("Pago registrado, pero el navegador bloqueó la ventana del recibo. Permite popups para imprimir.");
      }

      if (portalUrlForReceipt) {
        alert(
          `✅ Pago inicial registrado correctamente. Ingreso: ${incomeCode}\n\n` +
            `${portalWasEnabledNow ? "Portal cliente activado" : "Portal cliente disponible"}:\n${portalUrlForReceipt}`
        );
      } else {
        alert(`✅ Pago inicial registrado correctamente. Ingreso: ${incomeCode}`);
      }
    } catch (error: any) {
      alert(error?.message || "Error registrando pago inicial.");
    } finally {
      setSaving(false);
    }
  }

  async function releaseProduction() {
    if (!selected?.quote_id) {
      alert("El contrato no tiene cotización vinculada.");
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase.rpc("release_quote_to_production_if_paid", {
        p_quote_id: selected.quote_id,
      });

      if (error) throw error;

      await loadContracts();
      alert(String(data || "Proceso ejecutado."));
    } catch (error: any) {
      alert(error?.message || "Error liberando producción.");
    } finally {
      setSaving(false);
    }
  }

  function printContract() {
    if (!selected) {
      alert("Selecciona un contrato.");
      return;
    }

    const measurements = selected.approved_measurements || {};
    const materials = selected.approved_materials || {};
    const separatedMaterials = splitHardwareLighting(materials);
    const modules = Array.isArray(selected.approved_modules) ? selected.approved_modules : [];
    const legalDocument = contractLegalDocument(selected);

    const moduleRows = modules.length
      ? modules.map((m: any, i: number) => `
          <tr>
            <td>${i + 1}</td>
            <td>${m.name || m.module_name || m.description || "Módulo"}</td>
            <td>${m.width_mm || m.width_m || m.width || "-"} x ${m.height_mm || m.height_m || m.height || "-"} x ${m.depth_mm || m.depth_m || m.depth || "-"}</td>
            <td>${m.material || materials.material || "-"}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="4">Los módulos aprobados se encuentran definidos por la cotización, render, mediciones y documentación anexa.</td></tr>`;

    const html = `
      <html>
        <head>
          <title>${selected.contract_code}</title>
          <style>
            body{font-family:Arial;margin:34px;color:#111;line-height:1.45}
            h1{font-size:28px;margin:0}
            h2{font-size:17px;margin-top:24px;border-bottom:2px solid #111;padding-bottom:5px}
            .brand{letter-spacing:6px;color:#005c99;font-weight:900;font-size:12px}
            .muted{color:#555}
            .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:18px 0}
            .box{border:1px solid #222;border-radius:12px;padding:12px}
            .label{font-size:10px;text-transform:uppercase;color:#666;font-weight:900}
            .value{font-size:16px;font-weight:900}
            table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}
            th{background:#07111f;color:#fff;text-align:left;padding:8px}
            td{border:1px solid #ddd;padding:8px;vertical-align:top}
            .clause{border-left:4px solid #005c99;padding:10px 14px;background:#f3f7fb;margin:10px 0}
            .warn{border-left:4px solid #c47a00;background:#fff8e6}
            .ok{border-left:4px solid #078a4f;background:#effaf4}
            .company-data{margin-top:8px;font-size:12px;font-weight:900;color:#111}
            .notary{margin-top:42px;border:1px solid #111;padding:18px;font-family:"Times New Roman",serif;font-size:14px;line-height:1.55;text-align:justify;page-break-inside:avoid;break-inside:avoid}
            .notary-title{font-weight:900;text-transform:uppercase;text-align:center;margin-bottom:10px}
            .notary-sign{margin:46px auto 0;max-width:360px;border-top:1px solid #111;text-align:center;padding-top:8px;font-weight:900}
            .sign{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:55px;page-break-inside:avoid;break-inside:avoid}
            .line{border-top:1px solid #111;text-align:center;padding-top:8px}
            @media print{body{margin:14mm}}
          </style>
        </head>
        <body>
          <div class="brand">RDSS SANTANA GROUP</div>
          <p class="company-data">Empresa contratada: RDSS SANTANA GROUP, RNC 133-45900-2.</p>
          <h1>CONTRATO DE FABRICACIÓN, SUMINISTRO E INSTALACIÓN</h1>
          <p class="muted">Contrato: ${selected.contract_code || "-"} · Fecha: ${formatDate(selected.created_at)}</p>

          <div class="grid">
            <div class="box">
              <div class="label">Cliente</div>
              <div class="value">${selected.client_name || "-"}</div>
              <p>${selected.client_phone || ""}<br/>${selected.client_email || ""}<br/>${selected.client_address || ""}<br/><b>Documento:</b> ${formatClientLegalDocument(legalDocument)}</p>
            </div>
            <div class="box">
              <div class="label">Proyecto</div>
              <div class="value">${selected.project_name || "-"}</div>
              <p>Tipo: ${selected.project_type || "-"}<br/>Monto: ${money(selected.total_amount)}</p>
            </div>
          </div>

          <h2>1. Render aprobado por el cliente</h2>
          <p>Este contrato se genera únicamente después de que el cliente aprueba el render del proyecto. El render aprobado forma parte integral del contrato.</p>
          ${selected.approved_render_url ? `<p><b>Render aprobado:</b> ${selected.approved_render_url}</p>` : ""}
          ${selected.approved_render_notes ? `<p><b>Notas aprobación:</b> ${selected.approved_render_notes}</p>` : ""}

          <h2>2. Alcance aprobado</h2>
          <p>El cliente declara que revisó y aprueba el proyecto descrito en la cotización, render, medidas, materiales, colores, herrajes, módulos y condiciones comerciales asociadas.</p>

          <table>
            <thead><tr><th>Concepto</th><th>Detalle aprobado</th></tr></thead>
            <tbody>
              <tr><td>Material</td><td>${materials.material || "-"}</td></tr>
              <tr><td>Color</td><td>${materials.color || "-"}</td></tr>
              <tr><td>Herrajes</td><td>${separatedMaterials.hardware || "-"}</td></tr>
              <tr><td>Luces / detalles electricos</td><td>${separatedMaterials.lights || "-"}</td></tr>
              <tr><td>Medidas</td><td>Ancho: ${measurements.width_m || "-"}m · Alto: ${measurements.height_m || "-"}m · Profundidad: ${measurements.depth_m || "-"}m · Pies lineales: ${measurements.linear_feet || "-"} · M²: ${measurements.square_meters || "-"}</td></tr>
            </tbody>
          </table>

          <h2>3. Módulos aprobados</h2>
          <table>
            <thead><tr><th>#</th><th>Módulo</th><th>Medidas</th><th>Material</th></tr></thead>
            <tbody>${moduleRows}</tbody>
          </table>

          <h2>4. Proyecto blindado después de aprobación del render</h2>
          <div class="clause warn">
            Luego de aprobado el render, dimensiones, distribución, materiales, colores, herrajes y este contrato, el proyecto queda cerrado para producción. Cualquier cambio solicitado por el cliente, incluyendo medidas, diseño, color, material, herraje, distribución o ubicación, genera costo adicional, posible variación de precio y extensión del tiempo de entrega. Todo cambio deberá cotizarse y aprobarse por escrito antes de ejecutarse.
          </div>

          <h2>5. Condiciones de pago 60/20/20</h2>
          <table>
            <thead><tr><th>Etapa</th><th>Monto</th><th>Condición</th></tr></thead>
            <tbody>
              <tr><td>Total contractual del proyecto</td><td>${money(selectedPayment.total)}</td><td>Monto total aprobado, sin reducir por abonos previos.</td></tr>
              <tr><td>Abono medición/render reservado</td><td>${money(selectedPayment.credit)}</td><td>Este abono se reserva como crédito para descontarse del 20% final, no del 60% inicial.</td></tr>
              <tr><td>Inicial 60%</td><td>${money(selectedPayment.initial60)}</td><td>Monto completo requerido para liberar producción.</td></tr>
              <tr><td>Entrega de módulos 20%</td><td>${money(selectedPayment.delivery20)}</td><td>Monto completo pagadero antes de cargar/salir a transporte.</td></tr>
              <tr><td>Entrega final 20%</td><td>${money(selectedPayment.final20)}</td><td>Monto contractual completo de cierre; aquí se aplica el crédito reservado de medición/render.</td></tr>
              <tr><td>Entrega final pendiente despues del abono</td><td>${money(selectedPayment.finalDue)}</td><td>Monto real a pagar al cierre luego de descontar el abono de medicion/render.</td></tr>
            </tbody>
          </table>

          <div class="clause warn">
            La falta de pago según las etapas acordadas autoriza a RDSS SANTANA GROUP a pausar producción, transporte, instalación o entrega, sin que esto constituya incumplimiento por parte de la empresa. Los saldos vencidos podrán ser reclamados por las vías correspondientes.
          </div>

          <h2>6. Protección del cliente</h2>
          <div class="clause ok">
            RDSS SANTANA GROUP se compromete a entregar el proyecto conforme al render, medidas, materiales, colores, herrajes y calidad aprobada. Si ocurre un error atribuible directamente a la empresa en fabricación o instalación, la empresa deberá corregirlo sin costo adicional para el cliente, dentro de un plazo no mayor de veinticinco (25) días laborables.
          </div>

          <h2>7. Tiempos de entrega</h2>
          <p>${selected.delivery_terms || ""}</p>

          <h2>8. Garantía</h2>
          <p>${selected.warranty_terms || ""}</p>

          <h2>9. Aceptación</h2>
          <p>Ambas partes aceptan que este documento, junto con la cotización, render aprobado, mediciones y anexos, constituye el acuerdo base del proyecto suscrito entre el cliente y RDSS SANTANA GROUP, RNC 133-45900-2.</p>
          <div class="clause">
            El cliente acepta que las condiciones aprobadas son la base de producción. Cambios posteriores, retrasos causados por falta de acceso, modificaciones en obra, decisiones tardías, falta de pago o condiciones externas no imputables a la empresa podrán generar costos adicionales y extensión del plazo.
          </div>

          <div class="sign">
            <div class="line">
              Cliente<br/>
              ${selected.client_signature || selected.client_name || ""}
            </div>
            <div class="line">
              Representante<br/>
              RDSS SANTANA GROUP<br/>
              RNC 133-45900-2
            </div>
          </div>

          <div class="notary">
            <div class="notary-title">Legalización notarial de firmas</div>
            <p>
              YO, LICDO. DIONICIO MARTIRE JOSEFES RUIZ, abogado Notario Público de los del número para este Municipio de La Romana, portador del carnet No. 7130, portador de la Cédula de Identidad y Electoral No. 026-0014926-0, con estudio profesional abierto en el Edificio No. 2, Apartamento No. 1B, Manzana (P), Residencial el INVI de esta ciudad de La Romana, República Dominicana, CERTIFICO Y DOY FE; que las firmas que anteceden al presente escrito fueron puestas en mi presencia por el cliente y por el representante de RDSS SANTANA GROUP, RNC 133-45900-2, cuyas generales y calidades constan en el mismo, quienes me han declarado bajo la fe del juramento que tales son las firmas que acostumbran a usar en todos sus documentos tanto públicos como privados, por lo que se les debe dar entero crédito y fe.
            </p>
            <p>
              En la ciudad, municipio y provincia de La Romana, República Dominicana, a los ______ días del mes de __________________ del año Dos Mil Veintiséis (2026).
            </p>
            <div class="notary-sign">
              LICDO. DIONICIO MARTIRE JOSEFES RUIZ<br/>
              Abogado Notario Público
            </div>
          </div>

          <script>window.print()</script>
        </body>
      </html>
    `;

    const win = window.open("", "_blank");
    if (!win) {
      alert("Permite popups para imprimir contrato.");
      return;
    }
    win.document.write(html);
    win.document.close();
  }

  const selectedPayment = contractPaymentInfo(selected);

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-6 text-white">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="rounded-[30px] border border-cyan-900/60 bg-gradient-to-br from-[#07111f] to-[#111b38] p-6 shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-700 bg-cyan-500/10 px-3 py-1 text-xs font-black tracking-[0.25em] text-cyan-300">
                <ShieldCheck size={14} /> FASE 29B · CONTRATO DESDE RENDER APROBADO
              </div>
              <h1 className="mt-4 text-4xl font-black lg:text-5xl">Contratos Generados por Render</h1>
              <p className="mt-2 max-w-4xl text-slate-300">
                El contrato se genera automáticamente cuando el cliente aprueba el render. Aquí solo se firma, imprime y libera producción.
              </p>
            </div>

            <button onClick={loadContracts} disabled={loading} className="flex h-12 items-center gap-2 rounded-2xl bg-white px-5 font-black text-slate-950">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              Actualizar
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Kpi icon={<FileText />} label="Contratos" value={contracts.length} />
          <Kpi icon={<ClipboardSignature />} label="Pendientes firma" value={contracts.filter((c) => c.status !== "firmado").length} />
          <Kpi icon={<CheckCircle2 />} label="Firmados" value={contracts.filter((c) => c.status === "firmado").length} />
          <Kpi icon={<Lock />} label="Origen" value="Render" />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">
          <aside className="rounded-[30px] border border-cyan-900/60 bg-[#07111f] p-5">
            <h2 className="mb-4 text-xl font-black">Contratos</h2>
            <p className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              No se generan contratos manualmente aquí. El contrato nace al aprobar el render en IA Diseño.
            </p>

            <div className="max-h-[720px] space-y-3 overflow-auto pr-1">
              {contracts.map((contract) => (
                <button
                  key={contract.id}
                  onClick={() => setSelected(contract)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selected?.id === contract.id ? "border-cyan-400 bg-cyan-500/10" : "border-slate-800 bg-slate-950 hover:border-cyan-900"
                  }`}
                >
                  <div className="text-xs font-black text-cyan-300">{contract.contract_code}</div>
                  <div className="mt-1 font-black">{contract.client_name}</div>
                  <div className="text-xs text-slate-400">{contract.project_name}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-black text-emerald-300">{money(contract.total_amount)}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${
                      contract.status === "firmado" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"
                    }`}>
                      {contract.status}
                    </span>
                  </div>
                </button>
              ))}

              {!contracts.length ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-center text-sm text-slate-400">
                  Todavía no hay contratos. Aprueba un render en IA Diseño.
                </div>
              ) : null}
            </div>
          </aside>

          <section className="space-y-5">
            {!selected ? (
              <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-10 text-center text-slate-400">
                Selecciona un contrato generado desde un render aprobado.
              </div>
            ) : (
              <>
                <div className="rounded-[30px] border border-cyan-900/60 bg-[#07111f] p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">{selected.contract_code}</p>
                      <h2 className="mt-2 text-3xl font-black">{selected.project_name}</h2>
                      <p className="mt-1 text-slate-400">{selected.client_name} · {selected.client_phone}</p>
                      <p className="mt-1 text-sm font-bold text-cyan-100">
                        {formatClientLegalDocument(contractLegalDocument(selected))}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button onClick={printContract} className="flex h-11 items-center gap-2 rounded-2xl bg-white px-4 font-black text-slate-950">
                        <Printer size={18} />
                        Imprimir PDF
                      </button>

                      <button
                        onClick={acceptContract}
                        disabled={saving || selected.status === "firmado"}
                        className="flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-4 font-black disabled:opacity-50"
                      >
                        <Signature size={18} />
                        Firmar/Aceptar
                      </button>

                      <button
                        onClick={() => {
                          window.open(`/pagos?contract_id=${selected.id}&stage=initial_60`, "_blank", "noopener,noreferrer");
                        }}
                        disabled={saving || selected.status !== "firmado" || selectedPayment.initialCovered}
                        className="flex h-11 items-center gap-2 rounded-2xl bg-emerald-700 px-4 font-black disabled:opacity-50"
                      >
                        <CreditCard size={18} />
                        {selectedPayment.initialCovered ? "Inicial 60% pagado" : "Caja Principal 60%"}
                      </button>

                      <button
                        onClick={releaseProduction}
                        disabled={saving || selected.status !== "firmado" || !selectedPayment.initialCovered}
                        className="flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-4 font-black disabled:opacity-50"
                      >
                        <Unlock size={18} />
                        Liberar Producción
                      </button>

                      <button
                        onClick={openClientPortal}
                        disabled={portalBusy}
                        className="flex h-11 items-center gap-2 rounded-2xl bg-purple-600 px-4 font-black hover:bg-purple-500 disabled:opacity-50"
                      >
                        {portalBusy ? <Loader2 className="animate-spin" size={18} /> : <ExternalLink size={18} />}
                        Portal Cliente
                      </button>

                      <button
                        onClick={sendClientPortalWhatsapp}
                        disabled={portalBusy}
                        className="flex h-11 items-center gap-2 rounded-2xl bg-emerald-500 px-4 font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                      >
                        <MessageCircle size={18} />
                        WhatsApp Portal
                      </button>

                      <button
                        onClick={copyClientPortalLink}
                        disabled={portalBusy}
                        className="flex h-11 items-center gap-2 rounded-2xl bg-slate-800 px-4 font-black hover:bg-slate-700 disabled:opacity-50"
                      >
                        <Copy size={18} />
                        Copiar Link
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                  <Kpi icon={<FileText />} label="Total proyecto" value={money(selectedPayment.total)} />
                  <Kpi icon={<CheckCircle2 />} label="Abono reservado final" value={money(selectedPayment.credit)} />
                  <Kpi icon={<AlertTriangle />} label="Inicial pendiente" value={money(selectedPayment.initialDue)} />
                  <Kpi icon={<CreditCard />} label="Final pendiente" value={money(selectedPayment.finalDue)} />
                  <Kpi icon={<ShieldCheck />} label="Estado" value={selected.status} />
                  <Kpi icon={<Unlock />} label="Portal cliente" value={selected.portal_enabled ? "Activo" : "No activo"} />
                </div>

                <div className="rounded-[30px] border border-cyan-900/60 bg-[#07111f] p-6">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Portal cliente</p>
                      <h3 className="mt-2 text-2xl font-black">Render autorizado</h3>
                    </div>
                    <span className="rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-xs font-black uppercase text-purple-100">
                      {selected.client_portal_url ? "Link generado" : "Listo para generar"}
                    </span>
                  </div>

                  {selected.approved_render_url ? (
                    <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-slate-950">
                      <img
                        src={selected.approved_render_url}
                        alt={`Render aprobado de ${selected.project_name || "proyecto"}`}
                        className="max-h-[520px] w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="mt-5 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm font-bold text-amber-100">
                      Este contrato aun no tiene foto de render aprobado guardada.
                    </div>
                  )}

                  {selected.client_portal_url ? (
                    <a
                      href={selected.client_portal_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 block break-all rounded-2xl border border-purple-400/30 bg-purple-500/10 p-4 text-sm font-bold text-purple-100 hover:bg-purple-500/15"
                    >
                      {selected.client_portal_url}
                    </a>
                  ) : null}
                </div>

                <div className="rounded-[30px] border border-cyan-900/60 bg-[#07111f] p-6">
                  <h3 className="mb-4 text-2xl font-black">Firma / aceptación del cliente</h3>
                  <input
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Escribe el nombre del cliente como firma"
                    className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 outline-none focus:border-cyan-400"
                  />
                  <p className="mt-3 text-sm text-slate-400">
                    Al aceptar, el cliente confirma render, medidas, módulos, materiales, colores, herrajes, precio y condiciones de pago.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  <ClauseCard
                    title="Contrato generado desde render aprobado"
                    tone="success"
                    text="Este contrato nace únicamente después de que el cliente aprueba el render en IA Diseño. No se genera manualmente desde una cotización sin render aprobado."
                  />

                  <ClauseCard
                    title="Proyecto blindado"
                    tone="warning"
                    text="Luego de aprobado el render, medidas, distribución, materiales, colores y herrajes, el proyecto queda cerrado. Cualquier cambio solicitado por el cliente genera costo adicional, tiempo adicional y requiere aprobación por escrito."
                  />

                  <ClauseCard
                    title="Pago 60/20/20"
                    text={`Inicial pendiente: ${money(selectedPayment.initialDue)}. Entrega de modulos: ${money(selectedPayment.delivery20)}. Entrega final 20%: ${money(selectedPayment.final20)}. Final pendiente despues del abono: ${money(selectedPayment.finalDue)}.`}
                  />

                  <ClauseCard
                    title="Protección de ambas partes"
                    text="RD Wood debe entregar lo aprobado. El cliente debe cumplir pagos y aceptar que cambios posteriores generan costos y tiempos adicionales."
                  />
                </div>
              </>
            )}
          </section>
        </section>
      </div>
      {paymentOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[30px] border border-cyan-900/70 bg-[#07111f] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                  Registro de ingreso auditable
                </p>
                <h3 className="mt-2 text-3xl font-black">Pago inicial 60%</h3>
                <p className="mt-1 text-slate-400">
                  {selected.client_name} · {selected.contract_code}
                </p>
              </div>

              <button
                onClick={() => setPaymentOpen(false)}
                className="rounded-2xl bg-red-500/15 p-3 text-red-200 hover:bg-red-500/25"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Monto</span>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 font-black outline-none focus:border-cyan-400"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Método de pago</span>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 font-black outline-none focus:border-cyan-400"
                >
                  <option>Efectivo</option>
                  <option>Transferencia</option>
                  <option>Tarjeta</option>
                  <option>Cheque</option>
                  <option>Otro</option>
                </select>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Referencia externa</span>
                <input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="No. transferencia / voucher / recibo"
                  className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 outline-none focus:border-cyan-400"
                />
              </label>

              <label className="md:col-span-2">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => setSupportFile(e.target.files?.[0] || null)}
                />
                <div className="flex min-h-[110px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-800 bg-cyan-500/5 p-4 text-center hover:bg-cyan-500/10">
                  <UploadCloud className="mb-2 text-cyan-300" size={30} />
                  <p className="font-black">
                    {supportFile ? supportFile.name : paymentMethod === "Efectivo" ? "Soporte opcional para efectivo" : "Subir soporte obligatorio"}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Imagen o PDF del comprobante
                  </p>
                </div>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Notas internas</span>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                  placeholder="Observación de caja / administración"
                />
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              Este pago crea registro en client_payments, income_records y audit_logs con código automático y trazabilidad.
            </div>

            <button
              onClick={registerInitialPayment}
              disabled={saving}
              className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-4 font-black disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
              Registrar pago e ingreso auditable
            </button>
          </div>
        </div>
      ) : null}

    </main>
  );
}

function Kpi({ icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-[#07111f] p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</div>
        <div className="rounded-2xl bg-cyan-500/10 p-2 text-cyan-300">{icon}</div>
      </div>
      <div className="mt-3 text-xl font-black">{value}</div>
    </div>
  );
}

function ClauseCard({ title, text, tone }: { title: string; text: string; tone?: "warning" | "success" }) {
  const cls =
    tone === "warning"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
      : tone === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
      : "border-cyan-900/60 bg-[#07111f] text-slate-200";

  return (
    <div className={`rounded-[28px] border p-5 ${cls}`}>
      <h4 className="text-xl font-black">{title}</h4>
      <p className="mt-3 text-sm leading-6">{text}</p>
    </div>
  );
}
