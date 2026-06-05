import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: false,
    message: "API CRM legacy sin implementacion activa. Usa el modulo /crm.",
  });
}
