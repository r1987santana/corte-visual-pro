export type ClientLegalDocumentType = "cedula" | "pasaporte" | "rnc";

export type ClientLegalDocument = {
  type: ClientLegalDocumentType;
  number: string;
};

export type LegalDocumentRecord = {
  client_document?: string | null;
  document_number?: string | null;
  document_type?: string | null;
  notes?: string | null;
};

export const CLIENT_LEGAL_DOCUMENT_TYPES: Array<{
  value: ClientLegalDocumentType;
  label: string;
}> = [
  { value: "cedula", label: "Cedula" },
  { value: "pasaporte", label: "Pasaporte" },
  { value: "rnc", label: "RNC" },
];

const LEGAL_DOCUMENT_PREFIX = "Documento legal RDW:";
const LEGAL_DOCUMENT_LINE_RE = /^\s*Documento legal RDW:\s*([^|]+)\|\s*(.+?)\s*$/i;

export function normalizeClientDocumentType(
  value?: string | null
): ClientLegalDocumentType {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized === "rnc") return "rnc";
  if (normalized === "pasaporte" || normalized === "passport") return "pasaporte";
  return "cedula";
}

export function clientDocumentTypeLabel(value?: string | null) {
  const type = normalizeClientDocumentType(value);
  return CLIENT_LEGAL_DOCUMENT_TYPES.find((item) => item.value === type)?.label || "Cedula";
}

export function normalizeClientDocumentNumber(value?: string | null) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function parseClientLegalDocumentFromNotes(
  notes?: string | null
): ClientLegalDocument | null {
  const line = String(notes || "")
    .split(/\r?\n/)
    .find((item) => LEGAL_DOCUMENT_LINE_RE.test(item));

  if (!line) return null;

  const match = line.match(LEGAL_DOCUMENT_LINE_RE);
  const number = normalizeClientDocumentNumber(match?.[2]);

  if (!number) return null;

  return {
    type: normalizeClientDocumentType(match?.[1]),
    number,
  };
}

export function getClientLegalDocumentFromRecord(
  record?: LegalDocumentRecord | null
): ClientLegalDocument | null {
  if (!record) return null;

  const directNumber = normalizeClientDocumentNumber(
    record.client_document || record.document_number
  );

  if (directNumber) {
    return {
      type: normalizeClientDocumentType(record.document_type),
      number: directNumber,
    };
  }

  return parseClientLegalDocumentFromNotes(record.notes);
}

export function mergeClientLegalDocumentIntoNotes(
  notes: string | null | undefined,
  type: ClientLegalDocumentType,
  number: string
) {
  const cleanNumber = normalizeClientDocumentNumber(number);
  const cleanLines = String(notes || "")
    .split(/\r?\n/)
    .filter((line) => !LEGAL_DOCUMENT_LINE_RE.test(line))
    .map((line) => line.trimEnd())
    .filter((line, index, list) => line || index < list.length - 1);

  if (cleanNumber) {
    cleanLines.push(
      `${LEGAL_DOCUMENT_PREFIX} ${clientDocumentTypeLabel(type)} | ${cleanNumber}`
    );
  }

  return cleanLines.join("\n").trim() || null;
}

export function formatClientLegalDocument(
  document?: ClientLegalDocument | null,
  fallback = "Sin documento legal"
) {
  if (!document?.number) return fallback;
  return `${clientDocumentTypeLabel(document.type)}: ${document.number}`;
}
