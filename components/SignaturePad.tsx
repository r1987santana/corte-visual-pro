"use client";

import { useRef, useState } from "react";
import { PenLine, RotateCcw, Save } from "lucide-react";

type Props = {
  onSave: (signatureDataUrl: string) => void;
  height?: number;
};

export default function SignaturePad({ onSave, height = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);

  function getPoint(event: any) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0] || event.changedTouches?.[0];

    return {
      x: (touch ? touch.clientX : event.clientX) - rect.left,
      y: (touch ? touch.clientY : event.clientY) - rect.top,
    };
  }

  function startDrawing(event: any) {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff";
    setDrawing(true);
  }

  function draw(event: any) {
    event.preventDefault();
    if (!drawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function stopDrawing(event: any) {
    event.preventDefault();
    setDrawing(false);
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    onSave(canvas.toDataURL("image/png"));
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <PenLine size={18} className="text-blue-300" />
        <p className="font-black">Firma biométrica</p>
      </div>

      <canvas
        ref={canvasRef}
        width={900}
        height={height}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="h-[220px] w-full touch-none rounded-2xl border border-white/10 bg-slate-950"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={clear}
          type="button"
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-700 px-4 py-3 text-sm font-bold hover:bg-slate-600"
        >
          <RotateCcw size={16} />
          Limpiar
        </button>

        <button
          onClick={save}
          type="button"
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black hover:bg-blue-500"
        >
          <Save size={16} />
          Usar firma
        </button>
      </div>
    </div>
  );
}
