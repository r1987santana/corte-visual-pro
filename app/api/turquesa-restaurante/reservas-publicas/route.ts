import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/security/api-guard";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESTAURANT_SLUG = "turquesa-restaurante";

function clean(value: unknown, max = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function reservationIso(dateValue: unknown, timeValue: unknown) {
  const today = new Date().toISOString().slice(0, 10);
  const rawDate = clean(dateValue) || today;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
  const rawTime = clean(timeValue) || "20:00";
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime : "20:00";
  return new Date(`${date}T${time}:00-04:00`).toISOString();
}

function publicErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as any)?.message || error || "");
  if (
    message.includes("turquesa_") ||
    message.includes("schema cache") ||
    message.includes("relation") ||
    message.includes("does not exist")
  ) {
    return "Base Turquesa pendiente de aplicar en Supabase.";
  }
  return message || "No se pudo registrar la reserva.";
}

export async function POST(request: Request) {
  try {
    const limit = checkRateLimit(request, {
      key: "turquesa-reservation-public",
      limit: 12,
      windowMs: 10 * 60 * 1000,
    });
    if (!limit.allowed) return rateLimitResponse(limit);

    const body = await request.json().catch(() => ({}));
    if (clean(body?.website)) {
      return NextResponse.json({ ok: true, message: "Solicitud recibida." });
    }

    const guestName = clean(body?.guestName || body?.name, 120);
    const phone = clean(body?.phone, 40);
    const email = clean(body?.email, 140);
    const pax = Math.max(1, Math.min(50, Math.round(Number(body?.pax || body?.guests || 2) || 2)));
    const note = clean(body?.note, 280);
    const reservationAt = reservationIso(body?.date, body?.time);

    if (!guestName) return NextResponse.json({ ok: false, error: "Nombre requerido." }, { status: 400 });
    if (!phone && !email) {
      return NextResponse.json({ ok: false, error: "Telefono o correo requerido para confirmar disponibilidad." }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: restaurant, error: restaurantError } = await supabase
      .from("turquesa_restaurants")
      .select("id")
      .eq("slug", RESTAURANT_SLUG)
      .maybeSingle();

    if (restaurantError) throw restaurantError;
    if (!restaurant) {
      return NextResponse.json({ ok: false, error: "Turquesa Restaurante no esta configurado." }, { status: 503 });
    }

    const { data: reservation, error } = await supabase
      .from("turquesa_reservations")
      .insert({
        restaurant_id: restaurant.id,
        reservation_at: reservationAt,
        guest_name: guestName,
        phone: phone || null,
        email: email || null,
        pax,
        source: "Web Turquesa",
        status: "pending",
        note: note || "Solicitud web pendiente de confirmar disponibilidad.",
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      reservationId: reservation.id,
      message: "Solicitud recibida. El equipo confirmara disponibilidad antes de dejar la mesa firme.",
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
