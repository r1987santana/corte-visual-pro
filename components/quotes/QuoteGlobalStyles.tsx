"use client";

export function QuoteGlobalStyles() {
  return (
    <style jsx global>{`
      .input-dark {
        width: 100%;
        border-radius: 16px;
        border: 1px solid rgb(51 65 85);
        background: #020617;
        padding: 12px 14px;
        color: white;
        outline: none;
        font-weight: 700;
      }
      .textarea-dark {
        width: 100%;
        border-radius: 16px;
        border: 1px solid rgb(51 65 85);
        background: #020617;
        padding: 12px 14px;
        color: white;
        outline: none;
        font-weight: 700;
      }
      .mini-input {
        width: 86px;
        border-radius: 12px;
        border: 1px solid rgb(51 65 85);
        background: #020617;
        padding: 8px 10px;
        color: white;
        outline: none;
        font-weight: 800;
      }
      .icon-btn {
        border-radius: 12px;
        padding: 8px;
        color: white;
      }
      .btn-cyan,
      .btn-blue,
      .btn-purple,
      .btn-green,
      .btn-red,
      .btn-dark {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 18px;
        padding: 13px 16px;
        font-size: 13px;
        font-weight: 900;
        transition: 0.15s;
      }
      .btn-cyan {
        background: #22d3ee;
        color: #020617;
      }
      .btn-blue {
        background: #2563eb;
        color: white;
      }
      .btn-purple {
        background: #9333ea;
        color: white;
      }
      .btn-green {
        background: #10b981;
        color: white;
      }
      .btn-red {
        background: #ef4444;
        color: white;
      }
      .btn-dark {
        background: #334155;
        color: white;
      }
      .badge-green {
        border-radius: 999px;
        background: rgba(16, 185, 129, 0.18);
        color: #6ee7b7;
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 900;
      }
      .badge-slate {
        border-radius: 999px;
        background: rgba(100, 116, 139, 0.18);
        color: #cbd5e1;
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 900;
      }
    `}</style>
  );
}
