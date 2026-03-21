import { getAllowedStatusTransitions, isBusinessOrderStatus, type OrderRow } from "@/lib/orders";
import { assertAdminActionAccess } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const ADMIN_ORDERS_BASE_PATH = "/admin/pedidos";

export function getSafeAdminOrdersReturnPath(rawValue: FormDataEntryValue | null) {
  if (typeof rawValue !== "string") {
    return ADMIN_ORDERS_BASE_PATH;
  }

  const value = rawValue.trim();

  if (!value.startsWith(ADMIN_ORDERS_BASE_PATH)) {
    return ADMIN_ORDERS_BASE_PATH;
  }

  return value;
}

export type RedirectWithNotice = (path: string, notice: string) => never;

type OrderStatusLookup = Pick<OrderRow, "id" | "status">;

export function createUpdateAdminOrderStatusAction(
  deps: {
    assertAdminActionAccess?: typeof assertAdminActionAccess;
    createAdminClient?: typeof createAdminClient;
    redirectWithNotice: RedirectWithNotice;
    revalidatePath: (path: string) => void;
    now?: () => string;
  }
) {
  return async function updateAdminOrderStatusAction(formData: FormData) {
    const returnPath = getSafeAdminOrdersReturnPath(formData.get("returnPath"));

    try {
      await (deps.assertAdminActionAccess ?? assertAdminActionAccess)();
    } catch {
      return deps.redirectWithNotice(returnPath, "forbidden");
    }

    const orderIdEntry = formData.get("orderId");
    const nextStatusEntry = formData.get("nextStatus");
    const orderId = typeof orderIdEntry === "string" ? orderIdEntry.trim() : "";
    const nextStatus = typeof nextStatusEntry === "string" ? nextStatusEntry.trim() : "";

    if (!orderId || !isBusinessOrderStatus(nextStatus)) {
      return deps.redirectWithNotice(returnPath, "invalid_payload");
    }

    const admin = (deps.createAdminClient ?? createAdminClient)();
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .maybeSingle<OrderStatusLookup>();

    if (orderError || !order) {
      return deps.redirectWithNotice(returnPath, "order_not_found");
    }

    if (!isBusinessOrderStatus(order.status)) {
      return deps.redirectWithNotice(returnPath, "unsupported_status");
    }

    if (order.status === nextStatus) {
      return deps.redirectWithNotice(returnPath, "no_change");
    }

    const allowedTransitions = getAllowedStatusTransitions(order.status);

    if (!allowedTransitions.includes(nextStatus)) {
      return deps.redirectWithNotice(returnPath, "invalid_transition");
    }

    const { error: updateError } = await admin
      .from("orders")
      .update({ status: nextStatus, updated_at: (deps.now ?? (() => new Date().toISOString()))() })
      .eq("id", orderId);

    if (updateError) {
      return deps.redirectWithNotice(returnPath, "update_failed");
    }

    deps.revalidatePath(ADMIN_ORDERS_BASE_PATH);
    deps.revalidatePath(`${ADMIN_ORDERS_BASE_PATH}/${orderId}`);

    return deps.redirectWithNotice(returnPath, "status_updated");
  };
}
