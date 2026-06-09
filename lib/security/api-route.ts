import { NextResponse } from "next/server";
import type { PermissionKey } from "@/lib/saas/saas-client";
import { requireApiSession } from "@/lib/security/api-guard";

type ProtectedApiSession = Extract<
  Awaited<ReturnType<typeof requireApiSession>>,
  { ok: true }
>;

type ProtectedApiContext = {
  session: ProtectedApiSession;
  supabase: ProtectedApiSession["supabase"];
  user: ProtectedApiSession["user"];
};

export function apiError(error: any, fallback = "Error interno del servidor.") {
  return NextResponse.json(
    {
      ok: false,
      error: error?.message || fallback,
    },
    { status: 500 }
  );
}

export function createProtectedApiHandler(
  permission: PermissionKey | PermissionKey[] | undefined,
  handler: (request: Request, context: ProtectedApiContext) => Promise<Response>
) {
  return async function protectedApiHandler(request: Request) {
    try {
      const session = await requireApiSession(request, permission);
      if (!session.ok) return session.response;

      return handler(request, {
        session,
        supabase: session.supabase,
        user: session.user,
      });
    } catch (error: any) {
      return apiError(error);
    }
  };
}
