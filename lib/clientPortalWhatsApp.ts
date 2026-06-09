export type ClientPortalWhatsAppQuote = {
  client_name?: string | null;
  client_phone?: string | null;
  project_name?: string | null;
};

export function digitsOnly(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

export function clientPhoneFromQuote(q?: ClientPortalWhatsAppQuote | null) {
  return String(q?.client_phone || "");
}

export function whatsappPhone(value: unknown) {
  const digits = digitsOnly(value);
  if (!digits) return "";
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

export function clientPortalWhatsAppMessage(
  q: ClientPortalWhatsAppQuote,
  portalUrl: string,
  variantsCount: number
) {
  const firstName = String(q.client_name || "cliente").trim().split(/\s+/)[0] || "cliente";
  const projectName = String(q.project_name || "tu proyecto").trim() || "tu proyecto";
  return [
    `Hola ${firstName}, soy RD Wood System.`,
    `Ya tenemos listas las ${variantsCount} opciones de render para ${projectName}.`,
    "Puedes revisar y aprobar la opcion que prefieras aqui:",
    portalUrl,
    "",
    "Cuando elijas una variante, el sistema continua a cotizacion.",
  ].join("\n");
}

export function whatsappLinkForClient(
  q: ClientPortalWhatsAppQuote | null,
  portalUrl: string,
  variantsCount = 5
) {
  if (!q || !portalUrl) return "";
  const phone = whatsappPhone(clientPhoneFromQuote(q));
  if (!phone) return "";
  return `https://wa.me/${phone}?text=${encodeURIComponent(
    clientPortalWhatsAppMessage(q, portalUrl, variantsCount)
  )}`;
}

export function openClientPortalWhatsApp(
  q: ClientPortalWhatsAppQuote | null,
  portalUrl: string,
  variantsCount = 5
) {
  if (typeof window === "undefined") return false;
  const url = whatsappLinkForClient(q, portalUrl, variantsCount);
  if (!url) return false;
  return Boolean(window.open(url, "_blank", "noopener,noreferrer"));
}
