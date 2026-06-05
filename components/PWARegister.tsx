"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", async () => {
        try {
          await navigator.serviceWorker.register("/sw.js");
          console.log("RD Wood System PWA activa");
        } catch (error) {
          console.error("Error registrando PWA:", error);
        }
      });
    }
  }, []);

  return null;
}