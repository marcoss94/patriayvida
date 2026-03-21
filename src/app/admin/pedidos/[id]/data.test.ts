import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAdminOrderOperationalFields, loadAdminOrderDetail } from "@/app/admin/pedidos/[id]/data";
import { createSupabaseRouteMock, getFilterValue } from "@/test-utils/supabase-route-mock";
import { parseShippingAddress } from "@/lib/orders";

describe("admin order detail data", () => {
  it("loads the order by id and exposes operational payment and shipping fields", async () => {
    const supabase = createSupabaseRouteMock({
      resolve(call) {
        assert.equal(call.table, "orders");
        assert.equal(getFilterValue(call, "eq", "id"), "order-1");

        return {
          data: {
            id: "order-1",
            user_id: "user-1",
            created_at: "2026-03-21T18:00:00.000Z",
            updated_at: "2026-03-22T18:00:00.000Z",
            status: "preparing",
            mp_status: "approved:accredited",
            mp_payment_id: "mp-123",
            mp_preference_id: "pref-123",
            delivery_method: "shipping",
            shipping_address: {
              full_name: "Ada Lovelace",
              distance_km: 12.34,
              shipping_rule: "distance_gt_5km",
              geocode_source: "nominatim",
            },
            shipping_cost: 180,
            subtotal: 300,
            total: 480,
            profile: null,
            order_items: [],
          },
          error: null,
        };
      },
    });

    const result = await loadAdminOrderDetail("order-1", { createAdminClient: () => supabase as never });

    assert.equal(result?.allowedTransitions.join(","), "shipped,cancelled");
    assert.equal(result?.operationalFields.find((field) => field.label === "mp_payment_id")?.value, "mp-123");
    assert.equal(result?.operationalFields.find((field) => field.label === "Distancia estimada")?.value, "12.34 km");
    assert.equal(result?.operationalFields.find((field) => field.label === "Regla de envío")?.value, "distance_gt_5km");
  });

  it("omits shipping-only operational fields for pickup orders", () => {
    const fields = getAdminOrderOperationalFields(
      {
        id: "order-2",
        user_id: "user-2",
        created_at: "2026-03-21T18:00:00.000Z",
        updated_at: "2026-03-22T18:00:00.000Z",
        mp_status: null,
        mp_payment_id: null,
        mp_preference_id: null,
        delivery_method: "pickup",
      },
      parseShippingAddress(null)
    );

    assert.equal(fields.some((field) => field.label === "Distancia estimada"), false);
    assert.equal(fields.some((field) => field.label === "Regla de envío"), false);
    assert.equal(fields.some((field) => field.label === "Geocode source"), false);
  });

  it("delegates missing admin orders to notFound handling", async () => {
    const supabase = createSupabaseRouteMock({
      resolve() {
        return { data: null, error: null };
      },
    });

    await assert.rejects(
      () =>
        loadAdminOrderDetail("missing", {
          createAdminClient: () => supabase as never,
          onNotFound: () => {
            throw new Error("NOT_FOUND");
          },
        }),
      /NOT_FOUND/
    );
  });
});
