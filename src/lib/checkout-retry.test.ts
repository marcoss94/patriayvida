import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Json } from "@/types/database";
import {
  canRetryPendingOrderPayment,
  RECENT_PENDING_ORDER_REUSE_WINDOW_MS,
  selectReusablePendingOrder,
} from "@/lib/checkout-retry";

const now = new Date("2026-03-21T18:00:00.000Z");

function buildPendingOrder(overrides: Partial<Parameters<typeof canRetryPendingOrderPayment>[0]> & {
  id?: string;
  created_at?: string;
  delivery_method?: string;
  shipping_cost?: number;
  subtotal?: number;
  total?: number;
  shipping_address?: Json;
} = {}) {
  return {
    id: overrides.id ?? "order-1",
    status: overrides.status ?? "pending",
    mp_status: overrides.mp_status ?? "preference_created",
    mp_payment_id: overrides.mp_payment_id ?? null,
    mp_preference_id: null,
    delivery_method: overrides.delivery_method ?? "shipping",
    shipping_cost: overrides.shipping_cost ?? 180,
    subtotal: overrides.subtotal ?? 300,
    total: overrides.total ?? 480,
    shipping_address: overrides.shipping_address ?? {
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "099123456",
      address: "Av. 18 de Julio 1234",
      city: "Montevideo",
      notes: "Apartamento 2",
      shipping_rule: "flat_rate",
      shipping_price_uyu: 180,
    },
    created_at:
      overrides.created_at ??
      new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
  };
}

describe("checkout retry guards", () => {
  it("allows retries only for safe pending Mercado Pago states", () => {
    assert.equal(
      canRetryPendingOrderPayment({ status: "pending", mp_status: "rejected:cc_rejected", mp_payment_id: "123" }),
      true,
    );
    assert.equal(
      canRetryPendingOrderPayment({ status: "pending", mp_status: "preference_created", mp_payment_id: null }),
      true,
    );
    assert.equal(
      canRetryPendingOrderPayment({ status: "pending", mp_status: "in_process", mp_payment_id: "456" }),
      false,
    );
    assert.equal(
      canRetryPendingOrderPayment({ status: "paid", mp_status: "rejected", mp_payment_id: "789" }),
      false,
    );
  });

  it("reuses the most recent matching pending order", () => {
    const selected = selectReusablePendingOrder({
      currentTime: now,
      orderLines: [{ variantId: "variant-1", quantity: 2, unitPrice: 150, productName: "", variantName: "", size: null }],
      orders: [
        buildPendingOrder({ id: "older", created_at: new Date(now.getTime() - 10 * 60 * 1000).toISOString() }),
        buildPendingOrder({ id: "newer", created_at: new Date(now.getTime() - 2 * 60 * 1000).toISOString() }),
      ],
      orderItems: [
        { order_id: "older", variant_id: "variant-1", quantity: 2, unit_price: 150 },
        { order_id: "newer", variant_id: "variant-1", quantity: 2, unit_price: 150 },
      ],
      checkout: {
        delivery_method: "shipping",
        shipping_cost: 180,
        subtotal: 300,
        total: 480,
        shipping_address: {
          full_name: "Ada Lovelace",
          email: "ada@example.com",
          phone: "099123456",
          address: "Av. 18 de Julio 1234",
          city: "Montevideo",
          notes: "Apartamento 2",
          shipping_rule: "flat_rate",
          shipping_price_uyu: 180,
          coordinates: { lat: -34.9, lng: -56.2 },
        },
      },
    });

    assert.equal(selected?.id, "newer");
  });

  it("does not reuse stale, mismatched, or active-payment orders", () => {
    const selected = selectReusablePendingOrder({
      currentTime: now,
      orderLines: [{ variantId: "variant-1", quantity: 2, unitPrice: 150, productName: "", variantName: "", size: null }],
      orders: [
        buildPendingOrder({
          id: "stale",
          created_at: new Date(now.getTime() - RECENT_PENDING_ORDER_REUSE_WINDOW_MS - 1).toISOString(),
        }),
        buildPendingOrder({
          id: "active",
          mp_status: "pending",
          mp_payment_id: "payment-1",
        }),
        buildPendingOrder({
          id: "changed-shipping",
          shipping_cost: 220,
          total: 520,
          shipping_address: {
            full_name: "Ada Lovelace",
            email: "ada@example.com",
            phone: "099123456",
            address: "Otra direccion 999",
            city: "Montevideo",
            notes: "Apartamento 2",
            shipping_rule: "flat_rate",
            shipping_price_uyu: 220,
          },
        }),
      ],
      orderItems: [
        { order_id: "stale", variant_id: "variant-1", quantity: 2, unit_price: 150 },
        { order_id: "active", variant_id: "variant-1", quantity: 2, unit_price: 150 },
        { order_id: "changed-shipping", variant_id: "variant-1", quantity: 2, unit_price: 150 },
      ],
      checkout: {
        delivery_method: "shipping",
        shipping_cost: 180,
        subtotal: 300,
        total: 480,
        shipping_address: {
          full_name: "Ada Lovelace",
          email: "ada@example.com",
          phone: "099123456",
          address: "Av. 18 de Julio 1234",
          city: "Montevideo",
          notes: "Apartamento 2",
          shipping_rule: "flat_rate",
          shipping_price_uyu: 180,
        },
      },
    });

    assert.equal(selected, null);
  });
});
