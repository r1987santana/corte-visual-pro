export interface AIAlert {
  type: "success" | "warning" | "danger" | "info";
  title: string;
  message: string;
}

export interface AIResult {
  score: number;
  margin: number;
  utility: number;
  alerts: AIAlert[];
}

export function analyzeQuote(cart: any[] = []) : AIResult {
  let total = 0;
  let cost = 0;

  const alerts: AIAlert[] = [];

  cart.forEach((item) => {
    total += Number(item.price || 0) * Number(item.qty || 1);
    cost += Number(item.cost || 0) * Number(item.qty || 1);

    if (!item.cost || Number(item.cost) <= 0) {
      alerts.push({
        type: "warning",
        title: "Producto sin costo",
        message: `${item.name} no tiene costo configurado`,
      });
    }

    if (Number(item.stock || 0) <= 3) {
      alerts.push({
        type: "danger",
        title: "Stock crítico",
        message: `${item.name} tiene stock bajo`,
      });
    }
  });

  const utility = total - cost;
  const margin = total > 0 ? (utility / total) * 100 : 0;

  let score = 100;

  if (margin < 15) {
    score -= 30;

    alerts.push({
      type: "warning",
      title: "Margen bajo",
      message: "La cotización tiene margen peligroso",
    });
  }

  if (utility <= 0) {
    score -= 40;

    alerts.push({
      type: "danger",
      title: "Utilidad negativa",
      message: "La cotización pierde dinero",
    });
  }

  if (cart.length === 0) {
    score = 0;

    alerts.push({
      type: "info",
      title: "Cotización vacía",
      message: "Agrega productos para analizar",
    });
  }

  return {
    score,
    margin,
    utility,
    alerts,
  };
}
