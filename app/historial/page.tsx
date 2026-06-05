"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Movement = {
  id: string;
  product_id: string | null;
  product_name: string | null;
  group_name: string | null;
  subgroup_name: string | null;
  movement_type: string | null;
  origin: string | null;
  quantity: number | null;
  unit: string | null;
  stock_before: number | null;
  stock_after: number | null;
  related_order: string | null;
  note: string | null;
  created_at: string;
};

export default function HistorialPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [openOrders, setOpenOrders] = useState<Record<string, boolean>>({});

  const [moduleFilter, setModuleFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [groupFilter, setGroupFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    loadMovements();
  }, []);

  async function loadMovements() {
    setLoading(true);

    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      alert("Error cargando historial: " + error.message);
      return;
    }

    setMovements(data || []);
  }

  function toggleOrder(order: string) {
    setOpenOrders((prev) => ({
      ...prev,
      [order]: !prev[order],
    }));
  }

  function getModuleLabel(origin: string | null) {
    const value = origin || "N/A";

    const labels: Record<string, string> = {
      produccion_receta: "Producción por receta",
      produccion_manual: "Producción manual",
      inventario_manual: "Inventario manual",
      compra: "Compra",
      venta: "Venta",
      ajuste: "Ajuste",
      merma: "Merma",
    };

    return labels[value] || value;
  }

  function getTypeBadge(type: string | null): React.CSSProperties {
    const value = (type || "").toLowerCase();

    if (value === "entrada") return entryBadge;
    if (value === "salida") return exitBadge;

    return neutralBadge;
  }

  function getModuleBadge(origin: string | null): React.CSSProperties {
    const value = origin || "";

    if (value.includes("produccion")) return productionBadge;
    if (value.includes("compra")) return purchaseBadge;
    if (value.includes("inventario")) return inventoryBadge;
    if (value.includes("venta")) return saleBadge;
    if (value.includes("merma")) return wasteBadge;

    return moduleBadge;
  }

  const modules = useMemo(() => {
    return Array.from(
      new Set(movements.map((m) => m.origin).filter(Boolean) as string[])
    );
  }, [movements]);

  const groups = useMemo(() => {
    return Array.from(
      new Set(movements.map((m) => m.group_name).filter(Boolean) as string[])
    );
  }, [movements]);

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const text = `${m.product_name || ""} ${m.group_name || ""} ${
        m.subgroup_name || ""
      } ${m.origin || ""} ${m.related_order || ""} ${
        m.note || ""
      }`.toLowerCase();

      const createdDate = new Date(m.created_at);

      return (
        text.includes(search.toLowerCase()) &&
        (moduleFilter === "todos" || m.origin === moduleFilter) &&
        (typeFilter === "todos" || m.movement_type === typeFilter) &&
        (groupFilter === "todos" || m.group_name === groupFilter) &&
        (dateFrom ? createdDate >= new Date(dateFrom + "T00:00:00") : true) &&
        (dateTo ? createdDate <= new Date(dateTo + "T23:59:59") : true)
      );
    });
  }, [
    movements,
    search,
    moduleFilter,
    typeFilter,
    groupFilter,
    dateFrom,
    dateTo,
  ]);

  const groupedByOrder = useMemo(() => {
    const groupsMap: Record<
      string,
      {
        order: string;
        items: Movement[];
        totalQuantity: number;
        module: string;
        lastDate: string;
        hasError: boolean;
      }
    > = {};

    filteredMovements.forEach((m) => {
      const key = m.related_order || "SIN ORDEN";

      if (!groupsMap[key]) {
        groupsMap[key] = {
          order: key,
          items: [],
          totalQuantity: 0,
          module: m.origin || "N/A",
          lastDate: m.created_at,
          hasError: false,
        };
      }

      groupsMap[key].items.push(m);
      groupsMap[key].totalQuantity += Number(m.quantity || 0);

      if (Number(m.stock_after || 0) < 0) {
        groupsMap[key].hasError = true;
      }

      if (new Date(m.created_at) > new Date(groupsMap[key].lastDate)) {
        groupsMap[key].lastDate = m.created_at;
      }
    });

    return Object.values(groupsMap).sort(
      (a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
    );
  }, [filteredMovements]);

  const resumenMaterial = useMemo(() => {
    const map: Record<string, { qty: number; unit: string }> = {};

    filteredMovements.forEach((m) => {
      const key = m.product_name || "N/A";

      if (!map[key]) {
        map[key] = {
          qty: 0,
          unit: m.unit || "",
        };
      }

      map[key].qty += Number(m.quantity || 0);
    });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        qty: data.qty,
        unit: data.unit,
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [filteredMovements]);

  const criticalStockErrors = filteredMovements.filter(
    (m) => Number(m.stock_after || 0) < 0
  ).length;

  const totalEntradas = filteredMovements
    .filter((m) => m.movement_type?.toLowerCase() === "entrada")
    .reduce((sum, m) => sum + Number(m.quantity || 0), 0);

  const totalSalidas = filteredMovements
    .filter((m) => m.movement_type?.toLowerCase() === "salida")
    .reduce((sum, m) => sum + Number(m.quantity || 0), 0);

  function clearFilters() {
    setModuleFilter("todos");
    setTypeFilter("todos");
    setGroupFilter("todos");
    setSearch("");
    setDateFrom("");
    setDateTo("");
  }

  function openAllOrders() {
    const next: Record<string, boolean> = {};
    groupedByOrder.forEach((g) => {
      next[g.order] = true;
    });
    setOpenOrders(next);
  }

  function closeAllOrders() {
    setOpenOrders({});
  }

  return (
    <main style={pageStyle}>
      <section style={headerCard}>
        <div>
          <p style={smallText}>RD Wood System</p>
          <h1 style={titleStyle}>Historial de Movimientos</h1>
          <p style={mutedText}>
            Auditoría profesional por módulo, orden, tipo, grupo, fecha y
            material.
          </p>
        </div>

        <button onClick={loadMovements} style={buttonStyle}>
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </section>

      <section style={filtersCard}>
        <div style={filtersGrid}>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            style={inputStyle}
          >
            <option value="todos">Todos los módulos</option>
            {modules.map((module) => (
              <option key={module} value={module}>
                {getModuleLabel(module)}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={inputStyle}
          >
            <option value="todos">Todos los tipos</option>
            <option value="Entrada">Entrada</option>
            <option value="Salida">Salida</option>
          </select>

          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            style={inputStyle}
          >
            <option value="todos">Todos los grupos</option>
            {groups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Buscar material, orden, nota..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle}
          />

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={inputStyle}
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={filterActions}>
          <button onClick={openAllOrders} style={secondaryButtonStyle}>
            Abrir todo
          </button>

          <button onClick={closeAllOrders} style={secondaryButtonStyle}>
            Cerrar todo
          </button>

          <button onClick={clearFilters} style={secondaryButtonStyle}>
            Limpiar filtros
          </button>
        </div>
      </section>

      <section style={summaryGrid}>
        <div style={summaryCard}>
          <p style={mutedText}>Registros filtrados</p>
          <h2>{filteredMovements.length}</h2>
        </div>

        <div style={summaryCard}>
          <p style={mutedText}>Órdenes / grupos</p>
          <h2>{groupedByOrder.length}</h2>
        </div>

        <div style={summaryCard}>
          <p style={mutedText}>Total entradas</p>
          <h2>{totalEntradas.toLocaleString()}</h2>
        </div>

        <div style={summaryCard}>
          <p style={mutedText}>Total salidas</p>
          <h2>{totalSalidas.toLocaleString()}</h2>
        </div>

        <div style={criticalStockErrors > 0 ? dangerSummaryCard : summaryCard}>
          <p style={mutedText}>Errores stock negativo</p>
          <h2>{criticalStockErrors}</h2>
        </div>
      </section>

      <section style={tableCard}>
        <h2>Material más usado</h2>

        {resumenMaterial.length === 0 ? (
          <p style={mutedText}>No hay datos para mostrar.</p>
        ) : (
          <div style={materialGrid}>
            {resumenMaterial.map((r) => (
              <div key={r.name} style={materialCard}>
                <p style={mutedText}>{r.name}</p>
                <h3>
                  {r.qty.toLocaleString()} {r.unit}
                </h3>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={tableCard}>
        <div style={tableHeader}>
          <div>
            <h2 style={{ margin: 0 }}>Auditoría agrupada por orden</h2>
            <p style={mutedText}>
              Haz click sobre una orden para abrir o cerrar sus movimientos.
            </p>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Fecha</th>
                <th style={thStyle}>Módulo</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Grupo</th>
                <th style={thStyle}>Subgrupo</th>
                <th style={thStyle}>Artículo</th>
                <th style={thStyle}>Cantidad</th>
                <th style={thStyle}>Antes</th>
                <th style={thStyle}>Después</th>
                <th style={thStyle}>Orden</th>
                <th style={thStyle}>Nota</th>
              </tr>
            </thead>

            <tbody>
              {groupedByOrder.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={11}>
                    No hay movimientos para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                groupedByOrder.map((group) => {
                  const isOpen = !!openOrders[group.order];

                  return (
                    <React.Fragment key={`group-${group.order}`}>
                      <tr
                        style={{
                          ...groupRowStyle,
                          background: group.hasError ? "#fef2f2" : "#f1f5f9",
                          cursor: "pointer",
                        }}
                        onClick={() => toggleOrder(group.order)}
                      >
                        <td style={groupTdStyle} colSpan={11}>
                          <div style={groupHeader}>
                            <div>
                              <strong>
                                {isOpen ? "▼" : "▶"} Orden: {group.order}
                              </strong>
                              <br />
                              <span style={groupSubText}>
                                {getModuleLabel(group.module)}
                              </span>
                            </div>

                            <div style={{ textAlign: "right" }}>
                              <strong>{group.items.length}</strong> movimientos
                              <br />
                              <span style={groupSubText}>
                                Total cantidad:{" "}
                                {group.totalQuantity.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {isOpen &&
                        group.items.map((m) => {
                          const stockAfter = Number(m.stock_after || 0);
                          const hasStockError = stockAfter < 0;

                          return (
                            <tr
                              key={m.id}
                              style={hasStockError ? errorRowStyle : undefined}
                            >
                              <td style={tdStyle}>
                                {new Date(m.created_at).toLocaleString("es-DO")}
                              </td>

                              <td style={tdStyle}>
                                <span style={getModuleBadge(m.origin)}>
                                  {getModuleLabel(m.origin)}
                                </span>
                              </td>

                              <td style={tdStyle}>
                                <span style={getTypeBadge(m.movement_type)}>
                                  {m.movement_type || "N/A"}
                                </span>
                              </td>

                              <td style={tdStyle}>{m.group_name || "-"}</td>
                              <td style={tdStyle}>{m.subgroup_name || "-"}</td>
                              <td style={tdStyle}>
                                <strong>{m.product_name || "-"}</strong>
                              </td>
                              <td style={tdStyle}>
                                {Number(m.quantity || 0).toLocaleString()}{" "}
                                {m.unit || ""}
                              </td>
                              <td style={tdStyle}>
                                {Number(m.stock_before || 0)}
                              </td>
                              <td style={tdStyle}>
                                <strong
                                  style={{
                                    color: hasStockError
                                      ? "#b91c1c"
                                      : "#111827",
                                    fontWeight: 900,
                                  }}
                                >
                                  {stockAfter}
                                </strong>
                              </td>
                              <td style={tdStyle}>{m.related_order || "-"}</td>
                              <td style={tdStyle}>{m.note || "-"}</td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 24,
};

const headerCard: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 18,
  padding: 24,
  marginBottom: 20,
  background: "white",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
};

const filtersCard: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 18,
  padding: 20,
  marginBottom: 20,
  background: "white",
};

const filtersGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 12,
};

const filterActions: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 16,
  marginBottom: 20,
};

const summaryCard: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 16,
  padding: 20,
  background: "white",
};

const dangerSummaryCard: React.CSSProperties = {
  border: "1px solid #fecaca",
  borderRadius: 16,
  padding: 20,
  background: "#fef2f2",
};

const tableCard: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 18,
  padding: 24,
  background: "white",
  marginBottom: 20,
};

const tableHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const materialGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 12,
  marginTop: 16,
};

const materialCard: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 14,
  padding: 16,
  background: "#f8fafc",
};

const smallText: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
};

const titleStyle: React.CSSProperties = {
  margin: "4px 0",
  fontSize: 32,
};

const mutedText: React.CSSProperties = {
  margin: 0,
  color: "#666",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #ccc",
  borderRadius: 12,
  fontSize: 14,
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 18px",
  border: "none",
  borderRadius: 12,
  background: "#1f2937",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  border: "1px solid #ccc",
  borderRadius: 12,
  background: "white",
  color: "#111827",
  fontWeight: 700,
  cursor: "pointer",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
  marginTop: 16,
};

const thStyle: React.CSSProperties = {
  padding: 12,
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  background: "#f8fafc",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
  whiteSpace: "nowrap",
};

const groupRowStyle: React.CSSProperties = {
  background: "#f1f5f9",
};

const groupTdStyle: React.CSSProperties = {
  padding: 14,
  fontWeight: 800,
  borderTop: "2px solid #cbd5e1",
  borderBottom: "1px solid #cbd5e1",
  color: "#111827",
};

const groupHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
};

const groupSubText: React.CSSProperties = {
  fontSize: 12,
  color: "#475569",
};

const errorRowStyle: React.CSSProperties = {
  background: "#fef2f2",
};

const badgeBase: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
};

const moduleBadge: React.CSSProperties = {
  ...badgeBase,
  background: "#eef2ff",
  color: "#3730a3",
};

const productionBadge: React.CSSProperties = {
  ...badgeBase,
  background: "#e0f2fe",
  color: "#075985",
};

const purchaseBadge: React.CSSProperties = {
  ...badgeBase,
  background: "#dcfce7",
  color: "#166534",
};

const inventoryBadge: React.CSSProperties = {
  ...badgeBase,
  background: "#fef9c3",
  color: "#854d0e",
};

const saleBadge: React.CSSProperties = {
  ...badgeBase,
  background: "#fae8ff",
  color: "#86198f",
};

const wasteBadge: React.CSSProperties = {
  ...badgeBase,
  background: "#fee2e2",
  color: "#991b1b",
};

const entryBadge: React.CSSProperties = {
  ...badgeBase,
  background: "#dcfce7",
  color: "#166534",
};

const exitBadge: React.CSSProperties = {
  ...badgeBase,
  background: "#fee2e2",
  color: "#991b1b",
};

const neutralBadge: React.CSSProperties = {
  ...badgeBase,
  background: "#e5e7eb",
  color: "#374151",
};