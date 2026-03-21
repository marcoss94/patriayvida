import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildUserOrdersViewModel, loadUserOrdersPageData, parseUserOrderStatusFilter } from "@/app/cuenta/pedidos/data";
import { createSupabaseRouteMock, getFilterValue } from "@/test-utils/supabase-route-mock";

describe("user orders list data", () => {
  it("returns null when the shopper is not authenticated", async () => {
    const supabase = createSupabaseRouteMock({ user: null });

    const result = await loadUserOrdersPageData({}, { createClient: async () => supabase as never });

    assert.equal(result, null);
  });

  it("scopes the orders query to the authenticated user and keeps invalid filters harmless", async () => {
    const supabase = createSupabaseRouteMock({
      user: { id: "user-123" },
      resolve(call) {
        assert.equal(call.table, "orders");
        assert.equal(call.action, "select");
        assert.equal(getFilterValue(call, "eq", "user_id"), "user-123");
        assert.deepEqual(call.orderBy, { column: "created_at", ascending: false });

        return {
          data: [
            {
              id: "order-1",
              created_at: "2026-03-21T18:00:00.000Z",
              status: "paid",
              mp_status: "approved:accredited",
              total: 480,
              delivery_method: "shipping",
              order_items: [{ quantity: 2 }, { quantity: 1 }],
            },
          ],
          error: null,
        };
      },
    });

    const result = await loadUserOrdersPageData(
      { status: "made-up-status" },
      { createClient: async () => supabase as never }
    );

    assert.equal(result?.statusFilter, "all");
    assert.equal(result?.filteredOrders.length, 1);
    assert.equal(result?.filteredOrders[0]?.itemCount, 3);
    assert.equal(result?.visibleItemCount, 3);
  });

  it("builds an empty state model without exploding", () => {
    const model = buildUserOrdersViewModel([], parseUserOrderStatusFilter("pending"));

    assert.deepEqual(model.orders, []);
    assert.deepEqual(model.filteredOrders, []);
    assert.equal(model.latestVisibleOrder, null);
    assert.equal(model.visibleItemCount, 0);
  });
});
