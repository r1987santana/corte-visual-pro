export type AIMemoryScope =
  | "global"
  | "ceo"
  | "produccion"
  | "cotizaciones"
  | "corte"
  | "inventario"
  | "ventas"
  | "compras"
  | "instalacion";

export type AIMemoryRecord = {
  id: string;
  scope: AIMemoryScope;
  title: string;
  summary: string;
  entityType?: "cliente" | "proyecto" | "orden" | "cotizacion" | "material" | "accion" | "riesgo";
  entityId?: string;
  priority?: "low" | "normal" | "high" | "critical";
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
};

export type AIMemoryInput = {
  scope?: AIMemoryScope;
  title: string;
  summary: string;
  entityType?: AIMemoryRecord["entityType"];
  entityId?: string;
  priority?: AIMemoryRecord["priority"];
  metadata?: Record<string, any>;
};

const STORAGE_KEY = "rdwood_ai_operational_memory_v1";

function now() {
  return new Date().toISOString();
}

function safeId() {
  return `mem_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getAIMemory(): AIMemoryRecord[] {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAIMemory(records: AIMemoryRecord[]) {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 300)));
  } catch {
    // silent local fallback
  }
}

export function rememberAI(input: AIMemoryInput): AIMemoryRecord {
  const records = getAIMemory();
  const date = now();

  const existingIndex = records.findIndex((r) => {
    if (input.entityId && r.entityId === input.entityId && r.entityType === input.entityType) return true;
    return (
      r.scope === (input.scope || "global") &&
      r.title.trim().toLowerCase() === input.title.trim().toLowerCase()
    );
  });

  if (existingIndex >= 0) {
    const updated: AIMemoryRecord = {
      ...records[existingIndex],
      title: input.title,
      summary: input.summary,
      entityType: input.entityType,
      entityId: input.entityId,
      priority: input.priority || records[existingIndex].priority || "normal",
      metadata: {
        ...(records[existingIndex].metadata || {}),
        ...(input.metadata || {}),
      },
      updatedAt: date,
    };

    records.splice(existingIndex, 1);
    saveAIMemory([updated, ...records]);
    return updated;
  }

  const record: AIMemoryRecord = {
    id: safeId(),
    scope: input.scope || "global",
    title: input.title,
    summary: input.summary,
    entityType: input.entityType,
    entityId: input.entityId,
    priority: input.priority || "normal",
    createdAt: date,
    updatedAt: date,
    metadata: input.metadata || {},
  };

  saveAIMemory([record, ...records]);
  return record;
}

export function forgetAI(id: string) {
  const records = getAIMemory().filter((r) => r.id !== id);
  saveAIMemory(records);
  return records;
}

export function searchAIMemory(query: string, scope?: AIMemoryScope) {
  const q = query.trim().toLowerCase();
  const records = getAIMemory();

  return records
    .filter((r) => {
      if (scope && r.scope !== scope && r.scope !== "global") return false;
      if (!q) return true;

      const haystack = [
        r.title,
        r.summary,
        r.scope,
        r.entityType,
        r.entityId,
        JSON.stringify(r.metadata || {}),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    })
    .slice(0, 20);
}

export function summarizeMemoryForAI(scope?: AIMemoryScope) {
  const records = getAIMemory()
    .filter((r) => !scope || r.scope === scope || r.scope === "global")
    .slice(0, 12);

  if (!records.length) {
    return "No hay memoria operativa registrada todavía.";
  }

  return records
    .map((r, index) => {
      const priority = r.priority ? ` · ${r.priority}` : "";
      return `${index + 1}. [${r.scope}${priority}] ${r.title}: ${r.summary}`;
    })
    .join("\n");
}

export function detectMemoryCommand(message: string) {
  const raw = String(message || "").toLowerCase();

  return {
    wantsRemember:
      raw.includes("recuerda") ||
      raw.includes("memoriza") ||
      raw.includes("guarda esto") ||
      raw.includes("ten pendiente") ||
      raw.includes("no olvides"),
    wantsRecall:
      raw.includes("qué recuerdas") ||
      raw.includes("que recuerdas") ||
      raw.includes("memoria") ||
      raw.includes("recuerdas") ||
      raw.includes("pendiente anterior"),
    wantsForget:
      raw.includes("olvida") ||
      raw.includes("borra memoria") ||
      raw.includes("elimina memoria"),
  };
}
