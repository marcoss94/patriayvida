"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createUpdateAdminOrderStatusAction } from "./action-core";

function redirectWithNotice(path: string, notice: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}notice=${notice}`);
}

export const updateAdminOrderStatusAction = createUpdateAdminOrderStatusAction({
  redirectWithNotice,
  revalidatePath,
});
