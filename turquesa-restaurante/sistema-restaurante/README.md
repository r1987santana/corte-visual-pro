# Sistema restaurante

Aqui se trabaja el sistema operativo de Turquesa.

Modulos previstos:

- POS / caja restaurante.
- Mesas.
- Comandas.
- Cocina / KDS.
- Impresoras cocina, bar y centro de despacho.
- Menu operativo.
- Reservas.
- Inventario de alimentos y bebidas.
- Compras.
- Propinas y cierre diario.
- Reportes.
- AI operativa supervisada.

## Implementado

- Ruta: `/turquesa-restaurante`
- Pantalla: `TurquesaRestaurantOS.tsx`
- Estilos: `TurquesaRestaurantOS.module.css`
- Impresion local: `restaurant-printing.ts`
- Datos compartidos: `lib/turquesa/restaurant-data.ts`
- API: `app/api/turquesa-restaurante/operacion/route.ts`
- API AI: `app/api/turquesa-restaurante/ai/route.ts`
- SQL base: `scripts/turquesa-restaurant-core.sql`
- Variables privadas Turquesa: `turquesa-restaurante/.env.local`

La pantalla carga desde API/base de datos si existe y mantiene modo demo si la base todavia no esta aplicada.

## Flujos actuales

- `send_to_kitchen`: envia comanda a cocina/KDS.
- Consumo automatico: `send_to_kitchen` descuenta ingredientes desde recetas enlazadas al menu.
- `advance_ticket`: mueve ticket de cocina entre nueva, en cocina, lista y servida.
- `printJob` / `printPending`: genera tickets imprimibles de 80mm para despacho, cocina y bar desde la cola local.
- `close_order`: cobra mesa, registra pago, actualiza venta del turno y libera mesa.
- `create_reservation`: crea reserva confirmada para el turno.
- `adjust_inventory`: ajusta inventario rapido y deja evento operativo.
- `update_inventory_cost`: actualiza proveedor/costo promedio del insumo y deja evento operativo.
- `create_purchase_request`: genera solicitud de compra desde inventario bajo o critico.
- `update_recipe_ingredient`: ajusta cantidad de consumo de un insumo dentro de una receta.
- `receive_purchase_request`: recibe una solicitud de compra, suma cantidades al inventario y marca las lineas como recibidas.
- `update_wifi_lead`: cambia estado de cliente capturado por Wi-Fi.
- `close_shift`: cierra turno solo cuando no quedan mesas/ordenes abiertas, guarda efectivo contado, diferencia y resumen de caja.
- `exportTurnReport`: genera CSV local con venta, pagos, mesas, KDS, reservas, Wi-Fi, inventario, compras y alertas.
- `runTurquesaAI`: envia el snapshot operativo al endpoint AI, recibe riesgo, recomendaciones, vigilancia y proximos pasos.

En modo demo estos flujos actualizan la UI localmente para poder seguir disenando y probando operaciones.

## Cierre de caja

- Muestra venta cobrada del turno, fondo inicial, efectivo, tarjeta, transferencia y efectivo esperado.
- Permite escribir efectivo contado y nota de cierre.
- Calcula diferencia de caja en tiempo real.
- Bloquea el cierre si quedan mesas abiertas para evitar cierres incompletos.

## Compras sugeridas

- Muestra compra recomendada desde items bajo minimo o criticos.
- Calcula cantidad sugerida para llevar inventario a reposicion.
- Estima costo desde `avg_cost` y usa el proveedor guardado en inventario.
- Crea solicitud de compra en modo demo o por API cuando la base exista.
- Recibe la compra pendiente y actualiza existencias para cerrar el ciclo de inventario.

## Proveedores y costos

- Cada item de inventario maneja `supplier` y `avg_cost`.
- El panel `Proveedores` muestra costo de inventario, proveedor por insumo y costo promedio por unidad.
- Los ajustes de costo cambian inmediatamente las compras sugeridas en modo demo y persisten por API cuando la base exista.

## Reportes

- La vista `Reportes` resume venta cobrada, saldo abierto, ventas proyectadas, inventario valorizado y compra sugerida.
- Incluye mezcla de pagos con barras por efectivo, tarjeta y transferencia.
- Exporta CSV del turno para gerencia sin depender todavia de la base historica.

## Turquesa AI

- La vista `AI` muestra Turquesa AI Copilot con analisis supervisado del turno.
- Usa OpenAI Responses cuando `OPENAI_API_KEY` esta en `turquesa-restaurante/.env.local`.
- Si OpenAI no esta disponible, responde con reglas locales para no detener operacion.
- La AI recomienda acciones, pero no ejecuta compras, cobros, cambios de inventario ni cierres sin aprobacion humana.

## Impresoras y despacho

- La vista `Impresoras` separa cada ticket KDS en copia maestra para Centro de despacho y copia por estacion para Cocina o Bar.
- Los botones `Imprimir pendientes`, `Imprimir Cocina`, `Imprimir Bar` e `Imprimir` por ticket abren un documento termico de 80mm y llaman `window.print()`.
- La cola marca tickets como enviados y permite reimpresion sin cambiar el estado de cocina.
- Este paso deja el flujo operativo listo para pruebas con impresora normal o PDF. Para impresion directa sin dialogo del navegador falta instalar/asignar las impresoras termicas reales y conectar un agente local o modo kiosko.

## Recetas e inventario automatico

- `turquesa_recipe_ingredients` enlaza platos del menu con items de inventario.
- El panel `Recetas` permite seleccionar un plato y subir/bajar el consumo por insumo.
- Al enviar una comanda, el API descuenta los ingredientes consumidos por cantidad vendida.
- En modo demo, la UI aplica las recetas locales para probar el flujo antes de aplicar Supabase.
- El descuento deja evento `inventory_consumed_by_ticket` para auditoria operativa.
