"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdminActionAccess } from "@/lib/admin-auth";
import {
  getAllowedStatusTransitions,
  isBusinessOrderStatus,
  type OrderRow,
} from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_ORDERS_BASE_PATH = "/admin/pedidos";

function getSafeReturnPath(rawValue: FormDataEntryValue | null) {
  if (typeof rawValue !== "string") {
    return ADMIN_ORDERS_BASE_PATH;
  }

  const value = rawValue.trim();

  if (!value.startsWith(ADMIN_ORDERS_BASE_PATH)) {
    return ADMIN_ORDERS_BASE_PATH;
  }

  return value;
}

function redirectWithNotice(path: string, notice: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}notice=${notice}`);
}

type OrderStatusLookup = Pick<OrderRow, "id" | "status">;

export async function updateAdminOrderStatusAction(formData: FormData) {
  const returnPath = getSafeReturnPath(formData.get("returnPath"));

  try {
    await assertAdminActionAccess();
  } catch {
    return redirectWithNotice(returnPath, "forbidden");
  }

  const orderIdEntry = formData.get("orderId");
  const nextStatusEntry = formData.get("nextStatus");
  const orderId = typeof orderIdEntry === "string" ? orderIdEntry.trim() : "";
  const nextStatus = typeof nextStatusEntry === "string" ? nextStatusEntry.trim() : "";

  if (!orderId || !isBusinessOrderStatus(nextStatus)) {
    return redirectWithNotice(returnPath, "invalid_payload");
  }

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle<OrderStatusLookup>();

  if (orderError || !order) {
    return redirectWithNotice(returnPath, "order_not_found");
  }

  if (!isBusinessOrderStatus(order.status)) {
    return redirectWithNotice(returnPath, "unsupported_status");
  }

  if (order.status === nextStatus) {
    return redirectWithNotice(returnPath, "no_change");
  }

  const allowedTransitions = getAllowedStatusTransitions(order.status);

  if (!allowedTransitions.includes(nextStatus)) {
    return redirectWithNotice(returnPath, "invalid_transition");
  }

  const { error: updateError } = await admin
    .from("orders")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (updateError) {
    return redirectWithNotice(returnPath, "update_failed");
  }

  revalidatePath(ADMIN_ORDERS_BASE_PATH);
  revalidatePath(`${ADMIN_ORDERS_BASE_PATH}/${orderId}`);

  return redirectWithNotice(returnPath, "status_updated");
}
