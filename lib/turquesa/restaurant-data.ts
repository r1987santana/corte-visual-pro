export type TurquesaTableStatus = "free" | "open" | "reserved" | "attention";
export type TurquesaTicketStatus = "new" | "cooking" | "ready" | "served";
export type TurquesaInventoryTrend = "critico" | "bajo" | "ok";
export type TurquesaReservationStatus = "pending" | "confirmed" | "seated" | "cancelled" | "no_show";

export type TurquesaTable = {
  id: string;
  label: string;
  seats: number;
  activePax?: number;
  guestNames?: string[];
  zone: string;
  status: TurquesaTableStatus;
  server: string;
  total: number;
  minutes: number;
};

export type TurquesaMenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  station: string;
  prep: number;
};

export type TurquesaOrderItem = TurquesaMenuItem & {
  qty: number;
  lineId?: string;
  guestName?: string;
  note?: string;
};

export type TurquesaKitchenTicket = {
  id: string;
  table: string;
  items: string[];
  station: string;
  minutes: number;
  status: Exclude<TurquesaTicketStatus, "served">;
};

export type TurquesaReservation = {
  id?: string;
  date?: string;
  time: string;
  name: string;
  guests: number;
  area: string;
  note: string;
  status?: TurquesaReservationStatus;
  source?: string;
  phone?: string;
  email?: string;
  createdAt?: string;
};

export type TurquesaInventoryItem = {
  item: string;
  onHand: number;
  unit: string;
  min: number;
  trend: TurquesaInventoryTrend;
  avgCost: number;
  supplier: string;
};

export type TurquesaSpoilageEvent = {
  id: string;
  item: string;
  sourceType: "inventory" | "menu_item";
  quantity: number;
  unit: string;
  reason: string;
  cost: number;
  responsible: string;
  note: string;
  createdAt: string;
};

export type TurquesaMaterialYieldStatus = "ok" | "vigilar" | "critico";

export type TurquesaMaterialYieldMetric = {
  item: string;
  unit: string;
  theoreticalUsed: number;
  spoilageQty: number;
  totalOut: number;
  yieldRate: number;
  spoilageRate: number;
  spoilageCost: number;
  onHand: number;
  avgCost: number;
  recipeLinks: number;
  status: TurquesaMaterialYieldStatus;
  note: string;
};

export type TurquesaWarehouseCategory =
  | "cocina"
  | "bar"
  | "playa_piscina"
  | "limpieza"
  | "secos"
  | "congelados"
  | "refrigerados";

export type TurquesaStorageLocationKind =
  | "main"
  | "kitchen"
  | "bar"
  | "beach_pool"
  | "cleaning"
  | "dry_storage"
  | "refrigerated"
  | "frozen";

export type TurquesaBaseUnit = "g" | "kg" | "ml" | "l" | "u";
export type TurquesaInventoryUnitKind = "mass" | "volume" | "count";
export type TurquesaPurchaseReceiptStatus = "draft" | "received" | "void";
export type TurquesaInventoryBatchStatus = "active" | "depleted" | "expired" | "void";
export type TurquesaInventoryMovementType =
  | "purchase_receipt"
  | "transfer_out"
  | "transfer_in"
  | "pos_consumption"
  | "spoilage"
  | "production_input"
  | "production_output"
  | "weekly_count_adjustment"
  | "manual_adjustment";
export type TurquesaInternalTransferStatus = "draft" | "sent" | "received" | "cancelled";
export type TurquesaWeeklyInventoryStatus = "abierto" | "en_revision" | "cerrado";
export type TurquesaProductionProcessType =
  | "limpieza_camarones"
  | "salsa"
  | "porcionado_carne"
  | "jugo"
  | "base_cocina"
  | "otro";
export type TurquesaProductionStatus = "draft" | "completed" | "void";
export type TurquesaProductionLineRole = "input" | "output" | "waste";
export type TurquesaRecipeVersionStatus = "draft" | "active" | "archived";

export type TurquesaStorageLocation = {
  id: string;
  restaurantId: string;
  code: string;
  name: string;
  kind: TurquesaStorageLocationKind;
  isPrimary: boolean;
  isActive: boolean;
  notes?: string | null;
};

export type TurquesaSupplier = {
  id: string;
  restaurantId: string;
  name: string;
  rnc?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  category?: TurquesaWarehouseCategory | null;
  paymentTerms?: string | null;
  isActive: boolean;
};

export type TurquesaInventoryUnit = {
  id: string;
  restaurantId: string;
  code: string;
  name: string;
  unitKind: TurquesaInventoryUnitKind;
  baseUnit: TurquesaBaseUnit;
  toBaseFactor: number;
  isPackage: boolean;
  isActive: boolean;
};

export type TurquesaPurchaseReceipt = {
  id: string;
  restaurantId: string;
  supplierId?: string | null;
  purchaseRequestId?: string | null;
  receiptCode: string;
  invoiceNumber?: string | null;
  documentDate?: string | null;
  receivedAt: string;
  status: TurquesaPurchaseReceiptStatus;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  freightTotal: number;
  grandTotal: number;
  receivedByEmail?: string | null;
  notes?: string | null;
};

export type TurquesaInventoryBatch = {
  id: string;
  restaurantId: string;
  inventoryItemId: string;
  supplierId?: string | null;
  purchaseReceiptId?: string | null;
  storageLocationId?: string | null;
  batchCode?: string | null;
  invoiceNumber?: string | null;
  category: TurquesaWarehouseCategory;
  receivedAt: string;
  expirationDate?: string | null;
  quantityReceived: number;
  quantityRemaining: number;
  unit: string;
  baseQuantityReceived: number;
  baseQuantityRemaining: number;
  baseUnit: TurquesaBaseUnit;
  unitCost: number;
  totalCost: number;
  status: TurquesaInventoryBatchStatus;
};

export type TurquesaStockBalance = {
  id: string;
  restaurantId: string;
  storageLocationId: string;
  inventoryItemId: string;
  inventoryBatchId?: string | null;
  quantityOnHand: number;
  unit: string;
  baseQuantityOnHand: number;
  baseUnit: TurquesaBaseUnit;
  avgCost: number;
  lastMovementAt?: string | null;
};

export type TurquesaInventoryMovement = {
  id: string;
  restaurantId: string;
  inventoryItemId: string;
  inventoryBatchId?: string | null;
  sourceLocationId?: string | null;
  destinationLocationId?: string | null;
  movementType: TurquesaInventoryMovementType;
  quantity: number;
  unit: string;
  baseQuantity: number;
  baseUnit: TurquesaBaseUnit;
  unitCost: number;
  totalCost: number;
  reason?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  actorEmail?: string | null;
  occurredAt: string;
};

export type TurquesaInternalTransfer = {
  id: string;
  restaurantId: string;
  transferCode: string;
  sourceLocationId: string;
  destinationLocationId: string;
  status: TurquesaInternalTransferStatus;
  requestedByEmail?: string | null;
  sentByEmail?: string | null;
  receivedByEmail?: string | null;
  requestedAt: string;
  sentAt?: string | null;
  receivedAt?: string | null;
  notes?: string | null;
};

export type TurquesaWeeklyInventoryCount = {
  id: string;
  restaurantId: string;
  storageLocationId?: string | null;
  weekYear: number;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  responsibleEmail?: string | null;
  responsibleName?: string | null;
  status: TurquesaWeeklyInventoryStatus;
  observation?: string | null;
  signedByEmail?: string | null;
  signedAt?: string | null;
  closedAt?: string | null;
};

export type TurquesaWeeklyInventoryCountItem = {
  id: string;
  weeklyCountId: string;
  inventoryItemId: string;
  inventoryBatchId?: string | null;
  storageLocationId?: string | null;
  physicalQuantity: number;
  expectedQuantity: number;
  differenceQuantity: number;
  unit: string;
  unitCost: number;
  differenceCost: number;
  observation?: string | null;
  evidenceUrl?: string | null;
  confirmedByEmail?: string | null;
  confirmedAt?: string | null;
  adjustmentMovementId?: string | null;
};

export type TurquesaInternalProduction = {
  id: string;
  restaurantId: string;
  productionCode: string;
  processType: TurquesaProductionProcessType;
  productName: string;
  sourceLocationId?: string | null;
  destinationLocationId?: string | null;
  productionDate: string;
  responsibleEmail?: string | null;
  responsibleName?: string | null;
  inputQuantity: number;
  outputQuantity: number;
  wasteQuantity: number;
  wastePercent: number;
  unit: string;
  status: TurquesaProductionStatus;
  observation?: string | null;
};

export type TurquesaInternalProductionItem = {
  id: string;
  productionId: string;
  lineRole: TurquesaProductionLineRole;
  inventoryItemId: string;
  inventoryBatchId?: string | null;
  quantity: number;
  unit: string;
  baseQuantity: number;
  baseUnit: TurquesaBaseUnit;
  unitCost: number;
  notes?: string | null;
};

export type TurquesaBarYieldProfile = {
  id: string;
  restaurantId: string;
  inventoryItemId: string;
  menuItemId?: string | null;
  bottleVolumeMl: number;
  pourMl: number;
  expectedServings: number;
  lossAllowancePercent: number;
  isActive: boolean;
  notes?: string | null;
};

export type TurquesaRecipeVersion = {
  id: string;
  restaurantId: string;
  menuItemId: string;
  versionNumber: number;
  status: TurquesaRecipeVersionStatus;
  yieldQuantity: number;
  yieldUnit: string;
  costTheoretical: number;
  approvedByEmail?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
};

export type TurquesaRecipeVersionIngredient = {
  id: string;
  recipeVersionId: string;
  inventoryItemId: string;
  quantity: number;
  unit: string;
  baseQuantity: number;
  baseUnit: TurquesaBaseUnit;
  wastePercent: number;
  costSnapshot: number;
  notes?: string | null;
};

export type TurquesaRecipeIngredient = {
  id: string;
  menuItem: string;
  ingredient: string;
  qty: number;
  unit: string;
  note: string;
};

export type TurquesaPurchaseRequestItem = {
  item: string;
  qty: number;
  unit: string;
  supplier: string;
  estimatedCost: number;
};

export type TurquesaPurchaseRequest = {
  id: string;
  code: string;
  status: "draft" | "requested" | "approved" | "received" | "cancelled";
  priority: "normal" | "urgent";
  total: number;
  items: TurquesaPurchaseRequestItem[];
  createdAt: string;
};

export type TurquesaOperatingExpenseMethod = "cash" | "card" | "transfer" | "pending";

export type TurquesaOperatingExpense = {
  id: string;
  code: string;
  category: string;
  description: string;
  amount: number;
  method: TurquesaOperatingExpenseMethod;
  responsible: string;
  note: string;
  createdAt: string;
};

export type TurquesaWifiLead = {
  name: string;
  time: string;
  source: string;
  status: string;
};

export type TurquesaSnapshot = {
  source: "demo" | "database";
  message: string;
  generatedAt: string;
  restaurant: {
    id: string;
    name: string;
    location: string;
  };
  shift: {
    id: string;
    label: string;
    status: "open" | "closed" | "cancelled";
    openedAt: string;
    closedAt?: string | null;
    projectedSales: number;
    cashOpen: number;
    openingCash: number;
    cashSales: number;
    cardSales: number;
    transferSales: number;
    serviceChargeTotal: number;
    taxTotal: number;
    tipPool: number;
    expectedCashDrawer: number;
    countedCash?: number | null;
    cashDifference?: number | null;
  };
  tables: TurquesaTable[];
  menuItems: TurquesaMenuItem[];
  kitchenTickets: TurquesaKitchenTicket[];
  reservations: TurquesaReservation[];
  inventory: TurquesaInventoryItem[];
  recipeIngredients: TurquesaRecipeIngredient[];
  purchaseRequests: TurquesaPurchaseRequest[];
  operatingExpenses: TurquesaOperatingExpense[];
  spoilageEvents: TurquesaSpoilageEvent[];
  materialYieldMetrics: TurquesaMaterialYieldMetric[];
  wifiLeads: TurquesaWifiLead[];
};

export const TURQUESA_DEMO_SNAPSHOT: TurquesaSnapshot = {
  source: "demo",
  message: "Turno abierto. Cocina y caja sincronizadas.",
  generatedAt: new Date(0).toISOString(),
  restaurant: {
    id: "demo-turquesa",
    name: "Turquesa Restaurante",
    location: "Cadaques Caribe, Bayahibe",
  },
  shift: {
    id: "demo-shift-night",
    label: "Turno noche",
    status: "open",
    openedAt: "2026-06-21T18:00:00.000Z",
    closedAt: null,
    projectedSales: 86340,
    cashOpen: 48320,
    openingCash: 12000,
    cashSales: 15462,
    cardSales: 29475,
    transferSales: 3383,
    serviceChargeTotal: 4320,
    taxTotal: 7776,
    tipPool: 4320,
    expectedCashDrawer: 27462,
    countedCash: null,
    cashDifference: null,
  },
  tables: [
    { id: "t1", label: "M1", seats: 2, activePax: 2, guestNames: ["Juan", "Mariel"], zone: "Terraza mar", status: "open", server: "Laura", total: 2850, minutes: 18 },
    { id: "t2", label: "M2", seats: 4, zone: "Terraza mar", status: "reserved", server: "Mesa 8:30", total: 0, minutes: 0 },
    { id: "t3", label: "M3", seats: 4, activePax: 4, guestNames: ["Ana", "Pedro", "Sofia", "Luis"], zone: "Salon", status: "attention", server: "Rafael", total: 6120, minutes: 42 },
    { id: "t4", label: "M4", seats: 6, activePax: 3, guestNames: ["Mesa 4 A", "Mesa 4 B", "Mesa 4 C"], zone: "Salon", status: "open", server: "Mia", total: 4480, minutes: 27 },
    { id: "t5", label: "M5", seats: 2, zone: "Bar", status: "free", server: "Libre", total: 0, minutes: 0 },
    { id: "t6", label: "M6", seats: 8, zone: "Eventos", status: "open", server: "Carlos", total: 14350, minutes: 55 },
    { id: "t7", label: "B1", seats: 2, zone: "Bar", status: "open", server: "Nadia", total: 1620, minutes: 12 },
    { id: "t8", label: "VIP", seats: 10, zone: "Privado", status: "reserved", server: "9:15 PM", total: 0, minutes: 0 },
  ],
  menuItems: [
    { id: "m1", name: "Pescado local al coco", category: "Mar", price: 1250, station: "Cocina caliente", prep: 18 },
    { id: "m2", name: "Ceviche Turquesa", category: "Mar", price: 880, station: "Fria", prep: 10 },
    { id: "m3", name: "Langosta grill", category: "Especial", price: 2850, station: "Parrilla", prep: 24 },
    { id: "m4", name: "Tostones de la casa", category: "Entrada", price: 420, station: "Fritura", prep: 8 },
    { id: "m5", name: "Mojito de chinola", category: "Bar", price: 390, station: "Bar", prep: 4 },
    { id: "m6", name: "Atardecer Turquesa", category: "Coctel", price: 520, station: "Bar", prep: 5 },
    { id: "m7", name: "Arroz marinero", category: "Mar", price: 1480, station: "Cocina caliente", prep: 20 },
    { id: "m8", name: "Flan de coco", category: "Postre", price: 360, station: "Postres", prep: 6 },
  ],
  kitchenTickets: [
    { id: "K-104", table: "M3", items: ["Langosta grill", "Tostones de la casa"], station: "Parrilla", minutes: 14, status: "cooking" },
    { id: "K-105", table: "M6", items: ["Pescado local al coco", "Arroz marinero"], station: "Cocina caliente", minutes: 9, status: "new" },
    { id: "B-041", table: "B1", items: ["Mojito de chinola", "Atardecer Turquesa"], station: "Bar", minutes: 3, status: "ready" },
    { id: "F-018", table: "M1", items: ["Ceviche Turquesa"], station: "Fria", minutes: 6, status: "cooking" },
  ],
  reservations: [
    { id: "RES-DEMO-001", date: "Hoy", time: "7:30 PM", name: "Familia Perez", guests: 5, area: "Terraza mar", note: "Cumpleanos", status: "confirmed", source: "Directa" },
    { id: "RES-DEMO-002", date: "Hoy", time: "8:30 PM", name: "Mesa hotel", guests: 4, area: "Salon", note: "Confirmada por WhatsApp", status: "confirmed", source: "WhatsApp" },
    { id: "RES-DEMO-003", date: "Hoy", time: "9:15 PM", name: "VIP Cadaques", guests: 10, area: "Privado", note: "Menu fijo", status: "pending", source: "Web Turquesa", phone: "809-000-0000" },
  ],
  inventory: [
    { item: "Langosta", onHand: 9, unit: "lb", min: 12, trend: "critico", avgCost: 450, supplier: "Proveedor costa" },
    { item: "Pescado fresco", onHand: 28, unit: "lb", min: 20, trend: "ok", avgCost: 210, supplier: "Pescaderia local" },
    { item: "Chinola", onHand: 14, unit: "lb", min: 18, trend: "bajo", avgCost: 167, supplier: "Mercado local" },
    { item: "Ron blanco", onHand: 11, unit: "bot", min: 8, trend: "ok", avgCost: 820, supplier: "Distribuidor bebidas" },
  ],
  recipeIngredients: [
    { id: "REC-DEMO-001", menuItem: "Pescado local al coco", ingredient: "Pescado fresco", qty: 1.25, unit: "lb", note: "filete + merma limpia" },
    { id: "REC-DEMO-002", menuItem: "Ceviche Turquesa", ingredient: "Pescado fresco", qty: 0.65, unit: "lb", note: "porcion ceviche" },
    { id: "REC-DEMO-003", menuItem: "Ceviche Turquesa", ingredient: "Chinola", qty: 0.15, unit: "lb", note: "acido y salsa" },
    { id: "REC-DEMO-004", menuItem: "Langosta grill", ingredient: "Langosta", qty: 1.2, unit: "lb", note: "cola grill" },
    { id: "REC-DEMO-005", menuItem: "Mojito de chinola", ingredient: "Chinola", qty: 0.35, unit: "lb", note: "pulpa natural" },
    { id: "REC-DEMO-006", menuItem: "Mojito de chinola", ingredient: "Ron blanco", qty: 0.08, unit: "bot", note: "base coctel" },
    { id: "REC-DEMO-007", menuItem: "Atardecer Turquesa", ingredient: "Chinola", qty: 0.25, unit: "lb", note: "pulpa natural" },
    { id: "REC-DEMO-008", menuItem: "Atardecer Turquesa", ingredient: "Ron blanco", qty: 0.07, unit: "bot", note: "base coctel" },
    { id: "REC-DEMO-009", menuItem: "Arroz marinero", ingredient: "Pescado fresco", qty: 0.75, unit: "lb", note: "mixto marino" },
    { id: "REC-DEMO-010", menuItem: "Arroz marinero", ingredient: "Langosta", qty: 0.35, unit: "lb", note: "mixto marino" },
  ],
  purchaseRequests: [
    {
      id: "PO-DEMO-001",
      code: "COMP-0001",
      status: "draft",
      priority: "urgent",
      total: 8420,
      createdAt: "2026-06-21T20:10:00.000Z",
      items: [
        { item: "Langosta", qty: 15, unit: "lb", supplier: "Proveedor costa", estimatedCost: 6750 },
        { item: "Chinola", qty: 10, unit: "lb", supplier: "Mercado local", estimatedCost: 1670 },
      ],
    },
  ],
  operatingExpenses: [
    {
      id: "GASTO-DEMO-001",
      code: "GSF-0001",
      category: "Local",
      description: "Pago local playa",
      amount: 45000,
      method: "transfer",
      responsible: "Administracion",
      note: "Gasto sin factura registrado para control interno.",
      createdAt: "2026-06-21T18:40:00.000Z",
    },
    {
      id: "GASTO-DEMO-002",
      code: "GSF-0002",
      category: "Compra menor",
      description: "Hielo y compra menor",
      amount: 1800,
      method: "cash",
      responsible: "Caja",
      note: "Sin comprobante fiscal.",
      createdAt: "2026-06-21T21:05:00.000Z",
    },
  ],
  spoilageEvents: [
    {
      id: "DEC-DEMO-001",
      item: "Langosta",
      sourceType: "inventory",
      quantity: 1.5,
      unit: "lb",
      reason: "Materia prima en mal estado",
      cost: 675,
      responsible: "Cocina",
      note: "Temperatura fuera de rango.",
      createdAt: "2026-06-21T19:15:00.000Z",
    },
  ],
  materialYieldMetrics: [
    {
      item: "Langosta",
      unit: "lb",
      theoreticalUsed: 4.1,
      spoilageQty: 1.5,
      totalOut: 5.6,
      yieldRate: 73,
      spoilageRate: 27,
      spoilageCost: 675,
      onHand: 9,
      avgCost: 450,
      recipeLinks: 2,
      status: "critico",
      note: "Merma alta. Revisar frio, porcion y limpieza antes del servicio.",
    },
    {
      item: "Pescado fresco",
      unit: "lb",
      theoreticalUsed: 6.25,
      spoilageQty: 0.6,
      totalOut: 6.85,
      yieldRate: 91,
      spoilageRate: 9,
      spoilageCost: 126,
      onHand: 28,
      avgCost: 210,
      recipeLinks: 3,
      status: "vigilar",
      note: "Rendimiento aceptable con merma controlada.",
    },
    {
      item: "Chinola",
      unit: "lb",
      theoreticalUsed: 3.2,
      spoilageQty: 0.35,
      totalOut: 3.55,
      yieldRate: 90,
      spoilageRate: 10,
      spoilageCost: 58,
      onHand: 14,
      avgCost: 167,
      recipeLinks: 3,
      status: "vigilar",
      note: "Controlar pulpa usada en bar y jugos.",
    },
    {
      item: "Ron blanco",
      unit: "bot",
      theoreticalUsed: 0.5,
      spoilageQty: 0.02,
      totalOut: 0.52,
      yieldRate: 96,
      spoilageRate: 4,
      spoilageCost: 16,
      onHand: 11,
      avgCost: 820,
      recipeLinks: 2,
      status: "ok",
      note: "Rendimiento sano para bebidas.",
    },
  ],
  wifiLeads: [
    { name: "Ana M.", time: "6:42 PM", source: "Wi-Fi", status: "nuevo" },
    { name: "Jean P.", time: "7:04 PM", source: "Wi-Fi", status: "promocion" },
    { name: "Carlos R.", time: "7:18 PM", source: "Reserva", status: "cliente" },
  ],
};

export function freshDemoSnapshot(message = TURQUESA_DEMO_SNAPSHOT.message): TurquesaSnapshot {
  return {
    ...TURQUESA_DEMO_SNAPSHOT,
    message,
    generatedAt: new Date().toISOString(),
    tables: TURQUESA_DEMO_SNAPSHOT.tables.map((item) => ({ ...item })),
    menuItems: TURQUESA_DEMO_SNAPSHOT.menuItems.map((item) => ({ ...item })),
    kitchenTickets: TURQUESA_DEMO_SNAPSHOT.kitchenTickets.map((item) => ({ ...item, items: [...item.items] })),
    reservations: TURQUESA_DEMO_SNAPSHOT.reservations.map((item) => ({ ...item })),
    inventory: TURQUESA_DEMO_SNAPSHOT.inventory.map((item) => ({ ...item })),
    recipeIngredients: TURQUESA_DEMO_SNAPSHOT.recipeIngredients.map((item) => ({ ...item })),
    purchaseRequests: TURQUESA_DEMO_SNAPSHOT.purchaseRequests.map((request) => ({
      ...request,
      items: request.items.map((item) => ({ ...item })),
    })),
    operatingExpenses: TURQUESA_DEMO_SNAPSHOT.operatingExpenses.map((item) => ({ ...item })),
    spoilageEvents: TURQUESA_DEMO_SNAPSHOT.spoilageEvents.map((item) => ({ ...item })),
    materialYieldMetrics: TURQUESA_DEMO_SNAPSHOT.materialYieldMetrics.map((item) => ({ ...item })),
    wifiLeads: TURQUESA_DEMO_SNAPSHOT.wifiLeads.map((item) => ({ ...item })),
  };
}
