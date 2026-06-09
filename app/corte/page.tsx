"use client";

import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Boxes,
  Download,
  FileText,
  Layers3,
  Cpu,
  Compass,
  CreditCard,
  Drill,
  Upload,
  TerminalSquare,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  Scissors,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/auditTrail";
import { optimizeSheetsPRO, OptimizerPiece, SheetLayout } from "@/lib/corteOptimizerPRO";
import { summarizeProjectCost, moneyDOP } from "@/lib/costEngine";
import { getProductionRequisitionGate, type ProductionRequisitionGate } from "@/lib/productionRequisitionGate";
import { buildLocalMaterialsDispatchedGate } from "@/lib/productionOrderStatus";
import {
  edgeMl,
  edgeSummary,
  edgeText,
  generateDrillOperationsForPiece,
  grainModeLabel,
  materialCost,
  materialHasGrain,
  materialHeight,
  materialName,
  materialThickness,
  materialWidth,
  money,
  num,
  pieceCanRotateByGrain,
  pieceCode,
  qrStationText,
  uid,
  type DrillOperation,
} from "@/lib/cutShared";
import {
  bestMaterialForPiece as findBestMaterialForPiece,
  isBoardCutMaterial,
} from "@/lib/cutMaterialMatching";
import {
  normalizeDbProductionItemsToPieces,
  normalizeLocalCuttingPayloadToPieces,
} from "@/lib/cutProductionPieces";
import {
  defaultCncPostOptions,
  generateCncProgram,
  getCncPostProcessorPresets,
  type CncCompensationMode,
  type CncDrillPoint,
  type CncPostProcessorId,
  type CncRectPiece,
} from "@/lib/cncPostprocessor";

type MaterialSource = "TABLERO" | "RETAZO";

type CutMaterial = {
  id: string;
  code?: string | null;
  material?: string | null;
  name?: string | null;
  product_name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  source?: MaterialSource | string | null;
  largo_mm?: number | null;
  ancho_mm?: number | null;
  grosor_mm?: number | null;
  length_mm?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  sheet_width_mm?: number | null;
  sheet_height_mm?: number | null;
  quantity?: number | null;
  stock?: number | null;
  scrap_id?: string | null;
  tiene_veta?: boolean | null;
  grain_direction?: string | null;
  cost?: number | null;
  unit_cost?: number | null;
  purchase_cost?: number | null;
  price?: number | null;
};

type ProductionPayload = {
  production_order_id?: string;
  order_code?: string;
  project_name?: string;
  client_name?: string;
  items?: any[];
  created_at?: string;
  status?: string | null;
  estado?: string | null;
  cutting_status?: string | null;
  ready_for_cutting?: boolean | null;
};

type ProductionOrderSearchRow = {
  id: string;
  code?: string | null;
  order_code?: string | null;
  status?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  created_at?: string | null;
  [key: string]: any;
};

type PieceInput = {
  id: string;
  original_id?: string;
  piece_name: string;
  module_name?: string;
  material_name?: string;
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
  quantity: number;
  edge_front: boolean;
  edge_back: boolean;
  edge_left: boolean;
  edge_right: boolean;
  can_rotate: boolean;
};

type MaterialSheetLayout = SheetLayout & {
  material: CutMaterial;
  materialSheetNumber: number;
  globalSheetNumber: number;
  sheetHeightMm: number;
  sheetWidthMm: number;
  respectGrain: boolean;
};

function isSheetUsableForPieces(material: CutMaterial, pieces: OptimizerPiece[], kerf: number) {
  const w = materialWidth(material);
  const h = materialHeight(material);

  return pieces.every((piece) => {
    const pieceW = Number(piece.ancho || 0);
    const pieceH = Number(piece.largo || 0);
    const fitsNormal = pieceW <= w && pieceH <= h;
    const fitsRotated = pieceH <= w && pieceW <= h;
    return fitsNormal || fitsRotated;
  });
}
function materialPriorityScore(material: CutMaterial) {
  const source = String(material.source || "").toUpperCase();
  if (source === "RETAZO") return 0;
  return 1;
}


export default function CortePage() {
  const [materials, setMaterials] = useState<CutMaterial[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [autoMaterialMode, setAutoMaterialMode] = useState(true);
  const [materialAnalysisOpen, setMaterialAnalysisOpen] = useState(false);
  const [autoDrilling, setAutoDrilling] = useState(true);
  const [drillingPreviewOpen, setDrillingPreviewOpen] = useState(false);
  const [projectInstalledFeet, setProjectInstalledFeet] = useState(0);
  const [approvedRenderDataUrl, setApprovedRenderDataUrl] = useState<string>("");
  const [approvedRenderUrl, setApprovedRenderUrl] = useState<string>("");
  const [payload, setPayload] = useState<ProductionPayload | null>(null);
  const [projectName, setProjectName] = useState("Corte PRO");
  const [clientName, setClientName] = useState("");
  const [orderCode, setOrderCode] = useState("");
  const [kerf, setKerf] = useState(8);
  const [postProcessorId, setPostProcessorId] = useState<CncPostProcessorId>("blue_elephant_ncstudio");
  const [cncToolDiameter, setCncToolDiameter] = useState(6);
  const [cncKerfMm, setCncKerfMm] = useState(0);
  const [cncOffsetX, setCncOffsetX] = useState(0);
  const [cncOffsetY, setCncOffsetY] = useState(0);
  const [cncCompensation, setCncCompensation] = useState<CncCompensationMode>("outside");
  const [edgeMeterPrice, setEdgeMeterPrice] = useState(35);
  const [respectGrain, setRespectGrain] = useState(true);
  const [pieces, setPieces] = useState<PieceInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Corte PRO listo.");
  const [orderSearch, setOrderSearch] = useState("");
  const [productionOrders, setProductionOrders] = useState<ProductionOrderSearchRow[]>([]);
  const [selectedProductionOrderId, setSelectedProductionOrderId] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [requisitionGate, setRequisitionGate] = useState<ProductionRequisitionGate | null>(null);

  const selectedMaterial = useMemo(
    () => materials.find((m) => String(m.id) === String(selectedMaterialId)) || null,
    [materials, selectedMaterialId]
  );
  const cncPostPresets = useMemo(() => getCncPostProcessorPresets(), []);

  const sheetWidth = materialWidth(selectedMaterial);
  const sheetHeight = materialHeight(selectedMaterial);
  const sheetThickness = materialThickness(selectedMaterial);
  const sheetCost = materialCost(selectedMaterial);
  const hasGrain = respectGrain && materialHasGrain(selectedMaterial);

  const expandedPieces = useMemo(() => {
    const arr: PieceInput[] = [];

    pieces.forEach((p) => {
      const q = Math.max(1, num(p.quantity, 1));
      for (let i = 0; i < q; i++) {
        arr.push({
          ...p,
          id: `${p.id}-${i}`,
          quantity: 1,
          can_rotate: pieceCanRotateByGrain(p, selectedMaterial, respectGrain),
        });
      }
    });

    return arr.filter((p) => p.width_mm > 0 && p.height_mm > 0);
  }, [pieces, selectedMaterial, respectGrain]);


  const costSummary = useMemo(() => {
    return summarizeProjectCost(
      expandedPieces.map((p) => ({
        id: p.id,
        name: p.piece_name || "Pieza",
        module_name: p.module_name,
        width_mm: Number(p.width_mm || 0),
        height_mm: Number(p.height_mm || 0),
        thickness_mm: Number(p.thickness_mm || 18),
        quantity: Number(p.quantity || 1),
        board_cost: Number(sheetCost || 0),
        board_width_mm: Number(sheetWidth || 1220),
        board_height_mm: Number(sheetHeight || 2440),
        edge_front: Boolean(p.edge_front),
        edge_back: Boolean(p.edge_back),
        edge_left: Boolean(p.edge_left),
        edge_right: Boolean(p.edge_right),
        edge_cost_per_meter: Number(edgeMeterPrice || 35),
        cut_cost_per_linear_foot: 30,
        cnc_holes: 0,
        cnc_hole_cost: 2,
      }))
    );
  }, [expandedPieces, sheetCost, sheetWidth, sheetHeight, edgeMeterPrice]);

const drillingOperations = useMemo<DrillOperation[]>(() => {
    if (!autoDrilling) return [];
    return expandedPieces.flatMap((piece, index) =>
      generateDrillOperationsForPiece(piece, index)
    );
  }, [expandedPieces, autoDrilling]);

  const optimizerPieces = useMemo<OptimizerPiece[]>(() => {
    return expandedPieces.map((p, index) => ({
      id: `${p.id}-${index}`,
      originalId: p.original_id || p.id,
      nombre: p.piece_name || `Pieza ${index + 1}`,
      largo: p.height_mm + kerf,
      ancho: p.width_mm + kerf,
      area: ((p.height_mm + kerf) * (p.width_mm + kerf)) / 1000000,
    }));
  }, [expandedPieces, kerf]);

  function bestMaterialForPiece(piece: PieceInput) {
    return findBestMaterialForPiece(materials, piece, selectedMaterial);
  }

  const cutPlans = useMemo(() => {
    if (!expandedPieces.length || !materials.length) return [];

    const groups = new Map<string, { material: CutMaterial; pieces: PieceInput[] }>();

    expandedPieces.forEach((piece) => {
      const material = bestMaterialForPiece(piece);
      if (!material?.id) return;

      const key = String(material.id);
      const current = groups.get(key) || { material, pieces: [] };
      current.pieces.push({
        ...piece,
        can_rotate: pieceCanRotateByGrain(piece, material, respectGrain),
      });
      groups.set(key, current);
    });

    let globalSheetNumber = 1;

    return Array.from(groups.values()).map((group) => {
      const groupOptimizerPieces = group.pieces.map((p, index) => ({
        id: `${p.id}-${index}`,
        originalId: p.original_id || p.id,
        nombre: p.piece_name || `Pieza ${index + 1}`,
        largo: p.height_mm + kerf,
        ancho: p.width_mm + kerf,
        area: ((p.height_mm + kerf) * (p.width_mm + kerf)) / 1000000,
      }));

      const groupSheetHeight = materialHeight(group.material);
      const groupSheetWidth = materialWidth(group.material);
      const groupRespectGrain = respectGrain && materialHasGrain(group.material);
      const groupLayouts = optimizeSheetsPRO({
        pieces: groupOptimizerPieces,
        sheetLength: groupSheetHeight,
        sheetWidth: groupSheetWidth,
        respectGrain: groupRespectGrain,
      }).map((sheet, index) => {
        const sheetNumber = globalSheetNumber++;
        return {
          ...sheet,
          numero: sheetNumber,
          material: group.material,
          materialSheetNumber: index + 1,
          globalSheetNumber: sheetNumber,
          sheetHeightMm: groupSheetHeight,
          sheetWidthMm: groupSheetWidth,
          respectGrain: groupRespectGrain,
        };
      }) as MaterialSheetLayout[];

      const sheetM2 = (groupSheetHeight * groupSheetWidth) / 1000000;
      const usedM2 = groupLayouts.reduce((sum, sheet) => sum + sheet.usadoM2, 0);
      const totalM2 = groupLayouts.length * sheetM2;

      return {
        material: group.material,
        pieces: group.pieces,
        layouts: groupLayouts,
        sheets: groupLayouts.length,
        usedM2,
        totalM2,
        waste: Math.max(totalM2 - usedM2, 0),
        efficiency: totalM2 > 0 ? (usedM2 / totalM2) * 100 : 0,
        costTotal: groupLayouts.length * materialCost(group.material),
      };
    });
  }, [expandedPieces, materials, selectedMaterial, kerf, respectGrain]);

  const materialOptions = useMemo(() => {
    if (optimizerPieces.length === 0 || materials.length === 0) return [];

    return materials
      .map((material) => {
        const w = materialWidth(material);
        const h = materialHeight(material);
        const cost = materialCost(material);
        const grain = respectGrain && materialHasGrain(material);

        let layoutsForMaterial: SheetLayout[] = [];

        try {
          if (isSheetUsableForPieces(material, optimizerPieces, kerf)) {
            layoutsForMaterial = optimizeSheetsPRO({
              pieces: optimizerPieces,
              sheetLength: h,
              sheetWidth: w,
              respectGrain: grain,
            });
          }
        } catch {
          layoutsForMaterial = [];
        }

        const sheetM2 = (w * h) / 1000000;
        const usedM2 = layoutsForMaterial.reduce((sum, sheet) => sum + sheet.usadoM2, 0);
        const totalM2 = layoutsForMaterial.length * sheetM2;
        const waste = Math.max(totalM2 - usedM2, 0);
        const efficiency = totalM2 > 0 ? (usedM2 / totalM2) * 100 : 0;
        const sourcePriority = materialPriorityScore(material);

        return {
          material,
          layouts: layoutsForMaterial,
          sheets: layoutsForMaterial.length,
          usedM2,
          totalM2,
          waste,
          efficiency,
          costTotal: layoutsForMaterial.length * cost,
          sourcePriority,
          valid: layoutsForMaterial.length > 0,
        };
      })
      .filter((option) => option.valid)
      .sort((a, b) => {
        // 1) Retazos primero, 2) menos hojas, 3) menos merma, 4) mayor eficiencia, 5) menor costo
        if (a.sourcePriority !== b.sourcePriority) return a.sourcePriority - b.sourcePriority;
        if (a.sheets !== b.sheets) return a.sheets - b.sheets;
        if (Math.abs(a.waste - b.waste) > 0.01) return a.waste - b.waste;
        if (Math.abs(a.efficiency - b.efficiency) > 0.01) return b.efficiency - a.efficiency;
        return a.costTotal - b.costTotal;
      });
  }, [materials, optimizerPieces, kerf, respectGrain]);

  const bestMaterialOption = materialOptions[0] || null;

  useEffect(() => {
    if (!autoMaterialMode) return;
    if (!bestMaterialOption?.material?.id) return;
    if (String(bestMaterialOption.material.id) === String(selectedMaterialId)) return;

    setSelectedMaterialId(bestMaterialOption.material.id);
  }, [autoMaterialMode, bestMaterialOption?.material?.id, selectedMaterialId]);

  const layouts = useMemo<MaterialSheetLayout[]>(() => cutPlans.flatMap((plan) => plan.layouts), [cutPlans]);

  const totalUsedM2 = useMemo(
    () => layouts.reduce((sum, sheet) => sum + sheet.usadoM2, 0),
    [layouts]
  );

  const totalSheetM2 = layouts.reduce(
    (sum, sheet) => sum + (sheet.sheetHeightMm * sheet.sheetWidthMm) / 1000000,
    0
  );
  const wasteM2 = Math.max(totalSheetM2 - totalUsedM2, 0);
  const efficiency = totalSheetM2 > 0 ? (totalUsedM2 / totalSheetM2) * 100 : 0;
  const edge = edgeSummary(pieces);
  const totalEdgeCost = edge.total * edgeMeterPrice;
  const totalSheetCost = cutPlans.reduce((sum, plan) => sum + plan.costTotal, 0);
  const totalCutCost = totalSheetCost + totalEdgeCost;

  // SERVICIOS RD WOOD: corte RD$30/metro lineal y canto RD$35/metro lineal.
  const serviceCutLinearMeters = expandedPieces.reduce((sum, p) => {
    const w = Number(p.width_mm || 0);
    const h = Number(p.height_mm || 0);
    return sum + (2 * (w + h)) / 1000;
  }, 0);

  const serviceCutRate = 30; // RD$ por metro lineal
  const serviceCutCost = serviceCutLinearMeters * serviceCutRate;

  const checkedEdgeMeters = expandedPieces.reduce((sum, p) => {
    const w = Number(p.width_mm || 0);
    const h = Number(p.height_mm || 0);
    let ml = 0;
    if (p.edge_front) ml += w / 1000;
    if (p.edge_back) ml += w / 1000;
    if (p.edge_left) ml += h / 1000;
    if (p.edge_right) ml += h / 1000;
    return sum + ml;
  }, 0);

  const namedEdgeMeters = expandedPieces
    .filter((p) => String(p.piece_name || "").toLowerCase().includes("canto"))
    .reduce((sum, p) => {
      const w = Number(p.width_mm || 0);
      const h = Number(p.height_mm || 0);
      return sum + (2 * (w + h)) / 1000;
    }, 0);

  const serviceEdgeMeters = checkedEdgeMeters > 0 ? checkedEdgeMeters : namedEdgeMeters;
  const serviceEdgeRate = 35;
  const serviceEdgeCost = serviceEdgeMeters * serviceEdgeRate;
  const serviceTotalCost = serviceCutCost + serviceEdgeCost;

  async function createCutServiceInvoice() {
    if (!expandedPieces.length) {
      setMessage("Agrega o carga piezas antes de facturar corte/canteo.");
      return;
    }

    const total = Number(serviceTotalCost || 0);

    if (total <= 0) {
      setMessage("No hay servicio de corte/canteo calculado para facturar.");
      return;
    }

    const internalProductionOrder = Boolean(
      getCurrentProductionOrderId() ||
        String(getCurrentOrderCode() || "").startsWith("OP-") ||
        String(getCurrentOrderCode() || "").startsWith("PRO-"),
    );

    if (internalProductionOrder) {
      setMessage(
        "Orden interna detectada: corte/canteo queda como costo del proyecto, no como ingreso. Para vender a ebanistas usa Cotizacion > Servicios Ebanistas.",
      );
      return;
    }

    setBillingBusy(true);

    try {
      const invoiceNumber = `FC-${Date.now()}`;
      const salePayload = {
        invoice_number: invoiceNumber,
        sale_no: invoiceNumber,
        client_name: clientName || "Cliente general",
        client_phone: null,
        customer_name: clientName || "Cliente general",
        customer_phone: null,
        project_name: projectName || `Servicio de corte ${invoiceNumber}`,
        project_type: "servicio_corte_canteo",
        subtotal: total,
        discount: 0,
        tax: 0,
        total,
        cost_total: 0,
        profit_total: total,
        margin: total > 0 ? 100 : 0,
        payment_method: "Caja Principal",
        payment_status: "Pendiente Caja",
        status: "pendiente_caja",
        workflow_status: "servicio_corte_canteo_pendiente_caja",
        amount_paid: 0,
        balance: total,
      };

      const { data: sale, error } = await supabase
        .from("sales")
        .insert(salePayload)
        .select("*")
        .single();

      if (error || !sale) throw error || new Error("No se pudo crear factura de servicio.");

      const itemsPayload = [
        {
          sale_id: sale.id,
          product_id: null,
          product_name: "Servicio de corte",
          quantity: Number(serviceCutLinearMeters.toFixed(2)),
          price: serviceCutRate,
          cost_price: 0,
          subtotal: serviceCutCost,
          profit: serviceCutCost,
          item_type: "servicio",
        },
        {
          sale_id: sale.id,
          product_id: null,
          product_name: "Servicio de canteo",
          quantity: Number(serviceEdgeMeters.toFixed(2)),
          price: serviceEdgeRate,
          cost_price: 0,
          subtotal: serviceEdgeCost,
          profit: serviceEdgeCost,
          item_type: "servicio",
        },
      ].filter((item) => item.quantity > 0 && item.subtotal > 0);

      if (itemsPayload.length > 0) {
        const { error: itemsError } = await supabase.from("sale_items").insert(itemsPayload);
        if (itemsError) throw new Error(itemsError.message || JSON.stringify(itemsError));
      }

      await writeAuditLog({
        module: "corte",
        action: "cut_edge_service_invoice_created_pending_cashier",
        entity_type: "sales",
        entity_id: sale.id,
        entity_name: invoiceNumber,
        new_data: {
          sale,
          items: itemsPayload,
          order_code: getCurrentOrderCode(),
          production_order_id: getCurrentProductionOrderId(),
          pieces: expandedPieces.length,
          rule: "Cobro exclusivo por Caja Principal",
        },
        severity: "info",
      });

      window.open(`/pagos?sale_id=${sale.id}`, "_blank", "noopener,noreferrer");
      setMessage(`Factura ${invoiceNumber} enviada a Caja Principal por ${money(total)}.`);
    } catch (error: any) {
      const errorMessage = error?.message || error?.details || error?.hint || JSON.stringify(error);
      setMessage(`Error facturando servicio: ${errorMessage}`);
    } finally {
      setBillingBusy(false);
    }
  }

  useEffect(() => {
    loadMaterials();
    loadPayloadFromProduction();
    loadProductionOrders();
  }, []);

  function normalizeOrderCode(row: any) {
    return String(
      row?.order_code ||
        row?.code ||
        row?.production_code ||
        row?.numero ||
        row?.number ||
        row?.id ||
        ""
    );
  }

  function normalizeProjectName(row: any) {
    return String(
      row?.project_name ||
        row?.project ||
        row?.nombre_proyecto ||
        row?.name ||
        row?.title ||
        "Proyecto de corte"
    );
  }

  function normalizeClientName(row: any) {
    return String(
      row?.client_name ||
        row?.cliente ||
        row?.customer_name ||
        row?.client ||
        "Cliente General"
    );
  }

  const filteredProductionOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();

    if (!q) return productionOrders;

    return productionOrders.filter((row) => {
      const searchText = [
        row.id,
        normalizeOrderCode(row),
        normalizeProjectName(row),
        normalizeClientName(row),
        row.status,
        row.created_at,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchText.includes(q);
    });
  }, [productionOrders, orderSearch]);

  async function loadProductionOrders() {
    setLoadingOrders(true);

    try {
      const { data, error } = await supabase
        .from("production_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const rows = ((data || []) as ProductionOrderSearchRow[]).filter((row) => row?.id);
      setProductionOrders(rows);
    } catch (error: any) {
      console.error("Error cargando órdenes de producción:", error);
      setMessage(`⚠️ No pude cargar las órdenes/proyectos: ${error?.message || error}`);
    } finally {
      setLoadingOrders(false);
    }
  }

  async function loadProductionOrderFromRow(row: ProductionOrderSearchRow) {
    if (!row?.id) return;

    setSelectedProductionOrderId(row.id);
    setPayload({
      production_order_id: row.id,
      order_code: normalizeOrderCode(row),
      project_name: normalizeProjectName(row),
      client_name: normalizeClientName(row),
      created_at: row.created_at || "",
      status: row.status || null,
      estado: row.estado || null,
      cutting_status: row.cutting_status || null,
      ready_for_cutting: row.ready_for_cutting ?? null,
      items: [],
    });

    setProjectName(normalizeProjectName(row));
    setClientName(normalizeClientName(row));
    setOrderCode(normalizeOrderCode(row));
    setLoading(true);

    try {
      const gate = await refreshRequisitionGate(row.id, normalizeOrderCode(row));
      const selectAll = "*";

      const [byProduction, byOrder] = await Promise.all([
        supabase
          .from("production_order_items")
          .select(selectAll)
          .eq("production_order_id", row.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("production_order_items")
          .select(selectAll)
          .eq("order_id", row.id)
          .order("created_at", { ascending: true }),
      ]);

      if (byProduction.error) throw byProduction.error;
      if (byOrder.error) throw byOrder.error;

      const dbPieces = normalizeDbProductionItemsToPieces([
        ...(byProduction.data || []),
        ...(byOrder.data || []),
      ]);

      if (dbPieces.length > 0) {
        setPieces(dbPieces);
        setMessage(
          `${gate.canCut ? "OK" : "BLOQUEADO"} Proyecto ${normalizeProjectName(row)} cargado desde Supabase: ${dbPieces.length} pieza(s). ${gate.message}`
        );
        return;
      }

      // Fallback: no borrar piezas buenas que ya estaban cargadas desde el puente local.
      const rawBridge =
        localStorage.getItem("rdwood_cutting_items") ||
        localStorage.getItem("rdwood_cutting_order_payload");

      if (rawBridge) {
        const bridgePayload = JSON.parse(rawBridge);
        const bridgeOrderId =
          bridgePayload?.production_order_id ||
          bridgePayload?.order_id ||
          bridgePayload?.order?.id ||
          "";
        const bridgeOrderCode =
          bridgePayload?.order_code ||
          bridgePayload?.code ||
          bridgePayload?.order?.order_code ||
          "";

        const sameOrder =
          String(bridgeOrderId) === String(row.id) ||
          String(bridgeOrderCode) === String(normalizeOrderCode(row)) ||
          !bridgeOrderId;

        const bridgePieces = sameOrder ? normalizeLocalCuttingPayloadToPieces(bridgePayload) : [];

        if (bridgePieces.length > 0) {
          setPieces(bridgePieces);
          setMessage(
            `${gate.canCut ? "OK" : "BLOQUEADO"} Proyecto ${normalizeProjectName(row)} cargado desde puente local: ${bridgePieces.length} pieza(s). ${gate.message}`
          );
          return;
        }
      }

      setPieces((current) => {
        if (current.length > 0) return current;
        return [];
      });

      setMessage(
        `⚠️ Proyecto ${normalizeProjectName(row)} seleccionado, pero todavía no tiene piezas con medidas válidas. Vuelve a cargar/procesar el proyecto en Producción y luego entra a Corte.`
      );
    } catch (error: any) {
      console.error("Error seleccionando proyecto/orden:", error);
      setMessage(`⚠️ No pude cargar las piezas del proyecto: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadPayloadFromProduction() {
    try {
      const raw =
        localStorage.getItem("rdwood_cutting_items") ||
        localStorage.getItem("rdwood_cutting_order_payload");

      if (!raw) {
        setPieces([
          {
            id: uid(),
            piece_name: "Pieza manual",
            module_name: "Manual",
            material_name: "",
            width_mm: 600,
            height_mm: 720,
            thickness_mm: 18,
            quantity: 1,
            edge_front: true,
            edge_back: false,
            edge_left: false,
            edge_right: false,
            can_rotate: true,
          },
        ]);
        setMessage("Modo manual. Puedes agregar piezas.");
        return;
      }

      const parsed: any = JSON.parse(raw);
      setPayload(parsed);
      setProjectName(parsed.project_name || parsed.order?.project_name || "Proyecto de corte");
      setClientName(parsed.client_name || parsed.order?.client_name || "");
      setOrderCode(parsed.order_code || parsed.code || parsed.order?.order_code || "");

      const productionOrderId =
        parsed.production_order_id ||
        parsed.order_id ||
        parsed.order?.id ||
        "";

      const localPieces = normalizeLocalCuttingPayloadToPieces(parsed);
      if (localPieces.length > 0) {
        setPieces(localPieces);
        setMessage(
          `✅ Orden ${parsed.order_code || parsed.code || ""} cargada desde puente Producción → Corte: ${localPieces.length} pieza(s) cortables.`
        );
        return;
      }

      setLoading(true);

      if (productionOrderId) {
        const [byProduction, byOrder] = await Promise.all([
          supabase
            .from("production_order_items")
            .select("*")
            .eq("production_order_id", productionOrderId)
            .order("created_at", { ascending: true }),
          supabase
            .from("production_order_items")
            .select("*")
            .eq("order_id", productionOrderId)
            .order("created_at", { ascending: true }),
        ]);

        if (byProduction.error) throw byProduction.error;
        if (byOrder.error) throw byOrder.error;

        const dbPieces = normalizeDbProductionItemsToPieces([
          ...(byProduction.data || []),
          ...(byOrder.data || []),
        ]);

        if (dbPieces.length > 0) {
          setPieces(dbPieces);
          setMessage(
            `✅ Orden ${parsed.order_code || parsed.code || ""} cargada desde Supabase: ${dbPieces.length} pieza(s) con medidas listas para optimizar.`
          );
          return;
        }
      }

      setPieces([]);
      setMessage(
        "⚠️ La orden fue cargada, pero no encontré medidas de corte válidas. Vuelve a procesar el proyecto en Producción."
      );
    } catch (error: any) {
      console.error(error);
      setMessage(`⚠️ No se pudo leer la orden desde Optimización: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadMaterials() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("inventory_available_for_cut")
        .select("*")
        .order("source", { ascending: true });

      if (error) throw error;

      const rows = (data || []) as CutMaterial[];
      setMaterials(rows);

      if (!selectedMaterialId && rows.length > 0) {
        const firstBoard =
          rows.find((m) => String(m.source || "").toUpperCase() === "RETAZO") ||
          rows.find((m) =>
            `${m.material || ""} ${m.name || ""}`.toLowerCase().includes("melamina")
          ) ||
          rows[0];

        setSelectedMaterialId(firstBoard.id);
      }
    } catch (err: any) {
      setMessage("Error cargando materiales de corte: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function addPiece() {
    setPieces((old) => [
      ...old,
      {
        id: uid(),
        piece_name: "Nueva pieza",
        module_name: "Manual",
        material_name: "",
        width_mm: 0,
        height_mm: 0,
        thickness_mm: sheetThickness || 18,
        quantity: 1,
        edge_front: false,
        edge_back: false,
        edge_left: false,
        edge_right: false,
        can_rotate: !hasGrain,
      },
    ]);
  }

  function updatePiece(id: string, field: keyof PieceInput, value: any) {
    setPieces((old) =>
      old.map((p) =>
        p.id === id
          ? {
              ...p,
              [field]:
                field === "width_mm" ||
                field === "height_mm" ||
                field === "thickness_mm" ||
                field === "quantity"
                  ? Number(value)
                  : value,
            }
          : p
      )
    );
  }

  function removePiece(id: string) {
    setPieces((old) => old.filter((p) => p.id !== id));
  }

  function clearPayload() {
    localStorage.removeItem("rdwood_cutting_order_payload");
    setPayload(null);
    setOrderCode("");
    setProjectName("Corte PRO");
    setClientName("");
    setPieces([]);
    setMessage("Orden desconectada. Puedes trabajar corte manual.");
  }

  async function updateProductionStatus(nextStatus: string) {
    if (!payload?.production_order_id) return;

    const { error } = await supabase
      .from("production_orders")
      .update({ status: nextStatus })
      .eq("id", payload.production_order_id);

    if (error) {
      setMessage(`⚠️ No pude actualizar estado de producción: ${error.message}`);
      return;
    }

    setMessage(`✅ Estado de orden actualizado a ${nextStatus}.`);
  }

  function getCurrentProductionOrderId() {
    return (
      selectedProductionOrderId ||
      payload?.production_order_id ||
      (payload as any)?.order_id ||
      (payload as any)?.order?.id ||
      ""
    );
  }

  function getCurrentOrderCode() {
    return String(orderCode || payload?.order_code || (payload as any)?.code || "OP-SIN-CODIGO");
  }

  function getCurrentOrderCodeForLookup() {
    return String(
      orderCode ||
        payload?.order_code ||
        (payload as any)?.code ||
        (payload as any)?.order?.order_code ||
        (payload as any)?.order?.code ||
        ""
    );
  }

  function findCurrentOrderSnapshot(productionOrderId?: string | null, orderCodeOverride?: string | null) {
    const id = String(productionOrderId || getCurrentProductionOrderId() || "");
    const code = String(orderCodeOverride || getCurrentOrderCodeForLookup() || "");

    const row = productionOrders.find((item) => {
      const itemCode = normalizeOrderCode(item);
      return (
        (id && String(item.id) === id) ||
        (code && itemCode === code) ||
        (code && String(item.code || "") === code) ||
        (code && String(item.order_code || "") === code)
      );
    });

    return row || payload || null;
  }

  function localDispatchedGate(productionOrderId?: string | null, orderCodeOverride?: string | null): ProductionRequisitionGate | null {
    const orderSnapshot = findCurrentOrderSnapshot(productionOrderId, orderCodeOverride);
    return buildLocalMaterialsDispatchedGate({
      orderSnapshot,
      orderCodeOverride,
      fallbackOrderCode: getCurrentOrderCodeForLookup(),
      productionOrderId,
    });
  }

  async function refreshRequisitionGate(productionOrderId?: string | null, orderCodeOverride?: string | null) {
    const localGate = localDispatchedGate(productionOrderId, orderCodeOverride);
    if (localGate) {
      setRequisitionGate(localGate);
      return localGate;
    }

    const gate = await getProductionRequisitionGate(
      productionOrderId || getCurrentProductionOrderId(),
      orderCodeOverride || getCurrentOrderCodeForLookup()
    );
    setRequisitionGate(gate);
    return gate;
  }

  async function ensureRequisitionGate(actionLabel: string) {
    const gate = await refreshRequisitionGate();
    if (gate.canCut) return true;

    alert(`${gate.title}\n\n${gate.message}\n\nAcción bloqueada: ${actionLabel}`);
    return false;
  }

  async function saveCut() {
    if (!selectedMaterial) {
      alert("Selecciona un tablero o retazo.");
      return;
    }

    if (!layouts.length || !expandedPieces.length) {
      alert("Agrega piezas válidas antes de guardar.");
      return;
    }

    const productionOrderId = getCurrentProductionOrderId();
    const finalOrderCode = getCurrentOrderCode();

    if (!productionOrderId && !finalOrderCode) {
      alert("Selecciona una orden/proyecto antes de guardar la optimización.");
      return;
    }

    if (!(await ensureRequisitionGate("guardar optimización / generar QR"))) {
      return;
    }

    if (
      !confirm(
        `¿Guardar esta optimización y enviar las piezas a QR / Trazabilidad?

Esto marcará la orden como optimizada y creará las etiquetas reales.`
      )
    ) {
      return;
    }

    setLoading(true);
    setMessage("Guardando optimización y creando trazabilidad...");

    try {
      const now = new Date().toISOString();

      const rpcPieces = expandedPieces.map((p, i) => ({
        piece_code: pieceCode(i),
        piece_name: p.piece_name || "pieza",
        module_name: p.module_name || "General",
        width_mm: Number(p.width_mm || 0),
        height_mm: Number(p.height_mm || 0),
        quantity: 1,
        thickness: String(p.thickness_mm || sheetThickness || 18),
        edge_front: Boolean(p.edge_front),
        edge_back: Boolean(p.edge_back),
        edge_left: Boolean(p.edge_left),
        edge_right: Boolean(p.edge_right),
        edge_type: "PVC",
      }));

      // 1) Guardar trabajo de corte/optimización.
      let jobId: any = null;

      try {
        const { data, error } = await supabase.rpc("create_cutting_job_pro", {
          p_project_name: projectName || "Corte PRO",
          p_client_name: clientName || "",
          p_material_name: materialName(selectedMaterial),
          p_sheet_type:
            selectedMaterial.source === "RETAZO"
              ? "RETAZO"
              : `${sheetHeight} x ${sheetWidth}`,
          p_material_cost: Number(totalSheetCost || 0),
          p_cut_service_cost: Number(serviceCutCost || 0),
          p_edge_meter_price: Number(edgeMeterPrice || 35),
          p_pieces: rpcPieces,
        });

        if (error) throw error;
        jobId = data;
      } catch (rpcError: any) {
        console.warn("create_cutting_job_pro no disponible o falló:", rpcError);
        jobId = `CUT-${Date.now()}`;
      }

      // 2) Si se usó retazo, marcarlo usado.
      if (selectedMaterial.source === "RETAZO") {
        try {
          await supabase
            .from("inventory_scraps")
            .update({
              status: "usado",
              used_reference: String(jobId || `CORTE-${Date.now()}`),
              used_at: now,
            })
            .eq("id", selectedMaterial.id);
        } catch (scrapError) {
          console.warn("No se pudo marcar retazo como usado:", scrapError);
        }
      }

      // 3) Borrar etiquetas anteriores de ESTA orden para evitar duplicados.
      // Primero se borra historial, luego etiquetas.
      const labelDeleteQuery = supabase.from("piece_labels").delete();

      if (productionOrderId) {
        await supabase
          .from("piece_tracking_history")
          .delete()
          .eq("production_order_id", productionOrderId);
        await labelDeleteQuery.eq("production_order_id", productionOrderId);
      } else {
        await supabase
          .from("piece_tracking_history")
          .delete()
          .eq("order_code", finalOrderCode);
        await labelDeleteQuery.eq("order_code", finalOrderCode);
      }

      // 4) Crear etiquetas QR reales desde las piezas optimizadas.
      const safeOrderPrefix = finalOrderCode.replace(/[^a-zA-Z0-9_-]/g, "");
      const labelsPayload = expandedPieces.map((p, i) => {
        const localPieceCode = pieceCode(i);
        const labelCode = `${safeOrderPrefix}-${localPieceCode}`;

        return {
          label_code: labelCode,
          order_code: finalOrderCode,
          production_order_id: productionOrderId || null,
          client_name: clientName || "",
          project_name: projectName || "",
          module_name: p.module_name || "Sin módulo",
          piece_name: p.piece_name || `Pieza ${i + 1}`,
          width_mm: Number(p.width_mm || 0),
          height_mm: Number(p.height_mm || 0),
          thickness_mm: Number(p.thickness_mm || sheetThickness || 18),
          material_name: p.material_name || materialName(selectedMaterial) || "Material",
          edge_detail: edgeText(p),
          quantity: 1,
          current_status: "pendiente",
          qr_payload: {
            label_code: labelCode,
            piece_code: localPieceCode,
            production_order_id: productionOrderId || null,
            order_code: finalOrderCode,
            client_name: clientName || "",
            project_name: projectName || "",
            module_name: p.module_name || "Sin módulo",
            piece_name: p.piece_name || `Pieza ${i + 1}`,
            width_mm: Number(p.width_mm || 0),
            height_mm: Number(p.height_mm || 0),
            thickness_mm: Number(p.thickness_mm || sheetThickness || 18),
            material_name: p.material_name || materialName(selectedMaterial) || "Material",
            edge_detail: edgeText(p),
            job_id: jobId,
            route: "/trazabilidad-piezas",
            flow: qrStationText(),
          },
          created_at: now,
          updated_at: now,
        };
      });

      const { error: labelError } = await supabase.from("piece_labels").insert(labelsPayload);
      if (labelError) throw labelError;

      // 5) Crear historial inicial auditable.
      const historyPayload = labelsPayload.map((label) => ({
        piece_code: label.label_code,
        label_code: label.label_code,
        order_code: finalOrderCode,
        production_order_id: productionOrderId || null,
        piece_name: label.piece_name,
        module_name: label.module_name,
        previous_status: null,
        new_status: "pendiente",
        department: "Corte Inteligente",
        operator_name: "Sistema / Supervisor Corte",
        notes: `Optimización guardada y enviada a trazabilidad. Estado inicial pendiente para corte. Job: ${jobId}`,
        payload: {
          job_id: jobId,
          order_code: finalOrderCode,
          production_order_id: productionOrderId || null,
          material: materialName(selectedMaterial),
          sheet_width_mm: sheetWidth,
          sheet_height_mm: sheetHeight,
          sheets: layouts.length,
          pieces: expandedPieces.length,
          efficiency,
          waste_m2: wasteM2,
          edge_ml: serviceEdgeMeters,
          cut_service_cost: serviceCutCost,
          edge_service_cost: serviceEdgeCost,
          total_cut_cost: serviceTotalCost,
        },
        scanned_at: now,
        created_at: now,
      }));

      const { error: historyError } = await supabase
        .from("piece_tracking_history")
        .insert(historyPayload);

      if (historyError) throw historyError;

      // 6) Marcar orden como optimizada. Intenta con campos PRO; si no existen, cae a status simple.
      if (productionOrderId) {
        try {
          await supabase
            .from("production_orders")
            .update({
              status: "cut_optimized",
              cut_optimized: true,
              cut_optimized_at: now,
              cutting_job_id: String(jobId || ""),
            })
            .eq("id", productionOrderId);
        } catch (updateError) {
          console.warn("Columnas PRO no disponibles, actualizando solo status:", updateError);
          await supabase
            .from("production_orders")
            .update({ status: "cut_optimized" })
            .eq("id", productionOrderId);
        }
      }

      // 7) Guardar puente local para módulos siguientes.
      localStorage.setItem(
        "rdwood_last_optimized_cut",
        JSON.stringify({
          job_id: jobId,
          order_code: finalOrderCode,
          production_order_id: productionOrderId || null,
          client_name: clientName || "",
          project_name: projectName || "",
          labels_count: labelsPayload.length,
          saved_at: now,
        })
      );

      await updateProductionStatus("cut_optimized");
      await loadMaterials();
      await loadProductionOrders();

      setMessage(
        `✅ Optimización guardada. ${labelsPayload.length} etiqueta(s) enviadas a QR / Trazabilidad.`
      );

      alert(
        `✅ Optimización guardada correctamente.

Orden: ${finalOrderCode}
Job: ${jobId}
Piezas enviadas a trazabilidad: ${labelsPayload.length}

Ahora ve a Producción → QR / Trazabilidad.`
      );
    } catch (err: any) {
      console.error(err);
      alert("Error guardando optimización / trazabilidad: " + (err?.message || err));
      setMessage(`⚠️ Error guardando optimización: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  function handleApprovedRenderUpload(file?: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Selecciona una imagen válida para el render aprobado.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setApprovedRenderDataUrl(String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  }

  async function generateExecutivePDF() {
    if (!selectedMaterial) {
      alert("Selecciona un material antes de generar el PDF ejecutivo.");
      return;
    }

    if (!(await ensureRequisitionGate("generar PDF ejecutivo"))) {
      return;
    }

    const ref = orderCode || `CORTE-${Date.now()}`;
    const doc = new jsPDF("portrait", "mm", "letter");
    const pageW = doc.internal.pageSize.getWidth();
    const printTopMargin = 7;
    const headerHeight = 24;

    const moneyPdf = (n: number) =>
      `RD$${Number(n || 0).toLocaleString("es-DO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    const cleanText = (value: any) => String(value ?? "").replace(/\s+/g, " ").trim();

    const header = (title: string) => {
      doc.setFillColor(2, 8, 23);
      doc.rect(0, printTopMargin, pageW, headerHeight, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("RD WOOD SYSTEM", 14, printTopMargin + 10);
      doc.setFontSize(10);
      doc.text(title, 14, printTopMargin + 18);
      doc.setTextColor(34, 211, 238);
      doc.setFontSize(8);
      doc.text(ref, pageW - 14, printTopMargin + 10, { align: "right" });
      doc.text(new Date().toLocaleString("es-DO"), pageW - 14, printTopMargin + 18, { align: "right" });
    };

    const deepFindValue = (obj: any, keys: string[]): any => {
      if (!obj || typeof obj !== "object") return "";
      const seen = new Set<any>();
      const stack = [obj];

      while (stack.length) {
        const current = stack.pop();
        if (!current || typeof current !== "object" || seen.has(current)) continue;
        seen.add(current);

        for (const key of Object.keys(current)) {
          const lower = key.toLowerCase();
          const value = current[key];

          if (keys.some((k) => lower === k.toLowerCase() || lower.includes(k.toLowerCase()))) {
            if (value !== null && value !== undefined && String(value).trim() !== "") return value;
          }

          if (value && typeof value === "object") stack.push(value);
        }
      }

      return "";
    };

    const numberFromAnything = (value: any) => {
      const parsed = Number(String(value ?? "").replace(",", ".").replace(/[^\d.-]/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const findLinearFeetInText = (text: string) => {
      const candidates = [
        /(?:pies\s*lineales|pie\s*lineal|linear\s*feet|pies|ft)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i,
        /(\d+(?:[.,]\d+)?)\s*(?:pies\s*lineales|pie\s*lineal|linear\s*feet|pies|ft)/i,
        /(?:metraje|lineal|linear)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i,
      ];

      for (const regex of candidates) {
        const match = text.match(regex);
        if (match?.[1]) {
          const n = Number(match[1].replace(",", "."));
          if (Number.isFinite(n) && n > 0) return n;
        }
      }

      return 0;
    };

    const imageUrlToDataUrl = async (url: string) => {
      try {
        if (!url || url.startsWith("data:image")) return url;
        const response = await fetch(url, { mode: "cors" });
        if (!response.ok) return "";
        const blob = await response.blob();

        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ""));
          reader.onerror = () => resolve("");
          reader.readAsDataURL(blob);
        });
      } catch {
        return "";
      }
    };

    // Buscar orden completa, cotización/diseño y todos los items: aquí salen herrajes que no son piezas cortables.
    let productionOrderRow: any = null;
    let allOrderItems: any[] = [];
    const relatedRows: any[] = [];

    const possibleOrderCodes = Array.from(
      new Set([
        payload?.production_order_id,
        payload?.order_code,
        orderCode,
        (payload as any)?.code,
      ].filter(Boolean).map(String))
    );

    const tryFindProductionOrder = async () => {
      if (payload?.production_order_id) {
        try {
          const { data } = await supabase
            .from("production_orders")
            .select("*")
            .eq("id", payload.production_order_id)
            .maybeSingle();
          if (data) return data;
        } catch {}
      }

      for (const codeValue of possibleOrderCodes) {
        for (const col of ["order_code", "code", "order_number", "id"]) {
          try {
            const { data } = await supabase
              .from("production_orders")
              .select("*")
              .eq(col, codeValue)
              .maybeSingle();
            if (data) return data;
          } catch {}
        }
      }

      return null;
    };

    productionOrderRow = await tryFindProductionOrder();
    const realProductionOrderId = productionOrderRow?.id || payload?.production_order_id || "";

    if (realProductionOrderId) {
      const itemQueries = [
        { column: "production_order_id", value: realProductionOrderId },
        { column: "order_id", value: realProductionOrderId },
      ];

      for (const q of itemQueries) {
        try {
          const { data } = await supabase
            .from("production_order_items")
            .select("*")
            .eq(q.column, q.value);
          if (Array.isArray(data) && data.length) {
            allOrderItems = [...allOrderItems, ...data];
          }
        } catch {}
      }
    }

    // Buscar contexto adicional en módulos de cotización / IA Diseño / proyectos.
    // Esto ayuda a encontrar el render aprobado, pies lineales cotizados y materiales no cortables.
    const contextTables = [
      "ai_design_requests",
      "design_projects",
      "project_quotes",
      "quotes",
      "quotations",
      "cotizaciones",
      "projects",
      "pre_projects",
    ];

    const isRelatedRow = (row: any) => {
      const haystack = JSON.stringify(row || {}).toLowerCase();
      const needles = [
        projectName,
        clientName,
        orderCode,
        payload?.order_code,
        productionOrderRow?.project_name,
        productionOrderRow?.client_name,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());

      return needles.some((n) => n && haystack.includes(n));
    };

    for (const table of contextTables) {
      try {
        const { data } = await supabase.from(table).select("*").limit(80);
        if (Array.isArray(data)) {
          relatedRows.push(...data.filter(isRelatedRow));
        }
      } catch {}
    }

    const mergedContext = {
      payload,
      productionOrderRow,
      allOrderItems,
      relatedRows,
    };

    const boardAreaM2 = Math.max((sheetHeight * sheetWidth) / 1000000, 0.0001);
    const materialCostPerSheet = Number(
      sheetCost ||
        materialCost(selectedMaterial) ||
        (bestMaterialOption?.costTotal || 0) / Math.max(bestMaterialOption?.sheets || 1, 1) ||
        (materialName(selectedMaterial).toLowerCase().includes("melamina") ? 3000 : 0)
    );

    const materialTotal = layouts.length * materialCostPerSheet;

    // SERVICIOS: corte y canteo por metro lineal.
    const cutLinearMeters = expandedPieces.reduce((sum, p) => {
      const w = Number(p.width_mm || 0);
      const h = Number(p.height_mm || 0);
      return sum + (2 * (w + h)) / 1000;
    }, 0);

    const cutServiceRateMl = 30;
    const cutServiceTotal = cutLinearMeters * cutServiceRateMl;

    const checkedEdgeMeters = expandedPieces.reduce((sum, p) => {
      const w = Number(p.width_mm || 0);
      const h = Number(p.height_mm || 0);
      let ml = 0;
      if (p.edge_front) ml += w / 1000;
      if (p.edge_back) ml += w / 1000;
      if (p.edge_left) ml += h / 1000;
      if (p.edge_right) ml += h / 1000;
      return sum + ml;
    }, 0);

    const namedEdgeMeters = expandedPieces
      .filter((p) => cleanText(p.piece_name).toLowerCase().includes("canto"))
      .reduce((sum, p) => {
        const w = Number(p.width_mm || 0);
        const h = Number(p.height_mm || 0);
        return sum + (2 * (w + h)) / 1000;
      }, 0);

    const finalEdgeMeters = checkedEdgeMeters > 0 ? checkedEdgeMeters : namedEdgeMeters;
    const edgeServiceRateMl = 35;
    const edgeTotal = finalEdgeMeters * edgeServiceRateMl;

    const cncDrillingCount =
      typeof drillingOperations !== "undefined" && Array.isArray(drillingOperations)
        ? drillingOperations.length
        : 0;

    const cncProgrammingTotal = cncDrillingCount * 8;
    const wasteTotal = wasteM2 * (materialCostPerSheet / boardAreaM2);

    // INCENTIVO: tomarlo del módulo cotización/proyecto si existe; si no, del campo manual.
    const linearCandidates = [
      projectInstalledFeet,
      deepFindValue(mergedContext, ["project_linear_feet"]),
      deepFindValue(mergedContext, ["installed_linear_feet"]),
      deepFindValue(mergedContext, ["installation_linear_feet"]),
      deepFindValue(mergedContext, ["linear_feet"]),
      deepFindValue(mergedContext, ["pies_lineales"]),
      deepFindValue(mergedContext, ["piesLineales"]),
      deepFindValue(mergedContext, ["quote_linear_feet"]),
      deepFindValue(mergedContext, ["linearFeet"]),
      deepFindValue(mergedContext, ["lf"]),
    ];

    let installedProjectFeet = 0;
    for (const candidate of linearCandidates) {
      const n = numberFromAnything(candidate);
      if (n > 0) {
        installedProjectFeet = n;
        break;
      }
    }

    if (!installedProjectFeet) {
      installedProjectFeet = findLinearFeetInText(JSON.stringify(mergedContext));
    }

    // Si no viene de cotización/proyecto, pedirlo al imprimir.
    // Este valor es el pie lineal INSTALADO del proyecto, no el perímetro de las piezas.
    if (!installedProjectFeet && typeof window !== "undefined") {
      const typed = window.prompt(
        "Pies lineales instalados del proyecto para calcular incentivo (no es el corte de piezas):",
        projectInstalledFeet ? String(projectInstalledFeet) : ""
      );

      const manualFeet = numberFromAnything(typed);
      if (manualFeet > 0) {
        installedProjectFeet = manualFeet;
        setProjectInstalledFeet(manualFeet);
      }
    }

    const productionLabor = installedProjectFeet * 300;
    const installationLabor = installedProjectFeet * 300;

    // ALMACÉN: construir con todos los items reales de producción + inventario + BOM.
    const warehouseMap = new Map<string, { item: string; type: string; unit: string; qty: number; ref: string; destination: string; status: string }>();

    const addWarehouse = (
      key: string,
      item: string,
      type: string,
      unit: string,
      qty: number,
      refValue: string,
      destination: string
    ) => {
      const q = Number(qty || 0);
      if (q <= 0) return;
      const current = warehouseMap.get(key);
      if (current) {
        current.qty += q;
      } else {
        warehouseMap.set(key, {
          item,
          type,
          unit,
          qty: q,
          ref: refValue,
          destination,
          status: "Pendiente",
        });
      }
    };

    const linkedInventoryIds = Array.from(
      new Set(
        allOrderItems
          .flatMap((item: any) => [
            item?.inventory_item_id,
            item?.inventory_id,
            item?.item_id,
            item?.product_id,
            item?.material_id,
            item?.inventory_item,
            item?.item,
            item?.product,
            item?.stock_item_id,
            item?.article_id,
          ])
          .filter(Boolean)
          .map(String)
      )
    );

    const inventoryNameMap = new Map<string, any>();

    const loadInventoryNames = async (table: string) => {
      if (!linkedInventoryIds.length) return;
      try {
        const { data } = await supabase.from(table).select("*").in("id", linkedInventoryIds);
        if (Array.isArray(data)) {
          data.forEach((row: any) => {
            inventoryNameMap.set(String(row.id), row);
          });
        }
      } catch {}
    };

    await loadInventoryNames("inventory_items");
    await loadInventoryNames("inventory");

    const linkedInventoryRow = (item: any) => {
      const ids = [
        item?.inventory_item_id,
        item?.inventory_id,
        item?.item_id,
        item?.product_id,
        item?.material_id,
        item?.inventory_item,
        item?.item,
        item?.product,
        item?.stock_item_id,
        item?.article_id,
      ]
        .filter(Boolean)
        .map(String);

      for (const id of ids) {
        const row = inventoryNameMap.get(id);
        if (row) return row;
      }

      return null;
    };

    const getItemName = (item: any) => {
      const inv = linkedInventoryRow(item);

      // Si el item está vinculado a inventario, usar primero el nombre real del inventario.
      // Esto evita que el PDF tome nombres de piezas cortadas como "Soportes repisas"
      // cuando en realidad el artículo del almacén es un herraje específico.
      if (inv) {
        return cleanText(
          inv?.item_name ||
            inv?.product_name ||
            inv?.name ||
            inv?.material ||
            inv?.description ||
            item?.item_name ||
            item?.product_name ||
            item?.name ||
            item?.description ||
            ""
        );
      }

      return cleanText(
        item?.item_name ||
          item?.product_name ||
          item?.material_name ||
          item?.name ||
          item?.description ||
          item?.piece_name ||
          item?.part_name ||
          ""
      );
    };

    const getItemQty = (item: any) => {
      const q = Number(item?.quantity ?? item?.cantidad ?? item?.qty ?? item?.stock_qty ?? item?.units ?? 1);
      return Number.isFinite(q) && q > 0 ? q : 1;
    };

    // Buscar también movimientos de inventario ligados a esta orden: ahí viven los artículos reales de almacén.
    const movementRows: any[] = [];
    for (const col of ["production_order_id", "order_id", "reference_id", "reference", "order_code"]) {
      const value =
        col === "production_order_id" || col === "order_id" || col === "reference_id"
          ? realProductionOrderId
          : ref;

      if (!value) continue;

      try {
        const { data } = await supabase
          .from("inventory_movements")
          .select("*")
          .eq(col, value);
        if (Array.isArray(data) && data.length) movementRows.push(...data);
      } catch {}
    }

    const sourceRows = [
      ...allOrderItems,
      ...movementRows,
      ...relatedRows.flatMap((row: any) => {
        const possible = [row?.items, row?.materials, row?.hardware, row?.bom, row?.bom_items, row?.modules];
        return possible.flatMap((v) => (Array.isArray(v) ? v : []));
      }),
      ...(Array.isArray((payload as any)?.items) ? (payload as any).items : []),
    ];

    sourceRows.forEach((item: any) => {
      const rawName = getItemName(item);
      const name = rawName.toLowerCase();
      const qty = getItemQty(item);

      if (!rawName) return;

      const hasLinkedInventory = Boolean(linkedInventoryRow(item));
      const looksLikeCutPiece =
        Number(item?.width_mm || item?.width || 0) > 0 &&
        Number(item?.height_mm || item?.height || 0) > 0 &&
        !hasLinkedInventory;

      // No convertir piezas cortadas en herrajes de almacén.
      // Ejemplo: una pieza llamada "Soportes repisas #1" con medida 800x450 NO significa 4/8/23 soportes.
      if (looksLikeCutPiece) return;

      if (name.includes("melamina") || name.includes("tablero")) {
        return;
      }

      if (name.includes("canto") || name.includes("pvc")) {
        return;
      }

      if (name.includes("bisagra") || name.includes("hinge") || name.includes("puerta")) {
        addWarehouse("bisagra-cierre-suave", "Bisagra cierre suave", "Herraje", "unidad", qty, rawName, "Ensamble");
        return;
      }

      if (name.includes("corredera") || name.includes("slide") || name.includes("gaveta") || name.includes("cajon")) {
        addWarehouse("corredera", "Corredera telescópica / oculta", "Herraje", "juego", qty, rawName, "Ensamble");
        return;
      }

      if (name.includes("tirador") || name.includes("jaladera") || name.includes("handle")) {
        addWarehouse("tirador", "Tirador / jaladera", "Herraje", "unidad", qty, rawName, "Terminación");
        return;
      }

      if (name.includes("led") || name.includes("luz") || name.includes("luces") || name.includes("strip")) {
        addWarehouse("luz-led", "Luz LED / tira LED", "Eléctrico", name.includes("metro") ? "metro" : "unidad", qty, rawName, "Instalación");
        return;
      }

      if (name.includes("minifix")) {
        addWarehouse("minifix", "Minifix 181-05", "Herraje", "unidad", qty, rawName, "Ensamble");
        addWarehouse("perno-minifix", "Perno Minifix 181-13", "Herraje", "unidad", qty, rawName, "Ensamble");
        addWarehouse("tapon-minifix", "Tapón cubre minifix", "Herraje", "unidad", qty, rawName, "Terminación");
        return;
      }

      if (name.includes("tornillo") || name.includes("screw")) {
        addWarehouse("tornillo-ensamble", "Tornillo de ensamble", "Consumible", "unidad", qty, rawName, "Ensamble");
        return;
      }

      if (name.includes("soporte") || name.includes("repisa") || name.includes("shelf")) {
        if (!name.includes("canto")) {
          addWarehouse("soporte-repisa", "Soporte de repisa", "Herraje", "unidad", qty, rawName, "Instalación");
        }
        return;
      }

      if (name.includes("tarugo") || name.includes("dowel")) {
        addWarehouse("tarugo-8", "Tarugo 8mm", "Herraje", "unidad", qty, rawName, "Ensamble");
        return;
      }

      if (name.includes("colgador")) {
        addWarehouse("colgador", "Colgador para gabinete", "Herraje", "unidad", qty, rawName, "Instalación");
        return;
      }
    });


    // =========================================================
    // ALMACÉN INTELIGENTE PRO
    // Si Producción/BOM no trae algunos herrajes, inferimos lo mínimo
    // según el tipo de proyecto y módulos, para que almacén tenga una
    // orden de despacho útil y no incompleta.
    // =========================================================
    const projectSearchText = [
      projectName,
      clientName,
      orderCode,
      JSON.stringify(payload || {}),
      JSON.stringify(productionOrderRow || {}),
      expandedPieces.map((p) => `${p.module_name || ""} ${p.piece_name || ""}`).join(" "),
      allOrderItems.map((p) => getItemName(p)).join(" "),
    ].join(" ").toLowerCase();

    const moduleNames = Array.from(new Set(expandedPieces.map((p) => p.module_name || "Sin módulo")));

    const countByWords = (words: string[]) =>
      sourceRows.reduce((sum: number, item: any) => {
        const n = getItemName(item).toLowerCase();
        return sum + (words.some((w) => n.includes(w)) ? getItemQty(item) : 0);
      }, 0);

    const looksLikeTvProject =
      projectSearchText.includes("tv") ||
      projectSearchText.includes("centro") ||
      projectSearchText.includes("panel") ||
      projectSearchText.includes("repisa") ||
      projectSearchText.includes("credenza");

    const hasDrawers =
      projectSearchText.includes("gaveta") ||
      projectSearchText.includes("cajon") ||
      projectSearchText.includes("cajón") ||
      projectSearchText.includes("corredera") ||
      warehouseMap.has("corredera");

    const hasDoors =
      projectSearchText.includes("puerta") ||
      projectSearchText.includes("bisagra") ||
      projectSearchText.includes("lateral") ||
      projectSearchText.includes("gabinete");

    const hasLighting =
      projectSearchText.includes("led") ||
      projectSearchText.includes("luz") ||
      projectSearchText.includes("luces") ||
      looksLikeTvProject;

    // Bisagras: si no llegaron desde inventario, crear requerimiento estimado.
    // Para centro TV con gabinetes laterales/superiores, mínimo 8 unidades.
    if (!warehouseMap.has("bisagra-cierre-suave") && (hasDoors || looksLikeTvProject)) {
      const estimatedDoors = Math.max(
        2,
        Math.ceil(countByWords(["puerta", "bisagra", "gabinete", "lateral"]) || (looksLikeTvProject ? 4 : 2))
      );
      addWarehouse(
        "bisagra-cierre-suave",
        "Bisagra cierre suave",
        "Herraje",
        "unidad",
        estimatedDoors * 2,
        "Estimado automático: 2 bisagras por puerta",
        "Ensamble"
      );
    }

    // Tiradores: si hay gavetas/puertas y no llegaron, estimar por frentes.
    if (!warehouseMap.has("tirador") && (hasDrawers || hasDoors || looksLikeTvProject)) {
      const estimatedFronts = Math.max(
        4,
        Math.ceil(countByWords(["gaveta", "cajon", "cajón", "tirador", "puerta"]) || (looksLikeTvProject ? 6 : 4))
      );
      addWarehouse(
        "tirador",
        "Tirador / jaladera",
        "Herraje",
        "unidad",
        estimatedFronts,
        "Estimado automático: 1 tirador por frente/puerta",
        "Terminación"
      );
    }

    // LED: si es centro TV/render con iluminación y no llegó, incluir línea de despacho.
    if (!warehouseMap.has("luz-led") && hasLighting) {
      addWarehouse(
        "luz-led",
        "Luz LED cálida / tira LED",
        "Eléctrico",
        "metro",
        looksLikeTvProject ? 5 : 3,
        "Estimado automático para repisas/panel iluminado",
        "Instalación"
      );
      addWarehouse(
        "transformador-led",
        "Transformador LED",
        "Eléctrico",
        "unidad",
        1,
        "Fuente para luces LED",
        "Instalación"
      );
      addWarehouse(
        "interruptor-led",
        "Interruptor / sensor LED",
        "Eléctrico",
        "unidad",
        1,
        "Control de iluminación",
        "Instalación"
      );
    }

    // Soportes de repisa: evitar cantidades exageradas por piezas cortadas.
    // Si ya existe, limitarlo a cantidad razonable por repisa visible.
    const shelfLines = expandedPieces.filter((p) =>
      `${p.module_name || ""} ${p.piece_name || ""}`.toLowerCase().includes("repisa")
    ).length;
    const estimatedShelves = Math.max(1, Math.ceil(shelfLines / 4));
    const support = warehouseMap.get("soporte-repisa");
    if (support) {
      support.qty = Math.min(support.qty, estimatedShelves * 4);
      support.ref = "4 soportes por repisa estimada";
    } else if (looksLikeTvProject || projectSearchText.includes("repisa")) {
      addWarehouse(
        "soporte-repisa",
        "Soporte de repisa",
        "Herraje",
        "unidad",
        estimatedShelves * 4,
        "4 soportes por repisa estimada",
        "Instalación"
      );
    }


    if (!warehouseMap.has("minifix")) {
      moduleNames.forEach(() => addWarehouse("minifix", "Minifix 181-05", "Herraje", "unidad", 8, "Base por módulo", "Ensamble"));
    }
    if (!warehouseMap.has("perno-minifix")) {
      moduleNames.forEach(() => addWarehouse("perno-minifix", "Perno Minifix 181-13", "Herraje", "unidad", 8, "Base por módulo", "Ensamble"));
    }
    if (!warehouseMap.has("tapon-minifix")) {
      moduleNames.forEach(() => addWarehouse("tapon-minifix", "Tapón cubre minifix", "Herraje", "unidad", 8, "Base por módulo", "Terminación"));
    }
    if (!warehouseMap.has("tornillo-ensamble")) {
      moduleNames.forEach(() => addWarehouse("tornillo-ensamble", "Tornillo de ensamble", "Consumible", "unidad", 20, "Base por módulo", "Ensamble"));
    }

    const hardwareRows = Array.from(warehouseMap.values()).map((h) => [
      h.item,
      h.type,
      `${Number.isInteger(h.qty) ? h.qty : h.qty.toFixed(2)} ${h.unit}`,
      h.ref,
      h.destination,
      h.status,
    ]);

    const hardwareEstimated = Array.from(warehouseMap.values()).reduce((sum, h) => {
      const name = h.item.toLowerCase();
      const price =
        name.includes("bisagra") ? 150 :
        name.includes("corredera") ? 350 :
        name.includes("tirador") ? 120 :
        name.includes("led") || name.includes("luz") ? 250 :
        name.includes("minifix") ? 12 :
        name.includes("perno") ? 8 :
        name.includes("tornillo") ? 2 :
        name.includes("tarugo") ? 3 :
        name.includes("soporte") ? 15 :
        name.includes("colgador") ? 80 :
        name.includes("tapón") || name.includes("tapon") ? 2 :
        5;
      return sum + h.qty * price;
    }, 0);

    const subtotalCost =
      materialTotal +
      edgeTotal +
      cutServiceTotal +
      cncProgrammingTotal +
      hardwareEstimated +
      wasteTotal +
      productionLabor +
      installationLabor;

    const profitAmount = subtotalCost * 0.35;
    const priceBeforeTax = subtotalCost + profitAmount;
    const itbisAmount = priceBeforeTax * 0.18;
    const suggestedPrice = priceBeforeTax + itbisAmount;

    const modules = Array.from(
      expandedPieces.reduce((map, p) => {
        const key = p.module_name || "Sin módulo";
        const prev = map.get(key) || { module: key, pieces: 0, cutMl: 0, edgeMl: 0 };
        const w = Number(p.width_mm || 0);
        const h = Number(p.height_mm || 0);
        prev.pieces += 1;
        prev.cutMl += (2 * (w + h)) / 1000;
        if (p.edge_front) prev.edgeMl += w / 1000;
        if (p.edge_back) prev.edgeMl += w / 1000;
        if (p.edge_left) prev.edgeMl += h / 1000;
        if (p.edge_right) prev.edgeMl += h / 1000;
        map.set(key, prev);
        return map;
      }, new Map<string, any>()).values()
    );

    // RENDER APROBADO:
    // 1) Si el usuario cargó una imagen manual: usarla.
    // 2) Si pegó URL exacta: convertirla a base64 e insertarla.
    // 3) Si producción/IA trae campo explícito de render: usarlo.
    // 4) NO tomar URL genéricas para evitar render equivocado.
    const renderCandidates = [
      approvedRenderDataUrl,
      approvedRenderUrl,
      deepFindValue(productionOrderRow, ["approved_render_url"]),
      deepFindValue(productionOrderRow, ["approvedRenderUrl"]),
      deepFindValue(productionOrderRow, ["render_base64"]),
      deepFindValue(productionOrderRow, ["renderBase64"]),
      deepFindValue(productionOrderRow, ["render_url"]),
      deepFindValue(productionOrderRow, ["renderUrl"]),
      deepFindValue(productionOrderRow, ["image_url"]),
      deepFindValue(productionOrderRow, ["imageUrl"]),
      deepFindValue(productionOrderRow, ["preview_url"]),
      deepFindValue(productionOrderRow, ["thumbnail_url"]),
      deepFindValue(payload, ["approved_render_url"]),
      deepFindValue(payload, ["approvedRenderUrl"]),
      deepFindValue(payload, ["render_base64"]),
      deepFindValue(payload, ["renderBase64"]),
      deepFindValue(payload, ["render_url"]),
      deepFindValue(payload, ["renderUrl"]),
      deepFindValue(payload, ["image_url"]),
      deepFindValue(payload, ["imageUrl"]),
      deepFindValue(payload, ["preview_url"]),
      deepFindValue(payload, ["thumbnail_url"]),
      deepFindValue(relatedRows, ["approved_render_url"]),
      deepFindValue(relatedRows, ["approvedRenderUrl"]),
      deepFindValue(relatedRows, ["render_base64"]),
      deepFindValue(relatedRows, ["renderBase64"]),
      deepFindValue(relatedRows, ["render_url"]),
      deepFindValue(relatedRows, ["renderUrl"]),
      deepFindValue(relatedRows, ["image_url"]),
      deepFindValue(relatedRows, ["imageUrl"]),
      deepFindValue(relatedRows, ["preview_url"]),
      deepFindValue(relatedRows, ["thumbnail_url"]),
    ]
      .map((v) => String(v || "").trim())
      .filter(Boolean);

    let renderValue = renderCandidates[0] || "";

    // Último seguro: si no lo encontró en datos, pedir URL exacta al imprimir.
    // Pega la URL pública del render que abre en otra pestaña.
    if (!renderValue && typeof window !== "undefined") {
      const typedRenderUrl = window.prompt(
        "No encontré el render aprobado. Pega aquí la URL exacta del render para incluirlo en el PDF:",
        approvedRenderUrl || ""
      );

      if (typedRenderUrl && typedRenderUrl.trim()) {
        renderValue = typedRenderUrl.trim();
        setApprovedRenderUrl(renderValue);
      }
    }

    const convertExternalImageToBase64 = async (url: string) => {
      try {
        if (!url || url.startsWith("data:image")) return url;

        // Método normal para URLs públicas con CORS permitido.
        const response = await fetch(url, { mode: "cors", cache: "no-store" });
        if (!response.ok) return "";

        const blob = await response.blob();

        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ""));
          reader.onerror = () => resolve("");
          reader.readAsDataURL(blob);
        });
      } catch {
        return "";
      }
    };

    if (renderValue && !renderValue.startsWith("data:image")) {
      const converted = await convertExternalImageToBase64(renderValue);
      if (converted) {
        renderValue = converted;
      } else if (renderValue) {
        alert(
          "No pude insertar esa URL como imagen. Descarga el render y súbelo en 'Cargar render aprobado', o usa una URL pública directa de imagen PNG/JPG."
        );
      }
    }

    // PAGE 1
    header("PDF EJECUTIVO MASTER PRO");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(projectName || "Proyecto de corte", 14, 48);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Cliente: ${clientName || "-"}`, 14, 58);
    doc.text(`Orden: ${ref}`, 14, 66);
    doc.text(`Material principal: ${materialName(selectedMaterial)}`, 14, 74);

    doc.setFillColor(240, 249, 255);
    doc.roundedRect(14, 84, 182, 50, 3, 3, "F");
    doc.setTextColor(2, 132, 199);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Resumen industrial", 20, 96);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(`Hojas: ${layouts.length}`, 20, 106);
    doc.text(`Piezas: ${expandedPieces.length}`, 58, 106);
    doc.text(`Uso: ${efficiency.toFixed(1)}%`, 96, 106);
    doc.text(`Merma: ${wasteM2.toFixed(2)} m²`, 134, 106);
    doc.text(`Corte servicio: ${cutLinearMeters.toFixed(2)} ml x RD$30 = ${moneyPdf(cutServiceTotal)}`, 20, 116);
    doc.text(`Canteo servicio: ${finalEdgeMeters.toFixed(2)} ml x RD$35 = ${moneyPdf(edgeTotal)}`, 20, 124);
    doc.text(
      installedProjectFeet > 0
        ? `Incentivo: ${installedProjectFeet.toFixed(2)} pies instalados x RD$300 producción + RD$300 instalación`
        : "Incentivo: no encontré pies lineales en cotización; usar campo manual",
      20,
      132
    );

    autoTable(doc, {
      startY: 146,
      head: [["Concepto", "Base", "Monto"]],
      body: [
        ["Materiales / tableros", `${layouts.length} hoja(s) x ${moneyPdf(materialCostPerSheet)}`, moneyPdf(materialTotal)],
        ["Servicio de corte", `${cutLinearMeters.toFixed(2)} ml x RD$30`, moneyPdf(cutServiceTotal)],
        ["Servicio de canto PVC", `${finalEdgeMeters.toFixed(2)} ml x RD$35`, moneyPdf(edgeTotal)],
        ["Herrajes / eléctricos detallados", `${hardwareRows.length} renglones`, moneyPdf(hardwareEstimated)],
        ["CNC / programación", `${cncDrillingCount} operaciones`, moneyPdf(cncProgrammingTotal)],
        ["Merma / desperdicio", `${wasteM2.toFixed(2)} m²`, moneyPdf(wasteTotal)],
        ["Incentivo producción", installedProjectFeet > 0 ? `${installedProjectFeet.toFixed(2)} pies instalados x RD$300` : "Pies instalados pendientes", moneyPdf(productionLabor)],
        ["Incentivo instalación", installedProjectFeet > 0 ? `${installedProjectFeet.toFixed(2)} pies instalados x RD$300` : "Pies instalados pendientes", moneyPdf(installationLabor)],
        ["Subtotal costo", "", moneyPdf(subtotalCost)],
        ["Utilidad 35%", "", moneyPdf(profitAmount)],
        ["ITBIS 18%", "", moneyPdf(itbisAmount)],
        ["PRECIO SUGERIDO", "", moneyPdf(suggestedPrice)],
      ],
      theme: "grid",
      headStyles: { fillColor: [2, 8, 23], textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: { 0: { fontStyle: "bold" }, 2: { halign: "right", fontStyle: "bold" } },
    });

    // PAGE 2 RENDER
    doc.addPage();
    header("RENDER APROBADO / REFERENCIA VISUAL");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Render aprobado desde IA Diseño / Producción", 14, 44);
    doc.setDrawColor(148, 163, 184);
    doc.roundedRect(14, 62, 182, 135, 3, 3);

    if (renderValue && renderValue.startsWith("data:image")) {
      try {
        const format = renderValue.includes("image/jpeg") || renderValue.includes("image/jpg") ? "JPEG" : "PNG";
        doc.addImage(renderValue, format, 22, 70, 166, 115);
      } catch {
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(10);
        doc.text("No se pudo insertar el render automáticamente.", 105, 126, { align: "center" });
      }
    } else {
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("NO HAY RENDER APROBADO VINCULADO", 105, 118, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Solución: pega la URL exacta o sube la imagen manualmente en Corte antes de imprimir.", 105, 132, { align: "center" });
    }

    // PAGE 3 ALMACEN
    doc.addPage();
    header("ORDEN DE ENTREGA DE ALMACÉN");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Orden real de despacho: materiales, herrajes y eléctricos", 14, 44);

    autoTable(doc, {
      startY: 54,
      head: [["Material / Insumo", "Tipo", "Cantidad", "Medida / Ref.", "Destino", "Estado"]],
      body: [
        [materialName(selectedMaterial), "Melamina / tablero", `${layouts.length} hoja(s)`, `${sheetHeight} x ${sheetWidth} mm`, "Corte", "Pendiente"],
        ["Canto PVC compatible", "Canto", `${finalEdgeMeters.toFixed(2)} ml`, "22mm / según diseño", "Canteo", "Pendiente"],
        ...hardwareRows,
      ],
      theme: "grid",
      headStyles: { fillColor: [2, 8, 23], textColor: 255 },
      styles: { fontSize: 7 },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [["Módulo", "Piezas", "Corte ML", "Canto ML", "Preparación"]],
      body: modules.map((m: any) => [
        m.module,
        String(m.pieces),
        m.cutMl.toFixed(2),
        m.edgeMl.toFixed(2),
        "Separar kit por módulo",
      ]),
      theme: "striped",
      headStyles: { fillColor: [2, 8, 23], textColor: 255 },
      styles: { fontSize: 8 },
    });

    // PAGE 4 PIECES
    doc.addPage();
    header("LISTA DE PIEZAS");

    autoTable(doc, {
      startY: 36,
      head: [["#", "Módulo", "Pieza", "Medida", "Canto"]],
      body: expandedPieces.slice(0, 140).map((p, i) => [
        String(i + 1),
        p.module_name || "Sin módulo",
        p.piece_name || "Pieza",
        `${p.width_mm} x ${p.height_mm} x ${p.thickness_mm} mm`,
        edgeText(p),
      ]),
      theme: "striped",
      headStyles: { fillColor: [2, 8, 23], textColor: 255 },
      styles: { fontSize: 7 },
    });

    // PAGE 5 CUT PLAN
    doc.addPage();
    header("PLANO DE CORTE");

    let y = 38;
    layouts.slice(0, 6).forEach((sheet, sheetIndex) => {
      if (y > 240) {
        doc.addPage();
        header("PLANO DE CORTE");
        y = 38;
      }

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`Hoja #${sheetIndex + 1} · Uso ${((sheet.usadoM2 / boardAreaM2) * 100).toFixed(1)}%`, 14, y);

      const scale = 70 / sheetHeight;
      const boardW = sheetHeight * scale;
      const boardH = sheetWidth * scale;
      doc.setDrawColor(15, 23, 42);
      doc.rect(14, y + 5, boardW, boardH);

      sheet.piezas.forEach((p) => {
        doc.setFillColor(34, 211, 238);
        doc.setDrawColor(15, 23, 42);
        doc.rect(14 + p.x * scale, y + 5 + p.y * scale, p.w * scale, p.h * scale, "FD");
      });

      y += boardH + 18;
    });

    // PAGE 6 ASSEMBLY
    doc.addPage();
    header("DIAGRAMA DE ARMADO");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Secuencia visual de armado del proyecto", 14, 44);

    const box = (x: number, yb: number, w: number, h: number, title: string, sub: string) => {
      doc.setDrawColor(2, 132, 199);
      doc.setFillColor(240, 249, 255);
      doc.roundedRect(x, yb, w, h, 3, 3, "FD");
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(title, x + 5, yb + 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(sub, x + 5, yb + 20, { maxWidth: w - 10 });
    };

    const arrow = (x1: number, y1: number, x2: number, y2: number) => {
      doc.setDrawColor(15, 23, 42);
      doc.line(x1, y1, x2, y2);
      doc.triangle(x2, y2, x2 - 3, y2 - 2, x2 - 3, y2 + 2, "F");
    };

    box(18, 62, 52, 32, "1. Separar piezas", "Almacén entrega kit detallado.");
    box(82, 62, 52, 32, "2. Armar módulos", "Ensamblar cajas, repisas y paneles.");
    box(146, 62, 46, 32, "3. Canteo", "Cantear piezas marcadas.");
    arrow(70, 78, 82, 78);
    arrow(134, 78, 146, 78);

    box(18, 118, 52, 32, "4. Herrajes", "Instalar bisagras, tiradores, luces y soportes.");
    box(82, 118, 52, 32, "5. Preinstalación", "Presentar, nivelar y verificar.");
    box(146, 118, 46, 32, "6. Entrega", "Limpieza, fotos y firma.");
    arrow(70, 134, 82, 134);
    arrow(134, 134, 146, 134);

    autoTable(doc, {
      startY: 170,
      head: [["Orden", "Actividad", "Responsable"]],
      body: [
        ["1", "Almacén entrega materiales y herrajes detallados.", "Almacén"],
        ["2", "Producción arma módulos por QR/etiqueta.", "Maestro producción"],
        ["3", "Canteo y terminación de piezas visibles.", "Canteo"],
        ["4", "Instalación de herrajes, tiradores y luces LED.", "Producción"],
        ["5", "Instalar en obra según render aprobado.", "Instalación"],
        ["6", "Checklist final y firma.", "Supervisor"],
      ],
      theme: "grid",
      headStyles: { fillColor: [2, 8, 23], textColor: 255 },
      styles: { fontSize: 8 },
    });

    // FINAL
    doc.addPage();
    header("CONTROL Y TRAZABILIDAD");

    const qrPayload = {
      system: "RD WOOD SYSTEM",
      type: "executive_pdf",
      order: ref,
      project: projectName,
      client: clientName,
      pieces: expandedPieces.length,
      sheets: layouts.length,
      materialTotal,
      cutLinearMeters,
      cutServiceTotal,
      edgeMeters: finalEdgeMeters,
      edgeTotal,
      installedProjectFeet,
      productionLabor,
      installationLabor,
      suggestedPrice,
      created_at: new Date().toISOString(),
    };

    const qr = await QRCode.toDataURL(JSON.stringify(qrPayload), {
      width: 260,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Resumen final", 14, 48);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Precio sugerido: ${moneyPdf(suggestedPrice)}`, 14, 62);
    doc.text(`Costo estimado: ${moneyPdf(subtotalCost)}`, 14, 72);
    doc.text(`Utilidad estimada: ${moneyPdf(profitAmount)}`, 14, 82);
    doc.text(`Corte servicio: ${cutLinearMeters.toFixed(2)} ml x RD$30 = ${moneyPdf(cutServiceTotal)}`, 14, 92);
    doc.text(`Canto servicio: ${finalEdgeMeters.toFixed(2)} ml x RD$35 = ${moneyPdf(edgeTotal)}`, 14, 102);
    doc.text(
      installedProjectFeet > 0
        ? `Incentivo: ${installedProjectFeet.toFixed(2)} pies instalados x RD$300 producción + RD$300 instalación`
        : "Incentivo: falta pies lineales instalados/cotizados",
      14,
      112
    );

    doc.addImage(qr, "PNG", 150, 48, 42, 42);

    doc.setDrawColor(148, 163, 184);
    doc.line(14, 230, 88, 230);
    doc.line(122, 230, 196, 230);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Firma almacén / producción", 14, 237);
    doc.text("Firma cliente / supervisor", 122, 237);

    doc.save(`RD-WOOD-PDF-EJECUTIVO-${ref}.pdf`);
  }

  async function generateLabelsPDF() {
    if (!selectedMaterial && !cutPlans.length) {
      alert("Selecciona material.");
      return;
    }

    if (!expandedPieces.length) {
      alert("No hay piezas para generar etiquetas.");
      return;
    }

    if (!(await ensureRequisitionGate("generar etiquetas"))) {
      return;
    }

    const doc = new jsPDF("portrait", "mm", "a4");
    const ref = orderCode || `CORTE-${Date.now()}`;
    const labelW = 95;
    const labelH = 56;
    const marginX = 8;
    const marginY = 12;
    const gapX = 4;
    const gapY = 4;

    let x = marginX;
    let y = marginY;

    const drawHeader = () => {
      doc.setFillColor(2, 8, 23);
      doc.rect(0, 0, 210, 9, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.text("RD WOOD SYSTEM · ETIQUETAS QR INTELIGENTES PRO", 8, 6);
    };

    drawHeader();

    for (let i = 0; i < expandedPieces.length; i++) {
      const p = expandedPieces[i];
      const code = pieceCode(i);
      const pieceMaterial = bestMaterialForPiece(p) || selectedMaterial;

      const qrPayload = {
        system: "RD WOOD SYSTEM",
        type: "piece_label",
        station_flow: qrStationText(),
        job_code: ref,
        production_order_id: payload?.production_order_id || "",
        order_code: orderCode || ref,
        project: projectName || "Corte PRO",
        client: clientName || "",
        module: p.module_name || "Sin módulo",
        piece_code: code,
        piece_name: p.piece_name || "Pieza",
        material: materialName(pieceMaterial),
        source: pieceMaterial?.source || "TABLERO",
        width_mm: p.width_mm,
        height_mm: p.height_mm,
        thickness_mm: p.thickness_mm,
        edge_text: edgeText(p),
        edge_front: p.edge_front,
        edge_back: p.edge_back,
        edge_left: p.edge_left,
        edge_right: p.edge_right,
        can_rotate: pieceCanRotateByGrain(p, pieceMaterial, respectGrain),
        created_at: new Date().toISOString(),
      };

      const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 260,
      });

      if (y + labelH > 292) {
        doc.addPage("portrait");
        drawHeader();
        x = marginX;
        y = marginY;
      }

      doc.setDrawColor(30, 41, 59);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, labelW, labelH, 2, 2, "FD");

      doc.setFillColor(2, 8, 23);
      doc.roundedRect(x, y, labelW, 10, 2, 2, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("RD WOOD SYSTEM", x + 3, y + 4);
      doc.setFontSize(5);
      doc.text(ref.slice(0, 32), x + 3, y + 8);

      doc.addImage(qrDataUrl, "PNG", x + 3, y + 14, 32, 32);

      doc.setTextColor(10, 10, 10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(code, x + 38, y + 16);

      doc.setFontSize(7);
      doc.text((p.piece_name || "Pieza").slice(0, 33), x + 38, y + 22);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.text(`Módulo: ${(p.module_name || "Sin módulo").slice(0, 30)}`, x + 38, y + 28);
      doc.text(`Medida: ${p.width_mm} x ${p.height_mm} x ${p.thickness_mm} mm`, x + 38, y + 34);
      doc.text(`Material: ${materialName(pieceMaterial).slice(0, 30)}`, x + 38, y + 40);
      doc.text(`Canto: ${edgeText(p).slice(0, 32)}`, x + 38, y + 46);

      doc.setFillColor(224, 242, 254);
      doc.roundedRect(x + 3, y + 48, labelW - 6, 5, 1, 1, "F");
      doc.setTextColor(2, 8, 23);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(4.6);
      doc.text(qrStationText(), x + 5, y + 51.5);

      x += labelW + gapX;
      if (x + labelW > 204) {
        x = marginX;
        y += labelH + gapY;
      }
    }

    doc.save(`${ref}_etiquetas_qr_rdwood.pdf`);
  }

  async function generatePDF() {
    if (!selectedMaterial && !cutPlans.length) {
      alert("Selecciona material.");
      return;
    }

    if (!expandedPieces.length) {
      alert("Agrega piezas válidas para generar PDF.");
      return;
    }

    if (!(await ensureRequisitionGate("generar PDF Corte Sierra"))) {
      return;
    }

    const doc = new jsPDF("landscape", "mm", "letter");
    const ref = orderCode || `CORTE-${Date.now()}`;
    const sheetScaleMaxW = 130;
    const sheetScaleMaxH = 105;
    const materialSummary = cutPlans.length
      ? cutPlans
          .map((plan) => `${materialName(plan.material)} (${plan.sheets} hoja${plan.sheets === 1 ? "" : "s"})`)
          .join(" / ")
      : materialName(selectedMaterial);
    const sizeSummary = cutPlans.length
      ? Array.from(new Set(cutPlans.map((plan) => `${materialHeight(plan.material)} x ${materialWidth(plan.material)} mm`))).join(" / ")
      : `${sheetHeight} x ${sheetWidth} mm`;

    doc.setFillColor(2, 8, 23);
    doc.rect(0, 0, 297, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("RD WOOD SYSTEM", 14, 13);
    doc.setFontSize(10);
    doc.text("OPTIMIZACIÓN DE CORTE PRO", 14, 22);
    doc.text(ref, 235, 13);
    doc.text(new Date().toLocaleString("es-DO"), 235, 22);

    doc.setTextColor(20, 20, 20);
    doc.setFontSize(11);
    doc.text("Resumen de corte", 14, 43);
    doc.setFontSize(9);
    doc.text(`Proyecto: ${projectName || "Corte PRO"}`, 14, 52);
    doc.text(`Cliente: ${clientName || "-"}`, 14, 59);
    doc.text(`Materiales: ${materialSummary.slice(0, 90)}`, 14, 66);
    doc.text(`Medida tablero: ${sizeSummary.slice(0, 90)}`, 14, 73);
    doc.text(`Origen: ${cutPlans.length > 1 ? "PLAN MULTI-MATERIAL" : selectedMaterial?.source || "TABLERO"}`, 14, 80);
    doc.text(`Veta: ${cutPlans.some((plan) => materialHasGrain(plan.material)) ? "RESPETADA POR MATERIAL" : "ROTACIÓN LIBRE"}`, 14, 87);
    doc.text(`Hojas usadas: ${layouts.length}`, 14, 94);
    doc.text(`Aprovechamiento: ${efficiency.toFixed(2)}%`, 14, 101);
    doc.text(`Desperdicio: ${wasteM2.toFixed(2)} m²`, 14, 108);
    doc.text(`Canteo: ${serviceEdgeMeters.toFixed(2)} ml / ${money(totalEdgeCost)}`, 14, 115);

    layouts.forEach((sheet, sheetIndex) => {
      if (sheetIndex > 0) doc.addPage("landscape");

      if (sheetIndex > 0) {
        doc.setFillColor(2, 8, 23);
        doc.rect(0, 0, 297, 24, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text("RD WOOD SYSTEM", 14, 12);
        doc.setFontSize(9);
        doc.text(`HOJA ${sheet.numero} · ${ref}`, 235, 12);
      }

      const startX = sheetIndex === 0 ? 125 : 20;
      const startY = sheetIndex === 0 ? 43 : 36;
      const sheetMaterial = sheet.material || selectedMaterial;
      const currentSheetHeight = sheet.sheetHeightMm || materialHeight(sheetMaterial);
      const currentSheetWidth = sheet.sheetWidthMm || materialWidth(sheetMaterial);
      const scale = Math.min(sheetScaleMaxW / currentSheetHeight, sheetScaleMaxH / currentSheetWidth);

      doc.setTextColor(20, 20, 20);
      doc.setFontSize(11);
      doc.text(`Hoja #${sheet.numero} · ${materialName(sheetMaterial).slice(0, 42)}`, startX, startY - 5);

      doc.setDrawColor(10, 80, 160);
      doc.setLineWidth(0.4);
      doc.rect(startX, startY, currentSheetHeight * scale, currentSheetWidth * scale);
      const smallPieceLabels: { code: string; size: string; rotated: boolean; fromX: number; fromY: number }[] = [];

      sheet.piezas.forEach((p, idx) => {
        const x = startX + p.x * scale;
        const y = startY + p.y * scale;
        const w = p.w * scale;
        const h = p.h * scale;
        const pieceIndex = expandedPieces.findIndex((ep) => p.id.includes(ep.id));
        const code = pieceCode(pieceIndex >= 0 ? pieceIndex : idx);
        const sizeLabel = `${Math.round(p.w)}x${Math.round(p.h)}`;

        doc.setFillColor(31, 171, 210);
        doc.rect(x, y, w, h, "F");
        doc.setDrawColor(255, 255, 255);
        doc.rect(x, y, w, h);

        doc.setTextColor(5, 20, 35);
        doc.setFontSize(5);
        const labelTooWide = doc.getTextWidth(sizeLabel) > Math.max(0, w - 3);
        const isSmallForLabel = w < 18 || h < 11 || labelTooWide;

        if (isSmallForLabel) {
          smallPieceLabels.push({
            code,
            size: sizeLabel,
            rotated: Boolean(p.rotada),
            fromX: x + w,
            fromY: y + h / 2,
          });
        } else {
          doc.text(code, x + 1.5, y + 4);
          doc.text(sizeLabel, x + 1.5, y + 8);
          if (p.rotada) doc.text("R", x + w - 4, y + 4);
        }
      });

      if (smallPieceLabels.length) {
        const legendX = Math.min(274, startX + currentSheetHeight * scale + 7);
        const maxLegendY = 198;
        const lineH = 4.3;

        doc.setTextColor(5, 20, 35);
        doc.setFontSize(7);
        doc.text("Piezas pequenas", legendX, startY);

        smallPieceLabels.forEach((label, i) => {
          const col = Math.floor(i / 34);
          const row = i % 34;
          const lx = legendX + col * 62;
          const ly = Math.min(maxLegendY, startY + 5 + row * lineH);

          doc.setDrawColor(10, 80, 160);
          doc.setLineWidth(0.15);
          if (col === 0) doc.line(label.fromX, label.fromY, lx - 1.5, ly - 1);

          doc.setTextColor(5, 20, 35);
          doc.setFontSize(5.8);
          doc.text(`${label.code}  ${label.size}${label.rotated ? " R" : ""}`, lx, ly);
        });
      }
    });

    doc.addPage("landscape");
    doc.setFillColor(2, 8, 23);
    doc.rect(0, 0, 297, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("RD WOOD SYSTEM", 14, 13);
    doc.setFontSize(10);
    doc.text("LISTA DE PIEZAS Y CANTEO", 14, 21);

    autoTable(doc, {
      startY: 38,
      head: [["#", "Módulo", "Nombre", "Material", "Medida", "Cant.", "Veta", "Canteo", "ML"]],
      body: expandedPieces.map((p, i) => {
        const pieceMaterial = bestMaterialForPiece(p);
        const pieceHasGrain = respectGrain && materialHasGrain(pieceMaterial);
        return [
          pieceCode(i),
          p.module_name || "General",
          p.piece_name || "pieza",
          materialName(pieceMaterial).slice(0, 30),
          `${p.width_mm} x ${p.height_mm} x ${p.thickness_mm}`,
          "1",
          pieceHasGrain ? "NO VETA / ROTAR" : p.can_rotate ? "Puede rotar" : "No rotar",
          edgeText(p),
          edgeMl(p).toFixed(2),
        ];
      }),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [2, 8, 23] },
    });

    doc.save(`${ref}_pdf_corte_sierra_rdwood.pdf`);
    return;

    doc.addPage("portrait");
    doc.setFillColor(2, 8, 23);
    doc.rect(0, 0, 210, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("RD WOOD SYSTEM", 12, 11);
    doc.setFontSize(9);
    doc.text("ETIQUETAS QR DE PIEZAS", 12, 18);
    doc.text(ref, 155, 11);

    let x = 10;
    let y = 32;
    const labelW = 62;
    const labelH = 42;
    const gapX = 5;
    const gapY = 5;

    for (let i = 0; i < expandedPieces.length; i++) {
      const p = expandedPieces[i];
      const code = pieceCode(i);
      const qrPayload = {
        system: "RD WOOD SYSTEM",
        job_code: ref,
        order_code: orderCode,
        production_order_id: payload?.production_order_id || "",
        piece_code: code,
        module: p.module_name || "",
        piece: p.piece_name || "",
        project: projectName || "Corte PRO",
        client: clientName || "",
        material: materialName(selectedMaterial),
        measure: `${p.width_mm} x ${p.height_mm} x ${p.thickness_mm}`,
        width_mm: p.width_mm,
        height_mm: p.height_mm,
        thickness_mm: p.thickness_mm,
        edge: edgeText(p),
        edge_ml: Number(edgeMl(p).toFixed(2)),
        created_at: new Date().toISOString(),
      };

      const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 220,
      });

      if (y + labelH > 285) {
        doc.addPage("portrait");
        doc.setFillColor(2, 8, 23);
        doc.rect(0, 0, 210, 24, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text("RD WOOD SYSTEM", 12, 11);
        doc.setFontSize(9);
        doc.text("ETIQUETAS QR DE PIEZAS", 12, 18);
        x = 10;
        y = 32;
      }

      doc.setDrawColor(20, 35, 60);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, labelW, labelH, 2, 2, "FD");

      doc.addImage(qrDataUrl, "PNG", x + 2, y + 6, 28, 28);

      doc.setTextColor(10, 10, 10);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(code, x + 32, y + 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text((p.piece_name || "pieza").slice(0, 23), x + 32, y + 13);
      doc.text(`${p.width_mm} x ${p.height_mm} x ${p.thickness_mm}`, x + 32, y + 18);
      doc.text(`Mód: ${(p.module_name || "General").slice(0, 22)}`, x + 32, y + 23);
      doc.text(`Canto: ${edgeText(p).slice(0, 24)}`, x + 32, y + 28);
      doc.text(`Proyecto: ${(projectName || "Corte PRO").slice(0, 22)}`, x + 32, y + 33);
      doc.text(ref.slice(0, 28), x + 4, y + 39);

      x += labelW + gapX;
      if (x + labelW > 200) {
        x = 10;
        y += labelH + gapY;
      }
    }

    doc.save(`${ref}_optimizacion_corte_rdwood.pdf`);
  }

  function escapeDxfText(value: any) {
    return String(value ?? "")
      .replace(/[^\x20-\x7EÁÉÍÓÚÑáéíóúñ]/g, "")
      .slice(0, 60);
  }

  function buildDxfForSheet(sheet: SheetLayout, sheetIndex: number) {
    const ref = orderCode || `CORTE-${Date.now()}`;
    const mat = selectedMaterial ? materialName(selectedMaterial) : "Material";
    const lines: string[] = [];

    const add = (...values: any[]) => {
      values.forEach((v) => lines.push(String(v)));
    };

    const rect = (x: number, y: number, w: number, h: number, layer: string) => {
      add(
        0, "LWPOLYLINE",
        8, layer,
        90, 4,
        70, 1,
        10, x.toFixed(3), 20, y.toFixed(3),
        10, (x + w).toFixed(3), 20, y.toFixed(3),
        10, (x + w).toFixed(3), 20, (y + h).toFixed(3),
        10, x.toFixed(3), 20, (y + h).toFixed(3)
      );
    };

    const textEntity = (x: number, y: number, h: number, value: string, layer: string) => {
      add(
        0, "TEXT",
        8, layer,
        10, x.toFixed(3),
        20, y.toFixed(3),
        40, h.toFixed(3),
        1, escapeDxfText(value)
      );
    };

    const circle = (cx: number, cy: number, r: number, layer: string) => {
      add(
        0, "CIRCLE",
        8, layer,
        10, cx.toFixed(3),
        20, cy.toFixed(3),
        40, r.toFixed(3)
      );
    };

    add(
      0, "SECTION",
      2, "HEADER",
      9, "$INSUNITS",
      70, 4,
      0, "ENDSEC",
      0, "SECTION",
      2, "TABLES",
      0, "TABLE",
      2, "LAYER",
      70, 5,
      0, "LAYER", 2, "TABLERO", 70, 0, 62, 7, 6, "CONTINUOUS",
      0, "LAYER", 2, "CORTE", 70, 0, 62, 1, 6, "CONTINUOUS",
      0, "LAYER", 2, "ETIQUETA", 70, 0, 62, 3, 6, "CONTINUOUS",
      0, "LAYER", 2, "CANTO", 70, 0, 62, 5, 6, "CONTINUOUS",
      0, "LAYER", 2, "INFO", 70, 0, 62, 4, 6, "CONTINUOUS",
      0, "LAYER", 2, "PERFORACION", 70, 0, 62, 2, 6, "CONTINUOUS",
      0, "ENDTAB",
      0, "ENDSEC",
      0, "SECTION",
      2, "ENTITIES"
    );

    // Tablero completo en milímetros.
    rect(0, 0, sheetHeight, sheetWidth, "TABLERO");
    textEntity(20, sheetWidth + 35, 18, `RD WOOD SYSTEM · ${ref} · Hoja ${sheetIndex + 1}`, "INFO");
    textEntity(20, sheetWidth + 12, 12, `${mat} · ${sheetHeight}x${sheetWidth} mm · ${grainModeLabel(selectedMaterial, respectGrain)}`, "INFO");

    sheet.piezas.forEach((piece, idx) => {
      const originalIndex = expandedPieces.findIndex((ep) => piece.id.includes(ep.id));
      const p = originalIndex >= 0 ? expandedPieces[originalIndex] : null;
      const code = pieceCode(originalIndex >= 0 ? originalIndex : idx);

      rect(piece.x, piece.y, piece.w, piece.h, "CORTE");

      // Marcas de canteo: líneas internas cercanas al borde.
      if (p) {
        const offset = 8;
        if (p.edge_front) {
          add(0, "LINE", 8, "CANTO", 10, piece.x, 20, piece.y + offset, 11, piece.x + piece.w, 21, piece.y + offset);
        }
        if (p.edge_back) {
          add(0, "LINE", 8, "CANTO", 10, piece.x, 20, piece.y + piece.h - offset, 11, piece.x + piece.w, 21, piece.y + piece.h - offset);
        }
        if (p.edge_left) {
          add(0, "LINE", 8, "CANTO", 10, piece.x + offset, 20, piece.y, 11, piece.x + offset, 21, piece.y + piece.h);
        }
        if (p.edge_right) {
          add(0, "LINE", 8, "CANTO", 10, piece.x + piece.w - offset, 20, piece.y, 11, piece.x + piece.w - offset, 21, piece.y + piece.h);
        }
      }

      if (p && autoDrilling) {
        const ops = generateDrillOperationsForPiece(p, originalIndex >= 0 ? originalIndex : idx);
        ops.forEach((op) => {
          const drillX = piece.x + op.x;
          const drillY = piece.y + op.y;
          circle(drillX, drillY, op.diameter / 2, "PERFORACION");
          textEntity(drillX + 6, drillY + 6, 5, `${op.type} ${op.depth}mm`, "PERFORACION");
        });
      }

      textEntity(piece.x + 12, piece.y + 22, 10, code, "ETIQUETA");
      textEntity(piece.x + 12, piece.y + 38, 8, piece.nombre || "Pieza", "ETIQUETA");
      textEntity(piece.x + 12, piece.y + 52, 7, `${Math.round(piece.w)}x${Math.round(piece.h)}`, "ETIQUETA");
    });

    add(0, "ENDSEC", 0, "EOF");

    return lines.join("\n");
  }

  async function exportDXF() {
    if (!selectedMaterial) {
      alert("Selecciona material.");
      return;
    }

    if (!layouts.length) {
      alert("No hay plano para exportar DXF.");
      return;
    }

    if (!(await ensureRequisitionGate("exportar DXF CNC"))) {
      return;
    }

    const ref = orderCode || `CORTE-${Date.now()}`;

    layouts.forEach((sheet, index) => {
      const dxf = buildDxfForSheet(sheet, index);
      const blob = new Blob([dxf], { type: "application/dxf;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ref}_hoja_${index + 1}_rdwood_cnc.dxf`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function downloadPlainText(fileName: string, content: string) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildCncPiecesForSheet(sheet: SheetLayout, sheetIndex: number): CncRectPiece[] {
    return sheet.piezas.map((piece, idx) => {
      const originalIndex = expandedPieces.findIndex((ep) => piece.id.includes(ep.id));
      const p = originalIndex >= 0 ? expandedPieces[originalIndex] : null;

      return {
        id: piece.id,
        code: pieceCode(originalIndex >= 0 ? originalIndex : idx),
        name: piece.nombre || p?.piece_name || "Pieza",
        moduleName: p?.module_name || "Sin modulo",
        sheetIndex: sheetIndex + 1,
        x: piece.x,
        y: piece.y,
        width: piece.w,
        height: piece.h,
        thickness: p?.thickness_mm || sheetThickness || 18,
        rotated: piece.rotada,
      };
    });
  }

  function buildCncDrillsForSheet(sheet: SheetLayout, sheetIndex: number): CncDrillPoint[] {
    if (!autoDrilling) return [];

    return sheet.piezas.flatMap((piece, idx) => {
      const originalIndex = expandedPieces.findIndex((ep) => piece.id.includes(ep.id));
      const p = originalIndex >= 0 ? expandedPieces[originalIndex] : null;
      const code = pieceCode(originalIndex >= 0 ? originalIndex : idx);

      if (!p) return [];

      return generateDrillOperationsForPiece(p, originalIndex >= 0 ? originalIndex : idx).map((op) => ({
        sheetIndex: sheetIndex + 1,
        x: piece.x + op.x,
        y: piece.y + op.y,
        depth: op.depth,
        diameter: op.diameter,
        note: `${op.type} ${op.note}`,
        pieceCode: code,
      }));
    });
  }

  async function exportCncProgram(processorOverride?: CncPostProcessorId) {
    if (!selectedMaterial) {
      alert("Selecciona material.");
      return;
    }

    if (!layouts.length) {
      alert("No hay plano para exportar CNC.");
      return;
    }

    if (!(await ensureRequisitionGate("exportar Post CNC"))) {
      return;
    }

    const ref = orderCode || `CORTE-${Date.now()}`;
    const processor = processorOverride || postProcessorId;
    const preset = cncPostPresets.find((item) => item.id === processor) || cncPostPresets[0];
    const ok = confirm(
      `Se exportara el programa CNC con post ${preset?.label || "CNC"}.\n\nValida en el controlador: origen, herramienta, profundidad, clamps, sentido de corte y primera hoja en seco antes de cortar.\n\nDeseas exportarlo?`
    );

    if (!ok) return;

    layouts.forEach((sheet, index) => {
      const program = generateCncProgram({
        orderCode: ref,
        projectName,
        clientName,
        materialName: materialName(selectedMaterial),
        sheetNumber: index + 1,
        sheetWidth,
        sheetHeight,
        pieces: buildCncPiecesForSheet(sheet, index),
        drills: buildCncDrillsForSheet(sheet, index),
        options: {
          ...defaultCncPostOptions(processor),
          processorId: processor,
          cutDepth: -(Math.abs(sheetThickness || 18) + 1.2),
          toolDiameter: cncToolDiameter,
          kerfMm: cncKerfMm,
          offsetX: cncOffsetX,
          offsetY: cncOffsetY,
          compensation: cncCompensation,
          includeDrills: autoDrilling,
        },
      });

      downloadPlainText(program.fileName, program.content);
    });

    setMessage(`Post CNC exportado: ${preset?.label || "CNC"} (${layouts.length} hoja(s)).`);
  }

  function buildGcodeForSheet(sheet: SheetLayout, sheetIndex: number) {
    return "";
    /*
    const ref = orderCode || `CORTE-${Date.now()}`;
    const lines: string[] = [];
    const cutDepth = -19.2; // melamina 18mm + paso mínimo
    const cutFeed = 4200;
    const drillFeed = 900;

    lines.push(...gcodeHeader(`${ref} - HOJA ${sheetIndex + 1}`));

    lines.push(`(MATERIAL: ${selectedMaterial ? materialName(selectedMaterial) : "Material"})`);
    lines.push(`(HOJA: ${sheetHeight} x ${sheetWidth} mm)`);
    lines.push(`(HERRAMIENTA CORTE SUGERIDA: Compression 1/4")`);
    lines.push(`(NOTA: Validar origen, offsets, clamps y postprocesador antes de cortar)`);

    sheet.piezas.forEach((piece, idx) => {
      const originalIndex = expandedPieces.findIndex((ep) => piece.id.includes(ep.id));
      const p = originalIndex >= 0 ? expandedPieces[originalIndex] : null;
      const code = pieceCode(originalIndex >= 0 ? originalIndex : idx);

      lines.push(`(${code} - ${piece.nombre || "Pieza"})`);
      lines.push(...gcodeCutRect(piece.x, piece.y, piece.w, piece.h, cutDepth, cutFeed));

      if (p && autoDrilling) {
        const ops = generateDrillOperationsForPiece(p, originalIndex >= 0 ? originalIndex : idx);
        ops.forEach((op) => {
          const drillX = piece.x + op.x;
          const drillY = piece.y + op.y;
          lines.push(...gcodeDrill(drillX, drillY, op.depth, drillFeed, `${code} ${op.type} Ø${op.diameter} ${op.note}`));
        });
      }
    });

    lines.push(...gcodeFooter());

    return lines.join("\n");
    */
  }

  async function exportGcodeNC() {
    await exportCncProgram();
    return;
    /*

    if (!selectedMaterial) {
      alert("Selecciona material.");
      return;
    }

    if (!layouts.length) {
      alert("No hay plano para exportar G-Code.");
      return;
    }

    const ref = orderCode || `CORTE-${Date.now()}`;

    const ok = confirm(
      "Este G-Code es una base automática para Blue Elephant. Antes de cortar, valida en Aspire/Mach3/NC Studio: origen, herramienta, profundidad, clamps, sentido de corte y postprocesador. ¿Deseas exportarlo?"
    );

    if (!ok) return;

    layouts.forEach((sheet, index) => {
      const nc = buildGcodeForSheet(sheet, index);
      const blob = new Blob([nc], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ref}_hoja_${index + 1}_blue_elephant.nc`;
      a.click();
      URL.revokeObjectURL(url);
    });
    */
  }

  async function exportDrillingCSV() {
    if (!drillingOperations.length) {
      alert("No hay perforaciones generadas.");
      return;
    }

    if (!(await ensureRequisitionGate("exportar perforaciones CNC"))) {
      return;
    }

    const ref = orderCode || `CORTE-${Date.now()}`;
    const header = [
      "orden",
      "proyecto",
      "cliente",
      "codigo_pieza",
      "pieza",
      "modulo",
      "tipo_perforacion",
      "x_mm",
      "y_mm",
      "diametro_mm",
      "profundidad_mm",
      "nota",
    ];

    const rows = drillingOperations.map((op) => [
      ref,
      projectName,
      clientName,
      op.pieceCode,
      op.pieceName,
      op.moduleName,
      op.type,
      op.x,
      op.y,
      op.diameter,
      op.depth,
      op.note,
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ref}_perforaciones_cnc.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportCSV() {
    if (!(await ensureRequisitionGate("exportar CSV CNC"))) {
      return;
    }

    const ref = orderCode || `CORTE-${Date.now()}`;
    const rows = [
      ["piece_code", "module", "piece_name", "width_mm", "height_mm", "thickness_mm", "quantity", "edge", "can_rotate"],
      ...expandedPieces.map((p, i) => [
        pieceCode(i),
        p.module_name || "",
        p.piece_name || "",
        String(p.width_mm),
        String(p.height_mm),
        String(p.thickness_mm),
        "1",
        edgeText(p),
        hasGrain ? "NO" : p.can_rotate ? "YES" : "NO",
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ref}_piezas_cnc.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="border-b border-slate-800 bg-[#020817] px-5 py-5 lg:px-6">
        <div className="w-full max-w-none">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.32em] text-cyan-300">
                <Sparkles size={16} />
                Fase 44.1.4.3 · Margen Industrial
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-tight lg:text-5xl">
                Corte Inteligente PRO
              </h1>
              <p className="mt-2 max-w-4xl text-xs font-bold leading-5 text-slate-400 lg:text-sm">
                Optimización automática desde órdenes de producción: tableros, retazos,
                veta, canteo, PDF corte sierra, etiquetas QR y CSV para CNC.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/optimizacion-corte"
                className="inline-flex h-11 min-w-[126px] items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 text-sm font-black text-slate-200 hover:border-cyan-400"
              >
                <ArrowLeft size={18} />
                Volver
              </a>
              <button
                onClick={loadMaterials}
                disabled={loading}
                className="inline-flex h-11 min-w-[126px] items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-slate-950 hover:bg-cyan-50 disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                Materiales
              </button>
              <a
                href="/corte/disenos-personalizados"
                className="inline-flex h-11 min-w-[178px] items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 text-sm font-black text-cyan-100 hover:border-cyan-300 hover:bg-cyan-500/20"
              >
                <Upload size={18} />
                Disenos personalizados
              </a>
              <button
                onClick={generatePDF}
                className="inline-flex h-11 min-w-[126px] items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 text-sm font-black text-slate-950 hover:bg-cyan-400"
              >
                <Printer size={18} />
                PDF Corte Sierra
              </button>
              <button
                onClick={generateExecutivePDF}
                className="inline-flex h-11 min-w-[126px] items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 text-sm font-black text-white hover:bg-rose-400"
              >
                <FileText size={18} />
                PDF Ejecutivo
              </button>
              <button
                onClick={generateLabelsPDF}
                className="inline-flex h-11 min-w-[126px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-black text-slate-950 hover:bg-emerald-400"
              >
                <QrCode size={18} />
                Etiquetas
              </button>
              <button
                onClick={exportCSV}
                className="inline-flex h-11 min-w-[126px] items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 text-sm font-black text-white hover:bg-slate-700"
              >
                <Download size={18} />
                CSV CNC
              </button>
              <button
                onClick={exportDXF}
                className="inline-flex h-11 min-w-[126px] items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-black text-slate-950 hover:bg-amber-300"
              >
                <Cpu size={18} />
                DXF CNC
              </button>
              <button
                onClick={exportDrillingCSV}
                className="inline-flex h-11 min-w-[126px] items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-black text-white hover:bg-violet-400"
              >
                <Drill size={18} />
                Perforaciones
              </button>
              <button
                onClick={exportGcodeNC}
                className="inline-flex h-11 min-w-[126px] items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 text-sm font-black text-slate-950 hover:bg-lime-300"
              >
                <TerminalSquare size={18} />
                Post CNC
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-6">
            <Stat title="Hojas" value={layouts.length} icon={<Layers3 />} />
            <Stat title="Piezas" value={expandedPieces.length} icon={<Boxes />} />
            <Stat title="Uso" value={`${efficiency.toFixed(1)}%`} icon={<Scissors />} accent="text-cyan-300" />
            <Stat title="Merma" value={`${wasteM2.toFixed(2)} m²`} icon={<Boxes />} accent="text-amber-300" />
            <Stat title="Canteo" value={`${serviceEdgeMeters.toFixed(2)} ml`} icon={<QrCode />} accent="text-emerald-300" />
            <Stat title="Corte + canto" value={money(serviceTotalCost)} icon={<FileText />} accent="text-emerald-300" />
          </div>
        </div>
      </section>

      {requisitionGate && requisitionGate.status !== "manual" && (
        <section
          className={`mx-5 mt-4 rounded-2xl border px-5 py-4 lg:mx-6 ${
            requisitionGate.canCut
              ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
              : "border-amber-400/30 bg-amber-500/10 text-amber-100"
          }`}
        >
          <div className="text-xs font-black uppercase tracking-[0.22em]">
            {requisitionGate.canCut ? "Centro de Requisiciones listo" : "Corte bloqueado por requisicion"}
          </div>
          <div className="mt-1 text-sm font-bold">{requisitionGate.message}</div>
          {!requisitionGate.canCut && (
            <a
              href="/inventario-inteligente/requisiciones"
              className="mt-3 inline-flex rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-950"
            >
              Abrir Centro de Requisiciones
            </a>
          )}
        </section>
      )}

      <section className="grid w-full grid-cols-1 gap-4 px-5 py-5 lg:px-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#07111f] p-4 shadow-xl shadow-black/20">
            <h2 className="text-xl font-black">Orden / Proyecto</h2>
            <p className="text-sm font-bold text-slate-500">
              {payload ? "Cargado desde Optimización de Corte" : "Modo manual"}
            </p>

            <div className="mt-3 space-y-2">
              <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                      Buscar proyecto / OP
                    </div>
                    <div className="text-[11px] font-bold text-cyan-100/70">
                      Selecciona una orden para cargar piezas reales.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={loadProductionOrders}
                    disabled={loadingOrders}
                    className="inline-flex h-8 items-center justify-center rounded-xl border border-cyan-400/40 px-3 text-[10px] font-black text-cyan-100 hover:bg-cyan-400/10 disabled:opacity-60"
                  >
                    {loadingOrders ? "..." : "Recargar"}
                  </button>
                </div>

                <input
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Buscar OP, cliente o proyecto..."
                  className="h-10 w-full rounded-xl border border-slate-700 bg-[#020617] px-3 text-xs font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                />

                <div className="mt-2 max-h-[210px] space-y-2 overflow-y-auto pr-1">
                  {filteredProductionOrders.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-[#020617] px-3 py-3 text-xs font-bold text-slate-500">
                      No hay órdenes disponibles.
                    </div>
                  ) : (
                    filteredProductionOrders.slice(0, 12).map((row) => {
                      const active = selectedProductionOrderId === row.id;

                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => loadProductionOrderFromRow(row)}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                            active
                              ? "border-cyan-300 bg-cyan-400/15"
                              : "border-slate-800 bg-[#020617] hover:border-cyan-500/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-black text-white">
                              {normalizeOrderCode(row)}
                            </span>
                            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[9px] font-black uppercase text-slate-400">
                              {row.status || "orden"}
                            </span>
                          </div>
                          <div className="mt-1 truncate text-[11px] font-bold text-cyan-200">
                            {normalizeProjectName(row)}
                          </div>
                          <div className="truncate text-[10px] font-bold text-slate-500">
                            {normalizeClientName(row)}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <Input label="Orden" value={orderCode} onChange={setOrderCode} />
              <Input label="Cliente" value={clientName} onChange={setClientName} />
              <Input label="Proyecto" value={projectName} onChange={setProjectName} />

              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Kerf / disco mm" value={kerf} onChange={setKerf} />
                <NumberInput label="PVC RD$/ml" value={edgeMeterPrice} onChange={setEdgeMeterPrice} />
                <NumberInput label="Pies lineales instalados" value={projectInstalledFeet} onChange={setProjectInstalledFeet} />
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#020617] px-3 py-2.5 text-sm font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={respectGrain}
                  onChange={(e) => setRespectGrain(e.target.checked)}
                />
                Respetar veta si el material aplica
              </label>

              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
                      Post CNC real
                    </div>
                    <div className="text-[11px] font-bold text-emerald-100/70">
                      Controlador, offsets y compensacion.
                    </div>
                  </div>
                  <TerminalSquare className="text-emerald-300" size={20} />
                </div>

                <select
                  value={postProcessorId}
                  onChange={(e) => setPostProcessorId(e.target.value as CncPostProcessorId)}
                  className="h-10 w-full rounded-xl border border-slate-700 bg-[#020617] px-3 text-xs font-bold text-white outline-none focus:border-emerald-400"
                >
                  {cncPostPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <NumberInput label="Broca mm" value={cncToolDiameter} onChange={setCncToolDiameter} />
                  <NumberInput label="Kerf CNC mm" value={cncKerfMm} onChange={setCncKerfMm} />
                  <NumberInput label="Offset X" value={cncOffsetX} onChange={setCncOffsetX} />
                  <NumberInput label="Offset Y" value={cncOffsetY} onChange={setCncOffsetY} />
                </div>

                <select
                  value={cncCompensation}
                  onChange={(e) => setCncCompensation(e.target.value as CncCompensationMode)}
                  className="mt-3 h-10 w-full rounded-xl border border-slate-700 bg-[#020617] px-3 text-xs font-bold text-white outline-none focus:border-emerald-400"
                >
                  <option value="outside">Compensacion exterior</option>
                  <option value="centerline">Linea central</option>
                  <option value="inside">Compensacion interior</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={saveCut}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-400 px-4 py-2.5 font-black text-slate-950 hover:from-emerald-400 hover:to-cyan-300 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Guardar optimización + QR
                </button>
                <button
                  onClick={clearPayload}
                  className="rounded-xl border border-slate-700 px-4 py-2.5 font-black text-slate-300 hover:border-red-400 hover:text-red-200"
                >
                  Limpiar orden
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#07111f] p-4 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Material</h2>
                <p className="text-sm font-bold text-slate-500">Tablero o retazo</p>
              </div>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-300">
                {materials.length}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2">
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100">
                <span className="inline-flex items-center gap-2">
                  <Target size={16} />
                  Selección automática PRO
                </span>
                <input
                  type="checkbox"
                  checked={autoMaterialMode}
                  onChange={(e) => setAutoMaterialMode(e.target.checked)}
                />
              </label>

              <select
                value={selectedMaterialId}
                onChange={(e) => {
                  setAutoMaterialMode(false);
                  setSelectedMaterialId(e.target.value);
                }}
                className="w-full rounded-xl border border-slate-700 bg-[#020617] px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-cyan-400"
              >
                <option value="">Seleccionar tablero o retazo...</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {String(m.source || "TABLERO")} · {materialName(m)} · {materialHeight(m)}x{materialWidth(m)} · Stock {num(m.stock ?? m.quantity)}
                  </option>
                ))}
              </select>
            </div>

            {selectedMaterial && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Mini label="Medida" value={`${sheetHeight} x ${sheetWidth}`} />
                <Mini label="Grosor" value={`${sheetThickness} mm`} />
                <Mini label="Costo hoja" value={money(sheetCost || materialCost(selectedMaterial) || (materialName(selectedMaterial).toLowerCase().includes("melamina") ? 3000 : 0))} />
                <Mini label="Veta" value={grainModeLabel(selectedMaterial, respectGrain)} />
              </div>
            )}

            {selectedMaterial && (
              <div className="mt-4 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
                <div className="flex items-start gap-3">
                  <Compass className="mt-0.5 text-violet-300" size={20} />
                  <div>
                    <div className="text-sm font-black text-violet-100">
                      Control de veta profesional
                    </div>
                    <p className="mt-1 text-xs font-bold leading-relaxed text-violet-100/70">
                      {hasGrain && respectGrain
                        ? "Este material tiene veta. Las piezas quedan bloqueadas para no rotar y mantener dirección visual uniforme."
                        : hasGrain && !respectGrain
                        ? "Este material parece tener veta, pero el bloqueo está desactivado. Úsalo solo si el diseño permite rotación."
                        : "Este material no fue detectado como veta. El sistema permite rotación para mejorar aprovechamiento."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {bestMaterialOption && (
              <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
                  Mejor opción detectada
                </div>
                <div className="mt-2 text-sm font-black text-white">
                  {String(bestMaterialOption.material.source || "TABLERO")} · {materialName(bestMaterialOption.material)}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold text-slate-300">
                  <span>Hojas: {bestMaterialOption.sheets}</span>
                  <span>Uso: {bestMaterialOption.efficiency.toFixed(1)}%</span>
                  <span>Merma: {bestMaterialOption.waste.toFixed(2)} m²</span>
                  <span>Costo: {money(bestMaterialOption.costTotal)}</span>
                </div>
              </div>
            )}

            {cutPlans.length > 1 && (
              <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                  Plan multi-material
                </div>
                <div className="mt-3 space-y-2 text-xs font-bold text-slate-200">
                  {cutPlans.map((plan) => (
                    <div key={plan.material.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <span className="truncate">{materialName(plan.material)}</span>
                      <span className="shrink-0 text-cyan-200">{plan.sheets} hoja(s)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setMaterialAnalysisOpen((v) => !v)}
              className="mt-4 w-full rounded-2xl border border-slate-700 px-4 py-3 text-sm font-black text-slate-200 hover:border-cyan-400"
            >
              {materialAnalysisOpen ? "Ocultar análisis" : "Ver análisis de tableros y retazos"}
            </button>

            {materialAnalysisOpen && (
              <div className="mt-4 max-h-72 space-y-2 overflow-auto pr-1">
                {materialOptions.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-[#020617] p-4 text-sm font-bold text-slate-500">
                    No hay análisis hasta tener piezas válidas.
                  </div>
                ) : (
                  materialOptions.slice(0, 12).map((option, index) => (
                    <button
                      key={option.material.id}
                      onClick={() => {
                        setAutoMaterialMode(false);
                        setSelectedMaterialId(option.material.id);
                      }}
                      className={[
                        "w-full rounded-2xl border p-3 text-left text-xs transition",
                        String(option.material.id) === String(selectedMaterialId)
                          ? "border-cyan-400 bg-cyan-500/10"
                          : "border-slate-800 bg-[#020617] hover:border-cyan-500/50",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black text-white">
                          #{index + 1} {String(option.material.source || "TABLERO")} · {materialName(option.material)}
                        </div>
                        <div className="font-black text-emerald-300">{option.efficiency.toFixed(1)}%</div>
                      </div>
                      <div className="mt-1 grid grid-cols-4 gap-2 font-bold text-slate-400">
                        <span>{materialHeight(option.material)}x{materialWidth(option.material)}</span>
                        <span>{option.sheets} hoja(s)</span>
                        <span>{option.waste.toFixed(2)} m² merma</span>
                        <span>{money(option.costTotal)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#07111f] p-4 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">Canteo</h2>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
                {serviceEdgeMeters.toFixed(2)} ml
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Mini label="Canto detectado" value={`${serviceEdgeMeters.toFixed(2)} ml`} />
              <Mini label="Tarifa canto" value={`RD$${serviceEdgeRate}/ml`} />
              <Mini label="Corte detectado" value={`${serviceCutLinearMeters.toFixed(2)} ml`} />
              <Mini label="Tarifa corte" value={`RD$${serviceCutRate}/ml`} />
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Costo PVC</div>
              <div className="mt-2 text-2xl font-black">{money(serviceEdgeCost)}</div>
            </div>

            <div className="mt-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Servicio de corte</div>
              <div className="mt-2 text-2xl font-black">{money(serviceCutCost)}</div>
              <div className="mt-1 text-xs font-bold text-cyan-100/70">
                {serviceCutLinearMeters.toFixed(2)} metros lineales x RD$30
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Total a caja</div>
              <div className="mt-2 text-2xl font-black">{money(serviceTotalCost)}</div>
              <p className="mt-1 text-xs font-bold leading-relaxed text-emerald-100/70">
                Solo para ebanistas/clientes externos o adicionales cobrables. En proyectos RD Wood queda como costo interno del proyecto, no ingreso.
              </p>
            </div>

            <button
              onClick={createCutServiceInvoice}
              disabled={billingBusy || serviceTotalCost <= 0 || expandedPieces.length === 0}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-sm font-black text-slate-950 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {billingBusy ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
              Facturar servicio externo en Caja Principal
            </button>
          </div>

        </aside>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#07111f] p-4 shadow-xl shadow-black/20">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-black">Piezas del proyecto</h2>
                <p className="text-sm font-bold text-slate-500">
                  Edita medidas, cantidad, veta y lados con PVC antes de generar el plano.
                </p>
              </div>
              <button
                onClick={addPiece}
                className="rounded-2xl bg-cyan-500 px-5 py-3 font-black text-slate-950 hover:bg-cyan-400"
              >
                Agregar pieza
              </button>
            </div>

            <div className="mt-5 max-h-[460px] overflow-auto rounded-3xl border border-slate-800">
              <table className="w-full min-w-[1250px] text-sm">
                <thead className="bg-[#020617] text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-4 py-4 text-left">Módulo</th>
                    <th className="px-4 py-4 text-left">Pieza</th>
                    <th className="px-4 py-4 text-right">Ancho</th>
                    <th className="px-4 py-4 text-right">Alto</th>
                    <th className="px-4 py-4 text-right">Grosor</th>
                    <th className="px-4 py-4 text-right">Cant.</th>
                    <th className="px-4 py-4 text-center">F</th>
                    <th className="px-4 py-4 text-center">A</th>
                    <th className="px-4 py-4 text-center">I</th>
                    <th className="px-4 py-4 text-center">D</th>
                    <th className="px-4 py-4 text-center">Rotar</th>
                    <th className="px-4 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {pieces.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-12 text-center font-bold text-slate-500">
                        No hay piezas. Agrega manualmente o vuelve desde Optimización de Corte.
                      </td>
                    </tr>
                  ) : (
                    pieces.map((p) => (
                      <tr key={p.id} className="border-t border-slate-800">
                        <td className="px-3 py-3">
                          <input
                            value={p.module_name || ""}
                            onChange={(e) => updatePiece(p.id, "module_name", e.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-[#020617] px-3 py-2 font-bold text-white outline-none focus:border-cyan-400"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            value={p.piece_name}
                            onChange={(e) => updatePiece(p.id, "piece_name", e.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-[#020617] px-3 py-2 font-bold text-white outline-none focus:border-cyan-400"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <SmallNumber value={p.width_mm} onChange={(v) => updatePiece(p.id, "width_mm", v)} />
                        </td>
                        <td className="px-3 py-3">
                          <SmallNumber value={p.height_mm} onChange={(v) => updatePiece(p.id, "height_mm", v)} />
                        </td>
                        <td className="px-3 py-3">
                          <SmallNumber value={p.thickness_mm} onChange={(v) => updatePiece(p.id, "thickness_mm", v)} />
                        </td>
                        <td className="px-3 py-3">
                          <SmallNumber value={p.quantity} onChange={(v) => updatePiece(p.id, "quantity", v)} />
                        </td>
                        {(["edge_front", "edge_back", "edge_left", "edge_right"] as const).map((field) => (
                          <td key={field} className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(p[field])}
                              onChange={(e) => updatePiece(p.id, field, e.target.checked)}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(p.can_rotate)}
                            disabled={hasGrain}
                            onChange={(e) => updatePiece(p.id, "can_rotate", e.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            onClick={() => removePiece(p.id)}
                            className="rounded-xl p-2 text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#07111f] p-4 shadow-xl shadow-black/20">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">Plano optimizado</h2>
                <p className="text-sm font-bold text-slate-500">
                  Motor MaxRects PRO con selección de mejor estrategia.
                </p>
              </div>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-300">
                {layouts.length} hoja(s)
              </span>
            </div>

            {layouts.length === 0 ? (
              <div className="flex h-96 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-[#020617] text-center">
                <Scissors className="text-slate-600" size={70} />
                <h3 className="mt-4 text-2xl font-black">Sin plano aún</h3>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  Selecciona material y agrega piezas válidas.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {layouts.map((sheet) => (
                  <SheetView
                    key={sheet.numero}
                    sheet={sheet}
                    sheetWidth={sheet.sheetWidthMm || sheetWidth}
                    sheetHeight={sheet.sheetHeightMm || sheetHeight}
                    material={materialName(sheet.material || selectedMaterial)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 px-4 py-3 text-sm font-bold text-blue-100">
            {message}
          </div>
        </section>
      </section>
    </main>
  );
}
function SheetView({
  sheet,
  sheetWidth,
  sheetHeight,
  material,
}: {
  sheet: SheetLayout;
  sheetWidth: number;
  sheetHeight: number;
  material: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-[#020617] p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black">Hoja #{sheet.numero}</h3>
          <p className="text-xs font-bold text-slate-500">{material}</p>
        </div>
        <div className="text-right text-xs font-bold text-slate-400">
          {sheetHeight} x {sheetWidth} mm · Usado {sheet.usadoM2.toFixed(2)} m²
        </div>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-950"
        style={{
          aspectRatio: `${sheetHeight}/${sheetWidth}`,
        }}
      >
        {sheet.piezas.map((p, index) => {
          const left = (p.x / sheetHeight) * 100;
          const top = (p.y / sheetWidth) * 100;
          const width = (p.w / sheetHeight) * 100;
          const height = (p.h / sheetWidth) * 100;

          return (
            <div
              key={`${p.id}-${index}`}
              className="absolute overflow-hidden rounded-md border border-white/40 bg-cyan-400/80 p-1 text-[10px] font-black text-slate-950"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
            >
              <div className="truncate">{p.nombre}</div>
              <div>{Math.round(p.w)} x {Math.round(p.h)}</div>
              {p.rotada && <div>ROTADA</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  icon,
  accent = "text-white",
}: {
  title: string;
  value: any;
  icon: any;
  accent?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-[#07111f] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
            {title}
          </div>
          <div className={`mt-3 text-xl font-black ${accent}`}>{value}</div>
        </div>
        <div className="text-cyan-400">{icon}</div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#020617] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-black text-white">{value}</div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-[#020617] px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-cyan-400"
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-slate-700 bg-[#020617] px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-cyan-400"
      />
    </div>
  );
}

function SmallNumber({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-24 rounded-xl border border-slate-700 bg-[#020617] px-3 py-2 text-right font-bold text-white outline-none focus:border-cyan-400"
    />
  );
}
