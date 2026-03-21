import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { derivePaymentState } from "@/lib/checkout-status";
import { createCheckoutStatusRoute } from "@/app/api/checkout/status/route";
import { createSupabaseRouteMock, getFilterValue } from "@/test-utils/supabase-route-mock";

function buildRequest(url: string) {
  return new NextRequest(url, {
    headers: {
      "x-request-id": "req-status-test",
    },
  });
}

describe("GET /api/checkout/status", () => {
  it("rejects unauthenticated order lookups", async () => {
    const supabase = createSupabaseRouteMock({ user: null });
    const GET = createCheckoutStatusRoute({
      createClient: async () => supabase as never,
      derivePaymentState,
    });

    const response = await GET(buildRequest("https://patriayvida.test/api/checkout/status?order_id=order-1"));
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, "Tenés que iniciar sesión para consultar tu orden.");
  });

  it("scopes the order lookup to the authenticated user and returns 404 when missing", async () => {
    const supabase = createSupabaseRouteMock({
      user: { id: "user-42" },
      resolve(call) {
        assert.equal(call.table, "orders");
        assert.equal(call.action, "select");
        assert.equal(getFilterValue(call, "eq", "id"), "order-404");
        assert.equal(getFilterValue(call, "eq", "user_id"), "user-42");

        return { data: null, error: null };
      },
    });
    const GET = createCheckoutStatusRoute({
      createClient: async () => supabase as never,
      derivePaymentState,
    });

    const response = await GET(buildRequest("https://patriayvida.test/api/checkout/status?order_id=order-404"));
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "No encontramos esa orden para tu cuenta.");
  });

  it("derives approved payment state even when the return hint says failure", async () => {
    const supabase = createSupabaseRouteMock({
      user: { id: "user-1" },
      resolve() {
        return {
          data: {
            id: "order-approved",
            status: "pending",
            mp_status: "approved:accredited",
            mp_payment_id: "pay-1",
            mp_preference_id: "pref-1",
            total: 480,
            updated_at: "2026-03-21T18:00:00.000Z",
          },
          error: null,
        };
      },
    });
    const GET = createCheckoutStatusRoute({
      createClient: async () => supabase as never,
      derivePaymentState,
    });

    const response = await GET(
      buildRequest(
        "https://patriayvida.test/api/checkout/status?order_id=order-approved&checkout_status=failure"
      )
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.order.paymentState, "paid");
    assert.equal(body.order.paymentStateDetail, "payment_approved");
    assert.equal(body.order.shouldPoll, true);
  });

  it("derives timeout when pending polling already expired", async () => {
    const supabase = createSupabaseRouteMock({
      resolve() {
        return {
          data: {
            id: "order-pending",
            status: "pending",
            mp_status: "pending:waiting_payment",
            mp_payment_id: null,
            mp_preference_id: "pref-2",
            total: 480,
            updated_at: "2026-03-21T18:00:00.000Z",
          },
          error: null,
        };
      },
    });
    const GET = createCheckoutStatusRoute({
      createClient: async () => supabase as never,
      derivePaymentState,
    });

    const response = await GET(
      buildRequest(
        "https://patriayvida.test/api/checkout/status?order_id=order-pending&checkout_status=pending&poll_timed_out=true"
      )
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.order.paymentState, "failure");
    assert.equal(body.order.paymentStateDetail, "payment_timeout");
    assert.equal(body.order.shouldPoll, false);
  });

  it("returns 500 when the order lookup query fails", async () => {
    const supabase = createSupabaseRouteMock({
      resolve() {
        return {
          data: null,
          error: { message: "boom" },
        };
      },
    });
    const GET = createCheckoutStatusRoute({
      createClient: async () => supabase as never,
      derivePaymentState,
    });

    const response = await GET(buildRequest("https://patriayvida.test/api/checkout/status?order_id=order-1"));
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.error, "No pudimos consultar el estado de la orden.");
  });
});
