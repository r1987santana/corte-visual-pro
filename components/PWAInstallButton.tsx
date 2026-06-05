"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PWAInstallButton() {
  const [mounted, setMounted] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
    setShow(false);
  }

  if (!mounted || !show || !promptEvent) return null;

  return (
    <button
      type="button"
      onClick={install}
      className="fixed bottom-6 right-6 z-[90] rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-2xl shadow-blue-950/40 transition hover:bg-blue-500"
    >
      Instalar App
    </button>
  );
}
