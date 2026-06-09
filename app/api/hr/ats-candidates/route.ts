import { NextResponse } from "next/server";
import { createProtectedApiHandler } from "@/lib/security/api-route";

export const GET = createProtectedApiHandler("rrhh", async (_request, { supabase }) => {
  const { data, error } = await supabase
    .from("hr_candidates")
    .select(
      [
        "id",
        "candidate_code",
        "full_name",
        "phone",
        "email",
        "source",
        "current_position",
        "years_experience",
        "expected_salary",
        "city",
        "cv_url",
        "portfolio_url",
        "notes",
        "status",
      ].join(",")
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, items: data || [] });
});
