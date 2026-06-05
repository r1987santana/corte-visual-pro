"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import {
  AuthUser,
  clearAuth,
  getPermissionForPath,
  getStoredToken,
  hasPermission,
  logout,
  validateSession,
} from "@/lib/saas/auth-client";
import { writeAuditLog } from "@/lib/auditTrail";

const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;

function isPublicClientRoute(pathname: string) {
  return (
    pathname.startsWith("/portal-cliente") ||
    pathname.startsWith("/portal/") ||
    pathname.startsWith("/referir/") ||
    pathname.startsWith("/privacidad") ||
    pathname.startsWith("/terminos") ||
    pathname.startsWith("/eliminar-cuenta")
  );
}

function isKioskRoute(pathname: string) {
  return pathname.startsWith("/tv/");
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAuditRef = useRef<string | null>(null);

  const permission = useMemo(() => getPermissionForPath(pathname), [pathname]);

  async function forceLock() {
    try {
      const token = getStoredToken();

      if (token) {
        await logout();
      } else {
        clearAuth();
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          "rdwood_lock_message",
          "Sesión bloqueada por 5 minutos sin actividad."
        );
      }

      router.push("/login");
      router.refresh();
    } catch {
      clearAuth();
      router.push("/login");
      router.refresh();
    }
  }

  function resetInactivityTimer() {
    if (pathname.startsWith("/login") || isPublicClientRoute(pathname) || isKioskRoute(pathname)) return;

    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    inactivityTimer.current = setTimeout(() => {
      forceLock();
    }, INACTIVITY_LIMIT_MS);
  }

  useEffect(() => {
    async function check() {
      if (pathname.startsWith("/login") || isPublicClientRoute(pathname)) {
        setChecking(false);
        return;
      }

      const activeUser = await validateSession();

      if (!activeUser) {
        router.push("/login");
        return;
      }

      setUser(activeUser);
      setChecking(false);
    }

    check();
  }, [pathname, router]);

  useEffect(() => {
    if (pathname.startsWith("/login") || isPublicClientRoute(pathname) || isKioskRoute(pathname)) return;

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    resetInactivityTimer();

    events.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer);
    });

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, resetInactivityTimer);
      });

      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [pathname]);

  useEffect(() => {
    if (checking || !user) return;
    if (pathname.startsWith("/login") || isPublicClientRoute(pathname)) return;

    const auditKey = `${user.id}:${pathname}`;
    if (lastAuditRef.current === auditKey) return;
    lastAuditRef.current = auditKey;

    void writeAuditLog({
      module: "sistema",
      action: "module_accessed",
      entity_type: "route",
      entity_id: pathname,
      entity_name: pathname,
      new_data: {
        pathname,
        permission,
        user_id: user.id,
        user_role: user.role_key,
      },
      severity: "info",
      user_email: user.email,
    });
  }, [checking, pathname, permission, user]);

  if (pathname.startsWith("/login") || isPublicClientRoute(pathname)) return <>{children}</>;

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020817] text-cyan-200">
        <Loader2 className="animate-spin" size={42} />
      </div>
    );
  }

  if (permission && !hasPermission(user, permission)) {
    return (
      <main className="min-h-screen bg-[#020817] p-6 text-white">
        <section className="mx-auto mt-16 max-w-2xl rounded-3xl border border-red-400/30 bg-red-500/10 p-8 text-center">
          <Lock className="mx-auto mb-4 text-red-300" size={56} />
          <h1 className="text-3xl font-black">Acceso restringido</h1>
          <p className="mt-3 text-slate-300">
            Tu usuario no tiene permiso para abrir este módulo.
          </p>
          <div className="mt-6 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
            Permiso requerido: <b>{permission}</b>
          </div>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
