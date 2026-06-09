import { NextResponse } from "next/server";
import { createProtectedApiHandler } from "@/lib/security/api-route";

export const GET = createProtectedApiHandler(["inventario", "ventas", "cotizador"], async (_request, { supabase }) => {
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
});
