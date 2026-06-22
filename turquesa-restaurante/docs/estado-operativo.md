# Estado operativo Turquesa

Fecha de actualizacion: 2026-06-22

## Confirmado

- `turquesarestaurante.com` esta comprado en Vercel.
- Registrar: Vercel.
- Nameservers: Vercel.
- Vercel CDN: activo.
- Auto-renewal: activo.
- Expira: 2027-06-18.

## Web publica

URL: `https://www.turquesarestaurante.com`

- Sitio vivo en Vercel.
- Web estatica con `index.html`, `/styles.css`, `/script.js` y `/assets`.
- Reservas por WhatsApp al `829-755-0107`.
- Email: `turquesarestaurantbayahibe@gmail.com`.

## Portal WiFi Omada

URL: `https://wifi.turquesarestaurante.com`

- App Next.js viva en Vercel.
- Portal cautivo conectado a Omada.
- El cliente registra nombre, celular, correo y consentimiento.
- Luego Omada autoriza el dispositivo y da acceso a internet.
- El usuario confirmo que funciona correctamente en produccion.

## Sistema interno

En `C:\rd-wood-system\rd-wood-system` Turquesa existe en RRHH y nomina multiempresa:

- Empresa: `turquesa_restaurant`
- Modelo: `restaurant_tips_points`
- Propina 10% por puntos.
- Centros de costo: Salon, Cocina, Bar, Caja, Eventos, Delivery, Limpieza, Administracion.

## Sistema restaurante creado

Ruta local: `http://127.0.0.1:3000/turquesa-restaurante`

- UI inicial: Turquesa Restaurante OS.
- Modulos visibles: mapa de mesas, POS rapido, comanda, KDS, impresoras, reservas, inventario, AI, reportes, gerencia y clientes Wi-Fi.
- La ruta ya no entra al login ni al sistema de fabrica.
- API inicial: `/api/turquesa-restaurante/operacion`.
- SQL inicial: `scripts/turquesa-restaurant-core.sql`.
- La pantalla soporta modo demo mientras se aplica el SQL en Supabase.
- Acciones operativas listas en UI: enviar cocina, avanzar KDS, cobrar mesa, selector de metodo de pago, reservas, inventario, proveedores/costos, recetas con consumo automatico, compras sugeridas, recepcion de compras, clientes Wi-Fi, AI supervisada, reportes CSV y cierre operativo.
- Accion API preparada para cobro: `close_order`, registra pago, actualiza turno y libera mesa cuando la base exista.
- Flujos nuevos: crear reserva, ajustar inventario rapido y marcar clientes del portal Wi-Fi como cliente/promocion.
- Cierre de caja agregado: desglose efectivo/tarjeta/transferencia, fondo inicial, efectivo esperado, efectivo contado, diferencia y advertencia por mesas abiertas.
- Compras sugeridas agregadas: inventario bajo/critico calcula cantidades, costo estimado, crea solicitud de compra y permite recibirla para actualizar existencias.
- Proveedores y costos agregados: cada insumo tiene proveedor y costo promedio, la compra sugerida usa esos costos y la API permite actualizar `avg_cost`/`supplier`.
- Reportes agregados: vista de gerencia con venta cobrada, saldo abierto, ventas proyectadas, mezcla de pagos, inventario valorizado, compras e indicador operativo; exporta CSV del turno.
- AI agregada: `Turquesa AI Copilot` analiza snapshot operativo, riesgo, recomendaciones, lista de vigilancia y proximos pasos. Usa `OPENAI_API_KEY` desde `turquesa-restaurante/.env.local` y fallback local si OpenAI no responde.
- Impresoras agregadas: vista `Impresoras` con centro de despacho, cocina y bar, cola de tickets, impresion de pendientes, reimpresion y documento termico de 80mm por navegador.
- Consumo automatico agregado: al enviar una comanda a cocina, las recetas descuentan insumos del inventario y registran evento operativo.
- Mantenedor de recetas agregado: desde Inventario se puede ajustar cantidad de consumo por plato e insumo.
- Acciones API nuevas: `create_reservation`, `adjust_inventory`, `update_inventory_cost`, `create_purchase_request`, `update_recipe_ingredient`, `receive_purchase_request`, `update_wifi_lead`, `close_shift`.
- API AI nueva: `/api/turquesa-restaurante/ai`.
- SQL actualizado para recetas: `turquesa_recipe_ingredients` enlaza menu con inventario y cantidades de consumo.
- SQL actualizado para cierre: `turquesa_shifts` guarda `expected_cash_drawer`, `counted_cash`, `cash_difference` y `closing_summary`.
- SQL actualizado para compras: `turquesa_purchase_requests` y `turquesa_purchase_request_items`.

## Nota impresoras fisicas

- Windows detecta impresoras locales, pero cocina y bar todavia deben instalarse/asignarse como impresoras termicas reales.
- La impresion actual usa `window.print()` para que el navegador muestre el dialogo de impresion.
- Para imprimir sin dialogo hace falta un modo kiosko o un agente local que reciba trabajos y los envie por nombre de impresora.

## Pendiente de organizar aqui

- Aplicar el SQL en Supabase cuando estemos listos para persistencia real.
- Conectar historico real de reportes, roles operativos y capturas reales del portal Wi-Fi.
- Definir roles operativos: gerente, caja, salon, cocina, bar e inventario.
- Instalar/asignar impresoras termicas reales para Cocina y Bar, y decidir si Despacho usa impresora principal o termica dedicada.
