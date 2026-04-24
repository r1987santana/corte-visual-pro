"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Module = "dashboard" | "inventario" | "produccion" | "historial" | "whatsapp";

type InventoryItem = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  stock: number;
  unit_cost: number | null;
  created_at?: string;
};

type Movement = {
  id: string;
  item_id: string | null;
  item_name: string;
  movement_type: string;
  quantity: number;
  stock_before: number;
  stock_after: number;
  related_order: string | null;
  material_used: string | null;
  notes: string | null;
  created_at: string;
};

export default function Home() {
  const [activeModule, setActiveModule] = useState<Module>("dashboard");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);

  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    unit: "unidad",
    stock: "",
    unit_cost: "",
  });

  const [production, setProduction] = useState({
    order: "",
    client: "",
    project: "",
    itemId: "",
    quantity: "",
    notes: "",
  });

  const [whatsapp, setWhatsapp] = useState({
    phone: "",
    message: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadInventory(), loadMovements()]);
    setLoading(false);
  }

  async function loadInventory() {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      alert("Error cargando inventario");
      console.error(error);
      return;
    }

    setInventory((data || []) as InventoryItem[]);
  }

  async function loadMovements() {
    const { data, error } = await supabase
      .from("inventory_movements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setMovements((data || []) as Movement[]);
  }

  const totalInventoryValue = useMemo(() => {
    return inventory.reduce((acc, item) => {
      return acc + Number(item.stock || 0) * Number(item.unit_cost || 0);
    }, 0);
  }, [inventory]);

  const lowStockItems = useMemo(() => {
    return inventory.filter((item) => Number(item.stock || 0) <= 5);
  }, [inventory]);

  async function addInventoryItem() {
    if (!newItem.name.trim()) {
      alert("Escribe el nombre del material");
      return;
    }

    const { error } = await supabase.from("inventory_items").insert({
      name: newItem.name.trim(),
      category: newItem.category.trim() || null,
      unit: newItem.unit || "unidad",
      stock: Number(newItem.stock || 0),
      unit_cost: Number(newItem.unit_cost || 0),
    });

    if (error) {
      alert("No se pudo agregar el material");
      console.error(error);
      return;
    }

    setNewItem({
      name: "",
      category: "",
      unit: "unidad",
      stock: "",
      unit_cost: "",
    });

    await loadData();
  }

  async function registerMovement(params: {
    itemId: string | null;
    itemName: string;
    movementType: "entrada" | "salida" | "ajuste" | "produccion";
    quantity: number;
    stockBefore: number;
    stockAfter: number;
    relatedOrder?: string;
    materialUsed?: string;
    notes?: string;
  }) {
    const { error } = await supabase.from("inventory_movements").insert({
      item_id: params.itemId,
      item_name: params.itemName,
      movement_type: params.movementType,
      quantity: params.quantity,
      stock_before: params.stockBefore,
      stock_after: params.stockAfter,
      related_order: params.relatedOrder || null,
      material_used: params.materialUsed || null,
      notes: params.notes || null,
    });

    if (error) {
      alert("No se pudo guardar el historial");
      console.error(error);
    }
  }

  async function adjustStock(item: InventoryItem, type: "entrada" | "salida") {
    const value = prompt(
      type === "entrada"
        ? "Cantidad que entra al inventario:"
        : "Cantidad que sale del inventario:"
    );

    if (!value) return;

    const quantity = Number(value);

    if (quantity <= 0) {
      alert("Cantidad inválida");
      return;
    }

    const stockBefore = Number(item.stock || 0);
    const stockAfter =
      type === "entrada" ? stockBefore + quantity : stockBefore - quantity;

    if (stockAfter < 0) {
      alert("No hay suficiente stock");
      return;
    }

    const { error } = await supabase
      .from("inventory_items")
      .update({ stock: stockAfter })
      .eq("id", item.id);

    if (error) {
      alert("No se pudo actualizar el stock");
      console.error(error);
      return;
    }

    await registerMovement({
      itemId: item.id,
      itemName: item.name,
      movementType: type,
      quantity,
      stockBefore,
      stockAfter,
      relatedOrder: "Movimiento manual",
      materialUsed: item.name,
    });

    await loadData();
  }

  async function discountFromProduction() {
    if (!production.itemId || !production.quantity) {
      alert("Selecciona material y cantidad");
      return;
    }

    const item = inventory.find((i) => i.id === production.itemId);

    if (!item) {
      alert("Material no encontrado");
      return;
    }

    const quantity = Number(production.quantity);

    if (quantity <= 0) {
      alert("La cantidad debe ser mayor que cero");
      return;
    }

    const stockBefore = Number(item.stock || 0);
    const stockAfter = stockBefore - quantity;

    if (stockAfter < 0) {
      alert("No hay suficiente stock");
      return;
    }

    const { error } = await supabase
      .from("inventory_items")
      .update({ stock: stockAfter })
      .eq("id", item.id);

    if (error) {
      alert("No se pudo rebajar inventario");
      console.error(error);
      return;
    }

    await registerMovement({
      itemId: item.id,
      itemName: item.name,
      movementType: "produccion",
      quantity,
      stockBefore,
      stockAfter,
      relatedOrder: production.order || "Orden sin número",
      materialUsed: item.name,
      notes: `Cliente: ${production.client || "-"} | Proyecto: ${
        production.project || "-"
      } | ${production.notes || ""}`,
    });

    setProduction({
      order: "",
      client: "",
      project: "",
      itemId: "",
      quantity: "",
      notes: "",
    });

    await loadData();
    alert("Producción registrada e inventario rebajado");
  }

  function openWhatsApp() {
    const phone = whatsapp.phone.replace(/\D/g, "");
    const message = encodeURIComponent(whatsapp.message);

    if (!phone || !message) {
      alert("Completa teléfono y mensaje");
      return;
    }

    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  }

  return (
    <main style={styles.app}>
      <aside style={styles.sidebar}>
        <div style={styles.logoBox}>
          <h1 style={styles.logo}>RD WOOD</h1>
          <p style={styles.logoSub}>Corte Visual Pro</p>
        </div>

        <nav style={styles.nav}>
          <MenuButton
            label="Dashboard"
            icon="📊"
            active={activeModule === "dashboard"}
            onClick={() => setActiveModule("dashboard")}
          />
          <MenuButton
            label="Inventario"
            icon="📦"
            active={activeModule === "inventario"}
            onClick={() => setActiveModule("inventario")}
          />
          <MenuButton
            label="Producción"
            icon="🏭"
            active={activeModule === "produccion"}
            onClick={() => setActiveModule("produccion")}
          />
          <MenuButton
            label="Historial"
            icon="🧾"
            active={activeModule === "historial"}
            onClick={() => setActiveModule("historial")}
          />
          <MenuButton
            label="WhatsApp"
            icon="🟢"
            active={activeModule === "whatsapp"}
            onClick={() => setActiveModule("whatsapp")}
          />
        </nav>

        <div style={styles.sidebarFooter}>
          <p>RD Wood Design</p>
          <span>Sistema de producción</span>
        </div>
      </aside>

      <section style={styles.content}>
        <header style={styles.header}>
          <div>
            <h2 style={styles.pageTitle}>
              {activeModule === "dashboard" && "Dashboard"}
              {activeModule === "inventario" && "Inventario"}
              {activeModule === "produccion" && "Producción"}
              {activeModule === "historial" && "Historial de movimientos"}
              {activeModule === "whatsapp" && "WhatsApp automático"}
            </h2>
            <p style={styles.pageSubtitle}>
              Sistema profesional para inventario, producción y costeo.
            </p>
          </div>

          <button style={styles.refreshButton} onClick={loadData}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </header>

        {activeModule === "dashboard" && (
          <div>
            <div style={styles.cardsGrid}>
              <StatCard title="Materiales" value={inventory.length.toString()} />
              <StatCard
                title="Valor inventario"
                value={`RD$ ${totalInventoryValue.toLocaleString("es-DO")}`}
              />
              <StatCard title="Stock bajo" value={lowStockItems.length.toString()} />
              <StatCard title="Movimientos" value={movements.length.toString()} />
            </div>

            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <h3>Alertas de stock bajo</h3>
                <span>Materiales con 5 unidades o menos</span>
              </div>

              {lowStockItems.length === 0 ? (
                <p style={styles.emptyText}>No hay materiales en stock bajo.</p>
              ) : (
                <div style={styles.list}>
                  {lowStockItems.map((item) => (
                    <div key={item.id} style={styles.warningRow}>
                      <strong>{item.name}</strong>
                      <span>
                        {item.stock} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeModule === "inventario" && (
          <div style={styles.gridTwo}>
            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <h3>Agregar material</h3>
                <span>Registra materiales disponibles</span>
              </div>

              <div style={styles.formGrid}>
                <input
                  style={styles.input}
                  placeholder="Nombre del material"
                  value={newItem.name}
                  onChange={(e) =>
                    setNewItem({ ...newItem, name: e.target.value })
                  }
                />
                <input
                  style={styles.input}
                  placeholder="Categoría"
                  value={newItem.category}
                  onChange={(e) =>
                    setNewItem({ ...newItem, category: e.target.value })
                  }
                />
                <input
                  style={styles.input}
                  placeholder="Unidad"
                  value={newItem.unit}
                  onChange={(e) =>
                    setNewItem({ ...newItem, unit: e.target.value })
                  }
                />
                <input
                  style={styles.input}
                  type="number"
                  placeholder="Stock"
                  value={newItem.stock}
                  onChange={(e) =>
                    setNewItem({ ...newItem, stock: e.target.value })
                  }
                />
                <input
                  style={styles.input}
                  type="number"
                  placeholder="Costo unitario"
                  value={newItem.unit_cost}
                  onChange={(e) =>
                    setNewItem({ ...newItem, unit_cost: e.target.value })
                  }
                />
              </div>

              <button style={styles.primaryButton} onClick={addInventoryItem}>
                Agregar material
              </button>
            </section>

            <section style={styles.panelWide}>
              <div style={styles.panelHeader}>
                <h3>Inventario actual</h3>
                <span>Control de entradas y salidas</span>
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Categoría</th>
                      <th>Stock</th>
                      <th>Costo</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={styles.emptyCell}>
                          No hay materiales registrados.
                        </td>
                      </tr>
                    ) : (
                      inventory.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.category || "-"}</td>
                          <td>
                            {item.stock} {item.unit}
                          </td>
                          <td>
                            RD$ {Number(item.unit_cost || 0).toLocaleString("es-DO")}
                          </td>
                          <td>
                            <button
                              style={styles.smallGreenButton}
                              onClick={() => adjustStock(item, "entrada")}
                            >
                              Entrada
                            </button>
                            <button
                              style={styles.smallRedButton}
                              onClick={() => adjustStock(item, "salida")}
                            >
                              Salida
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeModule === "produccion" && (
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h3>Orden de producción</h3>
              <span>Rebaja material automáticamente del inventario</span>
            </div>

            <div style={styles.formGridTwo}>
              <input
                style={styles.input}
                placeholder="Número de orden"
                value={production.order}
                onChange={(e) =>
                  setProduction({ ...production, order: e.target.value })
                }
              />
              <input
                style={styles.input}
                placeholder="Cliente"
                value={production.client}
                onChange={(e) =>
                  setProduction({ ...production, client: e.target.value })
                }
              />
              <input
                style={styles.input}
                placeholder="Proyecto"
                value={production.project}
                onChange={(e) =>
                  setProduction({ ...production, project: e.target.value })
                }
              />

              <select
                style={styles.input}
                value={production.itemId}
                onChange={(e) =>
                  setProduction({ ...production, itemId: e.target.value })
                }
              >
                <option value="">Seleccionar material</option>
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — Stock: {item.stock} {item.unit}
                  </option>
                ))}
              </select>

              <input
                style={styles.input}
                type="number"
                placeholder="Cantidad usada"
                value={production.quantity}
                onChange={(e) =>
                  setProduction({ ...production, quantity: e.target.value })
                }
              />

              <input
                style={styles.input}
                placeholder="Notas"
                value={production.notes}
                onChange={(e) =>
                  setProduction({ ...production, notes: e.target.value })
                }
              />
            </div>

            <button style={styles.primaryButton} onClick={discountFromProduction}>
              Rebajar inventario y guardar producción
            </button>
          </section>
        )}

        {activeModule === "historial" && (
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h3>Historial de movimientos</h3>
              <span>Stock antes, stock después, orden, material y fecha</span>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Material</th>
                    <th>Cantidad</th>
                    <th>Antes</th>
                    <th>Después</th>
                    <th>Orden</th>
                    <th>Uso</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={styles.emptyCell}>
                        No hay movimientos registrados.
                      </td>
                    </tr>
                  ) : (
                    movements.map((movement) => (
                      <tr key={movement.id}>
                        <td>
                          {new Date(movement.created_at).toLocaleString("es-DO")}
                        </td>
                        <td>
                          <Badge text={movement.movement_type} />
                        </td>
                        <td>{movement.item_name}</td>
                        <td>{movement.quantity}</td>
                        <td>{movement.stock_before}</td>
                        <td>{movement.stock_after}</td>
                        <td>{movement.related_order || "-"}</td>
                        <td>{movement.material_used || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeModule === "whatsapp" && (
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h3>WhatsApp automático</h3>
              <span>Envía mensajes directos a clientes</span>
            </div>

            <div style={styles.formGridTwo}>
              <input
                style={styles.input}
                placeholder="Teléfono. Ej: 18096905636"
                value={whatsapp.phone}
                onChange={(e) =>
                  setWhatsapp({ ...whatsapp, phone: e.target.value })
                }
              />
              <textarea
                style={{ ...styles.input, minHeight: 140 }}
                placeholder="Mensaje"
                value={whatsapp.message}
                onChange={(e) =>
                  setWhatsapp({ ...whatsapp, message: e.target.value })
                }
              />
            </div>

            <button style={styles.whatsappButton} onClick={openWhatsApp}>
              Abrir WhatsApp
            </button>
          </section>
        )}
      </section>
    </main>
  );
}

function MenuButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={active ? styles.menuActive : styles.menuButton}>
      <span>{icon}</span>
      {label}
    </button>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <p>{title}</p>
      <strong>{value}</strong>
    </div>
  );
}

function Badge({ text }: { text: string }) {
  const color =
    text === "entrada"
      ? "#16a34a"
      : text === "salida"
      ? "#dc2626"
      : text === "produccion"
      ? "#2563eb"
      : "#ca8a04";

  return (
    <span
      style={{
        background: `${color}20`,
        color,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {text}
    </span>
  );
}

const styles: any = {
  app: {
    minHeight: "100vh",
    display: "flex",
    background: "#f4f7fb",
    color: "#0f172a",
    fontFamily: "Arial, sans-serif",
  },
  sidebar: {
    width: 280,
    background: "linear-gradient(180deg, #020617, #0f172a)",
    color: "white",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  logoBox: {
    marginBottom: 30,
  },
  logo: {
    margin: 0,
    fontSize: 28,
    color: "#22c55e",
    letterSpacing: 1,
  },
  logoSub: {
    marginTop: 6,
    color: "#94a3b8",
    fontSize: 14,
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  menuButton: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#cbd5e1",
    padding: "14px 16px",
    borderRadius: 14,
    textAlign: "left",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 15,
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  menuActive: {
    width: "100%",
    border: "none",
    background: "linear-gradient(90deg, #22c55e, #86efac)",
    color: "#052e16",
    padding: "14px 16px",
    borderRadius: 14,
    textAlign: "left",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 15,
    display: "flex",
    gap: 10,
    alignItems: "center",
    boxShadow: "0 10px 25px rgba(34,197,94,.35)",
  },
  sidebarFooter: {
    color: "#94a3b8",
    fontSize: 13,
  },
  content: {
    flex: 1,
    padding: 34,
    overflow: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  pageTitle: {
    margin: 0,
    fontSize: 34,
    fontWeight: 900,
  },
  pageSubtitle: {
    color: "#64748b",
    marginTop: 6,
  },
  refreshButton: {
    background: "#0f172a",
    color: "white",
    border: "none",
    borderRadius: 14,
    padding: "13px 18px",
    fontWeight: 900,
    cursor: "pointer",
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 18,
    marginBottom: 24,
  },
  statCard: {
    background: "white",
    borderRadius: 22,
    padding: 24,
    boxShadow: "0 12px 35px rgba(15,23,42,.08)",
    border: "1px solid #e2e8f0",
  },
  panel: {
    background: "white",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 12px 35px rgba(15,23,42,.08)",
    border: "1px solid #e2e8f0",
    marginBottom: 24,
  },
  panelWide: {
    background: "white",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 12px 35px rgba(15,23,42,.08)",
    border: "1px solid #e2e8f0",
    gridColumn: "1 / -1",
  },
  panelHeader: {
    marginBottom: 18,
  },
  emptyText: {
    color: "#64748b",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  warningRow: {
    background: "#fef2f2",
    color: "#991b1b",
    padding: 14,
    borderRadius: 14,
    display: "flex",
    justifyContent: "space-between",
  },
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 24,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 12,
  },
  formGridTwo: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "14px 15px",
    outline: "none",
    fontSize: 14,
    background: "#fff",
  },
  primaryButton: {
    marginTop: 18,
    background: "linear-gradient(90deg, #16a34a, #22c55e)",
    color: "white",
    border: "none",
    borderRadius: 16,
    padding: "14px 22px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 30px rgba(34,197,94,.25)",
  },
  whatsappButton: {
    marginTop: 18,
    background: "#16a34a",
    color: "white",
    border: "none",
    borderRadius: 16,
    padding: "14px 22px",
    fontWeight: 900,
    cursor: "pointer",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  emptyCell: {
    padding: 20,
    textAlign: "center",
    color: "#64748b",
  },
  smallGreenButton: {
    background: "#dcfce7",
    color: "#166534",
    border: "none",
    borderRadius: 10,
    padding: "8px 10px",
    marginRight: 8,
    fontWeight: 800,
    cursor: "pointer",
  },
  smallRedButton: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "none",
    borderRadius: 10,
    padding: "8px 10px",
    fontWeight: 800,
    cursor: "pointer",
  },
};