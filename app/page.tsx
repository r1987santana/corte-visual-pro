"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Page() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>("");

  const [view, setView] = useState("dashboard");

  const [materials, setMaterials] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [form, setForm] = useState({
    name: "",
    category_id: "",
    stock: 0,
    cost: 0,
    price: 0,
  });

  useEffect(() => {
    loadUser();
    loadData();
  }, []);

  async function loadUser() {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", data.user?.id)
      .single();

    setRole(profile?.role || "");
  }

  async function loadData() {
    const { data } = await supabase.from("inventory_items").select("*");
    setMaterials(data || []);

    const { data: cat } = await supabase.from("inventory_categories").select("*");
    setCategories(cat || []);

    const { data: sup } = await supabase.from("suppliers").select("*");
    setSuppliers(sup || []);
  }

  async function addMaterial() {
    await supabase.from("inventory_items").insert([form]);
    setForm({ name: "", category_id: "", stock: 0, cost: 0, price: 0 });
    loadData();
  }

  async function createCategory(name: string) {
    await supabase.from("inventory_categories").insert([{ name }]);
    loadData();
  }

  async function createSupplier(name: string) {
    await supabase.from("suppliers").insert([{ name }]);
    loadData();
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      
      {/* SIDEBAR */}
      <div style={{ width: 260, background: "#0b0f1a", color: "white", padding: 20 }}>
        <img src="/logo.png" style={{ width: 160, marginBottom: 20 }} />

        {[
          ["Dashboard", "dashboard"],
          ["Inventario", "inventory"],
          ["Compras", "purchases"],
          ["Almacén", "warehouse"],
          ["Corte Visual", "cut"],
          ["Administrador", "admin"],
        ].map(([label, key]) => (
          <div
            key={key}
            onClick={() => setView(key)}
            style={{
              padding: 12,
              marginBottom: 10,
              cursor: "pointer",
              background: view === key ? "#22c55e" : "transparent",
              borderRadius: 6,
            }}
          >
            {label}
          </div>
        ))}

        <div style={{ marginTop: 40 }}>
          <p>{user?.email}</p>
          <p>Rol: {role}</p>
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{ flex: 1, padding: 30 }}>

        {view === "dashboard" && (
          <>
            <h1>Dashboard</h1>
            <p>Resumen del sistema</p>

            <div style={{ display: "flex", gap: 20 }}>
              <Box title="Materiales" value={materials.length} />
              <Box title="Categorías" value={categories.length} />
              <Box title="Proveedores" value={suppliers.length} />
            </div>
          </>
        )}

        {view === "inventory" && (
          <>
            <h1>Inventario PRO</h1>

            <div style={{ display: "flex", gap: 10 }}>
              <input placeholder="Nombre" onChange={(e) => setForm({ ...form, name: e.target.value })} />

              <select onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option>Categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <input type="number" placeholder="Stock" onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
              <input type="number" placeholder="Costo" onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
              <input type="number" placeholder="Precio Venta" onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />

              <button onClick={addMaterial}>Agregar</button>
            </div>

            <table style={{ width: "100%", marginTop: 20 }}>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Stock</th>
                  <th>Costo</th>
                  <th>Venta</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.stock}</td>
                    <td>{m.cost}</td>
                    <td>{m.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {view === "purchases" && (
          <>
            <h1>Órdenes de Compra</h1>
            <p>Crear compras a proveedores</p>

            <button onClick={() => createSupplier(prompt("Nombre proveedor") || "")}>
              + Nuevo proveedor
            </button>

            <ul>
              {suppliers.map((s) => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ul>
          </>
        )}

        {view === "warehouse" && (
          <>
            <h1>Almacén</h1>
            <p>Requisiciones y movimientos</p>
          </>
        )}

        {view === "cut" && (
          <>
            <h1>Corte Visual PRO</h1>
            <p>Aquí luego integramos optimización de corte CNC</p>
          </>
        )}

        {view === "admin" && role === "admin" && (
          <>
            <h1>Administrador</h1>

            <button onClick={() => createCategory(prompt("Nueva categoría") || "")}>
              + Crear categoría
            </button>

            <ul>
              {categories.map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Box({ title, value }: any) {
  return (
    <div style={{
      background: "#f3f4f6",
      padding: 20,
      borderRadius: 10,
      width: 200
    }}>
      <h3>{title}</h3>
      <h1>{value}</h1>
    </div>
  );
}