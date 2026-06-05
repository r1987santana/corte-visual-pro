import { apiFetch } from "@/lib/saas/auth-client";

let running = false;

export function startAutoSystem() {
  if (running) return;

  running = true;

  console.log("Sistema automatico iniciado...");

  setInterval(async () => {
    try {
      console.log("Ejecutando sistema automatico...");

      const res = await apiFetch("/api/auto-process");
      const data = await res.json();

      console.log("Resultado:", data);
    } catch (err) {
      console.error("Error auto sistema:", err);
    }
  }, 120000);
}
