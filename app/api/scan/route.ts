import { NextResponse } from "next/server";
import { hasApiPermission, requireApiSession } from "@/lib/security/api-guard";

type Station = "corte" | "canteo" | "armado";

function normalizeStation(station: string): Station | null {
  const s = String(station || "").trim().toLowerCase();

  if (s === "corte") return "corte";
  if (s === "canteo") return "canteo";
  if (s === "armado") return "armado";

  return null;
}

function statusFromStation(station: Station) {
  if (station === "corte") return "cortado";
  if (station === "canteo") return "canteado";
  if (station === "armado") return "armado";
  return "pending";
}

function extractPieceCode(raw: any) {
  const value = String(raw || "").trim();

  if (!value) return "";

  try {
    const parsed = JSON.parse(value);
    return String(parsed.piece_code || parsed.code || parsed.pieza || "").trim().toUpperCase();
  } catch {
    return value.trim().toUpperCase();
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireApiSession(req, ["produccion", "corte"]);
    if (!session.ok) return session.response;
    const supabase = session.supabase;

    const body = await req.json();

    const piece_code = extractPieceCode(body.piece_code || body.code || body.qr);
    const station = normalizeStation(body.station);
    const operator_name = String(body.operator_name || body.operator || "Operario").trim();

    if (!piece_code) {
      return NextResponse.json({ error: "Falta el código de la pieza." }, { status: 400 });
    }

    if (!station) {
      return NextResponse.json(
        { error: "Estación inválida. Usa corte, canteo o armado." },
        { status: 400 }
      );
    }

    const { data: piece, error: findError } = await supabase
      .from("production_order_items")
      .select("id, piece_code, piece_name, part_name, material_name, status")
      .eq("piece_code", piece_code)
      .maybeSingle();

    if (findError) throw findError;

    if (!piece) {
      return NextResponse.json(
        { error: `No encontré la pieza ${piece_code}.` },
        { status: 404 }
      );
    }

    const currentStatus = String(piece.status || "pending").trim().toLowerCase();
    const nextStatus = statusFromStation(station);
    const scannedAt = new Date().toISOString();

    // Reglas PRO: evita saltos cuando el operario use flujo normal.
    // Si eres administrador y quieres forzar, manda force=true desde el body.
    const force = Boolean(body.force) && hasApiPermission(session.user, "produccion");

    if (!force && station === "canteo" && !["cortado", "canteado", "armado"].includes(currentStatus)) {
      return NextResponse.json(
        { error: "Esta pieza debe estar cortada antes de pasar a canteo." },
        { status: 409 }
      );
    }

    if (!force && station === "armado" && !["canteado", "armado"].includes(currentStatus)) {
      return NextResponse.json(
        { error: "Esta pieza debe estar canteada antes de pasar a armado." },
        { status: 409 }
      );
    }

    const updatePayload: any = {
      status: nextStatus,
      station,
      scanned_at: scannedAt,
    };

    if (station === "corte") {
      updatePayload.cut_at = scannedAt;
      updatePayload.cut_by = operator_name;
    }

    if (station === "canteo") {
      updatePayload.edge_at = scannedAt;
      updatePayload.edge_by = operator_name;
    }

    if (station === "armado") {
      updatePayload.assembly_at = scannedAt;
      updatePayload.assembly_by = operator_name;
    }

    const { error: updateError } = await supabase
      .from("production_order_items")
      .update(updatePayload)
      .eq("id", piece.id);

    if (updateError) throw updateError;

    await supabase.from("production_tracking").insert({
      production_order_item_id: piece.id,
      piece_code,
      station,
      status: nextStatus,
      operator_name,
      scanned_at: scannedAt,
      note: body.note || null,
    });

    return NextResponse.json({
      success: true,
      piece_code,
      piece_name: piece.piece_name || piece.part_name || piece.material_name || "Pieza",
      station,
      status: nextStatus,
      operator_name,
      scanned_at: scannedAt,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error desconocido en escaneo." },
      { status: 500 }
    );
  }
}
