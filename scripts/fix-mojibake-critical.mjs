import { readFileSync, writeFileSync } from "node:fs";

const write = process.argv.includes("--write");

const files = [
  "components/saas/SaaSLayoutShell.tsx",
  "components/saas/ProtectedRoute.tsx",
  "lib/security/api-guard.ts",
  "app/api/auto-run/route.ts",
  "app/api/auto-purchase/route.ts",
  "app/api/scan/route.ts",
  "app/corte/page.tsx",
  "app/optimizacion-corte/page.tsx",
];

const replacements = [
  ["\u00c3\u0081", "\u00c1"],
  ["\u00c3\u0089", "\u00c9"],
  ["\u00c3\u008d", "\u00cd"],
  ["\u00c3\u0093", "\u00d3"],
  ["\u00c3\u009a", "\u00da"],
  ["\u00c3\u0091", "\u00d1"],
  ["\u00c3\u2030", "\u00c9"],
  ["\u00c3\u201c", "\u00d3"],
  ["\u00c3\u0161", "\u00da"],
  ["\u00c3\u2018", "\u00d1"],
  ["\u00c3\u02dc", "\u00d8"],
  ["\u00c3\u00a1", "\u00e1"],
  ["\u00c3\u00a9", "\u00e9"],
  ["\u00c3\u00ad", "\u00ed"],
  ["\u00c3\u00b3", "\u00f3"],
  ["\u00c3\u00ba", "\u00fa"],
  ["\u00c3\u00b1", "\u00f1"],
  ["\u00c3\u00bc", "\u00fc"],
  ["\u00c3\u0098", "\u00d8"],
  ["\u00c2\u00bf", "\u00bf"],
  ["\u00c2\u00a1", "\u00a1"],
  ["\u00c2\u00b7", "\u00b7"],
  ["\u00c2\u00b0", "\u00b0"],
  ["m\u00c2\u00b2", "m\u00b2"],
  ["\u00c3\u2014", "\u00d7"],
  ["\u00e2\u2020\u2019", "\u2192"],
  ["\u00e2\u0153\u2026", "\u2705"],
  ["\u00e2\u0161\u00a0\u00ef\u00b8\u008f", "\u26a0\ufe0f"],
  ["\u00e2\u009d\u0152", "\u274c"],
  ["\u00e2\u20ac\u201c", "-"],
  ["\u00e2\u20ac\u009d", "-"],
  ["\u00e2\u20ac\u0153", "\""],
  ["\u00e2\u20ac\u009d", "\""],
  ["\u00e2\u20ac\u02dc", "'"],
  ["\u00e2\u20ac\u2122", "'"],
  ["\u00e2\u20ac\u00a6", "..."],
];

let changed = 0;

for (const file of files) {
  const original = readFileSync(file, "utf8");
  let next = original;

  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }

  if (next !== original) {
    changed += 1;
    if (write) writeFileSync(file, next);
    console.log(`${write ? "fixed" : "would fix"} ${file}`);
  }
}

if (!changed) {
  console.log("No mojibake found in critical files.");
} else if (!write) {
  console.log("Run with --write to apply fixes.");
}
