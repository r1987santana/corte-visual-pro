#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const modules = [
  {
    name: "corte-produccion",
    patterns: [
      /^app\/corte\//,
      /^app\/optimizacion-corte\//,
      /^app\/production-orders-ai\//,
      /^app\/inventario-inteligente\/requisiciones\//,
      /^app\/api\/warehouse-requisitions\//,
      /^components\/ProduccionBomProClient\.tsx$/,
      /^lib\/cut/,
      /^lib\/production/,
    ],
  },
  {
    name: "rrhh-nomina",
    patterns: [
      /^app\/rrhh/,
      /^app\/employee-self-service\//,
      /^app\/payroll\//,
      /^app\/lms\//,
      /^app\/trabaja-con-nosotros\//,
    ],
  },
  {
    name: "operaciones-comercial",
    patterns: [
      /^app\/agenda\//,
      /^app\/crm\//,
      /^app\/helpdesk\//,
      /^app\/levantamientos\//,
      /^app\/instaladores\//,
      /^app\/entrega-final\//,
      /^app\/pagos\//,
      /^app\/reportes\//,
      /^app\/rentabilidad\//,
      /^app\/solicitudes-internas\//,
    ],
  },
  {
    name: "portal-pdf",
    patterns: [
      /^app\/portal-cliente\//,
      /^components\/ContratoProyectoClient\.tsx$/,
      /^lib\/pdf\//,
      /^app\/historial\//,
    ],
  },
  {
    name: "ai-diseno",
    patterns: [
      /^app\/ia-diseno\//,
      /^app\/ai-designer\//,
      /^lib\/clientPortalWhatsApp\.ts$/,
      /^lib\/designMaterialRoles\.ts$/,
      /^lib\/iaDesignPrompt\.ts$/,
    ],
  },
  {
    name: "shell-saas",
    patterns: [/^components\/saas\//, /^app\/globals\.css$/, /^app\/bi-ceo\//],
  },
  {
    name: "scripts-ops",
    patterns: [/^scripts\//],
  },
];

function gitStatus() {
  return execFileSync("git", ["status", "--porcelain=v1"], {
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2).trim() || line.slice(0, 2);
      const rawPath = line.slice(3);
      const file = rawPath.includes(" -> ") ? rawPath.split(" -> ").pop() : rawPath;
      return { status, file: file.replace(/\\/g, "/") };
    });
}

function moduleFor(file) {
  return modules.find((module) =>
    module.patterns.some((pattern) => pattern.test(file)),
  )?.name ?? "sin-clasificar";
}

const rows = gitStatus();
const grouped = new Map();

for (const row of rows) {
  const group = moduleFor(row.file);
  const list = grouped.get(group) ?? [];
  list.push(row);
  grouped.set(group, list);
}

if (rows.length === 0) {
  console.log("No hay cambios pendientes.");
  process.exit(0);
}

console.log(`Cambios pendientes: ${rows.length}`);
for (const [group, files] of [...grouped.entries()].sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  console.log(`\n[${group}] ${files.length}`);
  for (const row of files.sort((a, b) => a.file.localeCompare(b.file))) {
    console.log(`  ${row.status.padEnd(2)} ${row.file}`);
  }
}
