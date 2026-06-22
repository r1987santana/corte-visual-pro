# Turquesa Restaurant OS - Arquitectura de almacen

## Principio de migracion

Esta evolucion debe ser aditiva. No se renombran ni eliminan rutas, tablas,
columnas, componentes ni flujos existentes. El POS, cocina, reservas, caja,
inventario basico y auditoria actual siguen funcionando mientras se incorpora
el control profesional de almacen.

## A) Lo que ya existe

- Base multi-restaurante mediante `restaurant_id`.
- POS, mesas, comandas, cocina/KDS, pagos, turnos, reservas y cierres.
- Inventario basico en `turquesa_inventory_items`.
- Recetas actuales en `turquesa_recipe_ingredients`.
- Descuento automatico de inventario por receta al crear tickets de cocina.
- Compras sugeridas y recepcion simple con `turquesa_purchase_requests`.
- Decomiso y mermas iniciales mediante eventos y contabilidad.
- Auditoria en `turquesa_events`.
- Contabilidad en `turquesa_accounting_entries`.

## B) Lo que falta

- Kardex inmutable por movimiento.
- Almacen principal y subalmacenes.
- Recepcion real con suplidor, factura, costo, lote y vencimiento.
- Transferencias internas documentadas.
- Inventario fisico semanal.
- Produccion interna con merma.
- Control de bar por botella, ml, tragos esperados y diferencias.
- Dashboard CEO con costo teorico, costo real, mermas, vencimientos y alertas.

## C) Archivos tocados en Fase 1

- `scripts/turquesa-warehouse-phase1.sql`
- `lib/turquesa/restaurant-data.ts`
- `turquesa-restaurante/docs/almacen-arquitectura.md`

## D) Tablas nuevas de Fase 1

- `turquesa_storage_locations`
- `turquesa_suppliers`
- `turquesa_inventory_units`
- `turquesa_purchase_receipts`
- `turquesa_purchase_receipt_items`
- `turquesa_inventory_batches`
- `turquesa_stock_balances`
- `turquesa_inventory_movements`
- `turquesa_internal_transfers`
- `turquesa_internal_transfer_items`
- `turquesa_weekly_inventory_counts`
- `turquesa_weekly_inventory_count_items`
- `turquesa_internal_productions`
- `turquesa_internal_production_items`
- `turquesa_bar_yield_profiles`
- `turquesa_recipe_versions`
- `turquesa_recipe_version_ingredients`

## E) Tablas existentes reutilizadas

- `turquesa_restaurants`
- `turquesa_inventory_items`
- `turquesa_menu_items`
- `turquesa_recipe_ingredients`
- `turquesa_orders`
- `turquesa_order_items`
- `turquesa_kitchen_tickets`
- `turquesa_staff`
- `turquesa_purchase_requests`
- `turquesa_purchase_request_items`
- `turquesa_events`
- `turquesa_accounting_entries`

## F) Plan sin romper

1. Crear tablas nuevas y catalogos estructurales sin datos operativos falsos.
2. Mantener `turquesa_inventory_items.on_hand` como cache compatible.
3. Escribir nuevos movimientos en `turquesa_inventory_movements` sin editar
   historial.
4. En la fase de API, hacer escritura doble: flujo actual + kardex nuevo.
5. Generar ajustes de inventario semanal como movimientos documentados.
6. Mantener recetas actuales y agregar versiones sin cambiar el POS de golpe.
7. Llevar el dashboard CEO al nuevo ledger cuando existan movimientos reales.

## Fases siguientes

### Fase 2 - Pantallas de almacen

- Almacen principal.
- Subalmacenes: cocina, bar, playa/piscina, limpieza, seco, refrigerado,
  congelado.
- Registro de compras y recepcion por factura.
- Transferencias internas.

### Fase 3 - Inventario semanal

- Apertura de conteo por semana del ano.
- Conteo fisico por ubicacion.
- Diferencia contra existencia esperada.
- Evidencia/foto opcional.
- Firma o confirmacion del responsable.

### Fase 4 - Recetas y descuento automatico

- Versionado de recetas.
- Costo teorico por plato.
- Descuento por POS contra ingredientes.
- Compatibilidad temporal con `turquesa_recipe_ingredients`.

### Fase 5 - Produccion interna y merma

- Limpieza de camarones.
- Salsas.
- Porcionado de carnes.
- Jugos.
- Bases de cocina.
- Registro de materia prima, producto util y merma.

### Fase 6 - Dashboard CEO

- Compras semanales.
- Inventario valorizado.
- Diferencias semanales.
- Mermas por area.
- Productos proximos a vencer.
- Bajo stock.
- Costo teorico contra costo real.
- Rentabilidad por plato.
- Alertas de descuadre.
