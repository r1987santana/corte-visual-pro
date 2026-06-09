#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const strict = process.argv.includes("--strict");

const rules = [
  {
    name: "next-page",
    pattern: /^app\/.*\/page\.tsx$/,
    warn: 3000,
    fail: 4600,
  },
  {
    name: "client-component",
    pattern: /^components\/.*\.tsx$/,
    warn: 1800,
    fail: 2800,
  },
  {
    name: "domain-lib",
    pattern: /^lib\/.*\.(ts|tsx)$/,
    warn: 1200,
    fail: 2200,
  },
];

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split(/\r?\n/)
  .filter(Boolean)
  .map((file) => file.replace(/\\/g, "/"))
  .filter((file) => /\.(ts|tsx|mjs)$/.test(file))
  .filter((file) => !file.startsWith("node_modules/") && !file.startsWith(".next/"));

const findings = [];

for (const file of files) {
  const rule = rules.find((candidate) => candidate.pattern.test(file));
  if (!rule) continue;

  const lines = readFileSync(file, "utf8").split(/\r?\n/).length;
  if (lines >= rule.warn) {
    findings.push({
      file,
      lines,
      rule: rule.name,
      severity: lines >= rule.fail ? "FAIL" : "WARN",
      budget: lines >= rule.fail ? rule.fail : rule.warn,
    });
  }
}

if (findings.length === 0) {
  console.log("Auditoria modular limpia: no hay archivos sobre presupuesto.");
  process.exit(0);
}

console.log("Auditoria modular: archivos grandes a vigilar");
for (const finding of findings.sort((a, b) => b.lines - a.lines)) {
  console.log(
    `${finding.severity.padEnd(4)} ${String(finding.lines).padStart(5)} lineas ` +
      `${finding.file} (${finding.rule}, presupuesto ${finding.budget})`,
  );
}

const hardFailures = findings.filter((finding) => finding.severity === "FAIL");
if (hardFailures.length > 0) {
  const message = `\nLimite duro detectado: ${hardFailures.length} archivo(s) exceden el presupuesto.`;
  if (strict) {
    console.error(`${message} Ejecutado en modo estricto.`);
    process.exit(1);
  }

  console.log(`${message} Use audit:modules:strict para bloquear por estos hallazgos.`);
}
