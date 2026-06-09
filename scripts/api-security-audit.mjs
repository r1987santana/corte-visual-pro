import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const apiRoot = join(process.cwd(), "app", "api");

const publicRoutes = new Map([
  ["app/api/auth/login/route.ts", "public-login-rate-limited"],
  ["app/api/hr/candidate-intake/route.ts", "public-candidate-intake-rate-limited"],
  ["app/api/cron/route.ts", "cron-secret-protected"],
  ["app/api/crm/route.ts", "legacy-no-data"],
]);

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) return walk(path);
    return entry === "route.ts" ? [path] : [];
  });
}

function normalized(path) {
  return relative(process.cwd(), path).replace(/\\/g, "/");
}

function classifyRoute(path) {
  const rel = normalized(path);
  const source = readFileSync(path, "utf8");
  const protectedRoute =
    source.includes("requireApiSession") ||
    source.includes("createProtectedApiHandler");

  if (protectedRoute) return { rel, status: "protected" };

  const publicReason = publicRoutes.get(rel);
  if (!publicReason) return { rel, status: "unprotected" };

  if (publicReason.includes("rate-limited") && !source.includes("checkRateLimit")) {
    return { rel, status: "public-missing-rate-limit" };
  }

  if (publicReason.includes("cron-secret") && !source.includes("CRON_SECRET")) {
    return { rel, status: "cron-missing-secret" };
  }

  return { rel, status: publicReason };
}

const results = walk(apiRoot).map(classifyRoute).sort((a, b) => a.rel.localeCompare(b.rel));
const failures = results.filter((row) =>
  ["unprotected", "public-missing-rate-limit", "cron-missing-secret"].includes(row.status)
);

console.table(results);

if (failures.length) {
  console.error("\nAPI security audit failed:");
  for (const row of failures) {
    console.error(`- ${row.rel}: ${row.status}`);
  }
  process.exit(1);
}

console.log(`\nAPI security audit passed: ${results.length} route handlers reviewed.`);
