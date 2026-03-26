import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  buildMercadoPagoPreferenceItems,
  getShippingCost,
  normalizeCheckoutPayload,
} from "@/lib/checkout";
import type { MercadoPagoPreferenceBody } from "@/lib/mercadopago";
import type { RateLimitResult } from "@/lib/rate-limit";
import { getShippingRule } from "@/lib/shipping-pricing";
import { selectReusablePendingOrder } from "@/lib/checkout-retry";
import { createCheckoutRoute, type CheckoutRouteDeps } from "@/app/api/checkout/route";
import { createSupabaseRouteMock, getFilterValue, type SupabaseQueryCall } from "@/test-utils/supabase-route-mock";

const checkoutPayload = {
  deliveryMethod: "shipping",
  customer: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "099123456",
    address: "Av. 18 de Julio 1234",
    city: "Montevideo",
    notes: "Apto 2",
  },
  cart: {
    items: [{ variantId: "variant-1", quantity: 2 }],
  },
} as const;

function buildRequest(body = checkoutPayload) {
  return new NextRequest("https://shop.patriayvida.test/api/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": "req-checkout-test",
    },
    body: JSON.stringify(body),
  });
}

function createDeps(overrides: Partial<CheckoutRouteDeps> & Pick<CheckoutRouteDeps, "createClient">) {
  const { createClient, ...rest } = overrides;

  return {
    buildMercadoPagoPreferenceItems,
    calculateDistanceKm: () => 12,
    createCheckoutProPreference: async () => ({ id: "pref-1", init_point: "https://mp.test/pay/pref-1" }) as never,
    createClient,
    geocodeUruguayAddress: async () => ({
      coordinates: { latitude: -34.9, longitude: -56.2 },
      source: "nominatim" as const,
    }),
    getCheckoutRedirectUrl: (preference: { init_point?: string | null; sandbox_init_point?: string | null }) =>
      preference.init_point ?? preference.sandbox_init_point ?? null,
    getShippingCost,
    getShippingRule,
    getStoreCoordinates: () => ({ latitude: -34.88, longitude: -56.11 }),
    isMercadoPagoConfigured: () => true,
    isProductionRuntime: () => false,
    normalizeCheckoutPayload,
    consumeCheckoutRateLimit: () => ({
      ok: true,
      limit: 6,
      remaining: 5,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60,
    }) satisfies RateLimitResult,
    selectReusablePendingOrder,
    ...rest,
  };
}

function findCall(calls: SupabaseQueryCall[], predicate: (call: SupabaseQueryCall) => boolean) {
  return calls.find(predicate) ?? null;
}

describe("POST /api/checkout", () => {
  it("rejects unauthenticated checkout attempts", async () => {
    const supabase = createSupabaseRouteMock({ user: null });
    const POST = createCheckoutRoute(
      createDeps({
        createClient: async () => supabase as never,
      })
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, "Tenés que iniciar sesión para comprar.");
  });

  it("creates a shipping checkout with persisted totals and Mercado Pago shipping metadata", async () => {
    let preferenceBody: Record<string, unknown> | null = null;

    const supabase = createSupabaseRouteMock({
      resolve(call) {
        if (call.table === "store_config") {
          return { data: { store_name: "Patria y Vida" }, error: null };
        }

        if (call.table === "product_variants") {
          return {
            data: [
              {
                id: "variant-1",
                name: "Negra",
                stock: 5,
                price_override: null,
                is_active: true,
                attributes: { size: "L" },
                product: {
                  id: "product-1",
                  name: "Remera Patria y Vida",
                  slug: "remera",
                  base_price: 150,
                  is_active: true,
                },
              },
            ],
            error: null,
          };
        }

        if (call.table === "orders" && call.action === "select") {
          assert.equal(getFilterValue(call, "eq", "user_id"), "user-1");
          assert.equal(getFilterValue(call, "eq", "status"), "pending");
          return { data: [], error: null };
        }

        if (call.table === "orders" && call.action === "insert") {
          const values = call.values as Record<string, unknown>;
          assert.equal(values.delivery_method, "shipping");
          assert.equal(values.shipping_cost, 180);
          assert.equal(values.subtotal, 300);
          assert.equal(values.total, 480);
          assert.equal((values.shipping_address as Record<string, unknown>).shipping_price_uyu, 180);
          return { data: { id: "order-new" }, error: null };
        }

        if (call.table === "order_items" && call.action === "insert") {
          return { data: null, error: null };
        }

        if (call.table === "orders" && call.action === "update") {
          return { data: null, error: null };
        }

        throw new Error(`Unexpected query ${call.action} ${call.table}`);
      },
    });

    const POST = createCheckoutRoute(
      createDeps({
        createClient: async () => supabase as never,
        getShippingCost: () => 180,
        getShippingRule: () => "distance_gt_5km",
        createCheckoutProPreference: async (body: MercadoPagoPreferenceBody) => {
          preferenceBody = body as unknown as Record<string, unknown>;
          return { id: "pref-1", init_point: "https://mp.test/pay/pref-1" } as never;
        },
      })
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.orderId, "order-new");
    assert.equal(body.preferenceId, "pref-1");
    assert.equal(body.total, 480);
    assert.notEqual(preferenceBody, null);

    const capturedPreference = preferenceBody as unknown as Record<string, unknown>;
    const metadata = capturedPreference["metadata"] as Record<string, unknown>;
    const items = capturedPreference["items"] as Array<{ id: string }>;

    assert.equal(metadata.shipping_cost_uyu, 180);
    assert.equal(metadata.total_uyu, 480);
    assert.equal(items.at(-1)?.id, "shipping");
  });

  it("rate limits repeated checkout attempts before expensive processing", async () => {
    const supabase = createSupabaseRouteMock();
    const POST = createCheckoutRoute(
      createDeps({
        createClient: async () => supabase as never,
        consumeCheckoutRateLimit: () => ({
          ok: false,
          limit: 6,
          remaining: 0,
          resetAt: Date.now() + 60_000,
          retryAfterSeconds: 60,
        }),
      })
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    assert.equal(response.status, 429);
    assert.equal(body.error, "Demasiados intentos de checkout. Esperá un momento antes de reintentar.");
    assert.equal(response.headers.get("retry-after"), "60");
    assert.equal(findCall(supabase.calls, (call) => call.table === "orders"), null);
    assert.equal(findCall(supabase.calls, (call) => call.table === "product_variants"), null);
  });

  it("reuses a matching recent pending order instead of creating a new one", async () => {
    const supabase = createSupabaseRouteMock({
      resolve(call) {
        if (call.table === "store_config") {
          return { data: { store_name: "Patria y Vida" }, error: null };
        }

        if (call.table === "product_variants") {
          return {
            data: [
              {
                id: "variant-1",
                name: "Negra",
                stock: 5,
                price_override: null,
                is_active: true,
                attributes: { size: "L" },
                product: {
                  id: "product-1",
                  name: "Remera Patria y Vida",
                  slug: "remera",
                  base_price: 150,
                  is_active: true,
                },
              },
            ],
            error: null,
          };
        }

        if (call.table === "orders" && call.action === "select") {
          return {
            data: [
              {
                id: "order-reused",
                created_at: "2026-03-21T17:55:00.000Z",
                delivery_method: "shipping",
                mp_payment_id: "pay-old",
                mp_preference_id: "pref-old",
                mp_status: "rejected:cc_rejected",
                shipping_address: {},
                shipping_cost: 180,
                status: "pending",
                subtotal: 300,
                total: 480,
              },
            ],
            error: null,
          };
        }

        if (call.table === "order_items" && call.action === "select") {
          return {
            data: [
              {
                order_id: "order-reused",
                variant_id: "variant-1",
                quantity: 2,
                unit_price: 150,
              },
            ],
            error: null,
          };
        }

        if (call.table === "orders" && call.action === "update" && call.resultMode === "maybeSingle") {
          const values = call.values as Record<string, unknown>;
          assert.equal(getFilterValue(call, "eq", "id"), "order-reused");
          assert.equal(values.mp_payment_id, null);
          assert.equal(values.mp_preference_id, null);
          assert.equal(values.mp_status, "preference_pending");
          return { data: { id: "order-reused" }, error: null };
        }

        if (call.table === "orders" && call.action === "update") {
          return { data: null, error: null };
        }

        throw new Error(`Unexpected query ${call.action} ${call.table}`);
      },
    });

    const POST = createCheckoutRoute(
      createDeps({
        createClient: async () => supabase as never,
        getShippingCost: () => 180,
        getShippingRule: () => "distance_gt_5km",
        selectReusablePendingOrder: () => ({
          id: "order-reused",
          created_at: "2026-03-21T17:55:00.000Z",
          delivery_method: "shipping",
          mp_payment_id: "pay-old",
          mp_preference_id: "pref-old",
          mp_status: "rejected:cc_rejected",
          shipping_address: {},
          shipping_cost: 180,
          status: "pending",
          subtotal: 300,
          total: 480,
        }),
      })
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.orderId, "order-reused");
    assert.equal(findCall(supabase.calls, (call) => call.table === "orders" && call.action === "insert"), null);
    assert.equal(findCall(supabase.calls, (call) => call.table === "order_items" && call.action === "insert"), null);
  });

  it("marks the order when Mercado Pago does not return a usable redirect", async () => {
    const supabase = createSupabaseRouteMock({
      resolve(call) {
        if (call.table === "store_config") {
          return { data: { store_name: "Patria y Vida" }, error: null };
        }

        if (call.table === "product_variants") {
          return {
            data: [
              {
                id: "variant-1",
                name: "Negra",
                stock: 5,
                price_override: null,
                is_active: true,
                attributes: { size: "L" },
                product: {
                  id: "product-1",
                  name: "Remera Patria y Vida",
                  slug: "remera",
                  base_price: 150,
                  is_active: true,
                },
              },
            ],
            error: null,
          };
        }

        if (call.table === "orders" && call.action === "select") {
          return { data: [], error: null };
        }

        if (call.table === "orders" && call.action === "insert") {
          return { data: { id: "order-missing-redirect" }, error: null };
        }

        if (call.table === "order_items" && call.action === "insert") {
          return { data: null, error: null };
        }

        if (call.table === "orders" && call.action === "update") {
          const values = call.values as Record<string, unknown>;
          if (values.mp_status === "preference_missing_redirect") {
            assert.equal(getFilterValue(call, "eq", "id"), "order-missing-redirect");
          }
          return { data: null, error: null };
        }

        throw new Error(`Unexpected query ${call.action} ${call.table}`);
      },
    });

    const POST = createCheckoutRoute(
      createDeps({
        createClient: async () => supabase as never,
        getShippingCost: () => 180,
        getShippingRule: () => "distance_gt_5km",
        createCheckoutProPreference: async () => ({ id: "pref-redirectless", init_point: null } as never),
      })
    );

    const response = await POST(buildRequest());
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.equal(body.error, "Mercado Pago no devolvió una URL válida para continuar el pago.");
    assert.notEqual(
      findCall(
        supabase.calls,
        (call) =>
          call.table === "orders" &&
          call.action === "update" &&
          (call.values as Record<string, unknown>).mp_status === "preference_missing_redirect"
      ),
      null
    );
  });
});
