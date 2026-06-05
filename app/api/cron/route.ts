import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "Falta CRON_SECRET para ejecutar el cron." },
        { status: 500 }
      );
    }

    if (request.headers.get("x-cron-secret") !== secret) {
      return NextResponse.json(
        { ok: false, error: "Cron no autorizado." },
        { status: 401 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "http://localhost:3000";
    const origin = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;

    await fetch(`${origin}/api/auto-process`, {
      headers: { "x-cron-secret": secret },
    });

    return NextResponse.json({
      ok: true,
      message: "Auto proceso ejecutado por cron",
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message,
    });
  }
}
