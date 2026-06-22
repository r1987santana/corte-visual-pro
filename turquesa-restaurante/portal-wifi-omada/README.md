# Portal WiFi Omada

Aqui ira el codigo y respaldo del portal cautivo `wifi.turquesarestaurante.com`.

Estado actual:

- El portal esta vivo y funcionando.
- Omada redirige al cliente al portal.
- El formulario envia a `/api/access`.
- El backend autoriza el dispositivo en Omada y luego el cliente obtiene internet.
- Se guardo una copia visible de produccion en `current/`:
  - `current/index.html`
  - `current/portal.css`
  - `current/turquesa-logo.png`

Regla:

No tocar este portal en produccion sin respaldo, porque esta operativo.

Datos funcionales conocidos:

- Campos visibles: nombre, celular, correo, consentimiento.
- Campo oculto: `portalContext`, con datos de Omada.
- Ruta principal: `/`
- Ruta backend: `/api/access`

## Nota

La copia en `current/` no sustituye el codigo fuente completo del proyecto Next.js. Es una fotografia publica para referencia y respaldo visual.
