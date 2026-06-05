"use client";

import { useEffect, useRef, useState } from "react";

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const Detector = (window as any).BarcodeDetector;
  if (!Detector) return null;
  return new Detector({ formats: ["qr_code"] });
}

export default function QRScanner({ onScan }: { onScan: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef("");
  const [enabled, setEnabled] = useState(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let timer: number | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    async function start() {
      try {
        setError("");
        const detector = getBarcodeDetector();

        if (!detector) {
          setError("Este navegador no soporta escaneo QR nativo. Usa el campo manual.");
          setEnabled(false);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        timer = window.setInterval(async () => {
          const video = videoRef.current;
          if (!active || !video || !ctx || video.readyState < 2) return;

          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const codes = await detector.detect(canvas);
          const decoded = codes[0]?.rawValue;
          if (!decoded) return;

          const nowKey = `${decoded}-${Math.floor(Date.now() / 2500)}`;
          if (lastScanRef.current === nowKey) return;

          lastScanRef.current = nowKey;
          onScan(decoded);
        }, 450);
      } catch (err: any) {
        setError(err?.message || "No se pudo abrir la camara. Usa el campo manual.");
        setEnabled(false);
      }
    }

    start();

    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [enabled, onScan]);

  function sendManual() {
    const value = manual.trim();
    if (!value) return;
    onScan(value);
    setManual("");
  }

  return (
    <div className="w-full rounded-2xl border border-slate-700 bg-slate-900 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black text-white">Escaner QR</p>
        <button
          type="button"
          onClick={() => {
            setError("");
            setEnabled((value) => !value);
          }}
          className={`rounded-xl px-4 py-2 text-xs font-black text-white ${
            enabled ? "bg-red-600" : "bg-emerald-600"
          }`}
        >
          {enabled ? "Apagar camara" : "Activar camara"}
        </button>
      </div>

      {enabled ? (
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-64 w-full rounded-xl bg-black object-cover"
        />
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-sm font-bold text-amber-100">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <input
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && sendManual()}
          placeholder="Codigo QR manual"
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-white px-3 py-2 text-sm font-bold text-slate-950"
        />
        <button
          type="button"
          onClick={sendManual}
          className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-white"
        >
          Usar
        </button>
      </div>
    </div>
  );
}
