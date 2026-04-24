"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type InventoryItem = {
  id: string;
  name: string;
  stock: number;
  unit_cost: number | null;
};

export default function Home() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
    const { data } = await supabase.from("inventory").select("*");
    setItems(data || []);
    setLoading(false);
  }

  const totalValue = items.reduce(
    (acc, item) => acc + item.stock * (item.unit_cost || 0),
    0
  );

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial" }}>
      
      {/* SIDEBAR */}
      <div
        style={{
          width: "240px",
          background: "#0f172a",
          color: "white",
          padding: "20px",
        }}
      >
        <h2 style={{ color: "#22c55e" }}>RD WOOD</h2>
        <p style={{ fontSize: "12px", color: "#94a3b8" }}>
          Corte Visual Pro
        </p>

        <div style={{ marginTop: "30px" }}>
          <button style={menuBtn(true)}>Dashboard</button>
          <button style={menuBtn()}>Inventario</button>
          <button style={menuBtn()}>Producción</button>
          <button style={menuBtn()}>Historial</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, background: "#f1f5f9", padding: "30px" }}>
        
        <h1 style={{ marginBottom: "20px" }}>Dashboard</h1>

        {/* CARDS */}
        <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
          
          <div style={card}>
            <h3>Materiales</h3>
            <p style={bigNumber}>{items.length}</p>
          </div>

          <div style={card}>
            <h3>Valor Inventario</h3>
            <p style={bigNumber}>RD$ {totalValue.toLocaleString()}</p>
          </div>

          <div style={card}>
            <h3>Stock Bajo</h3>
            <p style={bigNumber}>
              {items.filter(i => i.stock < 5).length}
            </p>
          </div>

        </div>

        {/* TABLE */}
        <div style={tableBox}>
          <h3>Inventario</h3>

          {loading ? (
            <p>Cargando...</p>
          ) : (
            <table style={{ width: "100%", marginTop: "10px" }}>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Stock</th>
                  <th>Costo</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.stock}</td>
                    <td>RD$ {item.unit_cost || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* 🎨 STYLES */

const menuBtn = (active = false) => ({
  display: "block",
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  background: active ? "#22c55e" : "transparent",
  border: "none",
  color: "white",
  textAlign: "left" as const,
  cursor: "pointer",
  borderRadius: "6px",
});

const card = {
  flex: 1,
  background: "white",
  padding: "20px",
  borderRadius: "10px",
  boxShadow: "0 5px 10px rgba(0,0,0,0.05)",
};

const bigNumber = {
  fontSize: "22px",
  fontWeight: "bold",
};

const tableBox = {
  background: "white",
  padding: "20px",
  borderRadius: "10px",
};