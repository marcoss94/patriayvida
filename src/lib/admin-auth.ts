import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export async function getAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      isAdmin: false,
    } as const;
  }

  const configuredAdminEmail = normalizeEmail(process.env.ADMIN_EMAIL);

  if (configuredAdminEmail && normalizeEmail(user.email) === configuredAdminEmail) {
    return {
      user,
      isAdmin: true,
    } as const;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    isAdmin: profile?.is_admin ?? false,
  } as const;
}

export async function requireAdminRouteAccess(redirectPath = "/admin") {
  const { user, isAdmin } = await getAdminAccess();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  if (!isAdmin) {
    redirect("/");
  }

  return { user };
}

export async function assertAdminActionAccess() {
  const { user, isAdmin } = await getAdminAccess();

  if (!user || !isAdmin) {
    throw new Error("ADMIN_FORBIDDEN");
  }

  return { user };
}
