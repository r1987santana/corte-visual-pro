# RD Wood System - Estabilizacion Modular

Fecha: 2026-06-09

## Estado de los 7 puntos

1. Vercel conectado
   - Proyecto vinculado por `.vercel/project.json`.
   - Produccion publicada en `https://corte-visual-pro.vercel.app`.
   - CLI autenticado en esta maquina.

2. Git con cambios pendientes
   - El repo tiene cambios locales previos en muchos modulos.
   - Para no mezclar trabajo, cada estabilizacion nueva debe entrar en commits pequenos por area.
   - Antes de push a GitHub, revisar `git status --short --branch`.

3. Warning de face-api
   - `@vladmandic/face-api` usa require dinamico interno.
   - `next.config.ts` silencia solo ese warning conocido para que el build destaque problemas nuevos.

4. Textos / encoding
   - Se agrego `scripts/fix-mojibake-critical.mjs` para revisar archivos criticos.
   - Si PowerShell muestra `Ã`, confirmar con Node o navegador antes de cambiar codigo: puede ser encoding de consola.

5. Shell y modularidad
   - Nuevo helper `lib/security/api-route.ts` reduce repeticion en APIs protegidas.
   - Nuevas rutas protegidas pueden usar `createProtectedApiHandler(permission, handler)`.

6. QA visual y tecnico
   - `npm run lint` valida TypeScript.
   - `npm run build` valida Next produccion.
   - `npm run audit:api-security` valida clasificacion de APIs.

7. Seguridad API
   - Nuevo `lib/security/rate-limit.ts` para endpoints publicos.
   - Login publico tiene limite por IP y correo.
   - Captacion publica RRHH tiene limite por IP y contacto.
   - `scripts/api-security-audit.mjs` falla si aparece una API nueva sin proteccion o clasificacion publica.

## Comandos recomendados antes de publicar

```powershell
npm run lint
npm run audit:api-security
npm run build
vercel deploy --prod --yes
```

## Regla modular

Cada modulo nuevo debe separar:

- UI de pagina
- componentes de dominio
- helpers de negocio en `lib/`
- API protegida con `createProtectedApiHandler`
- validacion/auditoria en script cuando aplique
