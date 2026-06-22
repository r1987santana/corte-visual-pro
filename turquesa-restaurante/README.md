# Turquesa Restaurante

Centro de trabajo para todo lo relacionado con Turquesa Restaurante.

Esta carpeta queda separada del sistema principal para trabajar sin romper la operacion actual de RD Wood/RDSS.

## Estructura

- `docs/`: decisiones, estado operativo, dominios, Vercel, Omada y planes.
- `web-publica/`: codigo y respaldos de `www.turquesarestaurante.com`.
- `portal-wifi-omada/`: codigo y respaldos del portal cautivo `wifi.turquesarestaurante.com`.
- `sistema-restaurante/`: sistema operativo del restaurante: POS, mesas, comandas, cocina, impresoras, caja, cierre, inventario, recetas, proveedores, costos, compras, reportes y AI.
- `assets/`: logos, imagenes, fotos, iconos y materiales visuales de Turquesa.
- `../scripts/turquesa-restaurant-core.sql`: esquema inicial de base de datos para operacion restaurante.
- `../app/api/turquesa-restaurante/operacion/route.ts`: API para cargar operacion, comandas, cobros, reservas, inventario, proveedores/costos, compras, Wi-Fi CRM y cierre de turno.
- `../app/api/turquesa-restaurante/ai/route.ts`: API de Turquesa AI Copilot.
- `.env.local`: variables privadas del proyecto Turquesa, incluyendo `OPENAI_API_KEY`.

## Produccion activa

- Web publica: `https://www.turquesarestaurante.com`
- Portal WiFi: `https://wifi.turquesarestaurante.com`
- Dominio raiz: `https://turquesarestaurante.com`

## Regla principal

No tocar DNS, Vercel ni el portal WiFi de produccion sin respaldo y prueba previa.

## Sistema restaurante actual

- Ruta local: `http://127.0.0.1:3000/turquesa-restaurante`
- Pantalla aislada del ERP de fabrica.
- Carga datos desde la API Turquesa cuando la base existe.
- Si la base no esta aplicada todavia, trabaja en modo demo operativo para avanzar UI y flujo.
- Cierre de turno visible con ventas por metodo, efectivo esperado, efectivo contado, diferencia y bloqueo si quedan mesas abiertas.
- Inventario genera compra sugerida con items criticos/bajos, costo estimado desde costo promedio, ultima solicitud y recepcion de compra para actualizar existencias.
- Inventario incluye panel de proveedores para ver proveedor, costo promedio por unidad y ajustar costo desde la pantalla.
- Las comandas descuentan inventario automaticamente cuando el plato tiene receta enlazada.
- Impresoras agrega centro de despacho, cocina y bar con cola de tickets, copia maestra, ticket por estacion y reimpresion desde KDS.
- Inventario incluye mantenedor de recetas para ajustar consumo por plato desde la pantalla.
- Reportes muestra resumen del turno, mezcla de pagos, inventario valorizado, compra sugerida y exporta CSV para gerencia.
- AI analiza el turno con OpenAI cuando hay API key y cae a reglas locales si la conexion/modelo no responde.
