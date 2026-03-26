import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  createMercadoPagoWebhookRoute,
  type MercadoPagoWebhookRouteDeps,
} from "@/app/api/webhooks/mercadopago/route";
import { createSupabaseRouteMock, type SupabaseQueryCall } from "@/test-utils/supabase-route-mock";

function buildRequest(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": "req-webhook-test",
    },
    body: JSON.stringify(body),
  });
}

function createDeps(
  overrides: Partial<MercadoPagoWebhookRouteDeps> &
    Pick<MercadoPagoWebhookRouteDeps, "createAdminClient">,
) {
  const { createAdminClient, ...rest } = overrides;

  return {
    createAdminClient,
    getMercadoPagoMerchantOrder: async () => ({
      external_reference: "order-1",
      payments: [],
      preference_id: null,
      status: "opened",
      order_status: "opened",
    }) as never,
    getMercadoPagoPayment: async () => ({
      id: 123456,
      status: "approved",
      status_detail: "accredited",
      external_reference: "order-1",
      currency_id: "UYU",
      transaction_amount: 480,
      metadata: {
        order_id: "order-1",
        subtotal_uyu: 300,
        shipping_cost_uyu: 180,
        total_uyu: 480,
      },
    }) as never,
    getMercadoPagoPreference: async () => ({
      external_reference: "order-1",
      id: "pref-1",
    }) as never,
    getMercadoPagoWebhookSecrets: () => ["secret"],
    getMercadoPagoWebhookSecurityMode: () => "enforced" as const,
    isMercadoPagoConfigured: () => true,
    isProductionRuntime: () => false,
    ...rest,
  } satisfies MercadoPagoWebhookRouteDeps;
}

function findCall(calls: SupabaseQueryCall[], predicate: (call: SupabaseQueryCall) => boolean) {
  return calls.find(predicate) ?? null;
}

describe("POST /api/webhooks/mercadopago", () => {
  it("reconciles approved payments with valid order integrity even when the signature is not enforced yet", async () => {
    const admin = createSupabaseRouteMock({
      resolve(call) {
        if (call.table === "orders" && call.action === "select") {
          return {
            data: {
              id: "order-1",
              status: "pending",
              mp_status: "preference_created",
              mp_payment_id: null,
              mp_preference_id: "pref-1",
              subtotal: 300,
              shipping_cost: 180,
              total: 480,
            },
            error: null,
          };
        }

        if (call.table === "orders" && call.action === "update") {
          const values = call.values as Record<string, unknown>;
          assert.equal(values.status, "paid");
          assert.equal(values.mp_payment_id, "123456");
          assert.equal(values.mp_status, "approved:accredited");

          return {
            data: {
              id: "order-1",
              status: "paid",
              mp_status: "approved:accredited",
              mp_payment_id: "123456",
            },
            error: null,
          };
        }

        throw new Error(`Unexpected query ${call.action} ${call.table}`);
      },
    });
    const POST = createMercadoPagoWebhookRoute(
      createDeps({
        createAdminClient: () => admin as never,
      }),
    );

    const response = await POST(
      buildRequest(
        "https://patriayvida.test/api/webhooks/mercadopago?type=payment&data.id=123456",
        {
          type: "payment",
          data: { id: "123456" },
        },
      ),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.verificationStatus, "unverified");
    assert.equal(body.action, "updated");
    assert.equal(body.reason, "order_reconciled");
    assert.equal(body.status, "paid");
  });

  it("blocks paid transitions when the payment amount does not match the stored order total", async () => {
    const admin = createSupabaseRouteMock({
      resolve(call) {
        if (call.table === "orders" && call.action === "select") {
          return {
            data: {
              id: "order-1",
              status: "pending",
              mp_status: "preference_created",
              mp_payment_id: null,
              mp_preference_id: "pref-1",
              subtotal: 300,
              shipping_cost: 180,
              total: 480,
            },
            error: null,
          };
        }

        if (call.table === "orders" && call.action === "update") {
          const values = call.values as Record<string, unknown>;
          assert.equal(values.status, undefined);
          assert.equal(values.mp_payment_id, "123456");
          assert.equal(
            values.mp_status,
            "integrity_blocked:approved:amount_mismatch+metadata_total_mismatch",
          );

          return {
            data: {
              id: "order-1",
              status: "pending",
              mp_status:
                "integrity_blocked:approved:amount_mismatch+metadata_total_mismatch",
              mp_payment_id: "123456",
            },
            error: null,
          };
        }

        throw new Error(`Unexpected query ${call.action} ${call.table}`);
      },
    });
    const POST = createMercadoPagoWebhookRoute(
      createDeps({
        createAdminClient: () => admin as never,
        getMercadoPagoPayment: async () => ({
          id: 123456,
          status: "approved",
          external_reference: "order-1",
          currency_id: "UYU",
          transaction_amount: 100,
          metadata: {
            order_id: "order-1",
            subtotal_uyu: 300,
            shipping_cost_uyu: 180,
            total_uyu: 100,
          },
        }) as never,
      }),
    );

    const response = await POST(
      buildRequest(
        "https://patriayvida.test/api/webhooks/mercadopago?type=payment&data.id=123456",
        {
          type: "payment",
          data: { id: "123456" },
        },
      ),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.action, "updated");
    assert.equal(body.reason, "payment_integrity_blocked");
    assert.equal(body.status, "pending");
    assert.equal(body.mpStatus, "integrity_blocked:approved:amount_mismatch+metadata_total_mismatch");
  });

  it("blocks paid transitions when a merchant order resolves to a different Mercado Pago preference", async () => {
    const admin = createSupabaseRouteMock({
      resolve(call) {
        if (call.table === "orders" && call.action === "select") {
          return {
            data: {
              id: "order-1",
              status: "pending",
              mp_status: "preference_created",
              mp_payment_id: null,
              mp_preference_id: "pref-expected",
              subtotal: 300,
              shipping_cost: 180,
              total: 480,
            },
            error: null,
          };
        }

        if (call.table === "orders" && call.action === "update") {
          const values = call.values as Record<string, unknown>;
          assert.equal(values.status, undefined);
          assert.equal(values.mp_payment_id, "999999");
          assert.equal(values.mp_preference_id, undefined);
          assert.equal(values.mp_status, "integrity_blocked:approved:preference_mismatch");

          return {
            data: {
              id: "order-1",
              status: "pending",
              mp_status: "integrity_blocked:approved:preference_mismatch",
              mp_payment_id: "999999",
            },
            error: null,
          };
        }

        throw new Error(`Unexpected query ${call.action} ${call.table}`);
      },
    });
    const POST = createMercadoPagoWebhookRoute(
      createDeps({
        createAdminClient: () => admin as never,
        getMercadoPagoMerchantOrder: async () => ({
          external_reference: "order-1",
          payments: [{ id: 999999, status: "approved" }],
          preference_id: "pref-other",
          status: "closed",
          order_status: "paid",
        }) as never,
        getMercadoPagoPayment: async () => ({
          id: 999999,
          status: "approved",
          external_reference: "order-1",
          currency_id: "UYU",
          transaction_amount: 480,
          metadata: {
            order_id: "order-1",
            subtotal_uyu: 300,
            shipping_cost_uyu: 180,
            total_uyu: 480,
          },
        }) as never,
      }),
    );

    const response = await POST(
      buildRequest(
        "https://patriayvida.test/api/webhooks/mercadopago?topic=merchant_order&id=777777",
        {
          topic: "merchant_order",
          data: { id: "777777" },
          action: "merchant_order.updated",
        },
      ),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.reason, "payment_integrity_blocked");
    assert.equal(body.status, "pending");
    assert.equal(body.mpStatus, "integrity_blocked:approved:preference_mismatch");
    assert.equal(
      findCall(
        admin.calls,
        (call) =>
          call.table === "orders" &&
          call.action === "update" &&
          (call.values as Record<string, unknown>).status === "paid",
      ),
      null,
    );
  });
});
