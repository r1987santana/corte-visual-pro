const BASE_URL = process.env.RDWOOD_BASE_URL || "http://localhost:3000";

const routes = [
  "/dashboard-ceo",
  "/clientes",
  "/agenda",
  "/levantamientos",
  "/ia-diseno",
  "/cotizador-automatico",
  "/cotizaciones",
  "/contratos",
  "/inventario-inteligente",
  "/inventario-inteligente/requisiciones",
  "/inventario-inteligente/recepcion-compras",
  "/produccion",
  "/ordenes-produccion",
  "/recetas",
  "/corte",
  "/trazabilidad-piezas",
  "/transporte",
  "/instalacion",
  "/verificacion",
  "/entrega-final",
  "/contabilidad",
  "/pagos",
  "/gamificacion",
  "/tv/gamificacion",
  "/rrhh",
  "/rrhh/auditoria",
  "/portal-empleado",
  "/usuarios",
  "/configuracion",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(timeoutMs = 90000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/login`, {
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      });

      if (response.status < 500) return true;
    } catch {
      await sleep(1500);
    }
  }

  return false;
}

async function warmRoute(route) {
  const started = Date.now();

  try {
    const response = await fetch(`${BASE_URL}${route}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(45000),
    });

    const ms = Date.now() - started;
    return { route, status: response.status, ms, ok: response.status < 500 };
  } catch (error) {
    return {
      route,
      status: "ERROR",
      ms: Date.now() - started,
      ok: false,
      error: error?.message || String(error),
    };
  }
}

async function main() {
  console.log("Esperando servidor RD Wood...");
  const ready = await waitForServer();

  if (!ready) {
    console.log("No se pudo confirmar el servidor. Abre http://localhost:3000 manualmente.");
    process.exitCode = 1;
    return;
  }

  console.log("Calentando modulos principales...");

  const results = [];
  for (const route of routes) {
    const result = await warmRoute(route);
    results.push(result);
    const mark = result.ok ? "OK" : "ERROR";
    console.log(`${mark.padEnd(5)} ${String(result.status).padEnd(5)} ${String(result.ms).padStart(6)} ms  ${route}`);
  }

  const failed = results.filter((result) => !result.ok);
  console.log("");
  console.log(`Warmup terminado: ${results.length - failed.length}/${results.length} rutas listas.`);

  if (failed.length) {
    console.log("Rutas con aviso:");
    failed.forEach((result) => console.log(`- ${result.route}: ${result.error || result.status}`));
  }
}

main();
