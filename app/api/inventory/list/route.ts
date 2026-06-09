import { NextResponse } from "next/server";
import { createProtectedApiHandler } from "@/lib/security/api-route";

export const GET = createProtectedApiHandler("inventario", async (_request, { supabase }) => {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, items: data || [] });
});
