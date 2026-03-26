import type { NextRequest } from "next/server";

type RateLimitBucket = "checkout" | "shipping_quote";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitConfig = {
  bucket: RateLimitBucket;
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const RATE_LIMIT_STORE_KEY = "__patriayvida_rate_limit_store__";

function getRateLimitStore() {
  const globalScope = globalThis as typeof globalThis & {
    [RATE_LIMIT_STORE_KEY]?: Map<string, RateLimitEntry>;
  };

  if (!globalScope[RATE_LIMIT_STORE_KEY]) {
    globalScope[RATE_LIMIT_STORE_KEY] = new Map<string, RateLimitEntry>();
  }

  return globalScope[RATE_LIMIT_STORE_KEY];
}

function buildStoreKey(bucket: RateLimitBucket, key: string) {
  return `${bucket}:${key}`;
}

export function resolveRateLimitKey(request: NextRequest, userId: string) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const firstForwardedIp = forwardedFor?.split(",", 1)[0]?.trim() ?? "";
  const ip = firstForwardedIp || realIp?.trim() || "unknown";

  return `${userId}:${ip}`;
}

export function consumeRateLimit(config: RateLimitConfig): RateLimitResult {
  const now = config.now ?? Date.now();
  const store = getRateLimitStore();
  const storeKey = buildStoreKey(config.bucket, config.key);
  const current = store.get(storeKey);

  if (!current || current.resetAt <= now) {
    const resetAt = now + config.windowMs;
    store.set(storeKey, { count: 1, resetAt });

    return {
      ok: true,
      limit: config.limit,
      remaining: Math.max(config.limit - 1, 0),
      resetAt,
      retryAfterSeconds: Math.ceil(config.windowMs / 1000),
    };
  }

  if (current.count >= config.limit) {
    return {
      ok: false,
      limit: config.limit,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      ),
    };
  }

  current.count += 1;
  store.set(storeKey, current);

  return {
    ok: true,
    limit: config.limit,
    remaining: Math.max(config.limit - current.count, 0),
    resetAt: current.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export function buildRateLimitHeaders(result: RateLimitResult) {
  return {
    "Retry-After": String(result.retryAfterSeconds),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

export function consumeCheckoutRateLimit(request: NextRequest, userId: string) {
  return consumeRateLimit({
    bucket: "checkout",
    key: resolveRateLimitKey(request, userId),
    limit: 6,
    windowMs: 10 * 60 * 1000,
  });
}

export function consumeShippingQuoteRateLimit(request: NextRequest, userId: string) {
  return consumeRateLimit({
    bucket: "shipping_quote",
    key: resolveRateLimitKey(request, userId),
    limit: 30,
    windowMs: 5 * 60 * 1000,
  });
}

export function resetRateLimitStore() {
  getRateLimitStore().clear();
}
