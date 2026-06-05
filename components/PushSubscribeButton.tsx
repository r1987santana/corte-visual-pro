"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Props = {
  employeeId?: string | null;
  vapidPublicKey?: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default function PushSubscribeButton({ employeeId, vapidPublicKey }: Props) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const isSupported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(isSupported);

    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  async function subscribe() {
    try {
      setMessage("");

      if (!employeeId) {
        setMessage("Primero inicia sesión en el portal.");
        return;
      }

      if (!supported) {
        setMessage("Este navegador no soporta push notifications.");
        return;
      }

      if (!vapidPublicKey) {
        setMessage("Falta configurar NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
        return;
      }

      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        setMessage("Permiso de notificaciones no concedido.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const json = subscription.toJSON();

      const { error } = await supabase.rpc("save_employee_push_subscription", {
        p_employee_id: employeeId,
        p_endpoint: json.endpoint,
        p_p256dh: json.keys?.p256dh || "",
        p_auth: json.keys?.auth || "",
        p_user_agent: navigator.userAgent,
        p_device_name: "PWA Employee Device",
      });

      if (error) throw error;

      setMessage("Notificaciones activadas correctamente.");
    } catch (error: any) {
      setMessage(error.message || "No se pudieron activar las notificaciones.");
    }
  }

  if (!supported) {
    return (
      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        Este dispositivo/navegador no soporta push notifications. En iPhone se requiere instalar la PWA y usar iOS moderno.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-black">Notificaciones Push</p>
          <p className="text-xs text-slate-400">
            Estado: {permission === "granted" ? "Permitidas" : permission === "denied" ? "Bloqueadas" : "Sin activar"}
          </p>
          {message && <p className="mt-2 text-xs text-blue-200">{message}</p>}
        </div>

        <button
          onClick={subscribe}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500"
        >
          {permission === "granted" ? <Bell size={18} /> : <BellOff size={18} />}
          Activar notificaciones
        </button>
      </div>
    </div>
  );
}
