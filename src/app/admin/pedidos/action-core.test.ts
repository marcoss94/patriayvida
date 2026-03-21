import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createUpdateAdminOrderStatusAction } from "@/app/admin/pedidos/action-core";
import { createSupabaseRouteMock, getFilterValue } from "@/test-utils/supabase-route-mock";

function buildFormData(values: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

function captureRedirect(path: string, notice: string): never {
  throw new Error(`REDIRECT:${path}|${notice}`);
}

describe("admin order status action core", () => {
  it("rejects non-admin callers and sanitizes unsafe return paths", async () => {
    const action = createUpdateAdminOrderStatusAction({
      redirectWithNotice: captureRedirect,
      revalidatePath: () => undefined,
      assertAdminActionAccess: async () => {
        throw new Error("ADMIN_FORBIDDEN");
      },
    });

    await assert.rejects(
      () =>
        action(
          buildFormData({
            orderId: "order-1",
            nextStatus: "paid",
            returnPath: "/",
          })
        ),
      /REDIRECT:\/admin\/pedidos\|forbidden/
    );
  });

  it("blocks invalid status transitions before updating", async () => {
    const supabase = createSupabaseRouteMock({
      resolve(call) {
        if (call.action === "select") {
          return { data: { id: "order-1", status: "shipped" }, error: null };
        }

        throw new Error("should not update");
      },
    });
    const action = createUpdateAdminOrderStatusAction({
      redirectWithNotice: captureRedirect,
      revalidatePath: () => undefined,
      createAdminClient: () => supabase as never,
      assertAdminActionAccess: async () => ({ user: {} as never }),
    });

    await assert.rejects(
      () =>
        action(
          buildFormData({
            orderId: "order-1",
            nextStatus: "paid",
            returnPath: "/admin/pedidos/order-1",
          })
        ),
      /invalid_transition/
    );
  });

  it("updates allowed transitions and revalidates list plus detail pages", async () => {
    const revalidated: string[] = [];
    const supabase = createSupabaseRouteMock({
      resolve(call) {
        if (call.action === "select") {
          assert.equal(getFilterValue(call, "eq", "id"), "order-1");
          return { data: { id: "order-1", status: "paid" }, error: null };
        }

        if (call.action === "update") {
          assert.deepEqual(call.values, {
            status: "preparing",
            updated_at: "2026-03-21T20:00:00.000Z",
          });
          assert.equal(getFilterValue(call, "eq", "id"), "order-1");
          return { data: null, error: null };
        }

        throw new Error(`Unexpected query ${call.action}`);
      },
    });
    const action = createUpdateAdminOrderStatusAction({
      redirectWithNotice: captureRedirect,
      revalidatePath: (path) => {
        revalidated.push(path);
      },
      createAdminClient: () => supabase as never,
      assertAdminActionAccess: async () => ({ user: {} as never }),
      now: () => "2026-03-21T20:00:00.000Z",
    });

    await assert.rejects(
      () =>
        action(
          buildFormData({
            orderId: "order-1",
            nextStatus: "preparing",
            returnPath: "/admin/pedidos/order-1",
          })
        ),
      /status_updated/
    );

    assert.deepEqual(revalidated, ["/admin/pedidos", "/admin/pedidos/order-1"]);
  });
});
