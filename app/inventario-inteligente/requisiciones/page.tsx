"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Loader2,
  PackageCheck,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Wand2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/saas/auth-client";

type AnyRow = any;

const REQUISITION_TYPES = [
  { value: "proyecto", label: "Proyecto" },
  { value: "interna", label: "Interna" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "instalacion", label: "Instalación" },
  { value: "produccion", label: "Producción" },
  { value: "oficina", label: "Oficina" },
];

const DEPARTMENTS = [
  "Producción",
  "Instalación",
  "Transporte",
  "Mantenimiento",
  "CNC / Corte",
  "Ensamblaje",
  "Oficina",
  "Ventas",
  "RRHH",
  "Administración",
];


const statusClass: Record<string, string> = {
  pendiente_autorizacion: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  autorizada: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  preparando: "border-blue-400/30 bg-blue-400/10 text-blue-200",
  parcial: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  despachada: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  rechazada: "border-red-400/30 bg-red-400/10 text-red-200",
};

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function norm(v: string) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function money(v: any) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(n(v));
}

function fmtQty(v: any) {
  return new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 }).format(n(v));
}

function fmtDate(v: any) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("es-DO");
  } catch {
    return String(v);
  }
}

function itemName(i: AnyRow) {
  return i?.material || i?.name || i?.product_name || i?.description || "Producto sin nombre";
}

function stock(i: AnyRow) {
  return n(i?.stock ?? i?.quantity ?? i?.qty ?? 0);
}

function reserved(i: AnyRow) {
  return n(i?.reserved_stock ?? i?.stock_reserved ?? i?.reserved_qty ?? 0);
}

function availableStock(i: AnyRow) {
  return Math.max(0, stock(i) - reserved(i));
}

function unitCost(i: AnyRow) {
  return n(i?.costo_promedio ?? i?.unit_cost ?? i?.purchase_cost ?? i?.cost_price ?? i?.cost ?? 0);
}

function reqCode(r: AnyRow) {
  return r.code || r.requisition_no || r.numero || "REQ-SIN-CODIGO";
}

function reqStatus(r: AnyRow) {
  return r.status || r.estado || "pendiente_autorizacion";
}

function reqType(r: AnyRow) {
  return r.type || r.tipo || "interna_departamento";
}

function reqTitle(r: AnyRow) {
  return r.project_name || r.project || r.title || r.descripcion || "Requisición sin proyecto";
}

function reqReason(r: AnyRow) {
  return r.reason || r.motivo || r.notes || r.observaciones || "-";
}

function reqRequestedBy(r: AnyRow) {
  return r.requested_by_name || r.solicitado_por || r.created_by_name || "Sistema";
}

function getReqIdFromItem(item: AnyRow) {
  return String(item.requisition_id || item.warehouse_requisition_id || item.req_id || "");
}

function getItemProductName(item: AnyRow, inventoryMap: Map<string, AnyRow>) {
  if (item.product_name || item.item_name || item.material) return item.product_name || item.item_name || item.material;
  const invId = item.inventory_id || item.product_id || item.item_id;
  const inv = invId ? inventoryMap.get(String(invId)) : null;
  return inv ? itemName(inv) : "Producto sin identificar";
}

function getItemQty(item: AnyRow) {
  return n(item.qty_requested ?? item.quantity_requested ?? item.cantidad_solicitada ?? item.quantity ?? item.qty ?? 0);
}

function getItemReserved(item: AnyRow) {
  return n(item.qty_reserved ?? item.quantity_reserved ?? item.cantidad_reservada ?? 0);
}

function getItemDispatched(item: AnyRow) {
  return n(item.qty_dispatched ?? item.quantity_dispatched ?? item.cantidad_despachada ?? 0);
}

function getItemApproved(item: AnyRow) {
  return n(item.qty_approved ?? item.quantity_approved ?? item.cantidad_aprobada ?? 0);
}

function getItemUnit(item: AnyRow) {
  return item.unit || item.unidad || "unidad";
}

function getErrorMessage(error: any) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return error.message || error.details || JSON.stringify(error);
}

function orderCode(o: AnyRow) {
  return o?.code || o?.order_number || o?.numero || o?.id || "OP-SIN-CODIGO";
}

function orderTitle(o: AnyRow) {
  return o?.project_name || o?.project || o?.client_name || o?.title || `Orden ${orderCode(o)}`;
}

function poiOrderId(i: AnyRow) {
  return String(i.production_order_id || i.order_id || i.work_order_id || i.op_id || "");
}

function poiName(i: AnyRow) {
  return i.item_name || i.product_name || i.material || i.name || i.description || i.descripcion || i.piece_name || "Artículo sin nombre";
}

function poiQty(i: AnyRow) {
  return n(i.qty_required ?? i.quantity_required ?? i.cantidad_requerida ?? i.quantity ?? i.qty ?? i.cantidad ?? 1) || 1;
}

function poiUnit(i: AnyRow) {
  return i.unit || i.unidad || "unidad";
}

function poiType(i: AnyRow) {
  return i.item_type || i.type || i.tipo || i.category || i.grupo || "material";
}

export default function RequisicionesAlmacenPage() {
  const [requisitions, setRequisitions] = useState<AnyRow[]>([]);
  const [items, setItems] = useState<AnyRow[]>([]);
  const [inventory, setInventory] = useState<AnyRow[]>([]);
  const [orders, setOrders] = useState<AnyRow[]>([]);
  const [orderItems, setOrderItems] = useState<AnyRow[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [tab, setTab] = useState<"todas" | "automaticas" | "manuales">("todas");
  const [selected, setSelected] = useState<AnyRow | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [manualOpen, setManualOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [selectedProductionOrderId, setSelectedProductionOrderId] = useState("");
  const [manualProject, setManualProject] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualProductId, setManualProductId] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [manualType, setManualType] = useState("interna");
  const [manualDepartment, setManualDepartment] = useState("Producción");
  const [manualRequestedBy, setManualRequestedBy] = useState("");
  const [manualRequiredDate, setManualRequiredDate] = useState("");
  const [manualProjectRef, setManualProjectRef] = useState("");

  async function safeSelect(table: string) {
    try {
      const res = await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(1500);
      if (res.error) return { data: [], error: res.error };
      return { data: res.data || [], error: null };
    } catch (err: any) {
      return { data: [], error: err };
    }
  }

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    try {
      const apiRes = await apiFetch("/api/warehouse-requisitions", { cache: "no-store" });
      const payload = await apiRes.json();

      if (apiRes.ok) {
        setRequisitions(payload.requisitions || []);
        setItems(payload.items || []);
        setInventory(payload.inventory || []);
        setOrders(payload.orders || []);
        setOrderItems(payload.orderItems || []);
        setPurchaseRequests(payload.purchaseRequests || []);
        if (payload.errors?.length) setErrorMessage(payload.errors.join(" | "));
        setLoading(false);
        return;
      }

      setErrorMessage(payload.error || "No se pudo cargar requisiciones por API interna.");
    } catch (err: any) {
      setErrorMessage(getErrorMessage(err));
    }

    const [reqRes, itemRes, invRes, ordersRes, orderItemsRes, prRes] = await Promise.all([
      safeSelect("warehouse_requisitions"),
      safeSelect("warehouse_requisition_items"),
      supabase.from("inventory").select("*").order("material", { ascending: true }).limit(1500),
      safeSelect("production_orders"),
      safeSelect("production_order_items"),
      safeSelect("purchase_orders"),
    ]);

    if (reqRes.error) setErrorMessage("warehouse_requisitions: " + getErrorMessage(reqRes.error));
    if (itemRes.error) setErrorMessage("warehouse_requisition_items: " + getErrorMessage(itemRes.error));
    if (invRes.error) setErrorMessage("inventory: " + invRes.error.message);

    setRequisitions(reqRes.data || []);
    setItems(itemRes.data || []);
    setInventory(invRes.data || []);
    setOrders(ordersRes.data || []);
    setOrderItems(orderItemsRes.data || []);
    setPurchaseRequests(prRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const inventoryMap = useMemo(() => {
    const map = new Map<string, AnyRow>();
    inventory.forEach((i) => i?.id && map.set(String(i.id), i));
    return map;
  }, [inventory]);

  const inventoryByName = useMemo(() => {
    const map = new Map<string, AnyRow>();
    inventory.forEach((i) => {
      map.set(norm(itemName(i)), i);
      if (i?.code) map.set(norm(String(i.code)), i);
      if (i?.sku) map.set(norm(String(i.sku)), i);
    });
    return map;
  }, [inventory]);

  const itemsByReq = useMemo(() => {
    const map = new Map<string, AnyRow[]>();
    items.forEach((item) => {
      const id = getReqIdFromItem(item);
      if (!id) return;
      map.set(id, [...(map.get(id) || []), item]);
    });
    return map;
  }, [items]);

  const orderItemsByOrder = useMemo(() => {
    const map = new Map<string, AnyRow[]>();
    orderItems.forEach((item) => {
      const id = poiOrderId(item);
      if (!id) return;
      map.set(id, [...(map.get(id) || []), item]);
    });
    return map;
  }, [orderItems]);

  const purchaseOrdersById = useMemo(() => {
    const map = new Map<string, AnyRow>();
    purchaseRequests.forEach((po) => {
      if (po?.id) map.set(String(po.id), po);
    });
    return map;
  }, [purchaseRequests]);

  function linkedPurchaseOrder(req: AnyRow) {
    const id = req?.purchase_order_id || req?.purchase_request_id;
    if (!id) return null;
    return purchaseOrdersById.get(String(id)) || null;
  }

  function purchaseStatusLabel(po: AnyRow | null) {
    if (!po) return "Sin OC";
    return po.status || po.estado || "pendiente";
  }

  function purchaseNumber(po: AnyRow | null) {
    if (!po) return "-";
    return po.po_number || po.order_number || po.code || po.invoice_number || po.id;
  }

  function purchaseEta(po: AnyRow | null) {
    if (!po) return "-";
    return po.expected_date || po.eta || po.delivery_date || po.fecha_estimada || "-";
  }

  function openCompras() {
    window.open("/compras", "_blank");
  }


  const filteredReqs = useMemo(() => {
    const q = query.trim().toLowerCase();

    return requisitions.filter((r) => {
      const status = reqStatus(r);
      const type = reqType(r);
      const isAuto = type === "produccion_automatica" || type.includes("produccion");
      const matchesTab = tab === "todas" || (tab === "automaticas" && isAuto) || (tab === "manuales" && !isAuto);
      const matchesStatus = statusFilter === "todos" || status === statusFilter;
      const text = `${reqCode(r)} ${reqTitle(r)} ${reqReason(r)} ${type} ${status}`.toLowerCase();
      return matchesTab && matchesStatus && (!q || text.includes(q));
    });
  }, [requisitions, query, statusFilter, tab]);

  const reservedTotal = useMemo(() => inventory.reduce((sum, i) => sum + reserved(i), 0), [inventory]);
  const physicalTotal = useMemo(() => inventory.reduce((sum, i) => sum + stock(i), 0), [inventory]);

  const missingTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + Math.max(0, getItemQty(item) - getItemReserved(item) - getItemDispatched(item)), 0);
  }, [items]);

  async function reserveInventoryLine(inventoryId: string, qty: number) {
    const inv = inventoryMap.get(String(inventoryId));
    if (!inv) return { reservedQty: 0, error: null };

    const canReserve = Math.max(0, Math.min(availableStock(inv), qty));
    const nextReserved = reserved(inv) + canReserve;

    const { error } = await supabase
      .from("inventory")
      .update({
        reserved_stock: nextReserved,
        stock_reserved: nextReserved,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inventoryId);

    return { reservedQty: canReserve, error };
  }


  async function createPurchaseRequestFromShortage(req: AnyRow) {
    if (!req?.id) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const apiRes = await apiFetch("/api/warehouse-requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-purchase-order-from-shortage", requisitionId: req.id }),
      });
      const payload = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok || !payload?.ok) throw new Error(payload?.error || "No se pudo crear la orden de compra.");

      if (payload.alreadyExists) {
        setSuccessMessage(`La requisicion ${payload.code || reqCode(req)} ya tiene una OC vinculada.`);
      } else {
        setSuccessMessage(`Orden de compra creada en Compras PRO: ${payload.purchaseOrderCode}. Faltantes: ${payload.itemCount}. Total estimado: ${money(payload.total)}.`);
      }

      await loadData();
      window.open("/compras", "_blank");
    } catch (err: any) {
      setErrorMessage("Error creando orden de compra: " + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function createPurchaseRequestFromShortageLegacy(req: AnyRow) {
    if (!req?.id) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (req.purchase_order_id) {
        setErrorMessage("Esta requisición ya tiene una orden de compra creada.");
        return;
      }

      const reqItems = itemsByReq.get(String(req.id)) || [];
      const shortageLines = reqItems
        .map((item) => {
          const invId = item.inventory_id || item.product_id || item.item_id;
          const inv = invId ? inventoryMap.get(String(invId)) : null;
          const requested = getItemQty(item);
          const reservedQty = getItemReserved(item);
          const dispatched = getItemDispatched(item);
          const missing = Math.max(0, requested - reservedQty - dispatched);
          const cost = inv ? unitCost(inv) : n(item.estimated_unit_cost ?? item.unit_cost ?? 0);
          return { item, inv, missing, cost };
        })
        .filter((x) => x.missing > 0);

      if (!shortageLines.length) {
        setErrorMessage("Esta requisición no tiene faltantes para comprar.");
        return;
      }

      const code = `AUTO-OC-${Date.now().toString().slice(-10)}`;
      const estimatedTotal = shortageLines.reduce((sum, x) => sum + x.missing * x.cost, 0);

      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          po_number: code,
          order_number: code,
          invoice_number: code,
          invoice_no: code,
          supplier_name: "Proveedor por definir",
          supplier: "Proveedor por definir",
          status: "pendiente",
          estado: "pendiente",
          subtotal: estimatedTotal,
          tax: 0,
          total: estimatedTotal,
          total_estimated: estimatedTotal,
          notes: `Orden automática generada desde requisición ${reqCode(req)} - ${reqTitle(req)}`,
          note: `Orden automática generada desde requisición ${reqCode(req)}`,
          code,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (poError) throw poError;

      const rows = shortageLines.map((x) => ({
        purchase_order_id: po.id,
        product_id: x.inv?.id || x.item.inventory_id || x.item.product_id || null,
        item_id: x.inv?.id || x.item.inventory_id || x.item.product_id || null,
        item_name: getItemProductName(x.item, inventoryMap),
        product_name: getItemProductName(x.item, inventoryMap),
        quantity: x.missing,
        quantity_to_buy: x.missing,
        qty: x.missing,
        unit_cost: x.cost,
        estimated_cost: x.cost,
        total: x.missing * x.cost,
        notes: `Faltante de requisición ${reqCode(req)}. Solicitado ${getItemQty(x.item)}, reservado ${getItemReserved(x.item)}, despachado ${getItemDispatched(x.item)}.`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: itemsError } = await supabase.from("purchase_order_items").insert(rows);
      if (itemsError) throw itemsError;

      await supabase
        .from("warehouse_requisitions")
        .update({
          purchase_order_id: po.id,
          purchase_request_id: po.id,
          purchase_requested_at: new Date().toISOString(),
          status: "compra_generada",
          estado: "compra_generada",
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.id);

      for (const x of shortageLines) {
        await supabase
          .from("warehouse_requisition_items")
          .update({
            purchase_order_item_id: null,
            qty_missing: x.missing,
            cantidad_faltante: x.missing,
            updated_at: new Date().toISOString(),
          })
          .eq("id", x.item.id);
      }

      setSuccessMessage(`Orden de compra creada en Compras PRO: ${code}. Faltantes: ${rows.length}. Total estimado: ${money(estimatedTotal)}.`);
      await loadData();
      window.open("/compras", "_blank");
    } catch (err: any) {
      setErrorMessage("Error creando orden de compra: " + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }


  async function updateReqStatus(req: AnyRow, status: string) {
    if (!req?.id) return;
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const apiRes = await apiFetch("/api/warehouse-requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-status", requisitionId: req.id, status }),
      });
      const payload = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok || !payload?.ok) throw new Error(payload?.error || "No se pudo actualizar la requisicion.");

      setSuccessMessage(`Requisicion ${payload.code || reqCode(req)} actualizada a ${status}.`);
      await loadData();
    } catch (err: any) {
      setErrorMessage("Error actualizando requisicion: " + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function updateReqStatusLegacy(req: AnyRow, status: string) {
    if (!req?.id) return;
    setSaving(true);
    const payload: any = { status, estado: status, updated_at: new Date().toISOString() };
    if (status === "autorizada") payload.approved_at = new Date().toISOString();
    const { error } = await supabase.from("warehouse_requisitions").update(payload).eq("id", req.id);
    setSaving(false);
    if (error) return setErrorMessage(getErrorMessage(error));
    setSuccessMessage(`Requisición ${reqCode(req)} actualizada a ${status}.`);
    await loadData();
  }

  async function createKardexMovement(args: any) {
    const payload = {
      inventory_id: args.inventoryId,
      product_id: args.inventoryId,
      product_name: args.productName,
      item_name: args.productName,
      type: "salida",
      tipo: "salida",
      movement_type: "requisicion_almacen",
      quantity: -Math.abs(args.qty),
      qty: -Math.abs(args.qty),
      cantidad: -Math.abs(args.qty),
      stock_before: args.beforeStock,
      stock_after: args.afterStock,
      stock_anterior: args.beforeStock,
      stock_nuevo: args.afterStock,
      unit_cost: args.cost,
      costo_unitario: args.cost,
      total_cost: args.qty * args.cost,
      total: args.qty * args.cost,
      reference: reqCode(args.req),
      referencia: reqCode(args.req),
      source: "warehouse_requisition",
      origin: "requisiciones_almacen",
      notes: `Despacho de requisición ${reqCode(args.req)} - ${reqTitle(args.req)}`,
      created_at: new Date().toISOString(),
    };

    let movementRes = await supabase.from("inventory_movements").insert(payload);
    if (movementRes.error) movementRes = await supabase.from("movimientos").insert(payload);
    return movementRes.error;
  }

  async function dispatchRequisition(req: AnyRow) {
    if (!req?.id) return;
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const apiRes = await apiFetch("/api/warehouse-requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dispatch", requisitionId: req.id }),
      });
      const payload = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok || !payload?.ok) throw new Error(payload?.error || "No se pudo despachar la requisicion.");

      const code = payload.code || reqCode(req);
      setSuccessMessage(
        payload.status === "despachada"
          ? `Requisicion ${code} despachada. Lineas despachadas: ${payload.dispatchedLines || 0}.`
          : `Requisicion ${code} parcial. Lineas despachadas: ${payload.dispatchedLines || 0}. Faltantes/bloqueadas: ${payload.blockedLines || 0}.`
      );
      await loadData();
    } catch (err: any) {
      setErrorMessage("Error despachando requisicion: " + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function dispatchRequisitionLegacy(req: AnyRow) {
    if (!req?.id) return;
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const reqItems = itemsByReq.get(String(req.id)) || [];
      if (!reqItems.length) return setErrorMessage("Esta requisición no tiene ítems para despachar.");

      let dispatchedLines = 0, partialLines = 0, blockedLines = 0;

      for (const item of reqItems) {
        const inventoryId = item.inventory_id || item.product_id || item.item_id;
        const inv = inventoryId ? inventoryMap.get(String(inventoryId)) : null;
        if (!inventoryId || !inv) { blockedLines += 1; continue; }

        const requestedQty = getItemQty(item);
        const alreadyDispatched = getItemDispatched(item);
        const reservedQty = getItemReserved(item);
        const pendingQty = Math.max(0, requestedQty - alreadyDispatched);
        if (pendingQty <= 0) continue;

        const qtyToDispatch = Math.min(stock(inv), pendingQty);
        if (qtyToDispatch <= 0) { blockedLines += 1; continue; }

        const before = stock(inv);
        const after = before - qtyToDispatch;
        const reserveToRelease = Math.min(reservedQty, qtyToDispatch);
        const nextReserved = Math.max(0, reserved(inv) - reserveToRelease);
        const cost = unitCost(inv);

        const { error: invError } = await supabase
          .from("inventory")
          .update({ stock: after, quantity: after, reserved_stock: nextReserved, stock_reserved: nextReserved, updated_at: new Date().toISOString() })
          .eq("id", inventoryId);

        if (invError) throw invError;

        const newDispatched = alreadyDispatched + qtyToDispatch;
        const newReserved = Math.max(0, reservedQty - reserveToRelease);
        const missing = Math.max(0, requestedQty - newDispatched - newReserved);
        const lineStatus = newDispatched >= requestedQty ? "despachada" : "parcial";

        const { error: itemError } = await supabase
          .from("warehouse_requisition_items")
          .update({
            qty_dispatched: newDispatched,
            quantity_dispatched: newDispatched,
            cantidad_despachada: newDispatched,
            qty_reserved: newReserved,
            quantity_reserved: newReserved,
            cantidad_reservada: newReserved,
            qty_missing: missing,
            cantidad_faltante: missing,
            qty_approved: Math.max(getItemApproved(item), newDispatched),
            quantity_approved: Math.max(getItemApproved(item), newDispatched),
            cantidad_aprobada: Math.max(getItemApproved(item), newDispatched),
            status: lineStatus,
            estado: lineStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        if (itemError) throw itemError;

        const movementError = await createKardexMovement({
          inventoryId: String(inventoryId),
          productName: getItemProductName(item, inventoryMap),
          qty: qtyToDispatch,
          beforeStock: before,
          afterStock: after,
          cost,
          req,
        });

        if (movementError) throw movementError;

        dispatchedLines += 1;
        if (qtyToDispatch < pendingQty) partialLines += 1;
      }

      const finalStatus = partialLines > 0 || blockedLines > 0 ? "parcial" : "despachada";
      await supabase.from("warehouse_requisitions").update({
        status: finalStatus,
        estado: finalStatus,
        dispatched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", req.id);

      setSuccessMessage(finalStatus === "despachada" ? `Requisición ${reqCode(req)} despachada.` : `Requisición ${reqCode(req)} parcial. Puedes generar compra por faltantes.`);
      await loadData();
    } catch (err: any) {
      setErrorMessage("Error despachando requisición: " + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function createManualReq() {
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (!manualProject.trim()) return setErrorMessage("Debes indicar el proyecto o motivo.");
      if (!manualProductId) return setErrorMessage("Debes seleccionar un producto.");

      const selectedProduct = inventoryMap.get(String(manualProductId));
      const requestedQty = n(manualQty);
      const { reservedQty, error: reserveError } = await reserveInventoryLine(manualProductId, requestedQty);
      if (reserveError) throw reserveError;

      const missing = Math.max(0, requestedQty - reservedQty);
      const code = `REQ-MAN-${Date.now().toString().slice(-7)}`;

      const { data: reqData, error: reqError } = await supabase
        .from("warehouse_requisitions")
        .insert({
          code,
          requisition_no: code,
          type: manualType,
          tipo: manualType,
          request_type: manualType,
          requisition_type: manualType,
          department: manualDepartment,
          departamento: manualDepartment,
          requested_department: manualDepartment,
          status: "pendiente_autorizacion",
          estado: "pendiente_autorizacion",
          project_name: manualProject.trim() || manualProjectRef.trim() || "Consumo interno",
          project_reference: manualProjectRef.trim() || null,
          reason: manualReason.trim() || `Solicitud interna de ${manualDepartment}`,
          urgency: "normal",
          requested_by_name: manualRequestedBy.trim() || "Usuario sistema",
          requested_by: manualRequestedBy.trim() || "Usuario sistema",
          required_date: manualRequiredDate || null,
          fecha_requerida: manualRequiredDate || null,
          reserved_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (reqError) throw reqError;

      const { error: itemError } = await supabase.from("warehouse_requisition_items").insert({
        requisition_id: reqData.id,
        warehouse_requisition_id: reqData.id,
        inventory_id: manualProductId,
        product_id: manualProductId,
        product_name: selectedProduct ? itemName(selectedProduct) : "Producto manual",
        item_name: selectedProduct ? itemName(selectedProduct) : "Producto manual",
        qty_requested: requestedQty,
        quantity_requested: requestedQty,
        cantidad_solicitada: requestedQty,
        qty_reserved: reservedQty,
        quantity_reserved: reservedQty,
        cantidad_reservada: reservedQty,
        qty_missing: missing,
        cantidad_faltante: missing,
        qty_approved: 0,
        qty_dispatched: 0,
        unit: selectedProduct?.unidad || selectedProduct?.unit || "unidad",
        unidad: selectedProduct?.unidad || selectedProduct?.unit || "unidad",
        status: missing > 0 ? "reserva_parcial" : "reservada",
        estado: missing > 0 ? "reserva_parcial" : "reservada",
        notes: missing > 0 ? `Reserva parcial. Faltante: ${missing}` : "Reserva completa",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (itemError) throw itemError;


    } catch (err: any) {
      setErrorMessage(getErrorMessage(err));
      setSaving(false);
      return;
    }

    setManualOpen(false);
    setManualProject("");
    setManualReason("");
    setManualQty("1");
    setManualProductId("");
    setManualType("interna");
    setManualDepartment("Producción");
    setManualRequestedBy("");
    setManualRequiredDate("");
    setManualProjectRef("");
    setSuccessMessage("Requisición interna creada. Si tiene faltante puedes generar solicitud de compra.");
    await loadData();
    setSaving(false);
  }

  function buildGroupedBomRows(rows: AnyRow[]) {
    const grouped = new Map<string, any>();
    for (const item of rows) {
      const name = poiName(item), unit = poiUnit(item), type = poiType(item);
      const key = `${norm(name)}|${norm(unit)}`;
      const current = grouped.get(key) || { name, unit, type, qty: 0, raw: item };
      current.qty += poiQty(item);
      grouped.set(key, current);
    }
    return Array.from(grouped.values()).filter((x) => x.qty > 0);
  }

  async function createAutoReqFromProduction() {
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (!selectedProductionOrderId) return setErrorMessage("Selecciona una orden de producción.");
      const order = orders.find((o) => String(o.id) === String(selectedProductionOrderId));
      if (!order) return setErrorMessage("No encontré la orden seleccionada.");

      const existing = requisitions.find((r) => String(r.production_order_id || "") === String(order.id));
      if (existing) return setErrorMessage(`Esta orden ya tiene requisición: ${reqCode(existing)}.`);

      const bomRows = buildGroupedBomRows(orderItemsByOrder.get(String(order.id)) || []);
      if (!bomRows.length) return setErrorMessage("Esta orden no tiene artículos en production_order_items.");

      const code = `REQ-BOM-${String(orderCode(order)).replace(/[^a-zA-Z0-9-]/g, "").slice(-12)}-${Date.now().toString().slice(-5)}`;

      const { data: reqData, error: reqError } = await supabase
        .from("warehouse_requisitions")
        .insert({
          code,
          requisition_no: code,
          type: "produccion_automatica",
          tipo: "produccion_automatica",
          status: "pendiente_autorizacion",
          estado: "pendiente_autorizacion",
          production_order_id: order.id,
          project_id: order.project_id || null,
          project_name: orderTitle(order),
          reason: `Requisición BOM generada desde production_order_items: ${orderCode(order)}`,
          urgency: "normal",
          requested_by_name: "Producción",
          reserved_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (reqError) throw reqError;

      const rows: any[] = [];

      for (const row of bomRows) {
        const inv = inventoryByName.get(norm(row.name));
        let reservedQty = 0;
        if (inv?.id) {
          const reserveResult = await reserveInventoryLine(String(inv.id), row.qty);
          if (reserveResult.error) throw reserveResult.error;
          reservedQty = reserveResult.reservedQty;
        }
        const missing = Math.max(0, row.qty - reservedQty);

        rows.push({
          requisition_id: reqData.id,
          warehouse_requisition_id: reqData.id,
          inventory_id: inv?.id || row.raw.inventory_id || row.raw.product_id || null,
          product_id: inv?.id || row.raw.product_id || row.raw.inventory_id || null,
          product_name: inv ? itemName(inv) : row.name,
          item_name: inv ? itemName(inv) : row.name,
          material: row.name,
          qty_requested: row.qty,
          quantity_requested: row.qty,
          cantidad_solicitada: row.qty,
          qty_reserved: reservedQty,
          quantity_reserved: reservedQty,
          cantidad_reservada: reservedQty,
          qty_missing: missing,
          cantidad_faltante: missing,
          qty_approved: 0,
          qty_dispatched: 0,
          unit: row.unit,
          unidad: row.unit,
          status: !inv ? "sin_match_inventario" : missing > 0 ? "reserva_parcial" : "reservada",
          estado: !inv ? "sin_match_inventario" : missing > 0 ? "reserva_parcial" : "reservada",
          destination: "Producción",
          destino: "Producción",
          notes: !inv ? `Sin match inventario. Tipo: ${row.type}` : `BOM automático. Reservado: ${reservedQty}/${row.qty}. Faltante: ${missing}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      const { error: itemError } = await supabase.from("warehouse_requisition_items").insert(rows);
      if (itemError) throw itemError;

      setAutoOpen(false);
      setSelectedProductionOrderId("");
      setSuccessMessage(`Requisición BOM creada: ${code}. Si tiene faltantes puedes generar compra automática.`);
      await loadData();
    } catch (err: any) {
      setErrorMessage("Error creando requisición BOM: " + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const selectedItems = selected?.id ? itemsByReq.get(String(selected.id)) || [] : [];
  const selectedReqMissing = selectedItems.reduce((sum, it) => sum + Math.max(0, getItemQty(it) - getItemReserved(it) - getItemDispatched(it)), 0);
  const selectedOrderItems = selectedProductionOrderId ? orderItemsByOrder.get(String(selectedProductionOrderId)) || [] : [];
  const selectedBomPreview = selectedOrderItems.length ? buildGroupedBomRows(selectedOrderItems).slice(0, 12) : [];

  function printRequisition(req: AnyRow) {
    if (!req?.id) return;

    const reqItems = itemsByReq.get(String(req.id)) || [];
    const rows = reqItems
      .map((item, index) => {
        const invId = item.inventory_id || item.product_id || item.item_id;
        const inv = invId ? inventoryMap.get(String(invId)) : null;
        const requested = getItemQty(item);
        const reservedLine = getItemReserved(item);
        const dispatched = getItemDispatched(item);
        const missing = Math.max(0, requested - reservedLine - dispatched);
        const itemUnit = getItemUnit(item);
        const itemCost = inv ? unitCost(inv) : n(item.estimated_unit_cost ?? item.unit_cost ?? 0);

        return `
          <tr>
            <td>${index + 1}</td>
            <td>${getItemProductName(item, inventoryMap)}</td>
            <td>${requested} ${itemUnit}</td>
            <td>${reservedLine} ${itemUnit}</td>
            <td>${missing} ${itemUnit}</td>
            <td>${money(itemCost)}</td>
            <td>${item.status || item.estado || "-"}</td>
            <td>${item.notes || item.observaciones || ""}</td>
          </tr>
        `;
      })
      .join("");

    const totalRequested = reqItems.reduce((sum, item) => sum + getItemQty(item), 0);
    const totalReserved = reqItems.reduce((sum, item) => sum + getItemReserved(item), 0);
    const totalMissing = reqItems.reduce((sum, item) => sum + Math.max(0, getItemQty(item) - getItemReserved(item) - getItemDispatched(item)), 0);

    const html = `
      <html>
        <head>
          <title>${reqCode(req)} - Requisicion</title>
          <style>
            body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #111; background: #fff; }
            .top { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #111; padding-bottom: 12px; }
            .brand { font-size: 12px; font-weight: 900; letter-spacing: 4px; color: #006b8f; text-transform: uppercase; }
            h1 { margin: 6px 0 0; font-size: 26px; }
            .code { border: 1px solid #111; border-radius: 12px; padding: 10px 14px; font-weight: 900; text-align: right; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
            .box { border: 1px solid #d7d7d7; border-radius: 12px; padding: 10px; }
            .label { font-size: 10px; font-weight: 900; color: #555; text-transform: uppercase; letter-spacing: .08em; }
            .value { margin-top: 4px; font-size: 14px; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
            th { background: #07111f; color: #fff; text-align: left; padding: 8px; }
            td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
            .summary { margin-top: 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .sign { margin-top: 46px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 42px; }
            .line { border-top: 1px solid #111; padding-top: 7px; text-align: center; font-size: 12px; }
            @media print { body { padding: 12mm; } }
          </style>
        </head>
        <body>
          <div class="top">
            <div>
              <div class="brand">RD WOOD SYSTEM / SANTANA GROUP</div>
              <h1>Requisicion de Materiales</h1>
              <p>Documento para autorizacion y despacho de almacen.</p>
            </div>
            <div class="code">
              ${reqCode(req)}<br/>
              <span style="font-size:12px;font-weight:700;">${reqStatus(req)}</span>
            </div>
          </div>

          <div class="grid">
            <div class="box"><div class="label">Proyecto</div><div class="value">${reqTitle(req)}</div></div>
            <div class="box"><div class="label">Departamento</div><div class="value">${req.department || req.departamento || req.requested_department || "Produccion"}</div></div>
            <div class="box"><div class="label">Solicitado por</div><div class="value">${reqRequestedBy(req)}</div></div>
            <div class="box"><div class="label">Fecha</div><div class="value">${fmtDate(req.created_at || req.fecha)}</div></div>
            <div class="box" style="grid-column: span 4;"><div class="label">Motivo</div><div class="value">${reqReason(req)}</div></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Material / articulo</th>
                <th>Solicitado</th>
                <th>Reservado</th>
                <th>Faltante</th>
                <th>Costo ref.</th>
                <th>Estado</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="8">No hay materiales registrados.</td></tr>`}
            </tbody>
          </table>

          <div class="summary">
            <div class="box"><div class="label">Lineas</div><div class="value">${reqItems.length}</div></div>
            <div class="box"><div class="label">Total reservado</div><div class="value">${totalReserved} / ${totalRequested}</div></div>
            <div class="box"><div class="label">Total faltante</div><div class="value">${totalMissing}</div></div>
          </div>

          <div class="sign">
            <div class="line">Solicitado por</div>
            <div class="line">Autorizado por</div>
            <div class="line">Despachado por almacen</div>
          </div>

          <script>window.onload = function(){ window.print(); };</script>
        </body>
      </html>
    `;

    const win = window.open("", "_blank", "width=1100,height=850");
    if (!win) {
      alert("Permite ventanas emergentes para imprimir la requisicion.");
      return;
    }
    win.document.write(html);
    win.document.close();
  }

  return (
    <main className="min-h-screen bg-[#030712] text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-7 p-5 md:p-8">
        <section className="overflow-hidden rounded-[30px] border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/25 shadow-2xl shadow-cyan-950/20">
          <div className="grid gap-6 p-6 xl:grid-cols-[1.35fr_.65fr] xl:p-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-200">
                <Database className="h-4 w-4" />
                Fase 6K · Requisiciones Internas
              </div>

              <div>
                <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">Centro de Requisiciones PRO</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
                  Centro único de abastecimiento: proyectos, departamentos, instalación, mantenimiento y producción.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/inventario-inteligente" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-200 hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4" /> Volver al inventario
                </Link>
                <button onClick={() => setAutoOpen(true)} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-400/20">
                  <Wand2 className="h-4 w-4" /> BOM desde Producción
                </button>
                <button onClick={() => setManualOpen(true)} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-400/20">
                  <Plus className="h-4 w-4" /> Requisición interna
                </button>
                <button onClick={loadData} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm font-black text-blue-100 hover:bg-blue-400/20 disabled:opacity-60">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Actualizar
                </button>
              </div>

              {successMessage && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-100">{successMessage}</div>}
              {errorMessage && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-semibold text-red-100">{errorMessage}</div>}
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200"><ShieldCheck className="h-7 w-7" /></div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Compras conectadas</p>
                  <h2 className="text-xl font-black text-white">Faltante → OC → Recepción</h2>
                </div>
              </div>
              <div className="mt-6 space-y-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">Stock físico: {fmtQty(physicalTotal)}</div>
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-amber-100">Reservado: {fmtQty(reservedTotal)}</div>
                <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-red-100">Faltante abierto: {fmtQty(missingTotal)}</div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-emerald-100">OC creadas: {purchaseRequests.length}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Requisiciones", value: requisitions.length, icon: ClipboardList, detail: "Total" },
            { label: "Pendientes", value: requisitions.filter((r) => reqStatus(r) === "pendiente_autorizacion").length, icon: AlertTriangle, detail: "Esperando autorización" },
            { label: "Reservado", value: fmtQty(reservedTotal), icon: PackageCheck, detail: "Stock comprometido" },
            { label: "Faltantes", value: fmtQty(missingTotal), icon: ShoppingCart, detail: "Para compras" },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="rounded-[26px] border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/20">
                <div className="flex items-center justify-between">
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200"><Icon className="h-5 w-5" /></div>
                  <p className="text-3xl font-black text-white">{m.value}</p>
                </div>
                <p className="mt-4 text-sm font-black text-slate-300">{m.label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{m.detail}</p>
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_440px]">
          <div className="rounded-[30px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
            <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-black text-white">Bandeja de requisiciones</h2>
                <p className="text-sm text-slate-500">Ahora con generación de compra por faltantes.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." className="w-full rounded-2xl border border-white/10 bg-slate-900 px-11 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50" />
                </div>
                <select value={tab} onChange={(e) => setTab(e.target.value as any)} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50">
                  <option value="todas">Todas</option><option value="automaticas">Automáticas</option><option value="manuales">Manuales</option>
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50">
                  <option value="todos">Todos los estados</option><option value="pendiente_autorizacion">Pendiente autorización</option><option value="autorizada">Autorizada</option><option value="parcial">Parcial</option><option value="despachada">Despachada</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-white/10 bg-slate-900/60">
                <Loader2 className="mr-3 h-6 w-6 animate-spin text-cyan-100" /> Cargando requisiciones...
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReqs.map((r) => {
                  const st = reqStatus(r);
                  const reqItems = r.id ? itemsByReq.get(String(r.id)) || [] : [];
                  const active = selected?.id === r.id;
                  const reqReserved = reqItems.reduce((sum, it) => sum + getItemReserved(it), 0);
                  const reqMissing = reqItems.reduce((sum, it) => sum + Math.max(0, getItemQty(it) - getItemReserved(it) - getItemDispatched(it)), 0);

                  return (
                    <article key={r.id || reqCode(r)} className={`rounded-[24px] border bg-gradient-to-br from-slate-900 to-slate-950 p-4 transition ${active ? "border-cyan-300/60" : "border-white/10 hover:border-cyan-300/30"}`}>
                      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">{reqCode(r)}</span>
                            <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass[st] || statusClass.pendiente_autorizacion}`}>{st}</span>
                            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-200">Reservado {fmtQty(reqReserved)}</span>
                            {reqMissing > 0 && <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-black text-red-200">Faltante {fmtQty(reqMissing)}</span>}
                            {(r.purchase_order_id || r.purchase_request_id) && (
                              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-200">
                                OC: {purchaseStatusLabel(linkedPurchaseOrder(r))}
                              </span>
                            )}
                          </div>
                          <h3 className="mt-3 text-lg font-black text-white">{reqTitle(r)}</h3>
                          <p className="mt-1 text-sm text-slate-400">{reqReason(r)}</p>
                          <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-500 md:grid-cols-3">
                            <span><Boxes className="mr-1 inline h-4 w-4" /> {reqItems.length} artículos</span>
                            <span><FileText className="mr-1 inline h-4 w-4" /> {reqRequestedBy(r)}</span>
                            <span>{r.department || r.departamento || r.requested_department || reqType(r)}</span>
                            <span>{fmtDate(r.created_at || r.fecha)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 xl:flex-col">
                          <button onClick={() => setSelected(r)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 hover:bg-white/10">Ver detalle</button>
                          <button onClick={() => printRequisition(r)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 hover:bg-white/10">
                            <Printer className="mr-1 inline h-4 w-4" /> Imprimir
                          </button>
                          <button onClick={() => updateReqStatus(r, "autorizada")} disabled={saving || st === "autorizada"} className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-50">Autorizar</button>
                          <button onClick={() => dispatchRequisition(r)} disabled={saving || st === "despachada" || !["autorizada", "parcial"].includes(st)} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-50">Despachar real</button>
                          <button onClick={() => createPurchaseRequestFromShortage(r)} disabled={saving || reqMissing <= 0 || !!(r.purchase_order_id || r.purchase_request_id)} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-100 hover:bg-amber-400/20 disabled:opacity-50">Generar OC</button>
                          {(r.purchase_order_id || r.purchase_request_id) && (
                            <button onClick={openCompras} className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100 hover:bg-cyan-400/20">Abrir OC</button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
                {!filteredReqs.length && <div className="flex min-h-[220px] items-center justify-center rounded-[24px] border border-white/10 bg-slate-900/50 text-sm font-semibold text-slate-500">No hay requisiciones con esos filtros.</div>}
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[30px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
              <h2 className="text-xl font-black text-white">Detalle de requisición</h2>
              <p className="mt-1 text-sm text-slate-500">{selected ? reqCode(selected) : "Selecciona una requisición"}</p>

              {selected && (selected.purchase_order_id || selected.purchase_request_id) && (
                <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Orden de compra vinculada</p>
                  <p className="mt-2 text-lg font-black text-white">{purchaseNumber(linkedPurchaseOrder(selected))}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-black/20 p-2">
                      <p className="text-slate-500">Estado</p>
                      <p className="font-black text-cyan-100">{purchaseStatusLabel(linkedPurchaseOrder(selected))}</p>
                    </div>
                    <div className="rounded-xl bg-black/20 p-2">
                      <p className="text-slate-500">Entrega estimada</p>
                      <p className="font-black text-white">{purchaseEta(linkedPurchaseOrder(selected))}</p>
                    </div>
                  </div>
                  <button onClick={openCompras} className="mt-3 w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-400/20">
                    Abrir en Compras PRO
                  </button>
                </div>
              )}
              {selected && selectedReqMissing > 0 && (
                <button onClick={() => createPurchaseRequestFromShortage(selected)} disabled={saving || !!selected.purchase_request_id} className="mt-4 w-full rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-black text-amber-100 hover:bg-amber-400/20 disabled:opacity-50">
                  <ShoppingCart className="mr-2 inline h-4 w-4" />
                  Crear orden compra por faltante {selectedReqMissing}
                </button>
              )}
              {selected && (
                <button onClick={() => printRequisition(selected)} className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-100 hover:bg-white/10">
                  <Printer className="mr-2 inline h-4 w-4" />
                  Imprimir requisicion para almacen
                </button>
              )}

              <div className="mt-5 space-y-3">
                {selectedItems.map((item, idx) => {
                  const invId = item.inventory_id || item.product_id || item.item_id;
                  const inv = invId ? inventoryMap.get(String(invId)) : null;
                  const physical = inv ? stock(inv) : 0;
                  const invReserved = inv ? reserved(inv) : 0;
                  const available = inv ? availableStock(inv) : 0;
                  const qty = getItemQty(item);
                  const reservedLine = getItemReserved(item);
                  const dispatched = getItemDispatched(item);
                  const missing = Math.max(0, qty - reservedLine - dispatched);
                  const cost = inv ? unitCost(inv) : 0;

                  return (
                    <div key={item.id || idx} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-white">{getItemProductName(item, inventoryMap)}</p>
                          <p className="mt-1 text-xs text-slate-500">Solicitado: {fmtQty(qty)} {getItemUnit(item)} · Costo: {money(cost)}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${missing > 0 ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>
                          Faltante {fmtQty(missing)}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-xl bg-black/20 p-2"><p className="text-slate-500">Físico</p><p className="font-black text-white">{fmtQty(physical)}</p></div>
                        <div className="rounded-xl bg-black/20 p-2"><p className="text-slate-500">Reservado</p><p className="font-black text-amber-100">{fmtQty(reservedLine)}</p></div>
                        <div className="rounded-xl bg-black/20 p-2"><p className="text-slate-500">Disponible</p><p className="font-black text-emerald-100">{fmtQty(available)}</p></div>
                      </div>
                    </div>
                  );
                })}
                {selected && !selectedItems.length && <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">Esta requisición no tiene ítems registrados.</div>}
                {!selected && <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">Selecciona una requisición para ver faltantes y generar compra.</div>}
              </div>
            </div>
            <div className="rounded-[30px] border border-emerald-400/20 bg-emerald-400/10 p-5">
              <div className="flex items-start gap-3">
                <Truck className="mt-1 h-5 w-5 text-emerald-200" />
                <div>
                  <h2 className="font-black text-emerald-100">Fase 6K activa</h2>
                  <p className="mt-2 text-sm leading-6 text-emerald-100/75">Cualquier departamento puede solicitar materiales con aprobación, reserva, despacho, Kardex y compras por faltantes.</p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>

      {autoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[30px] border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200">BOM real + reserva</p>
                <h2 className="mt-2 text-2xl font-black text-white">Crear requisición interna con reserva</h2>
              </div>
              <button onClick={() => setAutoOpen(false)} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 hover:bg-white/10"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Orden de producción</span>
                <select value={selectedProductionOrderId} onChange={(e) => setSelectedProductionOrderId(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50">
                  <option value="">Seleccionar orden</option>
                  {orders.slice(0, 500).map((o) => (<option key={o.id} value={o.id}>{orderCode(o)} · {orderTitle(o)}</option>))}
                </select>
              </label>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
                Detectados para esta orden: {selectedOrderItems.length} ítems. Agrupados: {selectedBomPreview.length}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setAutoOpen(false)} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 hover:bg-white/10">Cancelar</button>
              <button onClick={createAutoReqFromProduction} disabled={saving} className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60">Crear solicitud interna</button>
            </div>
          </div>
        </div>
      )}

      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200">Requisición interna + reserva</p>
                <h2 className="mt-2 text-2xl font-black text-white">Solicitud de materiales al almacén</h2>
              </div>
              <button onClick={() => setManualOpen(false)} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 hover:bg-white/10"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Tipo de requisición</span>
                <select value={manualType} onChange={(e) => setManualType(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50">
                  {REQUISITION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Departamento solicitante</span>
                <select value={manualDepartment} onChange={(e) => setManualDepartment(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50">
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Solicitado por</span>
                <input value={manualRequestedBy} onChange={(e) => setManualRequestedBy(e.target.value)} placeholder="Nombre del solicitante" className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Fecha requerida</span>
                <input type="date" value={manualRequiredDate} onChange={(e) => setManualRequiredDate(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50" />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-black text-slate-300">Proyecto / área</span>
                <input value={manualProject} onChange={(e) => setManualProject(e.target.value)} placeholder="Ej: Cocina Pérez, mantenimiento CNC, oficina administrativa" className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50" />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-black text-slate-300">Referencia de proyecto / OT (opcional)</span>
                <input value={manualProjectRef} onChange={(e) => setManualProjectRef(e.target.value)} placeholder="Ej: PRO-20260518-001 / OC / instalación" className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50" />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-black text-slate-300">Motivo</span>
                <textarea value={manualReason} onChange={(e) => setManualReason(e.target.value)} rows={3} className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50" placeholder="Describe para qué se necesitan estos materiales" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Producto</span>
                <select value={manualProductId} onChange={(e) => setManualProductId(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50">
                  <option value="">Seleccionar producto</option>
                  {inventory.slice(0, 500).map((i) => (<option key={i.id} value={i.id}>{itemName(i)} · Disp. {availableStock(i)}</option>))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Cantidad</span>
                <input type="number" value={manualQty} onChange={(e) => setManualQty(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setManualOpen(false)} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 hover:bg-white/10">Cancelar</button>
              <button onClick={createManualReq} disabled={saving} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-60">Crear solicitud interna</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
