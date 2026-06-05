export type OptimizerPiece = {
  id: string;
  originalId: string;
  nombre: string;
  largo: number;
  ancho: number;
  area: number;
};

export type PlacedPiece = OptimizerPiece & {
  hoja: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotada: boolean;
};

export type SheetLayout = {
  numero: number;
  piezas: PlacedPiece[];
  usadoM2: number;
};

type FreeRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function areaM2(largo: number, ancho: number) {
  return (largo * ancho) / 1000000;
}

function rectArea(r: FreeRect) {
  return r.w * r.h;
}

function canFit(w: number, h: number, r: FreeRect) {
  return w <= r.w && h <= r.h;
}

function contains(a: FreeRect, b: FreeRect) {
  return (
    b.x >= a.x &&
    b.y >= a.y &&
    b.x + b.w <= a.x + a.w &&
    b.y + b.h <= a.y + a.h
  );
}

function splitRect(rect: FreeRect, used: FreeRect) {
  const out: FreeRect[] = [];

  const rectRight = rect.x + rect.w;
  const rectBottom = rect.y + rect.h;
  const usedRight = used.x + used.w;
  const usedBottom = used.y + used.h;

  if (
    used.x >= rectRight ||
    usedRight <= rect.x ||
    used.y >= rectBottom ||
    usedBottom <= rect.y
  ) {
    return [rect];
  }

  if (used.x > rect.x) {
    out.push({
      x: rect.x,
      y: rect.y,
      w: used.x - rect.x,
      h: rect.h,
    });
  }

  if (usedRight < rectRight) {
    out.push({
      x: usedRight,
      y: rect.y,
      w: rectRight - usedRight,
      h: rect.h,
    });
  }

  if (used.y > rect.y) {
    out.push({
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: used.y - rect.y,
    });
  }

  if (usedBottom < rectBottom) {
    out.push({
      x: rect.x,
      y: usedBottom,
      w: rect.w,
      h: rectBottom - usedBottom,
    });
  }

  return out.filter((r) => r.w > 0 && r.h > 0);
}

function pruneRects(rects: FreeRect[]) {
  const clean = rects.filter((r) => r.w > 0 && r.h > 0);

  return clean.filter((r, index) => {
    return !clean.some((other, otherIndex) => {
      if (index === otherIndex) return false;
      return contains(other, r);
    });
  });
}

function sortPieces(pieces: OptimizerPiece[], mode: number) {
  const copy = [...pieces];

  if (mode === 1) {
    return copy.sort((a, b) => b.area - a.area);
  }

  if (mode === 2) {
    return copy.sort((a, b) => Math.max(b.largo, b.ancho) - Math.max(a.largo, a.ancho));
  }

  if (mode === 3) {
    return copy.sort((a, b) => b.largo - a.largo || b.ancho - a.ancho);
  }

  if (mode === 4) {
    return copy.sort((a, b) => b.ancho - a.ancho || b.largo - a.largo);
  }

  return copy.sort((a, b) => b.area - a.area);
}

function packOneAttempt({
  pieces,
  sheetLength,
  sheetWidth,
  respectGrain,
  sortMode,
}: {
  pieces: OptimizerPiece[];
  sheetLength: number;
  sheetWidth: number;
  respectGrain: boolean;
  sortMode: number;
}) {
  const ordered = sortPieces(pieces, sortMode);

  const sheets: SheetLayout[] = [];
  const freeBySheet: Record<number, FreeRect[]> = {};

  function createSheet() {
    const num = sheets.length + 1;

    sheets.push({
      numero: num,
      piezas: [],
      usadoM2: 0,
    });

    freeBySheet[num] = [
      {
        x: 0,
        y: 0,
        w: sheetLength,
        h: sheetWidth,
      },
    ];

    return num;
  }

  createSheet();

  for (const piece of ordered) {
    let best:
      | {
          sheet: number;
          rectIndex: number;
          x: number;
          y: number;
          w: number;
          h: number;
          rotada: boolean;
          score: number;
        }
      | null = null;

    for (const sheet of sheets) {
      const freeRects = freeBySheet[sheet.numero] || [];

      for (let i = 0; i < freeRects.length; i++) {
        const r = freeRects[i];

        const options = respectGrain
          ? [{ w: piece.largo, h: piece.ancho, rotada: false }]
          : [
              { w: piece.largo, h: piece.ancho, rotada: false },
              { w: piece.ancho, h: piece.largo, rotada: true },
            ];

        for (const op of options) {
          if (!canFit(op.w, op.h, r)) continue;

          const leftoverW = r.w - op.w;
          const leftoverH = r.h - op.h;
          const wasteArea = rectArea(r) - op.w * op.h;

          const score =
            wasteArea * 1 +
            Math.min(leftoverW, leftoverH) * 10 +
            Math.abs(leftoverW - leftoverH) * 0.25 +
            sheet.numero * 0.001;

          if (!best || score < best.score) {
            best = {
              sheet: sheet.numero,
              rectIndex: i,
              x: r.x,
              y: r.y,
              w: op.w,
              h: op.h,
              rotada: op.rotada,
              score,
            };
          }
        }
      }
    }

    if (!best) {
      const newSheet = createSheet();
      const r = freeBySheet[newSheet][0];

      const options = respectGrain
        ? [{ w: piece.largo, h: piece.ancho, rotada: false }]
        : [
            { w: piece.largo, h: piece.ancho, rotada: false },
            { w: piece.ancho, h: piece.largo, rotada: true },
          ];

      const op = options.find((o) => canFit(o.w, o.h, r));

      if (!op) continue;

      best = {
        sheet: newSheet,
        rectIndex: 0,
        x: 0,
        y: 0,
        w: op.w,
        h: op.h,
        rotada: op.rotada,
        score: 0,
      };
    }

    const sheet = sheets.find((s) => s.numero === best.sheet);
    if (!sheet) continue;

    const used: FreeRect = {
      x: best.x,
      y: best.y,
      w: best.w,
      h: best.h,
    };

    sheet.piezas.push({
      ...piece,
      hoja: best.sheet,
      x: best.x,
      y: best.y,
      w: best.w,
      h: best.h,
      rotada: best.rotada,
    });

    sheet.usadoM2 += areaM2(best.w, best.h);

    let newFree: FreeRect[] = [];

    for (const r of freeBySheet[best.sheet]) {
      newFree.push(...splitRect(r, used));
    }

    freeBySheet[best.sheet] = pruneRects(newFree).sort((a, b) => {
      const diff = rectArea(b) - rectArea(a);
      if (diff !== 0) return diff;
      return a.y - b.y || a.x - b.x;
    });
  }

  return sheets.filter((s) => s.piezas.length > 0);
}

function layoutScore(layout: SheetLayout[], sheetAreaM2: number) {
  const sheets = layout.length;
  const used = layout.reduce((a, h) => a + h.usadoM2, 0);
  const available = sheets * sheetAreaM2;
  const waste = Math.max(available - used, 0);

  return sheets * 1000000 + waste * 1000;
}

export function optimizeSheetsPRO({
  pieces,
  sheetLength,
  sheetWidth,
  respectGrain,
}: {
  pieces: OptimizerPiece[];
  sheetLength: number;
  sheetWidth: number;
  respectGrain: boolean;
}) {
  if (!pieces.length || sheetLength <= 0 || sheetWidth <= 0) return [];

  const sheetArea = areaM2(sheetLength, sheetWidth);

  const attempts = [1, 2, 3, 4].map((sortMode) =>
    packOneAttempt({
      pieces,
      sheetLength,
      sheetWidth,
      respectGrain,
      sortMode,
    })
  );

  let best = attempts[0];

  for (const attempt of attempts) {
    if (layoutScore(attempt, sheetArea) < layoutScore(best, sheetArea)) {
      best = attempt;
    }
  }

  return best.map((sheet, index) => ({
    ...sheet,
    numero: index + 1,
    piezas: sheet.piezas.map((p) => ({
      ...p,
      hoja: index + 1,
    })),
  }));
}