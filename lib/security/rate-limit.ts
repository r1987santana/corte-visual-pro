import { NextResponse } from "next/server";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

function clientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function cleanupExpired(now: number) {
  if (buckets.size < 500) return;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(request: Request, options: RateLimitOptions) {
  const now = Date.now();
  cleanupExpired(now);

  const key = `${options.key}:${clientIp(request)}`;
  const current = buckets.get(key);
  const bucket =
    current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + options.windowMs };

  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    allowed: bucket.count <= options.limit,
    remaining: Math.max(0, options.limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function rateLimitResponse(result: ReturnType<typeof checkRateLimit>) {
  return NextResponse.json(
    {
      ok: false,
      error: "Demasiados intentos. Espera un momento e intenta de nuevo.",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
      },
    }
  );
}
