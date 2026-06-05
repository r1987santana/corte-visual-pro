// ============================================================================
// lib/ai/live-actions.ts
// RD WOOD SYSTEM - LIVE AI ACTIONS ENGINE
// ============================================================================

import { supabase } from "@/lib/supabase";

export type LiveAIActionResult = {
  success: boolean;
  message: string;

  data?: any;

  redirect?: string;

  severity?: "info" | "warning" | "danger" | "success";
};

type ExecuteLiveActionInput = {
  action: string;

  payload?: any;

  user?: {
    id?: string;
    name?: string;
  };
};

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function executeLiveAIAction(
  input: ExecuteLiveActionInput
): Promise<LiveAIActionResult> {
  const action = String(input.action || "").toLowerCase();

  // =========================================================================
  // GENERAR QR
  // =========================================================================

  if (action === "generate_qr") {
    const code =
      "QR-" +
      Date.now().toString().slice(-8);

    return {
      success: true,

      severity: "success",

      message:
        "QR industrial preparado correctamente.",

      data: {
        qr: code,
      },

      redirect: "/qr-trazabilidad",
    };
  }

  // =========================================================================
  // CREAR REQUISICIÓN
  // =========================================================================

  if (action === "create_requisition") {
    try {
      const requisitionCode =
        "REQ-" +
        Date.now().toString().slice(-6);

      const { data, error } = await supabase
        .from("warehouse_requests")
        .insert([
          {
            code: requisitionCode,

            status: "pendiente",

            created_by:
              input?.user?.name ||
              "IA Industrial",

            notes:
              "Requisición generada automáticamente por IA.",
          },
        ])
        .select()
        .single();

      if (error) {
        return {
          success: false,

          severity: "danger",

          message:
            "No pude generar la requisición.",
        };
      }

      return {
        success: true,

        severity: "success",

        message:
          "Requisición creada correctamente.",

        data,

        redirect: "/compras",
      };
    } catch {
      return {
        success: false,

        severity: "danger",

        message:
          "Error interno creando requisición.",
      };
    }
  }

  // =========================================================================
  // PRIORIZAR ÓRDENES
  // =========================================================================

  if (action === "prioritize_orders") {
    return {
      success: true,

      severity: "info",

      message:
        "Motor de priorización industrial ejecutado.",

      redirect: "/produccion",
    };
  }

  // =========================================================================
  // GENERAR CHECKLIST
  // =========================================================================

  if (action === "generate_checklist") {
    const checklist = [
      "Validar BOM",
      "Validar inventario",
      "Validar herrajes",
      "Confirmar corte",
      "Confirmar CNC",
      "Generar QR",
      "Preparar ensamblaje",
    ];

    return {
      success: true,

      severity: "success",

      message:
        "Checklist industrial generado.",

      data: checklist,

      redirect: "/produccion",
    };
  }

  // =========================================================================
  // ABRIR CNC
  // =========================================================================

  if (action === "open_cnc") {
    return {
      success: true,

      severity: "info",

      message:
        "Abriendo módulo CNC/Corte.",

      redirect: "/corte-cnc",
    };
  }

  // =========================================================================
  // ANALIZAR UTILIDAD
  // =========================================================================

  if (action === "analyze_profit") {
    return {
      success: true,

      severity: "info",

      message:
        "Preparando análisis financiero CEO.",

      redirect: "/dashboard-ceo",
    };
  }

  // =========================================================================
  // CREAR ALERTA
  // =========================================================================

  if (action === "create_alert") {
    try {
      const { data, error } = await supabase
        .from("system_alerts")
        .insert([
          {
            title:
              input?.payload?.title ||
              "Alerta IA",

            description:
              input?.payload?.description ||
              "Generada automáticamente por IA.",

            severity:
              input?.payload?.severity ||
              "warning",
          },
        ])
        .select()
        .single();

      if (error) {
        return {
          success: false,

          severity: "danger",

          message:
            "No pude generar la alerta.",
        };
      }

      return {
        success: true,

        severity: "warning",

        message:
          "Alerta operativa creada.",

        data,
      };
    } catch {
      return {
        success: false,

        severity: "danger",

        message:
          "Error interno creando alerta.",
      };
    }
  }

  // =========================================================================
  // DEFAULT
  // =========================================================================

  return {
    success: false,

    severity: "warning",

    message:
      "La IA todavía no sabe ejecutar esta acción.",
  };
}