const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "ia-diseno", "page.tsx");

if (!fs.existsSync(filePath)) {
  console.error(
    "❌ No encontré app/ia-diseno/page.tsx. Ejecuta este script dentro de C:\\Users\\CNC\\rd-wood-system"
  );
  process.exit(1);
}

const code = fs.readFileSync(filePath, "utf8");

const start = code.indexOf(
  "  function approveRender(variant: RenderVariant) {"
);

if (start === -1) {
  console.error(
    "❌ No encontré la función approveRender. No hice cambios."
  );
  process.exit(1);
}

const nextMarker = "\n\n  const filteredQuotes = useMemo";
const end = code.indexOf(nextMarker, start);

if (end === -1) {
  console.error(
    "❌ No encontré el final de approveRender. No hice cambios."
  );
  process.exit(1);
}

const newFunction = `  async function approveRender(variant: RenderVariant) {
    if (!selectedQuote) {
      setMessage("⚠️ Selecciona una cotización primero.");
      return;
    }

    const imageUrl = renders[variant.id]?.imageUrl;

    if (!imageUrl) {
      setMessage("⚠️ Primero genera el render de esta variante antes de aprobar.");
      return;
    }

    const finalPrompt = buildPrompt(selectedQuote, modules, variant);

    const payload = {
      quote: selectedQuote,
      modules,
      approved_variant: variant,
      render_image_url: imageUrl,
      prompt: finalPrompt,
      approved_at: new Date().toISOString(),
      production_status: "pendiente_bom",
      flow: "cotizacion_render_aprobado_produccion",
    };

    localStorage.setItem(
      "rdwood_ia_design_approved",
      JSON.stringify(payload)
    );

    setRenders((current) => ({
      ...current,
      [variant.id]: {
        ...current[variant.id],
        status: "aprobado",
        imageUrl,
      },
    }));

    setMessage("⏳ Render aprobado. Enviando a Producción IA/CNC...");

    try {
      await supabase
        .from("quotes")
        .update({
          status: "render_aprobado_produccion",
          render_image_url: imageUrl,
        })
        .eq("id", selectedQuote.id);

      const now = new Date();
      const orderCode =
        "IA-" +
        now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0") +
        "-" +
        String(Date.now()).slice(-5);

      const productionPayload = {
        order_code: orderCode,
        quote_id: selectedQuote.id,
        request_id: selectedQuote.id,
        project_name:
          selectedQuote.project_name || "Proyecto IA",
        client_name:
          selectedQuote.client_name || "Cliente general",
        project_type:
          selectedQuote.project_type || "proyecto",
        status: "pendiente_bom",
        ai_status: "pendiente_bom",
        source: "ia_diseno",
        approved_variant: variant.id,
        approved_variant_title: variant.name,
        render_image_url: imageUrl,
        approved_render_url: imageUrl,
        design_prompt: finalPrompt,
        approved_modules: modules,
        quote_snapshot: selectedQuote,
        notes: selectedQuote.notes || "",
        total_cost: 0,
        total_sale: Number(
          selectedQuote.presupuesto || 0
        ),
        profit: 0,
      };

      let productionCreated = false;
      let productionError = "";

      const tryAI = await supabase
        .from("production_orders_ai")
        .insert(productionPayload)
        .select("*")
        .single();

      if (!tryAI.error) {
        productionCreated = true;
      } else {
        productionError = tryAI.error.message;

        const tryStandard = await supabase
          .from("production_orders")
          .insert({
            order_code: orderCode,
            quote_id: selectedQuote.id,
            project_name:
              selectedQuote.project_name || "Proyecto IA",
            client_name:
              selectedQuote.client_name || "Cliente general",
            project_type:
              selectedQuote.project_type || "proyecto",
            status: "pendiente_bom",
            source: "ia_diseno",
            render_image_url: imageUrl,
            notes: selectedQuote.notes || "",
          })
          .select("*")
          .single();

        if (!tryStandard.error) {
          productionCreated = true;
        } else {
          productionError +=
            " | " + tryStandard.error.message;
        }
      }

      if (productionCreated) {
        setMessage(
          "✅ Variante " +
            variant.id +
            " aprobada y enviada a Producción IA/CNC con estado PENDIENTE BOM. Orden: " +
            orderCode
        );
      } else {
        console.warn(
          "No se pudo crear la orden de producción:",
          productionError
        );

        setMessage(
          "✅ Render aprobado. ⚠️ No se pudo crear la orden de Producción automáticamente: " +
            productionError
        );
      }
    } catch (error) {
      setMessage(
        "✅ Render aprobado. ⚠️ Error enviando a Producción: " +
          (error?.message || "Error desconocido")
      );
    }
  }`;

const backupPath =
  filePath + ".backup-antes-produccion";

fs.writeFileSync(backupPath, code, "utf8");

const updated =
  code.slice(0, start) +
  newFunction +
  code.slice(end);

fs.writeFileSync(filePath, updated, "utf8");

console.log("✅ Listo. Solo reemplacé approveRender().");
console.log("📦 Backup creado:", backupPath);
console.log("");
console.log("Ahora ejecuta:");
console.log("rmdir /s /q .next");
console.log("npm run dev");