import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadUserOrderDetail } from "@/app/cuenta/pedidos/[id]/data";
import { createSupabaseRouteMock, getFilterValue } from "@/test-utils/supabase-route-mock";

describe("user order detail data", () => {
  it("scopes the detail query to the authenticated owner", async () => {
    const supabase = createSupabaseRouteMock({
      user: { id: "user-42" },
      resolve(call) {
        assert.equal(call.table, "orders");
        assert.equal(getFilterValue(call, "eq", "id"), "order-1");
        assert.equal(getFilterValue(call, "eq", "user_id"), "user-42");

        return {
          data: {
            id: "order-1",
            created_at: "2026-03-21T18:00:00.000Z",
            status: "paid",
            mp_status: "approved:accredited",
            mp_payment_id: "mp-123",
            mp_preference_id: "pref-123",
            delivery_method: "shipping",
            shipping_address: {
              full_name: "Ada Lovelace",
              email: "ada@example.com",
              phone: "099123456",
              address: "18 de Julio 1234",
              city: "Montevideo",
            },
            shipping_cost: 180,
            subtotal: 300,
            total: 480,
            order_items: [],
          },
          error: null,
        };
      },
    });

    const result = await loadUserOrderDetail("order-1", { createClient: async () => supabase as never });

    assert.equal(result?.shippingSnapshot.fullName, "Ada Lovelace");
    assert.equal(result?.subtotal, 300);
    assert.equal(result?.shippingCost, 180);
    assert.equal(result?.total, 480);
  });

  it("delegates missing orders to notFound handling", async () => {
    const supabase = createSupabaseRouteMock({
      resolve() {
        return { data: null, error: null };
      },
    });

    await assert.rejects(
      () =>
        loadUserOrderDetail("order-missing", {
          createClient: async () => supabase as never,
          onNotFound: () => {
            throw new Error("NOT_FOUND");
          },
        }),
      /NOT_FOUND/
    );
  });
});
