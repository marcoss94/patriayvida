import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FETCH_LIMIT,
  buildAdminOrdersListPath,
  filterAdminOrdersByQuery,
  loadAdminOrdersPageData,
  mapAdminOrders,
  paginateAdminOrders,
} from "@/app/admin/pedidos/data";
import { createSupabaseRouteMock, getFilterValue } from "@/test-utils/supabase-route-mock";

describe("admin orders list data", () => {
  it("applies status filtering at query time and keeps pagination deterministic", async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      id: `order-${index + 1}`,
      created_at: `2026-03-${String(21 - Math.min(index, 20)).padStart(2, "0")}T18:00:00.000Z`,
      status: "paid",
      mp_status: "approved:accredited",
      mp_payment_id: `mp-${index + 1}`,
      subtotal: 300,
      shipping_cost: 180,
      total: 480,
      delivery_method: "shipping",
      shipping_address: {
        full_name: index === 20 ? "Ada Lovelace" : `Cliente ${index + 1}`,
        email: index === 20 ? "ada@example.com" : `cliente${index + 1}@example.com`,
        address: "18 de Julio 1234",
        city: "Montevideo",
      },
      order_items: [{ quantity: 1 }],
      profile: null,
    }));
    const supabase = createSupabaseRouteMock({
      resolve(call) {
        assert.equal(call.table, "orders");
        assert.equal(getFilterValue(call, "eq", "status"), "paid");
        assert.equal(call.limit, FETCH_LIMIT);

        return { data: rows, error: null };
      },
    });

    const result = await loadAdminOrdersPageData(
      { status: "paid", q: "ada@example.com", page: "2" },
      { createAdminClient: () => supabase as never }
    );

    assert.equal(result.filteredOrders.length, 1);
    assert.equal(result.currentPage, 1);
    assert.equal(result.totalPages, 1);
    assert.equal(result.pageOrders[0]?.customerEmail, "ada@example.com");
  });

  it("maps customer and shipping fallbacks for operational visibility", () => {
    const mapped = mapAdminOrders([
      {
        id: "order-1",
        created_at: "2026-03-21T18:00:00.000Z",
        status: "pending",
        mp_status: null,
        mp_payment_id: null,
        subtotal: 300,
        shipping_cost: 0,
        total: 300,
        delivery_method: "pickup",
        shipping_address: { full_name: "Ada Lovelace", email: "ada@example.com" },
        order_items: [{ quantity: 2 }],
        profile: { full_name: "Ignored Name" },
      },
      {
        id: "order-2",
        created_at: "2026-03-21T18:00:00.000Z",
        status: "pending",
        mp_status: null,
        mp_payment_id: null,
        subtotal: 300,
        shipping_cost: 180,
        total: 480,
        delivery_method: "shipping",
        shipping_address: { address: "Colonia 999", city: "Montevideo" },
        order_items: [{ quantity: 3 }],
        profile: { full_name: "Grace Hopper" },
      },
    ]);

    assert.equal(mapped[0]?.customerName, "Ada Lovelace");
    assert.equal(mapped[0]?.customerEmail, "ada@example.com");
    assert.equal(mapped[1]?.customerName, "Grace Hopper");
    assert.equal(mapped[1]?.shippingSummary, "Colonia 999 · Montevideo");
    assert.equal(mapped[1]?.itemCount, 3);
  });

  it("preserves filter urls and paginates empty states safely", () => {
    assert.equal(
      buildAdminOrdersListPath({ status: "paid", query: "ada", page: 2 }),
      "/admin/pedidos?status=paid&q=ada&page=2"
    );

    const filtered = filterAdminOrdersByQuery([], "missing");
    const page = paginateAdminOrders(filtered, 9);

    assert.deepEqual(filtered, []);
    assert.equal(page.currentPage, 1);
    assert.equal(page.totalPages, 1);
    assert.deepEqual(page.pageOrders, []);
  });
});
