"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  ExternalLink,
  Maximize2,
  MessageCircle,
  Minimize2,
  Radar,
  Send,
  Sparkles,
  StopCircle,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { getModuleConfig, getModuleKeyFromPath } from "@/lib/ai/assistant-config";
import { apiFetch } from "@/lib/saas/auth-client";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
  action?: {
    type?: string;
    label?: string;
    route?: string;
    confirmRequired?: boolean;
    payload?: Record<string, any>;
  };
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseMoneyFromText(text: string, label: string) {
  const normalized = text.replace(/\s+/g, " ");
  const regex = new RegExp(`${label}[^0-9-]*RD\\$?\\s*([0-9.,]+)`, "i");
  const match = normalized.match(regex);
  if (!match?.[1]) return 0;
  return Number(match[1].replace(/,/g, "")) || 0;
}

function parsePercentFromText(text: string, label: string) {
  const normalized = text.replace(/\s+/g, " ");
  const regex = new RegExp(`${label}[^0-9-]*([0-9.,]+)\\s*%`, "i");
  const match = normalized.match(regex);
  if (!match?.[1]) return 0;
  return Number(match[1].replace(/,/g, "")) || 0;
}

function extractVisibleScreenContext(pathname: string | null, moduleName: string) {
  if (typeof document === "undefined") {
    return { path: pathname, module: moduleName, timestamp: new Date().toISOString() };
  }

  const bodyText = (document.body?.innerText || "").slice(0, 15000);
  const numbers = Array.from(bodyText.matchAll(/(?:RD\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/g))
    .map((m) => Number(String(m[1]).replace(/,/g, "")))
    .filter((n) => Number.isFinite(n))
    .slice(0, 100);

  const lower = bodyText.toLowerCase();
  const mode = lower.includes("corte") || lower.includes("canteo") || lower.includes("cnc") || lower.includes("despiece")
    ? "servicio"
    : "articulos";

  const possibleClient =
    bodyText.match(/Cliente\s*\n([^\n]{2,60})/i)?.[1] ||
    bodyText.match(/Nombre del cliente\s*\n([^\n]{2,60})/i)?.[1] ||
    "";

  return {
    path: pathname,
    module: moduleName,
    timestamp: new Date().toISOString(),
    mode,
    clientName: possibleClient.includes("manual") ? "" : possibleClient.trim(),
    subtotal: parseMoneyFromText(bodyText, "Subtotal"),
    tax: parseMoneyFromText(bodyText, "ITBIS"),
    total: parseMoneyFromText(bodyText, "Total"),
    costTotal: parseMoneyFromText(bodyText, "Costo"),
    profitTotal: parseMoneyFromText(bodyText, "Ganancia|Utilidad"),
    margin: parsePercentFromText(bodyText, "Margen"),
    piecesCount: numbers[0] || 0,
    visibleText: bodyText,
    screenNumbers: numbers,
  };
}

function miniFormat(content: string) {
  return String(content || "")
    .replace(/^###\s+/gm, "")
    .replace(/^- /gm, "• ");
}

function speechText(content: string) {
  return String(content || "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[•#*_`>\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

function getSpanishVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => /dominican|caribbean|latino|sabina|microsoft/i.test(voice.name) && voice.lang.toLowerCase().startsWith("es")) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("es-419")) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("es-us")) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("es")) ||
    null
  );
}

export default function ModuleAIAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const moduleKey = useMemo(() => getModuleKeyFromPath(pathname || "/"), [pathname]);
  const config = useMemo(() => getModuleConfig(pathname || "/"), [pathname]);

  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  useEffect(() => {
    setVoiceSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    try {
      setVoiceEnabled(localStorage.getItem("rdwood_ai_voice_enabled") === "true");
    } catch {}
  }, []);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `Soy ${config.name}. Ahora puedo analizar datos visibles, detectar riesgos, recomendar pasos y preparar acciones ejecutables.`,
      },
    ]);
  }, [config.name]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function stopVoice() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function speak(content: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const cleanText = speechText(content);
    if (!cleanText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "es-DO";
    utterance.rate = 0.94;
    utterance.pitch = 0.98;
    const voice = getSpanishVoice();
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function toggleVoice() {
    if (!voiceSupported) return;
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    try {
      localStorage.setItem("rdwood_ai_voice_enabled", String(next));
    } catch {}

    if (!next) {
      stopVoice();
      return;
    }

    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (lastAssistant) speak(lastAssistant.content);
  }

  function executeAction(action?: ChatMessage["action"]) {
    if (!action || !action.route) return;

    if (action.confirmRequired) {
      const ok = window.confirm(`¿Ejecutar acción IA?\n\n${action.label}`);
      if (!ok) return;
    }

    try {
      localStorage.setItem(
        "rdwood_last_ai_action",
        JSON.stringify({
          ...action,
          from: pathname,
          executed_at: new Date().toISOString(),
        })
      );
    } catch {}

    router.push(action.route);
  }

  async function askAssistant(customPrompt?: string) {
    const message = (customPrompt || input).trim();
    if (!message || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setLoading(true);

    try {
      const screenContext = extractVisibleScreenContext(pathname || "/", config.name);

      const response = await apiFetch("/api/ai/module-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleKey,
          moduleName: config.name,
          module: moduleKey,
          pathname,
          message,
          screenContext,
        }),
      });

      const data = await response.json();
      const action = data?.action?.type && data.action.type !== "none" ? data.action : undefined;
      const assistantContent = miniFormat(data.answer || data.response || data.message || "No pude responder ahora mismo.");

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantContent,
          action,
        },
      ]);
      if (voiceEnabled) speak(assistantContent);
    } catch (error: any) {
      const assistantContent = `No pude conectar con el asistente: ${error?.message || "error desconocido"}`;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantContent },
      ]);
      if (voiceEnabled) speak(assistantContent);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[70] flex items-center gap-3 rounded-3xl border border-cyan-400/40 bg-[#020617]/95 px-5 py-4 text-sm font-black text-cyan-100 shadow-[0_0_40px_rgba(6,182,212,0.22)] backdrop-blur-xl transition hover:scale-[1.02] hover:border-cyan-300"
        title="Abrir asistente IA"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
          <Brain size={20} />
        </span>
        <span className="hidden sm:block">{config.name}</span>
      </button>
    );
  }

  return (
    <section
      className={cx(
        "fixed bottom-6 right-6 z-[70] overflow-hidden rounded-[28px] border border-cyan-400/30 bg-[#020617]/98 text-white shadow-[0_0_60px_rgba(6,182,212,0.22)] backdrop-blur-xl",
        compact ? "w-[390px]" : "h-[82vh] w-[560px]",
      )}
    >
      <header className="border-b border-slate-800 bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
              <Bot size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-cyan-100">{config.name}</p>
              <p className="truncate text-xs font-semibold text-slate-400">IA operativa · Acciones reales</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleVoice}
              disabled={!voiceSupported}
              className={cx(
                "rounded-xl border p-2 disabled:cursor-not-allowed disabled:opacity-40",
                voiceEnabled
                  ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20"
                  : "border-slate-700 bg-slate-950 text-slate-300 hover:text-cyan-200",
              )}
              title={voiceEnabled ? "Apagar voz IA" : voiceSupported ? "Activar voz IA" : "Voz no disponible en este navegador"}
            >
              {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            {speaking ? (
              <button
                type="button"
                onClick={stopVoice}
                className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-2 text-amber-100 hover:bg-amber-400/20"
                title="Detener voz"
              >
                <StopCircle size={16} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => askAssistant("Analiza la pantalla actual y dime riesgos, margen y próximo paso")}
              className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-2 text-cyan-100 hover:bg-cyan-400/20"
              title="Analizar pantalla"
            >
              <Radar size={16} />
            </button>
            <button
              type="button"
              onClick={() => setCompact((v) => !v)}
              className="rounded-xl border border-slate-700 bg-slate-950 p-2 text-slate-300 hover:text-cyan-200"
              title={compact ? "Expandir" : "Compactar"}
            >
              {compact ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
            <button
              type="button"
              onClick={() => {
                stopVoice();
                setOpen(false);
              }}
              className="rounded-xl border border-slate-700 bg-slate-950 p-2 text-slate-300 hover:text-red-200"
              title="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {config.quickActions.slice(0, 4).map((action, idx) => (
            <button
              key={action}
              type="button"
              onClick={() => askAssistant(action)}
              className={cx(
                "rounded-2xl border px-3 py-2 text-left text-[11px] font-black transition",
                idx === 0
                  ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20"
                  : idx === 1
                    ? "border-amber-400/25 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
                    : "border-cyan-400/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20",
              )}
            >
              {idx === 0 ? <CheckCircle2 size={13} className="mb-1" /> : idx === 1 ? <AlertTriangle size={13} className="mb-1" /> : <Sparkles size={13} className="mb-1" />}
              {action}
            </button>
          ))}
        </div>
      </header>

      <div className={cx("space-y-3 overflow-y-auto p-4", compact ? "max-h-[390px]" : "h-[calc(82vh-218px)]")}>
        {messages.map((msg, index) => (
          <div
            key={`${msg.role}-${index}`}
            className={cx(
              "rounded-2xl border px-4 py-3 text-sm leading-relaxed",
              msg.role === "assistant"
                ? "border-slate-800 bg-[#07111f] text-slate-200"
                : "ml-8 border-cyan-400/25 bg-cyan-400/10 text-cyan-50",
            )}
          >
            <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              {msg.role === "assistant" ? <Sparkles size={12} /> : <MessageCircle size={12} />}
              {msg.role === "assistant" ? config.name : "Tú"}
            </div>

            <p className="whitespace-pre-line">{msg.content}</p>

            {msg.role === "assistant" && msg.action?.route ? (
              <button
                type="button"
                onClick={() => executeAction(msg.action)}
                className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-400/20"
              >
                <ExternalLink size={14} />
                {msg.action.label || "Ejecutar acción"}
              </button>
            ) : null}

            {msg.role === "assistant" && voiceSupported ? (
              <button
                type="button"
                onClick={() => speak(msg.content)}
                className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-slate-300 hover:border-cyan-400/30 hover:text-cyan-100"
                title="Escuchar respuesta"
              >
                <Volume2 size={14} />
                Escuchar
              </button>
            ) : null}
          </div>
        ))}

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-[#07111f] px-4 py-3 text-sm text-slate-400">
            Analizando pantalla, módulo, datos visibles y acciones disponibles...
          </div>
        ) : null}
      </div>

      <footer className="border-t border-slate-800 p-4">
        <div className="flex gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                askAssistant();
              }
            }}
            placeholder={`Pregúntale a ${config.name}...`}
            className="min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={() => askAssistant()}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-cyan-400 p-3 text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] font-semibold text-slate-600">
          IA operativa por módulo · análisis + acciones ejecutables
        </p>
      </footer>
    </section>
  );
}
