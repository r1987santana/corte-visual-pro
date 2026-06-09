"use client";

/**
 * RD WOOD SYSTEM / SANTANA GROUP
 * Maestro de Reportes Empresarial TOTAL
 * Archivo: app/reportes/page.tsx
 *
 * Incluye:
 * - Dashboard ejecutivo
 * - Filtros avanzados por fecha, búsqueda, inventario y movimientos
 * - Reporte de ventas
 * - Reporte de productos vendidos
 * - Reporte de clientes
 * - Reporte de inventario
 * - Reporte de movimientos
 * - Reporte financiero
 * - Gráficas con Recharts
 * - Exportación PDF profesional
 * - Exportación Excel multipestaña
 * - Exportación CSV
 * - Impresión profesional
 * - Cálculo de ITBIS, ganancia, margen, ticket promedio, inventario valorizado
 *
 * Dependencias:
 * npm install jspdf jspdf-autotable exceljs recharts lucide-react
 */

import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Download,
  Factory,
  FileSpreadsheet,
  FileText,
  Filter,
  Package,
  Printer,
  RefreshCcw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  Warehouse,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";

/* =========================================================
   TIPOS
========================================================= */

type Sale = {
  id: string;
  created_at: string;
  invoice_number: string | null;
  client_id?: string | null;
  client_name: string | null;
  client_phone: string | null;
  subtotal: number | string | null;
  tax: number | string | null;
  total: number | string | null;
  cost_total?: number | string | null;
  profit_total?: number | string | null;
  status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  seller_name?: string | null;
};

type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string | null;
  quantity: number | string | null;
  price: number | string | null;
  subtotal: number | string | null;
  cost_price?: number | string | null;
  profit?: number | string | null;
};

type Product = {
  id: string;
  name?: string | null;
  product_name?: string | null;
  description?: string | null;
  stock?: number | string | null;
  quantity?: number | string | null;
  price?: number | string | null;
  sale_price?: number | string | null;
  selling_price?: number | string | null;
  unit_price?: number | string | null;
  precio_venta?: number | string | null;
  cost_price?: number | string | null;
  average_cost?: number | string | null;
  category?: string | null;
  subcategory?: string | null;
  supplier_name?: string | null;
};

type Movement = {
  id: string;
  created_at: string;
  product_id: string | null;
  product_name: string | null;
  movement_type: string | null;
  quantity: number | string | null;
  stock_before: number | string | null;
  stock_after: number | string | null;
  reference: string | null;
  user_name?: string | null;
};

type ActiveTab =
  | "dashboard"
  | "ventas"
  | "productos"
  | "clientes"
  | "inventario"
  | "movimientos"
  | "finanzas"
  | "alertas";

type ProductSummary = {
  product_id: string;
  product_name: string;
  quantity: number;
  total: number;
  profit: number;
  avgPrice: number;
  margin: number;
};

type ClientSummary = {
  client_key: string;
  client_name: string;
  client_phone: string;
  invoices: number;
  total: number;
  profit: number;
  avgTicket: number;
  margin: number;
};

type DailySummary = {
  date: string;
  label: string;
  total: number;
  subtotal: number;
  tax: number;
  profit: number;
  invoices: number;
  avgTicket: number;
  margin: number;
};

type CategorySummary = {
  category: string;
  products: number;
  stock: number;
  saleValue: number;
  costValue: number;
  potentialProfit: number;
};

type FinanceSummary = {
  subtotal: number;
  tax: number;
  total: number;
  cost: number;
  profit: number;
  margin: number;
  invoices: number;
  avgTicket: number;
};

type InventoryAlert = {
  id: string;
  product_name: string;
  category: string;
  stock: number;
  price: number;
  cost: number;
  alert: string;
  severity: "alta" | "media" | "baja";
};

/* =========================================================
   HELPERS
========================================================= */

function toNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("es-DO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(value: string) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("es-DO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function yearStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function inDateRange(date: string, from: string, to: string) {
  if (!date) return false;
  const value = new Date(date).toISOString().slice(0, 10);
  return value >= from && value <= to;
}

function getProductName(p: Product) {
  return p.name || p.product_name || p.description || "Producto sin nombre";
}

function getProductStock(p: Product) {
  return toNumber(p.stock ?? p.quantity);
}

function getProductPrice(p: Product) {
  return (
    toNumber(p.price) ||
    toNumber(p.sale_price) ||
    toNumber(p.selling_price) ||
    toNumber(p.unit_price) ||
    toNumber(p.precio_venta)
  );
}

function getProductCost(p: Product) {
  return toNumber(p.cost_price) || toNumber(p.average_cost);
}

function percent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

function cleanSearch(value: string) {
  return value.trim().toLowerCase();
}

function csvSafe(value: any) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

function downloadCSV(filename: string, rows: any[][]) {
  const csv = rows.map((row) => row.map(csvSafe).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("/", "-")
    .replaceAll("\\", "-")
    .replaceAll(":", "-");
}

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */

export default function ReportesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);

  const [fromDate, setFromDate] = useState(monthStartISO());
  const [toDate, setToDate] = useState(todayISO());
  const [quickRange, setQuickRange] = useState("month");
  const [search, setSearch] = useState("");
  const [movementType, setMovementType] = useState("todos");
  const [stockFilter, setStockFilter] = useState("todos");
  const [paymentFilter, setPaymentFilter] = useState("todos");
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);

    try {
      const [salesRes, itemsRes, productsRes, movementsRes] = await Promise.all([
        supabase.from("sales").select("*").order("created_at", { ascending: false }),
        supabase.from("sale_items").select("*"),
        supabase.from("products").select("*"),
        supabase.from("inventory_movements").select("*").order("created_at", { ascending: false }),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (productsRes.error) throw productsRes.error;
      if (movementsRes.error) throw movementsRes.error;

      setSales(salesRes.data || []);
      setSaleItems(itemsRes.data || []);
      setProducts(productsRes.data || []);
      setMovements(movementsRes.data || []);
    } catch (error: any) {
      alert("Error cargando reportes: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  function applyQuickRange(value: string) {
    setQuickRange(value);

    if (value === "today") {
      setFromDate(todayISO());
      setToDate(todayISO());
    }

    if (value === "7days") {
      setFromDate(addDaysISO(-6));
      setToDate(todayISO());
    }

    if (value === "30days") {
      setFromDate(addDaysISO(-29));
      setToDate(todayISO());
    }

    if (value === "month") {
      setFromDate(monthStartISO());
      setToDate(todayISO());
    }

    if (value === "year") {
      setFromDate(yearStartISO());
      setToDate(todayISO());
    }
  }

  function clearFilters() {
    setFromDate(monthStartISO());
    setToDate(todayISO());
    setQuickRange("month");
    setSearch("");
    setMovementType("todos");
    setStockFilter("todos");
    setPaymentFilter("todos");
    setActiveTab("dashboard");
  }

  function getItemsBySale(saleId: string) {
    return saleItems.filter((item) => item.sale_id === saleId);
  }

  function calculateSaleCost(sale: Sale) {
    const direct = toNumber(sale.cost_total);
    if (direct > 0) return direct;

    return getItemsBySale(sale.id).reduce((acc, item) => {
      const qty = toNumber(item.quantity);
      const cost = toNumber(item.cost_price);
      return acc + cost * qty;
    }, 0);
  }

  function calculateSaleProfit(sale: Sale) {
    const direct = toNumber(sale.profit_total);
    if (direct > 0) return direct;

    return getItemsBySale(sale.id).reduce((acc, item) => {
      const directItemProfit = toNumber(item.profit);
      if (directItemProfit > 0) return acc + directItemProfit;

      const qty = toNumber(item.quantity);
      const price = toNumber(item.price);
      const cost = toNumber(item.cost_price);

      return acc + (price - cost) * qty;
    }, 0);
  }

  /* =========================================================
     FILTROS MEMO
  ========================================================= */

  const filteredSales = useMemo(() => {
    const term = cleanSearch(search);

    return sales.filter((sale) => {
      const matchesDate = inDateRange(sale.created_at, fromDate, toDate);

      const matchesSearch =
        !term ||
        (sale.invoice_number || "").toLowerCase().includes(term) ||
        (sale.client_name || "").toLowerCase().includes(term) ||
        (sale.client_phone || "").toLowerCase().includes(term) ||
        (sale.status || "").toLowerCase().includes(term) ||
        (sale.payment_status || "").toLowerCase().includes(term) ||
        (sale.payment_method || "").toLowerCase().includes(term) ||
        (sale.seller_name || "").toLowerCase().includes(term);

      const matchesPayment =
        paymentFilter === "todos" ||
        (sale.payment_status || "").toLowerCase() === paymentFilter.toLowerCase() ||
        (sale.payment_method || "").toLowerCase() === paymentFilter.toLowerCase();

      return matchesDate && matchesSearch && matchesPayment;
    });
  }, [sales, fromDate, toDate, search, paymentFilter]);

  const filteredSaleIds = useMemo(() => {
    return new Set(filteredSales.map((sale) => sale.id));
  }, [filteredSales]);

  const filteredSaleItems = useMemo(() => {
    const term = cleanSearch(search);

    return saleItems.filter((item) => {
      const saleMatches = filteredSaleIds.has(item.sale_id);
      const textMatches =
        !term ||
        (item.product_name || "").toLowerCase().includes(term);

      return saleMatches && textMatches;
    });
  }, [saleItems, filteredSaleIds, search]);

  const filteredMovements = useMemo(() => {
    const term = cleanSearch(search);

    return movements.filter((m) => {
      const matchesDate = inDateRange(m.created_at, fromDate, toDate);

      const matchesType =
        movementType === "todos" ||
        (m.movement_type || "").toLowerCase() === movementType.toLowerCase();

      const matchesSearch =
        !term ||
        (m.product_name || "").toLowerCase().includes(term) ||
        (m.reference || "").toLowerCase().includes(term) ||
        (m.movement_type || "").toLowerCase().includes(term) ||
        (m.user_name || "").toLowerCase().includes(term);

      return matchesDate && matchesType && matchesSearch;
    });
  }, [movements, fromDate, toDate, search, movementType]);

  const filteredProducts = useMemo(() => {
    const term = cleanSearch(search);

    return products.filter((p) => {
      const stock = getProductStock(p);
      const price = getProductPrice(p);
      const cost = getProductCost(p);

      const matchesSearch =
        !term ||
        getProductName(p).toLowerCase().includes(term) ||
        (p.category || "").toLowerCase().includes(term) ||
        (p.subcategory || "").toLowerCase().includes(term) ||
        (p.supplier_name || "").toLowerCase().includes(term);

      const matchesStock =
        stockFilter === "todos" ||
        (stockFilter === "bajo" && stock <= 2) ||
        (stockFilter === "sinprecio" && price <= 0) ||
        (stockFilter === "sincosto" && cost <= 0) ||
        (stockFilter === "negativo" && stock < 0) ||
        (stockFilter === "ok" && stock > 2 && price > 0 && cost > 0);

      return matchesSearch && matchesStock;
    });
  }, [products, search, stockFilter]);

  /* =========================================================
     KPI / AGREGADOS
  ========================================================= */

  const financeSummary = useMemo<FinanceSummary>(() => {
    const subtotal = filteredSales.reduce((acc, s) => acc + toNumber(s.subtotal), 0);
    const tax = filteredSales.reduce((acc, s) => acc + toNumber(s.tax), 0);
    const total = filteredSales.reduce((acc, s) => acc + toNumber(s.total), 0);
    const cost = filteredSales.reduce((acc, s) => acc + calculateSaleCost(s), 0);
    const profit = filteredSales.reduce((acc, s) => acc + calculateSaleProfit(s), 0);
    const margin = total > 0 ? (profit / total) * 100 : 0;
    const invoices = filteredSales.length;
    const avgTicket = invoices > 0 ? total / invoices : 0;

    return {
      subtotal,
      tax,
      total,
      cost,
      profit,
      margin,
      invoices,
      avgTicket,
    };
  }, [filteredSales, saleItems]);

  const inventorySaleValue = useMemo(() => {
    return products.reduce((acc, p) => acc + getProductStock(p) * getProductPrice(p), 0);
  }, [products]);

  const inventoryCostValue = useMemo(() => {
    return products.reduce((acc, p) => acc + getProductStock(p) * getProductCost(p), 0);
  }, [products]);

  const inventoryPotentialProfit = inventorySaleValue - inventoryCostValue;

  const lowStockProducts = useMemo(() => {
    return products.filter((p) => getProductStock(p) <= 2);
  }, [products]);

  const noPriceProducts = useMemo(() => {
    return products.filter((p) => getProductPrice(p) <= 0);
  }, [products]);

  const noCostProducts = useMemo(() => {
    return products.filter((p) => getProductCost(p) <= 0);
  }, [products]);

  const negativeStockProducts = useMemo(() => {
    return products.filter((p) => getProductStock(p) < 0);
  }, [products]);

  const inventoryAlerts = useMemo<InventoryAlert[]>(() => {
    const alerts: InventoryAlert[] = [];

    products.forEach((p) => {
      const stock = getProductStock(p);
      const price = getProductPrice(p);
      const cost = getProductCost(p);

      if (stock < 0) {
        alerts.push({
          id: `${p.id}-negative`,
          product_name: getProductName(p),
          category: p.category || "General",
          stock,
          price,
          cost,
          alert: "Stock negativo",
          severity: "alta",
        });
      } else if (stock <= 2) {
        alerts.push({
          id: `${p.id}-low`,
          product_name: getProductName(p),
          category: p.category || "General",
          stock,
          price,
          cost,
          alert: "Stock bajo",
          severity: "media",
        });
      }

      if (price <= 0) {
        alerts.push({
          id: `${p.id}-noprice`,
          product_name: getProductName(p),
          category: p.category || "General",
          stock,
          price,
          cost,
          alert: "Producto sin precio de venta",
          severity: "alta",
        });
      }

      if (cost <= 0) {
        alerts.push({
          id: `${p.id}-nocost`,
          product_name: getProductName(p),
          category: p.category || "General",
          stock,
          price,
          cost,
          alert: "Producto sin costo",
          severity: "media",
        });
      }
    });

    return alerts.sort((a, b) => {
      const order = { alta: 0, media: 1, baja: 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [products]);

  const topProducts = useMemo<ProductSummary[]>(() => {
    const map = new Map<string, ProductSummary>();

    filteredSaleItems.forEach((item) => {
      const key = item.product_id || item.product_name || "sin-id";
      const qty = toNumber(item.quantity);
      const total = toNumber(item.subtotal);
      const profit =
        toNumber(item.profit) ||
        (toNumber(item.price) - toNumber(item.cost_price)) * qty;

      const current = map.get(key);

      if (current) {
        current.quantity += qty;
        current.total += total;
        current.profit += profit;
        current.avgPrice = current.quantity > 0 ? current.total / current.quantity : 0;
        current.margin = current.total > 0 ? (current.profit / current.total) * 100 : 0;
      } else {
        map.set(key, {
          product_id: key,
          product_name: item.product_name || "Producto sin nombre",
          quantity: qty,
          total,
          profit,
          avgPrice: qty > 0 ? total / qty : 0,
          margin: total > 0 ? (profit / total) * 100 : 0,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredSaleItems]);

  const topClients = useMemo<ClientSummary[]>(() => {
    const map = new Map<string, ClientSummary>();

    filteredSales.forEach((sale) => {
      const key = (sale.client_phone || sale.client_name || "cliente-general").toLowerCase();
      const total = toNumber(sale.total);
      const profit = calculateSaleProfit(sale);

      const current = map.get(key);

      if (current) {
        current.invoices += 1;
        current.total += total;
        current.profit += profit;
        current.avgTicket = current.total / Math.max(current.invoices, 1);
        current.margin = current.total > 0 ? (current.profit / current.total) * 100 : 0;
      } else {
        map.set(key, {
          client_key: key,
          client_name: sale.client_name || "Cliente general",
          client_phone: sale.client_phone || "N/A",
          invoices: 1,
          total,
          profit,
          avgTicket: total,
          margin: total > 0 ? (profit / total) * 100 : 0,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredSales, saleItems]);

  const salesByDay = useMemo<DailySummary[]>(() => {
    const map = new Map<string, DailySummary>();

    filteredSales.forEach((sale) => {
      const date = new Date(sale.created_at).toISOString().slice(0, 10);
      const current = map.get(date);

      const total = toNumber(sale.total);
      const subtotal = toNumber(sale.subtotal);
      const tax = toNumber(sale.tax);
      const profit = calculateSaleProfit(sale);

      if (current) {
        current.total += total;
        current.subtotal += subtotal;
        current.tax += tax;
        current.profit += profit;
        current.invoices += 1;
        current.avgTicket = current.total / Math.max(current.invoices, 1);
        current.margin = current.total > 0 ? (current.profit / current.total) * 100 : 0;
      } else {
        map.set(date, {
          date,
          label: formatDate(date),
          total,
          subtotal,
          tax,
          profit,
          invoices: 1,
          avgTicket: total,
          margin: total > 0 ? (profit / total) * 100 : 0,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSales, saleItems]);

  const categoriesSummary = useMemo<CategorySummary[]>(() => {
    const map = new Map<string, CategorySummary>();

    products.forEach((p) => {
      const category = p.category || "General";
      const stock = getProductStock(p);
      const price = getProductPrice(p);
      const cost = getProductCost(p);

      const current = map.get(category);

      if (current) {
        current.products += 1;
        current.stock += stock;
        current.saleValue += stock * price;
        current.costValue += stock * cost;
        current.potentialProfit = current.saleValue - current.costValue;
      } else {
        map.set(category, {
          category,
          products: 1,
          stock,
          saleValue: stock * price,
          costValue: stock * cost,
          potentialProfit: stock * price - stock * cost,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.saleValue - a.saleValue);
  }, [products]);

  const pieData = [
    { name: "Ventas", value: Math.max(financeSummary.total, 0) },
    { name: "Ganancia", value: Math.max(financeSummary.profit, 0) },
    { name: "ITBIS", value: Math.max(financeSummary.tax, 0) },
  ];

  const maxDayTotal = Math.max(...salesByDay.map((d) => d.total), 1);

  /* =========================================================
     EXPORT CSV / EXCEL
  ========================================================= */

  function exportSalesCSV() {
    downloadCSV("reporte_ventas.csv", [
      ["Fecha", "Factura", "Cliente", "Teléfono", "Subtotal", "ITBIS", "Total", "Costo", "Ganancia", "Margen", "Estado", "Método Pago"],
      ...filteredSales.map((s) => {
        const total = toNumber(s.total);
        const profit = calculateSaleProfit(s);
        const cost = calculateSaleCost(s);

        return [
          formatDate(s.created_at),
          s.invoice_number || "",
          s.client_name || "",
          s.client_phone || "",
          toNumber(s.subtotal),
          toNumber(s.tax),
          total,
          cost,
          profit,
          total > 0 ? (profit / total) * 100 : 0,
          s.status || "emitida",
          s.payment_method || "",
        ];
      }),
    ]);
  }

  function exportProductsCSV() {
    downloadCSV("reporte_inventario.csv", [
      ["Producto", "Categoría", "Subcategoría", "Stock", "Precio Venta", "Costo", "Valor Venta", "Valor Costo", "Ganancia Potencial", "Estado"],
      ...filteredProducts.map((p) => {
        const stock = getProductStock(p);
        const price = getProductPrice(p);
        const cost = getProductCost(p);

        return [
          getProductName(p),
          p.category || "General",
          p.subcategory || "",
          stock,
          price,
          cost,
          stock * price,
          stock * cost,
          stock * price - stock * cost,
          stock <= 2 ? "Stock bajo" : price <= 0 ? "Sin precio" : cost <= 0 ? "Sin costo" : "OK",
        ];
      }),
    ]);
  }

  function exportMovementsCSV() {
    downloadCSV("reporte_movimientos.csv", [
      ["Fecha", "Producto", "Tipo", "Cantidad", "Stock Antes", "Stock Después", "Referencia", "Usuario"],
      ...filteredMovements.map((m) => [
        formatDateTime(m.created_at),
        m.product_name || "",
        m.movement_type || "",
        toNumber(m.quantity),
        toNumber(m.stock_before),
        toNumber(m.stock_after),
        m.reference || "",
        m.user_name || "",
      ]),
    ]);
  }

  function exportActiveCSV() {
    if (activeTab === "ventas" || activeTab === "dashboard" || activeTab === "finanzas") exportSalesCSV();
    if (activeTab === "inventario" || activeTab === "alertas") exportProductsCSV();
    if (activeTab === "movimientos") exportMovementsCSV();

    if (activeTab === "productos") {
      downloadCSV("reporte_productos_vendidos.csv", [
        ["Producto", "Cantidad", "Total", "Ganancia", "Precio Promedio", "Margen"],
        ...topProducts.map((p) => [p.product_name, p.quantity, p.total, p.profit, p.avgPrice, p.margin]),
      ]);
    }

    if (activeTab === "clientes") {
      downloadCSV("reporte_clientes.csv", [
        ["Cliente", "Teléfono", "Facturas", "Total", "Ganancia", "Ticket Promedio", "Margen"],
        ...topClients.map((c) => [
          c.client_name,
          c.client_phone,
          c.invoices,
          c.total,
          c.profit,
          c.avgTicket,
          c.margin,
        ]),
      ]);
    }
  }

  async function exportExcel() {
    const ventasSheet = filteredSales.map((s) => {
      const total = toNumber(s.total);
      const profit = calculateSaleProfit(s);
      const cost = calculateSaleCost(s);

      return {
        Fecha: formatDate(s.created_at),
        Factura: s.invoice_number || "",
        Cliente: s.client_name || "",
        Telefono: s.client_phone || "",
        Subtotal: toNumber(s.subtotal),
        ITBIS: toNumber(s.tax),
        Total: total,
        Costo: cost,
        Ganancia: profit,
        Margen: total > 0 ? profit / total : 0,
        Estado: s.status || "emitida",
        MetodoPago: s.payment_method || "",
      };
    });

    const productosSheet = topProducts.map((p) => ({
      Producto: p.product_name,
      Cantidad: p.quantity,
      Total: p.total,
      Ganancia: p.profit,
      PrecioPromedio: p.avgPrice,
      Margen: p.margin,
    }));

    const clientesSheet = topClients.map((c) => ({
      Cliente: c.client_name,
      Telefono: c.client_phone,
      Facturas: c.invoices,
      Total: c.total,
      Ganancia: c.profit,
      TicketPromedio: c.avgTicket,
      Margen: c.margin,
    }));

    const inventarioSheet = filteredProducts.map((p) => {
      const stock = getProductStock(p);
      const price = getProductPrice(p);
      const cost = getProductCost(p);

      return {
        Producto: getProductName(p),
        Categoria: p.category || "General",
        Subcategoria: p.subcategory || "",
        Stock: stock,
        PrecioVenta: price,
        Costo: cost,
        ValorVenta: stock * price,
        ValorCosto: stock * cost,
        GananciaPotencial: stock * price - stock * cost,
        Estado: stock <= 2 ? "Stock bajo" : price <= 0 ? "Sin precio" : cost <= 0 ? "Sin costo" : "OK",
      };
    });

    const movimientosSheet = filteredMovements.map((m) => ({
      Fecha: formatDateTime(m.created_at),
      Producto: m.product_name || "",
      Tipo: m.movement_type || "",
      Cantidad: toNumber(m.quantity),
      StockAntes: toNumber(m.stock_before),
      StockDespues: toNumber(m.stock_after),
      Referencia: m.reference || "",
      Usuario: m.user_name || "",
    }));

    const finanzasSheet = [
      {
        Subtotal: financeSummary.subtotal,
        ITBIS: financeSummary.tax,
        Total: financeSummary.total,
        Costo: financeSummary.cost,
        Ganancia: financeSummary.profit,
        Margen: financeSummary.margin,
        Facturas: financeSummary.invoices,
        TicketPromedio: financeSummary.avgTicket,
        InventarioVenta: inventorySaleValue,
        InventarioCosto: inventoryCostValue,
        GananciaPotencialInventario: inventoryPotentialProfit,
      },
    ];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "RD Wood System";
    workbook.created = new Date();

    const appendSheet = (name: string, rows: Record<string, any>[]) => {
      const worksheet = workbook.addWorksheet(name);
      const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
      worksheet.columns = columns.map((key) => ({ header: key, key, width: Math.max(14, key.length + 2) }));
      rows.forEach((row) => worksheet.addRow(row));
      worksheet.getRow(1).font = { bold: true };
    };

    appendSheet("Resumen", finanzasSheet);
    appendSheet("Ventas", ventasSheet);
    appendSheet("Productos", productosSheet);
    appendSheet("Clientes", clientesSheet);
    appendSheet("Inventario", inventarioSheet);
    appendSheet("Movimientos", movimientosSheet);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rdwood_reportes_${fromDate}_${toDate}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /* =========================================================
     PRINT / PDF
  ========================================================= */

  function getReportTitle(type: ActiveTab) {
    if (type === "dashboard") return "Reporte Ejecutivo";
    if (type === "ventas") return "Reporte de Ventas";
    if (type === "productos") return "Reporte de Productos Vendidos";
    if (type === "clientes") return "Reporte de Clientes";
    if (type === "inventario") return "Reporte de Inventario";
    if (type === "finanzas") return "Reporte Financiero";
    if (type === "alertas") return "Reporte de Alertas";
    return "Reporte de Movimientos";
  }

  function getReportSubtitle(type: ActiveTab) {
    if (type === "dashboard") return "Resumen ejecutivo de ventas, utilidad, ITBIS e inventario";
    if (type === "ventas") return "Ventas, ITBIS, utilidad, costos, márgenes y facturación";
    if (type === "productos") return "Productos vendidos por cantidad, total, utilidad y margen";
    if (type === "clientes") return "Clientes principales por compras, ticket y utilidad";
    if (type === "inventario") return "Stock, precios, costos y valor de inventario";
    if (type === "finanzas") return "Ingresos, costos, utilidad, margen y ticket promedio";
    if (type === "alertas") return "Alertas de stock, precio, costo y control de inventario";
    return "Entradas, salidas, ventas y ajustes de inventario";
  }

  function getReportRowsForPDF(type: ActiveTab) {
    if (type === "ventas" || type === "dashboard" || type === "finanzas") {
      return {
        head: [["Fecha", "Factura", "Cliente", "Teléfono", "Subtotal", "ITBIS", "Total", "Costo", "Ganancia", "Margen"]],
        body: filteredSales.map((s) => {
          const total = toNumber(s.total);
          const profit = calculateSaleProfit(s);
          const cost = calculateSaleCost(s);

          return [
            formatDate(s.created_at),
            s.invoice_number || "",
            s.client_name || "",
            s.client_phone || "",
            money(toNumber(s.subtotal)),
            money(toNumber(s.tax)),
            money(total),
            money(cost),
            money(profit),
            percent(total > 0 ? (profit / total) * 100 : 0),
          ];
        }),
      };
    }

    if (type === "productos") {
      return {
        head: [["Producto", "Cantidad", "Total", "Ganancia", "Promedio", "Margen"]],
        body: topProducts.map((p) => [
          p.product_name,
          p.quantity,
          money(p.total),
          money(p.profit),
          money(p.avgPrice),
          percent(p.margin),
        ]),
      };
    }

    if (type === "clientes") {
      return {
        head: [["Cliente", "Teléfono", "Facturas", "Total", "Ganancia", "Ticket", "Margen"]],
        body: topClients.map((c) => [
          c.client_name,
          c.client_phone,
          c.invoices,
          money(c.total),
          money(c.profit),
          money(c.avgTicket),
          percent(c.margin),
        ]),
      };
    }

    if (type === "inventario") {
      return {
        head: [["Producto", "Categoría", "Stock", "Precio", "Costo", "Valor Venta", "Valor Costo", "Estado"]],
        body: filteredProducts.map((p) => {
          const stock = getProductStock(p);
          const price = getProductPrice(p);
          const cost = getProductCost(p);

          return [
            getProductName(p),
            p.category || "General",
            stock,
            money(price),
            money(cost),
            money(stock * price),
            money(stock * cost),
            stock <= 2 ? "Stock bajo" : price <= 0 ? "Sin precio" : cost <= 0 ? "Sin costo" : "OK",
          ];
        }),
      };
    }

    if (type === "alertas") {
      return {
        head: [["Producto", "Categoría", "Stock", "Precio", "Costo", "Alerta", "Severidad"]],
        body: inventoryAlerts.map((a) => [
          a.product_name,
          a.category,
          a.stock,
          money(a.price),
          money(a.cost),
          a.alert,
          a.severity,
        ]),
      };
    }

    return {
      head: [["Fecha", "Producto", "Tipo", "Cantidad", "Antes", "Después", "Referencia"]],
      body: filteredMovements.map((m) => [
        formatDateTime(m.created_at),
        m.product_name || "",
        m.movement_type || "",
        toNumber(m.quantity),
        toNumber(m.stock_before),
        toNumber(m.stock_after),
        m.reference || "",
      ]),
    };
  }

  function exportPDF(type: ActiveTab) {
    const doc = new jsPDF("landscape", "mm", "letter");
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.text("RD WOOD SYSTEM", 14, 11);
    doc.setFontSize(9);
    doc.text("Maestro de Reportes Empresarial TOTAL", 14, 19);
    doc.text(`Periodo: ${fromDate} a ${toDate}`, pageWidth - 85, 11);
    doc.text(`Generado: ${formatDateTime(new Date().toISOString())}`, pageWidth - 85, 19);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.text(getReportTitle(type), 14, 38);

    doc.setFontSize(9);
    doc.text(`Ventas: ${money(financeSummary.total)}`, 14, 46);
    doc.text(`Ganancia: ${money(financeSummary.profit)}`, 65, 46);
    doc.text(`ITBIS: ${money(financeSummary.tax)}`, 125, 46);
    doc.text(`Facturas: ${financeSummary.invoices}`, 175, 46);
    doc.text(`Margen: ${percent(financeSummary.margin)}`, 215, 46);

    const { head, body } = getReportRowsForPDF(type);

    autoTable(doc, {
      startY: 54,
      head,
      body,
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 10, right: 10 },
    });

    doc.save(`${safeFileName(getReportTitle(type))}_${fromDate}_${toDate}.pdf`);
  }

  function getReportTableHTML(type: ActiveTab) {
    const { head, body } = getReportRowsForPDF(type);

    return `
      <table>
        <thead>
          ${head.map((row) => `<tr>${row.map((cell) => `<th>${cell}</th>`).join("")}</tr>`).join("")}
        </thead>
        <tbody>
          ${body.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    `;
  }

  function buildPrintHTML(type: ActiveTab) {
    return `
      <html>
        <head>
          <title>${getReportTitle(type)}</title>
          <style>
            @page { size: letter landscape; margin: 10mm; }
            body { font-family: Arial, Helvetica, sans-serif; padding: 28px; color: #0f172a; }
            .header { border-bottom: 3px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start; }
            .brand h1 { margin: 0; font-size: 24px; letter-spacing: 1px; }
            .brand p { margin: 4px 0 0 0; color: #475569; font-size: 12px; }
            .meta { text-align: right; font-size: 12px; color: #475569; }
            .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 18px 0; }
            .box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; }
            .box span { font-size: 11px; color: #64748b; }
            .box strong { display: block; margin-top: 4px; font-size: 15px; }
            table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
            th { background: #f1f5f9; color: #334155; text-align: left; }
            th, td { border: 1px solid #cbd5e1; padding: 6px; }
            .footer { margin-top: 22px; font-size: 11px; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 10px; }
            @media print { body { padding: 18px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">
              <h1>RD WOOD SYSTEM</h1>
              <p>ERP Empresarial | Santana Group / RD Wood Design</p>
              <p>${getReportSubtitle(type)}</p>
            </div>
            <div class="meta">
              <strong>${getReportTitle(type)}</strong><br/>
              Periodo: ${fromDate} a ${toDate}<br/>
              Fecha impresión: ${formatDateTime(new Date().toISOString())}
            </div>
          </div>

          <div class="summary">
            <div class="box"><span>Ventas</span><strong>${money(financeSummary.total)}</strong></div>
            <div class="box"><span>Ganancia</span><strong>${money(financeSummary.profit)}</strong></div>
            <div class="box"><span>ITBIS</span><strong>${money(financeSummary.tax)}</strong></div>
            <div class="box"><span>Facturas</span><strong>${financeSummary.invoices}</strong></div>
            <div class="box"><span>Margen</span><strong>${percent(financeSummary.margin)}</strong></div>
          </div>

          ${getReportTableHTML(type)}

          <div class="footer">
            Reporte generado por RD Wood System. WhatsApp: +1 (809) 690-5636.
          </div>
        </body>
      </html>
    `;
  }

  function printReport(type: ActiveTab) {
    const win = window.open("", "_blank", "width=1200,height=850");
    if (!win) return;

    win.document.write(buildPrintHTML(type));
    win.document.close();
    win.focus();
    win.print();
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-600">
            RD WOOD SYSTEM
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">
            Maestro de Reportes Empresarial TOTAL
          </h1>
          <p className="text-sm text-slate-500">
            Dashboard, ventas, productos, clientes, inventario, movimientos, finanzas, alertas, PDF, Excel, CSV e impresión.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => printReport(activeTab)}
            className="flex items-center gap-2 rounded-2xl border bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <Printer size={18} />
            Imprimir
          </button>

          <button
            onClick={() => exportPDF(activeTab)}
            className="flex items-center gap-2 rounded-2xl border bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <Download size={18} />
            PDF
          </button>

          <button
            onClick={exportExcel}
            className="flex items-center gap-2 rounded-2xl border bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet size={18} />
            Excel
          </button>

          <button
            onClick={exportActiveCSV}
            className="flex items-center gap-2 rounded-2xl border bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <Download size={18} />
            CSV
          </button>

          <button
            onClick={clearFilters}
            className="flex items-center gap-2 rounded-2xl border bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <XCircle size={18} />
            Limpiar
          </button>

          <button
            onClick={loadReports}
            disabled={loading}
            className="flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCcw size={18} />
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex items-center gap-2">
          <Filter size={18} className="text-blue-600" />
          <h2 className="text-lg font-black text-slate-900">Filtros Gerenciales</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
              Búsqueda general
            </label>
            <div className="flex items-center gap-3 rounded-2xl border px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Factura, cliente, teléfono, producto, vendedor..."
                className="w-full outline-none"
              />
            </div>
          </div>

          <DateInput
            label="Desde"
            value={fromDate}
            onChange={(value) => {
              setQuickRange("custom");
              setFromDate(value);
            }}
          />

          <DateInput
            label="Hasta"
            value={toDate}
            onChange={(value) => {
              setQuickRange("custom");
              setToDate(value);
            }}
          />

          <SelectBox
            label="Rango rápido"
            value={quickRange}
            onChange={applyQuickRange}
            options={[
              ["today", "Hoy"],
              ["7days", "Últimos 7 días"],
              ["30days", "Últimos 30 días"],
              ["month", "Este mes"],
              ["year", "Este año"],
              ["custom", "Personalizado"],
            ]}
          />

          <SelectBox
            label="Inventario"
            value={stockFilter}
            onChange={setStockFilter}
            options={[
              ["todos", "Todos"],
              ["bajo", "Stock bajo"],
              ["sinprecio", "Sin precio"],
              ["sincosto", "Sin costo"],
              ["negativo", "Stock negativo"],
              ["ok", "Solo OK"],
            ]}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <SelectBox
            label="Pago / Estado"
            value={paymentFilter}
            onChange={setPaymentFilter}
            options={[
              ["todos", "Todos"],
              ["pagada", "Pagada"],
              ["pendiente", "Pendiente"],
              ["contado", "Contado"],
              ["credito", "Crédito"],
              ["transferencia", "Transferencia"],
              ["efectivo", "Efectivo"],
            ]}
          />

          <SelectBox
            label="Movimientos"
            value={movementType}
            onChange={setMovementType}
            options={[
              ["todos", "Todos"],
              ["entrada", "Entrada"],
              ["salida", "Salida"],
              ["venta", "Venta"],
              ["ajuste", "Ajuste"],
              ["compra", "Compra"],
            ]}
          />

          <div className="rounded-2xl border bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase text-slate-500">Periodo activo</p>
            <p className="mt-1 font-black text-slate-900">
              {fromDate} → {toDate}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Kpi title="Ventas" value={money(financeSummary.total)} detail={`${financeSummary.invoices} facturas`} icon={<FileText />} tone="blue" />
        <Kpi title="Ganancia" value={money(financeSummary.profit)} detail={`Margen ${percent(financeSummary.margin)}`} icon={<TrendingUp />} tone="green" />
        <Kpi title="Costo" value={money(financeSummary.cost)} detail="Costo estimado" icon={<TrendingDown />} tone="orange" />
        <Kpi title="Ticket Promedio" value={money(financeSummary.avgTicket)} detail="Promedio por factura" icon={<BarChart3 />} tone="purple" />
        <Kpi title="Inventario Venta" value={money(inventorySaleValue)} detail={`${products.length} productos`} icon={<Warehouse />} tone="slate" />
        <Kpi title="Alertas" value={String(inventoryAlerts.length)} detail="Stock/precio/costo" icon={<AlertTriangle />} tone="red" />
      </div>

      <div className="rounded-3xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          <Tab active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} text="Dashboard" />
          <Tab active={activeTab === "ventas"} onClick={() => setActiveTab("ventas")} text="Ventas" />
          <Tab active={activeTab === "productos"} onClick={() => setActiveTab("productos")} text="Productos" />
          <Tab active={activeTab === "clientes"} onClick={() => setActiveTab("clientes")} text="Clientes" />
          <Tab active={activeTab === "inventario"} onClick={() => setActiveTab("inventario")} text="Inventario" />
          <Tab active={activeTab === "movimientos"} onClick={() => setActiveTab("movimientos")} text="Movimientos" />
          <Tab active={activeTab === "finanzas"} onClick={() => setActiveTab("finanzas")} text="Finanzas" />
          <Tab active={activeTab === "alertas"} onClick={() => setActiveTab("alertas")} text="Alertas" />
        </div>
      </div>

      {activeTab === "dashboard" && (
        <DashboardTab
          salesByDay={salesByDay}
          topProducts={topProducts}
          topClients={topClients}
          categoriesSummary={categoriesSummary}
          financeSummary={financeSummary}
          pieData={pieData}
          inventorySaleValue={inventorySaleValue}
          inventoryCostValue={inventoryCostValue}
          inventoryPotentialProfit={inventoryPotentialProfit}
          lowStockCount={lowStockProducts.length}
          noPriceCount={noPriceProducts.length}
          noCostCount={noCostProducts.length}
          negativeStockCount={negativeStockProducts.length}
        />
      )}

      {activeTab === "ventas" && (
        <SalesTab
          filteredSales={filteredSales}
          calculateSaleProfit={calculateSaleProfit}
          calculateSaleCost={calculateSaleCost}
        />
      )}

      {activeTab === "productos" && <ProductsTab topProducts={topProducts} />}

      {activeTab === "clientes" && <ClientsTab topClients={topClients} />}

      {activeTab === "inventario" && (
        <InventoryTab
          filteredProducts={filteredProducts}
          categoriesSummary={categoriesSummary}
        />
      )}

      {activeTab === "movimientos" && <MovementsTab filteredMovements={filteredMovements} />}

      {activeTab === "finanzas" && (
        <FinanceTab
          financeSummary={financeSummary}
          salesByDay={salesByDay}
          inventorySaleValue={inventorySaleValue}
          inventoryCostValue={inventoryCostValue}
          inventoryPotentialProfit={inventoryPotentialProfit}
          topClients={topClients}
          topProducts={topProducts}
        />
      )}

      {activeTab === "alertas" && <AlertsTab alerts={inventoryAlerts} />}
    </div>
  );
}

/* =========================================================
   TABS
========================================================= */

function DashboardTab({
  salesByDay,
  topProducts,
  topClients,
  categoriesSummary,
  financeSummary,
  pieData,
  inventorySaleValue,
  inventoryCostValue,
  inventoryPotentialProfit,
  lowStockCount,
  noPriceCount,
  noCostCount,
  negativeStockCount,
}: {
  salesByDay: DailySummary[];
  topProducts: ProductSummary[];
  topClients: ClientSummary[];
  categoriesSummary: CategorySummary[];
  financeSummary: FinanceSummary;
  pieData: { name: string; value: number }[];
  inventorySaleValue: number;
  inventoryCostValue: number;
  inventoryPotentialProfit: number;
  lowStockCount: number;
  noPriceCount: number;
  noCostCount: number;
  negativeStockCount: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Panel title="Ventas vs Ganancia" subtitle="Gráfica ejecutiva por día" className="xl:col-span-2">
        <div className="h-[330px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value: any) => money(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="total" name="Ventas" strokeWidth={3} />
              <Line type="monotone" dataKey="profit" name="Ganancia" strokeWidth={3} />
              <Line type="monotone" dataKey="tax" name="ITBIS" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Resumen Ejecutivo" subtitle="Lectura rápida del negocio">
        <div className="space-y-3">
          <InfoRow title="Subtotal" value={money(financeSummary.subtotal)} />
          <InfoRow title="ITBIS" value={money(financeSummary.tax)} />
          <InfoRow title="Ventas total" value={money(financeSummary.total)} />
          <InfoRow title="Costo" value={money(financeSummary.cost)} />
          <InfoRow title="Ganancia" value={money(financeSummary.profit)} />
          <InfoRow title="Margen" value={percent(financeSummary.margin)} />
          <InfoRow title="Ticket promedio" value={money(financeSummary.avgTicket)} />
        </div>
      </Panel>

      <Panel title="Top Productos" subtitle="Productos con mayor venta" className="xl:col-span-2">
        <div className="h-[330px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProducts.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="product_name" />
              <YAxis />
              <Tooltip formatter={(value: any) => money(Number(value))} />
              <Legend />
              <Bar dataKey="total" name="Venta" />
              <Bar dataKey="profit" name="Ganancia" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Distribución Financiera" subtitle="Ventas, ganancia e ITBIS">
        <div className="h-[330px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110} label>
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => money(Number(value))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Top Clientes" subtitle="Clientes principales por ventas">
        <div className="space-y-3">
          {topClients.slice(0, 6).map((c, index) => (
            <RankingRow
              key={c.client_key}
              index={index}
              title={c.client_name}
              subtitle={`${c.invoices} facturas · ${percent(c.margin)} margen`}
              value={money(c.total)}
            />
          ))}
          {topClients.length === 0 && <Empty text="No hay clientes en este periodo." />}
        </div>
      </Panel>

      <Panel title="Inventario Ejecutivo" subtitle="Valorización y potencial">
        <div className="space-y-3">
          <InfoRow title="Valor venta" value={money(inventorySaleValue)} />
          <InfoRow title="Valor costo" value={money(inventoryCostValue)} />
          <InfoRow title="Ganancia potencial" value={money(inventoryPotentialProfit)} />
          <InfoRow title="Categorías" value={String(categoriesSummary.length)} />
        </div>
      </Panel>

      <Panel title="Alertas críticas" subtitle="Control operativo">
        <div className="space-y-3">
          <AlertCard title="Stock negativo" value={negativeStockCount} color="red" />
          <AlertCard title="Stock bajo" value={lowStockCount} color="orange" />
          <AlertCard title="Sin precio" value={noPriceCount} color="red" />
          <AlertCard title="Sin costo" value={noCostCount} color="blue" />
        </div>
      </Panel>
    </div>
  );
}

function SalesTab({
  filteredSales,
  calculateSaleProfit,
  calculateSaleCost,
}: {
  filteredSales: Sale[];
  calculateSaleProfit: (sale: Sale) => number;
  calculateSaleCost: (sale: Sale) => number;
}) {
  return (
    <Panel title="Reporte Detallado de Ventas" subtitle="Facturación filtrada por fecha, cliente, teléfono, vendedor o estado">
      <DataTable>
        <thead className="bg-slate-50">
          <tr className="border-b text-left text-slate-500">
            <Th>Fecha</Th>
            <Th>Factura</Th>
            <Th>Cliente</Th>
            <Th>Teléfono</Th>
            <Th>Subtotal</Th>
            <Th>ITBIS</Th>
            <Th>Total</Th>
            <Th>Costo</Th>
            <Th>Ganancia</Th>
            <Th>Margen</Th>
            <Th>Pago</Th>
            <Th>Estado</Th>
          </tr>
        </thead>
        <tbody>
          {filteredSales.map((sale) => {
            const profit = calculateSaleProfit(sale);
            const cost = calculateSaleCost(sale);
            const total = toNumber(sale.total);
            const rowMargin = total > 0 ? (profit / total) * 100 : 0;

            return (
              <tr key={sale.id} className="border-b hover:bg-slate-50">
                <Td>{formatDate(sale.created_at)}</Td>
                <Td strong>{sale.invoice_number || "Sin número"}</Td>
                <Td>{sale.client_name || "Cliente general"}</Td>
                <Td>{sale.client_phone || "N/A"}</Td>
                <Td>{money(toNumber(sale.subtotal))}</Td>
                <Td>{money(toNumber(sale.tax))}</Td>
                <Td strong>{money(total)}</Td>
                <Td>{money(cost)}</Td>
                <Td green>{money(profit)}</Td>
                <Td>{percent(rowMargin)}</Td>
                <Td>{sale.payment_method || sale.payment_status || "N/A"}</Td>
                <Td>{sale.status || "emitida"}</Td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
      {filteredSales.length === 0 && <Empty text="No hay ventas para estos filtros." />}
    </Panel>
  );
}

function ProductsTab({ topProducts }: { topProducts: ProductSummary[] }) {
  return (
    <Panel title="Reporte de Productos Vendidos" subtitle="Productos vendidos en el periodo seleccionado con rentabilidad">
      <DataTable>
        <thead className="bg-slate-50">
          <tr className="border-b text-left text-slate-500">
            <Th>#</Th>
            <Th>Producto</Th>
            <Th>Cantidad</Th>
            <Th>Total vendido</Th>
            <Th>Ganancia</Th>
            <Th>Precio promedio</Th>
            <Th>Margen</Th>
          </tr>
        </thead>
        <tbody>
          {topProducts.map((p, index) => (
            <tr key={p.product_id} className="border-b hover:bg-slate-50">
              <Td strong>{index + 1}</Td>
              <Td strong>{p.product_name}</Td>
              <Td>{p.quantity}</Td>
              <Td strong>{money(p.total)}</Td>
              <Td green>{money(p.profit)}</Td>
              <Td>{money(p.avgPrice)}</Td>
              <Td>{percent(p.margin)}</Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {topProducts.length === 0 && <Empty text="No hay productos vendidos para estos filtros." />}
    </Panel>
  );
}

function ClientsTab({ topClients }: { topClients: ClientSummary[] }) {
  return (
    <Panel title="Reporte de Clientes" subtitle="Ranking de clientes por ventas, ticket y utilidad">
      <DataTable>
        <thead className="bg-slate-50">
          <tr className="border-b text-left text-slate-500">
            <Th>#</Th>
            <Th>Cliente</Th>
            <Th>Teléfono</Th>
            <Th>Facturas</Th>
            <Th>Total comprado</Th>
            <Th>Ganancia</Th>
            <Th>Ticket promedio</Th>
            <Th>Margen</Th>
          </tr>
        </thead>
        <tbody>
          {topClients.map((client, index) => (
            <tr key={client.client_key} className="border-b hover:bg-slate-50">
              <Td strong>{index + 1}</Td>
              <Td strong>{client.client_name}</Td>
              <Td>{client.client_phone}</Td>
              <Td>{client.invoices}</Td>
              <Td strong>{money(client.total)}</Td>
              <Td green>{money(client.profit)}</Td>
              <Td>{money(client.avgTicket)}</Td>
              <Td>{percent(client.margin)}</Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {topClients.length === 0 && <Empty text="No hay clientes para estos filtros." />}
    </Panel>
  );
}

function InventoryTab({
  filteredProducts,
  categoriesSummary,
}: {
  filteredProducts: Product[];
  categoriesSummary: CategorySummary[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Panel title="Reporte de Inventario" subtitle="Stock, valor, precio, costo y alertas" className="xl:col-span-2">
        <DataTable>
          <thead className="bg-slate-50">
            <tr className="border-b text-left text-slate-500">
              <Th>Producto</Th>
              <Th>Categoría</Th>
              <Th>Subcategoría</Th>
              <Th>Stock</Th>
              <Th>Precio</Th>
              <Th>Costo</Th>
              <Th>Valor Venta</Th>
              <Th>Valor Costo</Th>
              <Th>Ganancia Potencial</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => {
              const stock = getProductStock(p);
              const price = getProductPrice(p);
              const cost = getProductCost(p);

              return (
                <tr key={p.id} className="border-b hover:bg-slate-50">
                  <Td strong>{getProductName(p)}</Td>
                  <Td>{p.category || "General"}</Td>
                  <Td>{p.subcategory || "N/A"}</Td>
                  <Td>{stock}</Td>
                  <Td>{money(price)}</Td>
                  <Td>{money(cost)}</Td>
                  <Td strong>{money(stock * price)}</Td>
                  <Td>{money(stock * cost)}</Td>
                  <Td green>{money(stock * price - stock * cost)}</Td>
                  <Td>{stock <= 2 ? "Stock bajo" : price <= 0 ? "Sin precio" : cost <= 0 ? "Sin costo" : "OK"}</Td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
        {filteredProducts.length === 0 && <Empty text="No hay productos para estos filtros." />}
      </Panel>

      <Panel title="Inventario por Categoría" subtitle="Valorización agrupada">
        <div className="space-y-3">
          {categoriesSummary.map((c) => (
            <div key={c.category} className="rounded-2xl border p-4">
              <div className="flex items-center justify-between">
                <strong>{c.category}</strong>
                <span className="text-sm text-slate-500">{c.products} productos</span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <InfoRow title="Stock" value={String(c.stock)} />
                <InfoRow title="Valor venta" value={money(c.saleValue)} />
                <InfoRow title="Valor costo" value={money(c.costValue)} />
                <InfoRow title="Potencial" value={money(c.potentialProfit)} />
              </div>
            </div>
          ))}
          {categoriesSummary.length === 0 && <Empty text="No hay categorías." />}
        </div>
      </Panel>
    </div>
  );
}

function MovementsTab({ filteredMovements }: { filteredMovements: Movement[] }) {
  return (
    <Panel title="Reporte de Movimientos" subtitle="Entradas, salidas, ventas y ajustes de inventario">
      <DataTable>
        <thead className="bg-slate-50">
          <tr className="border-b text-left text-slate-500">
            <Th>Fecha</Th>
            <Th>Producto</Th>
            <Th>Tipo</Th>
            <Th>Cantidad</Th>
            <Th>Stock antes</Th>
            <Th>Stock después</Th>
            <Th>Referencia</Th>
            <Th>Usuario</Th>
          </tr>
        </thead>
        <tbody>
          {filteredMovements.map((m) => (
            <tr key={m.id} className="border-b hover:bg-slate-50">
              <Td>{formatDateTime(m.created_at)}</Td>
              <Td strong>{m.product_name || "Producto"}</Td>
              <Td>{m.movement_type || "MOV"}</Td>
              <Td>{toNumber(m.quantity)}</Td>
              <Td>{toNumber(m.stock_before)}</Td>
              <Td>{toNumber(m.stock_after)}</Td>
              <Td>{m.reference || "N/A"}</Td>
              <Td>{m.user_name || "N/A"}</Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {filteredMovements.length === 0 && <Empty text="No hay movimientos para estos filtros." />}
    </Panel>
  );
}

function FinanceTab({
  financeSummary,
  salesByDay,
  inventorySaleValue,
  inventoryCostValue,
  inventoryPotentialProfit,
  topClients,
  topProducts,
}: {
  financeSummary: FinanceSummary;
  salesByDay: DailySummary[];
  inventorySaleValue: number;
  inventoryCostValue: number;
  inventoryPotentialProfit: number;
  topClients: ClientSummary[];
  topProducts: ProductSummary[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Panel title="Estado de Resultados" subtitle="Ingresos, costos y utilidad" className="xl:col-span-1">
        <div className="space-y-3">
          <InfoRow title="Ingresos brutos" value={money(financeSummary.total)} />
          <InfoRow title="Subtotal" value={money(financeSummary.subtotal)} />
          <InfoRow title="ITBIS" value={money(financeSummary.tax)} />
          <InfoRow title="Costo estimado" value={money(financeSummary.cost)} />
          <InfoRow title="Utilidad bruta" value={money(financeSummary.profit)} />
          <InfoRow title="Margen bruto" value={percent(financeSummary.margin)} />
          <InfoRow title="Facturas" value={String(financeSummary.invoices)} />
          <InfoRow title="Ticket promedio" value={money(financeSummary.avgTicket)} />
        </div>
      </Panel>

      <Panel title="Tendencia Financiera" subtitle="Ventas y utilidad por día" className="xl:col-span-2">
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value: any) => money(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="total" name="Ventas" strokeWidth={3} />
              <Line type="monotone" dataKey="profit" name="Ganancia" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Inventario Financiero" subtitle="Valor económico del almacén">
        <div className="space-y-3">
          <InfoRow title="Inventario a venta" value={money(inventorySaleValue)} />
          <InfoRow title="Inventario a costo" value={money(inventoryCostValue)} />
          <InfoRow title="Ganancia potencial" value={money(inventoryPotentialProfit)} />
        </div>
      </Panel>

      <Panel title="Clientes Rentables" subtitle="Top clientes por utilidad">
        <div className="space-y-3">
          {topClients.slice(0, 8).map((c, index) => (
            <RankingRow
              key={c.client_key}
              index={index}
              title={c.client_name}
              subtitle={`${c.invoices} facturas · margen ${percent(c.margin)}`}
              value={money(c.profit)}
            />
          ))}
        </div>
      </Panel>

      <Panel title="Productos Rentables" subtitle="Top productos por utilidad">
        <div className="space-y-3">
          {topProducts.slice(0, 8).map((p, index) => (
            <RankingRow
              key={p.product_id}
              index={index}
              title={p.product_name}
              subtitle={`${p.quantity} vendidos · margen ${percent(p.margin)}`}
              value={money(p.profit)}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AlertsTab({ alerts }: { alerts: InventoryAlert[] }) {
  return (
    <Panel title="Centro de Alertas" subtitle="Problemas críticos del inventario y datos maestros">
      <DataTable>
        <thead className="bg-slate-50">
          <tr className="border-b text-left text-slate-500">
            <Th>Severidad</Th>
            <Th>Producto</Th>
            <Th>Categoría</Th>
            <Th>Stock</Th>
            <Th>Precio</Th>
            <Th>Costo</Th>
            <Th>Alerta</Th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <tr key={alert.id} className="border-b hover:bg-slate-50">
              <Td>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    alert.severity === "alta"
                      ? "bg-red-50 text-red-700"
                      : alert.severity === "media"
                      ? "bg-orange-50 text-orange-700"
                      : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {alert.severity.toUpperCase()}
                </span>
              </Td>
              <Td strong>{alert.product_name}</Td>
              <Td>{alert.category}</Td>
              <Td>{alert.stock}</Td>
              <Td>{money(alert.price)}</Td>
              <Td>{money(alert.cost)}</Td>
              <Td>{alert.alert}</Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {alerts.length === 0 && <Empty text="No hay alertas críticas." />}
    </Panel>
  );
}

/* =========================================================
   COMPONENTES UI
========================================================= */

function DateInput({
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
      <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border px-4 py-3 outline-none"
      />
    </div>
  );
}

function SelectBox({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-2xl border px-4 py-3 outline-none"
        >
          {options.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          className="pointer-events-none absolute right-4 top-3.5 text-slate-400"
        />
      </div>
    </div>
  );
}

function Kpi({
  title,
  value,
  detail,
  icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: "blue" | "green" | "orange" | "purple" | "slate" | "red";
}) {
  const tones = {
    blue: "bg-blue-600",
    green: "bg-emerald-600",
    orange: "bg-orange-500",
    purple: "bg-purple-600",
    slate: "bg-slate-900",
    red: "bg-red-600",
  };

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-4">
        <div className={`rounded-2xl p-3 text-white ${tones[tone]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <h2 className="truncate text-2xl font-black text-slate-900">
            {value}
          </h2>
          <p className="text-xs text-slate-400">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  text,
}: {
  active: boolean;
  onClick: () => void;
  text: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
        active
          ? "bg-slate-900 text-white shadow"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {text}
    </button>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
  action,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${className}`}
    >
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border p-4">
      <span className="font-bold text-slate-700">{title}</span>
      <strong className="text-slate-900">{value}</strong>
    </div>
  );
}

function AlertCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: "red" | "orange" | "blue";
}) {
  const styles = {
    red: "border-red-200 bg-red-50 text-red-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <div className={`rounded-2xl border p-4 ${styles[color]}`}>
      <div className="flex items-center justify-between">
        <span className="font-bold">{title}</span>
        <strong className="text-2xl">{value}</strong>
      </div>
    </div>
  );
}

function RankingRow({
  index,
  title,
  subtitle,
  value,
}: {
  index: number;
  title: string;
  subtitle: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 font-black text-slate-600">
          {index + 1}
        </div>
        <div>
          <p className="font-bold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      <strong className="text-slate-900">{value}</strong>
    </div>
  );
}

function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-auto rounded-2xl border">
      <table className="w-full min-w-[1100px] text-sm">{children}</table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-black">{children}</th>;
}

function Td({
  children,
  strong,
  green,
}: {
  children: React.ReactNode;
  strong?: boolean;
  green?: boolean;
}) {
  return (
    <td
      className={`px-4 py-4 ${
        strong ? "font-black text-slate-900" : ""
      } ${green ? "font-black text-emerald-700" : ""}`}
    >
      {children}
    </td>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-12 text-center text-slate-400">{text}</div>;
}
