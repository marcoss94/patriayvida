import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { createShippingQuoteRoute } from "@/app/api/checkout/shipping-quote/route";
import { getShippingCost } from "@/lib/checkout";
import type { RateLimitResult } from "@/lib/rate-limit";
import { getShippingRule } from "@/lib/shipping-pricing";
import { createSupabaseRouteMock } from "@/test-utils/supabase-route-mock";

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest("https://shop.patriayvida.test/api/checkout/shipping-quote", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": "req-shipping-quote-test",
    },
    body: JSON.stringify(body),
  });
}

function createDeps() {
  return {
    calculateDistanceKm: () => 8,
    consumeShippingQuoteRateLimit: () => ({
      ok: true,
      limit: 30,
      remaining: 29,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60,
    }) satisfies RateLimitResult,
    createClient: async () => createSupabaseRouteMock() as never,
    geocodeUruguayAddress: async () => ({
      coordinates: { latitude: -34.9, longitude: -56.2 },
      source: "nominatim" as const,
    }),
    getShippingCost,
    getShippingRule,
    getStoreCoordinates: () => ({ latitude: -34.88, longitude: -56.11 }),
  };
}

describe("POST /api/checkout/shipping-quote", () => {
  it("rate limits repeated shipping quote requests", async () => {
    const POST = createShippingQuoteRoute({
      ...createDeps(),
      consumeShippingQuoteRateLimit: () => ({
        ok: false,
        limit: 30,
        remaining: 0,
        resetAt: Date.now() + 120_000,
        retryAfterSeconds: 120,
      }),
    });

    const response = await POST(
      buildRequest({
        deliveryMethod: "shipping",
        address: "Av. 18 de Julio 1234",
        city: "Montevideo",
      }),
    );
    const body = await response.json();

    assert.equal(response.status, 429);
    assert.equal(
      body.error,
      "Demasiadas cotizaciones de envío en poco tiempo. Esperá un momento antes de reintentar.",
    );
    assert.equal(response.headers.get("retry-after"), "120");
  });

  it("returns a computed quote for authenticated users", async () => {
    const POST = createShippingQuoteRoute(createDeps());

    const response = await POST(
      buildRequest({
        deliveryMethod: "shipping",
        address: "Av. 18 de Julio 1234",
        city: "Montevideo",
      }),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.distanceKm, 8);
    assert.equal(body.geocodeSource, "nominatim");
    assert.equal(body.shippingRule, getShippingRule(8, "shipping"));
  });
});
