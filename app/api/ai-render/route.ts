import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/security/api-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await requireApiSession(request, "ia_diseno");
    if (!session.ok) return session.response;

    const { prompt, size = "1024x1024" } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Falta el prompt del render IA." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Falta OPENAI_API_KEY en el archivo .env.local. Agrega tu API key y reinicia npm run dev.",
        },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size,
        n: 1,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "OpenAI no pudo generar la imagen. Verifica la API key.",
        },
        { status: response.status }
      );
    }

    const b64 = data?.data?.[0]?.b64_json;

    if (!b64) {
      return NextResponse.json(
        { error: "La respuesta no trajo imagen b64_json." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      image_base64: b64,
      mime_type: "image/png",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error interno generando render IA." },
      { status: 500 }
    );
  }
}
