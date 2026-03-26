import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAdminOrdersSearchFilter,
  buildAdminOrdersListPath,
  filterAdminOrdersByQuery,
  loadAdminOrdersPageData,
  mapAdminOrders,
  paginateAdminOrders,
} from "@/app/admin/pedidos/data";
import { createSupabaseRouteMock, getFilterValue } from "@/test-utils/supabase-route-mock";

describe("admin orders list data", () => {
  it("applies status filtering and pagination at query time", async () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      id: `order-${index + 21}`,
      created_at: `2026-03-${String(20 - index).padStart(2, "0")}T18:00:00.000Z`,
      status: "paid",
      mp_status: "approved:accredited",
      mp_payment_id: `mp-${index + 21}`,
      subtotal: 300,
      shipping_cost: 180,
      total: 480,
      delivery_method: "shipping",
      shipping_address: {
        full_name: `Cliente ${index + 21}`,
        email: `cliente${index + 21}@example.com`,
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
        assert.deepEqual(call.selectOptions, { count: "exact" });
        assert.deepEqual(call.range, { from: 20, to: 39 });

        return { data: rows, error: null, count: 55 };
      },
    });

    const result = await loadAdminOrdersPageData({ status: "paid", page: "2" }, { createAdminClient: () => supabase as never });

    assert.equal(result.totalMatchingOrders, 55);
    assert.equal(result.currentPage, 2);
    assert.equal(result.totalPages, 3);
    assert.equal(result.pageOrders.length, 20);
    assert.equal(result.pageOrders[0]?.customerEmail, "cliente21@example.com");
  });

  it("builds a DB search filter that preserves order references and customer lookup", () => {
    assert.equal(
      buildAdminOrdersSearchFilter("PYV-Abc12345"),
      "shipping_address->>full_name.ilike.*PYV-Abc12345*,shipping_address->>email.ilike.*PYV-Abc12345*"
    );

    assert.equal(
      buildAdminOrdersSearchFilter("ada@example.com"),
      "shipping_address->>full_name.ilike.*ada@example.com*,shipping_address->>email.ilike.*ada@example.com*"
    );
  });

  it("handles simple search terms without crashing (regression for oss crash)", () => {
    assert.equal(
      buildAdminOrdersSearchFilter("oss"),
      "shipping_address->>full_name.ilike.*oss*,shipping_address->>email.ilike.*oss*"
    );

    assert.equal(
      buildAdminOrdersSearchFilter("test"),
      "shipping_address->>full_name.ilike.*test*,shipping_address->>email.ilike.*test*"
    );
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
