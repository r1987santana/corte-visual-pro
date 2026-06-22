import type { TurquesaKitchenTicket, TurquesaMenuItem } from "@/lib/turquesa/restaurant-data";

export type TurquesaPrinterStationKey = "despacho" | "cocina" | "bar";

export type TurquesaPrinterStation = {
  key: TurquesaPrinterStationKey;
  name: string;
  shortName: string;
  printerName: string;
  role: string;
  routing: string;
  status: "ready" | "pending_driver";
};

export type TurquesaPrintJob = {
  id: string;
  stationKey: TurquesaPrinterStationKey;
  stationName: string;
  printerName: string;
  ticketId: string;
  table: string;
  title: string;
  items: string[];
  sourceStation: string;
  createdAt: string;
  copies: number;
};

export type TurquesaPrintLogEntry = {
  jobId: string;
  ticketId: string;
  stationKey: TurquesaPrinterStationKey;
  printedAt: string;
  copies: number;
  mode: "print" | "reprint" | "bundle";
};

export const TURQUESA_PRINTER_STATIONS: TurquesaPrinterStation[] = [
  {
    key: "despacho",
    name: "Centro de despacho",
    shortName: "Despacho",
    printerName: "Principal Windows / despacho",
    role: "Ticket maestro",
    routing: "Recibe copia completa de cada comanda para coordinar salida, empaque y entrega.",
    status: "ready",
  },
  {
    key: "cocina",
    name: "Cocina",
    shortName: "Cocina",
    printerName: "Termica cocina 80mm",
    role: "Produccion caliente y fria",
    routing: "Parrilla, cocina caliente, fria, fritura, entradas y postres.",
    status: "pending_driver",
  },
  {
    key: "bar",
    name: "Bar",
    shortName: "Bar",
    printerName: "Termica bar 80mm",
    role: "Bebidas y cocteles",
    routing: "Cocteles, bebidas y articulos marcados como estacion Bar.",
    status: "pending_driver",
  },
];

const BAR_WORDS = ["bar", "coctel", "bebida", "ron", "mojito", "margarita"];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function cleanItemName(value: string) {
  return value.replace(/^\s*\d+\s*x\s+/i, "").trim();
}

function stationForTicketItem(itemLine: string, menuItems: TurquesaMenuItem[]): TurquesaPrinterStationKey {
  const cleanName = normalize(cleanItemName(itemLine));
  const menuItem = menuItems.find((item) => cleanName.includes(normalize(item.name)) || normalize(item.name).includes(cleanName));
  const stationText = normalize(`${menuItem?.station || ""} ${menuItem?.category || ""} ${itemLine}`);
  return BAR_WORDS.some((word) => stationText.includes(word)) ? "bar" : "cocina";
}

function stationByKey(key: TurquesaPrinterStationKey) {
  return TURQUESA_PRINTER_STATIONS.find((station) => station.key === key) || TURQUESA_PRINTER_STATIONS[0];
}

export function buildTurquesaPrintJobs(
  tickets: TurquesaKitchenTicket[],
  menuItems: TurquesaMenuItem[],
  createdAt = new Date().toISOString()
): TurquesaPrintJob[] {
  return tickets.flatMap((ticket) => {
    const despacho = stationByKey("despacho");
    const grouped: Record<TurquesaPrinterStationKey, string[]> = {
      despacho: ticket.items,
      cocina: [],
      bar: [],
    };

    ticket.items.forEach((item) => {
      grouped[stationForTicketItem(item, menuItems)].push(item);
    });

    const stationJobs: TurquesaPrintJob[] = [
      {
        id: `${ticket.id}-despacho`,
        stationKey: "despacho",
        stationName: despacho.name,
        printerName: despacho.printerName,
        ticketId: ticket.id,
        table: ticket.table,
        title: "Ticket maestro",
        items: grouped.despacho,
        sourceStation: ticket.station,
        createdAt,
        copies: 1,
      },
    ];

    (["cocina", "bar"] as const).forEach((key) => {
      if (!grouped[key].length) return;
      const station = stationByKey(key);
      stationJobs.push({
        id: `${ticket.id}-${key}`,
        stationKey: key,
        stationName: station.name,
        printerName: station.printerName,
        ticketId: ticket.id,
        table: ticket.table,
        title: key === "bar" ? "Ticket bar" : "Ticket cocina",
        items: grouped[key],
        sourceStation: ticket.station,
        createdAt,
        copies: 1,
      });
    });

    return stationJobs;
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatPrintTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-DO", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function turquesaPrintDocumentHtml(jobs: TurquesaPrintJob[], restaurantName: string) {
  const ticketHtml = jobs
    .map(
      (job) => `
        <section class="ticket">
          <header>
            <strong>${escapeHtml(restaurantName)}</strong>
            <span>${escapeHtml(job.stationName.toUpperCase())}</span>
          </header>
          <div class="meta">
            <b>${escapeHtml(job.title)}</b>
            <b>${escapeHtml(job.ticketId)} / ${escapeHtml(job.table)}</b>
          </div>
          <div class="submeta">
            <span>${escapeHtml(job.sourceStation)}</span>
            <span>${formatPrintTime(job.createdAt)}</span>
          </div>
          <ol>
            ${job.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ol>
          <footer>
            <span>${escapeHtml(job.printerName)}</span>
            <span>Copia ${job.copies}</span>
          </footer>
        </section>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Turquesa impresion</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #fff;
            color: #000;
            font-family: "Courier New", ui-monospace, monospace;
            font-size: 12px;
          }
          .ticket {
            width: 72mm;
            break-after: page;
            padding: 2mm 0;
          }
          header {
            border-bottom: 1px dashed #000;
            padding-bottom: 3mm;
            text-align: center;
            display: grid;
            gap: 1mm;
          }
          header strong {
            font-size: 16px;
            line-height: 1.1;
          }
          header span,
          .submeta,
          footer {
            font-size: 10px;
            text-transform: uppercase;
          }
          .meta {
            display: grid;
            grid-template-columns: 1fr;
            gap: 1mm;
            padding: 3mm 0 1mm;
            font-size: 14px;
          }
          .submeta,
          footer {
            display: flex;
            justify-content: space-between;
            gap: 4mm;
            border-bottom: 1px dashed #000;
            padding-bottom: 2mm;
          }
          ol {
            margin: 0;
            padding: 3mm 0 3mm 5mm;
            display: grid;
            gap: 2mm;
          }
          li {
            font-size: 13px;
            font-weight: 700;
            line-height: 1.25;
          }
          footer {
            border-top: 1px dashed #000;
            border-bottom: 0;
            padding-top: 2mm;
            padding-bottom: 0;
          }
        </style>
      </head>
      <body>${ticketHtml}</body>
    </html>
  `;
}
