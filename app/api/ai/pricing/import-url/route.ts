import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/security/api-guard";

const REFERENCES_TABLE = "ai_pricing_references";

type ImportBody = {
  productName?: string;
  productKey?: string;
  category?: string | null;
  unit?: string | null;
  sourceUrl?: string;
  sourceName?: string | null;
  observedCost?: number | null;
  observedPrice?: number | null;
  notes?: string | null;
};

function text(value: any) {
  return String(value || "").trim();
}

function normalizeKey(value: any) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function numberOrNull(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function denyPrivateUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) return true;

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (host === "0.0.0.0" || host === "::1") return true;
  if (host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.")) return true;

  const parts = host.split(".").map((part) => Number(part));
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part))) {
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
  }

  return false;
}

function htmlText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pageTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? htmlText(match[1]).slice(0, 180) : "";
}

function priceCandidates(content: string) {
  const matches = Array.from(content.matchAll(/(RD\$|DOP|US\$|USD|\$)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi));
  return matches
    .map((match) => {
      const label = match[1].toUpperCase();
      const currency = label.includes("US") || label === "USD" || label === "$" ? "USD" : "DOP";
      const value = Number(match[2].replace(/,/g, ""));
      return Number.isFinite(value) && value > 0 ? { currency, value, label: match[0] } : null;
    })
    .filter(Boolean)
    .slice(0, 12);
}

function referenceId(input: ImportBody, url: URL) {
  const raw = `internet_${input.productKey || input.productName}_${url.hostname}`;
  return `price_ref_${normalizeKey(raw).replace(/\s+/g, "_").slice(0, 130)}`;
}

export async function POST(req: Request) {
  const session = await requireApiSession(req, "dashboard_ceo");
  if (!session.ok) return session.response;

  const body = (await req.json()) as ImportBody;
  const sourceUrl = text(body.sourceUrl);
  const productName = text(body.productName);

  if (!sourceUrl || !productName) {
    return NextResponse.json({ ok: false, message: "Faltan productName o sourceUrl." }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return NextResponse.json({ ok: false, message: "URL invalida." }, { status: 400 });
  }

  if (denyPrivateUrl(url)) {
    return NextResponse.json({ ok: false, message: "Solo se permiten URLs publicas http/https." }, { status: 400 });
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "RD-Wood-System-PricingBot/1.0",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    return NextResponse.json({ ok: false, message: `No se pudo leer la fuente (${response.status}).` }, { status: 502 });
  }

  const html = await response.text();
  const visibleText = htmlText(html).slice(0, 20000);
  const candidates = priceCandidates(visibleText);
  const manualPrice = numberOrNull(body.observedPrice);
  const manualCost = numberOrNull(body.observedCost);
  const dopCandidate = candidates.find((candidate: any) => candidate.currency === "DOP") as any;
  const firstCandidate = candidates[0] as any;
  const observedPrice = manualPrice ?? (dopCandidate?.value || null);
  const observedCost = manualCost ?? null;
  const currency = manualPrice || dopCandidate ? "DOP" : firstCandidate?.currency || "DOP";
  const date = new Date().toISOString();

  const record = {
    id: referenceId(body, url),
    product_key: normalizeKey(`${body.productKey || ""} ${productName}`),
    product_name: productName,
    category: text(body.category) || null,
    unit: text(body.unit) || null,
    source_type: "internet",
    source_name: text(body.sourceName) || pageTitle(html) || url.hostname,
    source_url: url.toString(),
    observed_cost: observedCost,
    observed_price: observedPrice,
    currency,
    confidence: manualPrice || manualCost ? 0.65 : 0.35,
    notes: text(body.notes) || "Referencia importada desde URL publica. Requiere validacion humana.",
    metadata: {
      pageTitle: pageTitle(html),
      priceCandidates: candidates,
      autoExtracted: !manualPrice && !manualCost,
    },
    created_by: session.user.email,
    observed_at: date,
    created_at: date,
    updated_at: date,
  };

  const { data, error } = await session.supabase
    .from(REFERENCES_TABLE)
    .upsert(record, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        setupRequired: true,
        message: "No se pudo guardar la referencia. Ejecuta el SQL actualizado de IA Nivel 5.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    reference: data,
    candidates,
    message: "Referencia de internet guardada. La IA la usara como evidencia, no como cambio automatico.",
  });
}
