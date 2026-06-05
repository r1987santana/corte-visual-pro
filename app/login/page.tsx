"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { loginWithEmailAndPin } from "@/lib/saas/auth-client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const lockMessage = sessionStorage.getItem("rdwood_lock_message");
    if (lockMessage) {
      setMessage(lockMessage);
      sessionStorage.removeItem("rdwood_lock_message");
    }
  }, []);

  async function handleLogin() {
    if (!email.trim()) {
      setMessage("Escribe el correo.");
      return;
    }

    if (!pin.trim()) {
      setMessage("Escribe el PIN.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const user = await loginWithEmailAndPin(email, pin);

      if (user.must_change_pin) {
        router.push("/perfil/seguridad");
      } else {
        router.push("/dashboard-ceo");
      }

      router.refresh();
    } catch (error: any) {
      setMessage(error?.message || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020817] p-6 text-white">
      <section className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 items-center gap-8 lg:grid-cols-2">
        <div className="rounded-3xl border border-cyan-900/50 bg-gradient-to-br from-[#081421] via-[#0b1830] to-[#111b3f] p-8 shadow-2xl shadow-black/40">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            <ShieldCheck size={14} />
            Seguridad Empresarial PRO
          </div>

          <h1 className="text-5xl font-black leading-tight">
            RD Wood System
          </h1>
          <p className="mt-4 max-w-xl text-slate-300">
            Acceso protegido con control de sesiones, bloqueo por inactividad y auditoría empresarial.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Info title="Auto bloqueo" text="5 minutos sin actividad" />
            <Info title="Sesiones" text="Control por dispositivo" />
            <Info title="Auditoría" text="Eventos registrados" />
          </div>
        </div>

        <div className="mx-auto w-full max-w-md rounded-3xl border border-cyan-900/45 bg-[#07111f] p-8 shadow-2xl shadow-black/40">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-700 text-4xl font-black">
              R
            </div>
            <h2 className="text-3xl font-black">Acceso Seguro</h2>
            <p className="mt-2 text-sm text-slate-400">Bloqueo automático por inactividad</p>
          </div>

          <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="mb-4 h-14 w-full rounded-2xl border border-slate-700 bg-white px-4 text-slate-900 outline-none focus:border-cyan-400"
          />

          <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            PIN
          </label>
          <div className="relative">
            <input
              type={showPin ? "text" : "password"}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="h-14 w-full rounded-2xl border border-slate-700 bg-white px-4 pr-14 text-slate-900 outline-none focus:border-cyan-400"
            />
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600"
            >
              {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {message ? (
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
              {message}
            </div>
          ) : null}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 font-black text-white transition hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />}
            {loading ? "Validando..." : "Entrar seguro"}
          </button>

          <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs font-bold text-slate-400">
            <Link className="hover:text-cyan-200" href="/privacidad">Privacidad</Link>
            <Link className="hover:text-cyan-200" href="/terminos">Términos</Link>
            <Link className="hover:text-cyan-200" href="/eliminar-cuenta">Eliminar cuenta</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-cyan-400/15 bg-[#030817] p-4">
      <p className="font-black text-cyan-100">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{text}</p>
    </div>
  );
}
