import { readFileSync, writeFileSync } from "node:fs";

const write = process.argv.includes("--write");

const files = [
  "components/saas/SaaSLayoutShell.tsx",
  "components/saas/ProtectedRoute.tsx",
  "lib/security/api-guard.ts",
  "app/api/auto-run/route.ts",
  "app/api/auto-purchase/route.ts",
  "app/api/scan/route.ts",
];

const replacements = [
  ["â€“", "-"],
  ["â€”", "-"],
  ["â†’", "->"],
  ["â€¢", "-"],
  ["Â¿", "¿"],
  ["Â·", "·"],
  ["mÂ²", "m²"],
  ["Ã¡", "á"],
  ["Ã©", "é"],
  ["Ã­", "í"],
  ["Ã³", "ó"],
  ["Ãº", "ú"],
  ["Ã±", "ñ"],
  ["Ã", "Á"],
  ["Ã‰", "É"],
  ["Ã", "Í"],
  ["Ã“", "Ó"],
  ["Ãš", "Ú"],
  ["Ã‘", "Ñ"],
  ["Ã˜", "Ø"],
  ["âœ…", "OK"],
  ["âš ï¸", "Advertencia:"],
  ["âŒ", "Error:"],
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
