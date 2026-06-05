import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/security/api-guard";

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request, "inventario");
    if (!session.ok) return session.response;
    const supabase = session.supabase;

    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, items: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Error desconocido" },
      { status: 500 }
    );
  }
}
