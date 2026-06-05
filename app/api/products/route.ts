import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/security/api-guard";

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request, ["inventario", "ventas", "cotizador"]);
    if (!session.ok) return session.response;
    const supabase = session.supabase;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error loading products" },
      { status: 500 }
    );
  }
}
