"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  Boxes,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Factory,
  FileSpreadsheet,
  Layers3,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Wand2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  group_name: string | null;
  subgroup_name: string | null;
  unit: string | null;
  stock: number | null;
  cost_price: number | null;
};

type RecipeItem = {
  product_id: string;
  product_name: string;
  group_name: string;
  subgroup_name: string;
  unit: string;
  quantity_per_unit: number;
  unit_cost: number;
};

type Recipe = {
  id: string;
  recipe_name: string;
  description: string | null;
  sale_price: number | null;
  created_at: string;
};

const currency = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  maximumFractionDigits: 2,
});

const formatMoney = (value: number | null | undefined) =>
  currency.format(Number(value || 0));

const formatNumber = (value: number | null | undefined) =>
  new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 }).format(
    Number(value || 0)
  );

const recipeTypes = ["Cocina", "Closet", "TV", "Oficina", "Baño", "General"];

export default function RecetasPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [selectedType, setSelectedType] = useState("General");

  const [recipeName, setRecipeName] = useState("");
  const [description, setDescription] = useState("");
  const [salePrice, setSalePrice] = useState<number>(0);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantityPerUnit, setQuantityPerUnit] = useState<number>(1);

  const [items, setItems] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const totalCost = useMemo(() => {
    return items.reduce(
      (sum, item) =>
        sum + Number(item.quantity_per_unit || 0) * Number(item.unit_cost || 0),
      0
    );
  }, [items]);

  const totalQty = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + Number(item.quantity_per_unit || 0),
      0
    );
  }, [items]);

  const profit = Number(salePrice || 0) - totalCost;
  const margin = Number(salePrice || 0) > 0 ? (profit / Number(salePrice)) * 100 : 0;

  const lowStockItems = useMemo(() => {
    return items.filter((item) => {
      const product = products.find((p) => p.id === item.product_id);
      return Number(product?.stock || 0) < Number(item.quantity_per_unit || 0);
    }).length;
  }, [items, products]);

  const filteredRecipes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => {
      return (
        r.recipe_name?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    });
  }, [recipes, searchTerm]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoadingData(true);
    setMessage("");
    await Promise.all([loadProducts(), loadRecipes()]);
    setLoadingData(false);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setMessage("❌ Error cargando productos: " + error.message);
      return;
    }

    setProducts((data || []) as Product[]);
  }

  async function loadRecipes() {
    const { data, error } = await supabase
      .from("product_recipes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("❌ Error cargando BOM: " + error.message);
      return;
    }

    setRecipes((data || []) as Recipe[]);
  }

  async function loadRecipeItems(recipeId: string) {
    const { data, error } = await supabase
      .from("product_recipe_items")
      .select("*")
      .eq("recipe_id", recipeId);

    if (error) {
      setMessage("❌ Error cargando materiales del BOM: " + error.message);
      return;
    }

    const formatted: RecipeItem[] = (data || []).map((item: any) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      group_name: item.group_name || "",
      subgroup_name: item.subgroup_name || "",
      unit: item.unit || "",
      quantity_per_unit: Number(item.quantity_per_unit || 0),
      unit_cost: Number(item.unit_cost || 0),
    }));

    setItems(formatted);
  }

  function addItem() {
    const product = products.find((p) => p.id === selectedProductId);

    if (!product) {
      setMessage("⚠️ Selecciona un material del inventario.");
      return;
    }

    if (!quantityPerUnit || quantityPerUnit <= 0) {
      setMessage("⚠️ La cantidad debe ser mayor que cero.");
      return;
    }

    const exists = items.find((item) => item.product_id === product.id);

    if (exists) {
      setMessage("⚠️ Ese material ya está agregado al BOM.");
      return;
    }

    const newItem: RecipeItem = {
      product_id: product.id,
      product_name: product.name,
      group_name: product.group_name || "",
      subgroup_name: product.subgroup_name || "",
      unit: product.unit || "",
      quantity_per_unit: Number(quantityPerUnit),
      unit_cost: Number(product.cost_price || 0),
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedProductId("");
    setQuantityPerUnit(1);
    setMessage("✅ Material agregado al BOM.");
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((item) => item.product_id !== productId));
  }

  function clearForm() {
    setSelectedRecipeId("");
    setSelectedType("General");
    setRecipeName("");
    setDescription("");
    setSalePrice(0);
    setSelectedProductId("");
    setQuantityPerUnit(1);
    setItems([]);
    setMessage("");
  }

  async function saveRecipe() {
    if (!recipeName.trim()) {
      setMessage("⚠️ Escribe el nombre del BOM / ingeniería.");
      return;
    }

    if (items.length === 0) {
      setMessage("⚠️ Agrega materiales al BOM antes de guardar.");
      return;
    }

    setLoading(true);

    try {
      let recipeId = selectedRecipeId;
      const fullDescription = description.trim()
        ? `[${selectedType}] ${description.trim()}`
        : `[${selectedType}]`;

      if (selectedRecipeId) {
        const { error: updateError } = await supabase
          .from("product_recipes")
          .update({
            recipe_name: recipeName.trim(),
            description: fullDescription,
            sale_price: Number(salePrice || 0),
          })
          .eq("id", selectedRecipeId);

        if (updateError) throw updateError;

        const { error: deleteItemsError } = await supabase
          .from("product_recipe_items")
          .delete()
          .eq("recipe_id", selectedRecipeId);

        if (deleteItemsError) throw deleteItemsError;
      } else {
        const { data: recipe, error: recipeError } = await supabase
          .from("product_recipes")
          .insert({
            recipe_name: recipeName.trim(),
            description: fullDescription,
            sale_price: Number(salePrice || 0),
          })
          .select()
          .single();

        if (recipeError) throw recipeError;
        recipeId = recipe.id;
      }

      const recipeItems = items.map((item) => ({
        recipe_id: recipeId,
        product_id: item.product_id,
        product_name: item.product_name,
        group_name: item.group_name,
        subgroup_name: item.subgroup_name,
        unit: item.unit,
        quantity_per_unit: Number(item.quantity_per_unit || 0),
        unit_cost: Number(item.unit_cost || 0),
      }));

      const { error: itemsError } = await supabase
        .from("product_recipe_items")
        .insert(recipeItems);

      if (itemsError) throw itemsError;

      setMessage(
        selectedRecipeId
          ? "✅ Ingeniería BOM actualizada correctamente."
          : "✅ Ingeniería BOM guardada correctamente."
      );

      clearForm();
      await loadRecipes();
    } catch (error: any) {
      setMessage("❌ Error guardando BOM: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteRecipe(recipeId: string) {
    const confirmDelete = confirm("¿Seguro que quieres eliminar este BOM?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("product_recipes")
      .delete()
      .eq("id", recipeId);

    if (error) {
      setMessage("❌ Error eliminando BOM: " + error.message);
      return;
    }

    setMessage("✅ BOM eliminado correctamente.");
    clearForm();
    await loadRecipes();
  }

  function selectRecipe(recipe: Recipe) {
    setSelectedRecipeId(recipe.id);
    setRecipeName(recipe.recipe_name);
    setDescription((recipe.description || "").replace(/^\[[^\]]+\]\s*/, ""));
    const match = (recipe.description || "").match(/^\[([^\]]+)\]/);
    setSelectedType(match?.[1] || "General");
    setSalePrice(Number(recipe.sale_price || 0));
    loadRecipeItems(recipe.id);
    setMessage(`📐 BOM cargado: ${recipe.recipe_name}`);
  }

  return (
    <main className="min-h-screen bg-[#020817] px-5 py-6 text-slate-100 md:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[2rem] border border-cyan-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/50 p-6 shadow-2xl shadow-cyan-950/20 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.35em] text-cyan-300">
                <Factory size={15} /> Fase 44.1 · Ingeniería Producción
              </div>
              <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">
                Ingeniería BOM PRO
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Fórmulas de materiales por módulo: cocinas, closets, TV, oficina y
                muebles especiales. Calcula costo, utilidad y prepara la base para
                Producción, Corte CNC y consumo real de inventario.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={loadAll}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:scale-[1.02]"
              >
                <RefreshCw size={17} /> Actualizar
              </button>
              <button
                type="button"
                onClick={clearForm}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:scale-[1.02]"
              >
                <PackagePlus size={17} /> Nuevo BOM
              </button>
            </div>
          </div>
        </div>

        {message ? (
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-4 text-sm font-bold text-cyan-100">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="BOM creados" value={recipes.length.toString()} icon={<FileSpreadsheet size={22} />} />
          <KpiCard label="Materiales disponibles" value={products.length.toString()} icon={<Boxes size={22} />} />
          <KpiCard label="Items en fórmula" value={items.length.toString()} icon={<Layers3 size={22} />} />
          <KpiCard label="Costo BOM" value={formatMoney(totalCost)} icon={<Calculator size={22} />} accent="yellow" />
          <KpiCard label="Margen" value={`${formatNumber(margin)}%`} icon={<CheckCircle2 size={22} />} accent={margin >= 25 ? "green" : "red"} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-[1.5rem] border border-slate-700/80 bg-slate-900/80 p-5 shadow-xl">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black text-white">
                  {selectedRecipeId ? "Editar Ingeniería BOM" : "Crear Ingeniería BOM"}
                </h2>
                <p className="text-sm text-slate-400">
                  Define materiales, cantidades y costo estándar por unidad/módulo.
                </p>
              </div>
              <div className="flex rounded-2xl border border-slate-700 bg-slate-950 p-1">
                {recipeTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                      selectedType === type
                        ? "bg-cyan-400 text-slate-950"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Nombre BOM"
                placeholder="Ej: Cocina 1 metro lineal"
                value={recipeName}
                onChange={setRecipeName}
              />
              <Input
                label="Descripción técnica"
                placeholder="Ej: Base estándar, gavetas, herrajes..."
                value={description}
                onChange={setDescription}
              />
              <Input
                label="Precio venta RD$"
                type="number"
                placeholder="0.00"
                value={String(salePrice)}
                onChange={(v) => setSalePrice(Number(v))}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
                <Archive size={16} /> Agregar material desde inventario
              </div>
              <div className="grid gap-3 md:grid-cols-[1.7fr_0.7fr_auto]">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="h-12 rounded-2xl border border-slate-700 bg-slate-900 px-4 text-sm font-bold text-white outline-none transition focus:border-cyan-400"
                >
                  <option value="">Seleccionar material</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} | Stock: {product.stock || 0} {product.unit || ""} | {formatMoney(product.cost_price)}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Cantidad"
                  value={quantityPerUnit}
                  onChange={(e) => setQuantityPerUnit(Number(e.target.value))}
                  className="h-12 rounded-2xl border border-slate-700 bg-slate-900 px-4 text-sm font-bold text-white outline-none transition focus:border-cyan-400"
                />

                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 text-sm font-black text-slate-950 transition hover:scale-[1.02]"
                >
                  <Plus size={17} /> Agregar
                </button>
              </div>

              {selectedProduct ? (
                <div className="mt-3 grid gap-3 text-xs text-slate-300 md:grid-cols-4">
                  <InfoPill label="Grupo" value={selectedProduct.group_name || "Sin grupo"} />
                  <InfoPill label="Subgrupo" value={selectedProduct.subgroup_name || "Sin subgrupo"} />
                  <InfoPill label="Stock" value={`${formatNumber(selectedProduct.stock)} ${selectedProduct.unit || ""}`} />
                  <InfoPill label="Costo" value={formatMoney(selectedProduct.cost_price)} />
                </div>
              ) : null}
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-700">
              <table className="w-full min-w-[850px] border-collapse text-sm">
                <thead className="bg-slate-950 text-xs uppercase tracking-[0.22em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Material</th>
                    <th className="px-4 py-3 text-left">Grupo</th>
                    <th className="px-4 py-3 text-right">Cantidad</th>
                    <th className="px-4 py-3 text-right">Costo unit.</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        No hay materiales agregados. Selecciona materiales del inventario para construir el BOM.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const total = Number(item.quantity_per_unit || 0) * Number(item.unit_cost || 0);
                      const product = products.find((p) => p.id === item.product_id);
                      const lowStock = Number(product?.stock || 0) < Number(item.quantity_per_unit || 0);
                      return (
                        <tr key={item.product_id} className="border-t border-slate-800 bg-slate-900/40 hover:bg-slate-800/50">
                          <td className="px-4 py-3 font-black text-white">
                            {item.product_name}
                            {lowStock ? (
                              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-black text-red-300">
                                <AlertCircle size={12} /> stock bajo
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {item.group_name || "-"} / {item.subgroup_name || "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-cyan-200">
                            {formatNumber(item.quantity_per_unit)} {item.unit}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-300">{formatMoney(item.unit_cost)}</td>
                          <td className="px-4 py-3 text-right font-black text-green-300">{formatMoney(total)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeItem(item.product_id)}
                              className="inline-flex items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-500/25"
                            >
                              <Trash2 size={14} /> Quitar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 md:flex-row md:items-center md:justify-between">
              <div className="grid gap-3 md:grid-cols-4">
                <InfoPill label="Costo BOM" value={formatMoney(totalCost)} />
                <InfoPill label="Venta" value={formatMoney(salePrice)} />
                <InfoPill label="Utilidad" value={formatMoney(profit)} />
                <InfoPill label="Cantidad total" value={formatNumber(totalQty)} />
              </div>

              <button
                type="button"
                onClick={saveRecipe}
                disabled={loading}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-green-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-green-950/30 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={17} />
                {loading ? "Guardando..." : selectedRecipeId ? "Actualizar BOM" : "Guardar BOM"}
              </button>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[1.5rem] border border-slate-700/80 bg-slate-900/80 p-5 shadow-xl">
              <h2 className="mb-3 flex items-center gap-2 text-xl font-black text-white">
                <Wand2 className="text-cyan-300" size={22} /> Resumen inteligente
              </h2>
              <div className="space-y-3 text-sm text-slate-300">
                <InfoPill label="Tipo" value={selectedType} />
                <InfoPill label="Materiales" value={items.length.toString()} />
                <InfoPill label="Alertas stock" value={lowStockItems.toString()} />
                <InfoPill label="Estado margen" value={margin >= 25 ? "Rentable" : margin > 0 ? "Revisar margen" : "Sin venta"} />
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-700/80 bg-slate-900/80 p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black text-white">BOM guardados</h2>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">
                  {filteredRecipes.length}
                </span>
              </div>

              <div className="mb-4 flex h-12 items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4">
                <Search size={17} className="text-slate-500" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar BOM..."
                  className="h-full flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-500"
                />
              </div>

              <div className="max-h-[560px] space-y-3 overflow-auto pr-1">
                {loadingData ? (
                  <div className="rounded-2xl border border-slate-700 bg-slate-950 p-6 text-center text-sm text-slate-400">
                    Cargando BOM...
                  </div>
                ) : filteredRecipes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center text-sm text-slate-400">
                    No hay BOM guardados.
                  </div>
                ) : (
                  filteredRecipes.map((recipe) => {
                    const active = selectedRecipeId === recipe.id;
                    return (
                      <div
                        key={recipe.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectRecipe(recipe)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectRecipe(recipe);
                          }
                        }}
                        className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition ${
                          active
                            ? "border-cyan-400 bg-cyan-500/10"
                            : "border-slate-700 bg-slate-950 hover:border-slate-500"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-black text-white">{recipe.recipe_name}</h3>
                            <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                              {recipe.description || "Sin descripción"}
                            </p>
                          </div>
                          <ChevronRight size={18} className="mt-1 text-cyan-300" />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="font-bold text-green-300">{formatMoney(recipe.sale_price)}</span>
                          <span className="text-slate-500">
                            {recipe.created_at ? new Date(recipe.created_at).toLocaleDateString("es-DO") : "-"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRecipe(recipe.id);
                          }}
                          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-500/25"
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent = "cyan",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: "cyan" | "green" | "yellow" | "red";
}) {
  const colors = {
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    green: "border-green-500/30 bg-green-500/10 text-green-300",
    yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    red: "border-red-500/30 bg-red-500/10 text-red-300",
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black text-white">{value}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${colors[accent]}`}>{icon}</div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
      />
    </label>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}
