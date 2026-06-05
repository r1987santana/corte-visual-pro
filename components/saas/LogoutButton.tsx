"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { logout } from "@/lib/saas/auth-client";

export default function LogoutButton({
  className = "",
  label = "Cerrar sesión",
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    const ok = window.confirm("¿Seguro que deseas cerrar sesión?");
    if (!ok) return;

    try {
      setLoading(true);
      await logout();
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={
        className ||
        "inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 hover:bg-red-500/20 disabled:opacity-60"
      }
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : <LogOut size={16} />}
      {label}
    </button>
  );
}
