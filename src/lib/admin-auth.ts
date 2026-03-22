import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AdminAuthUser = {
  id: string;
  email?: string | null;
};

type AdminProfileRecord = {
  is_admin?: boolean | null;
};

type AdminAuthSupabase = {
  auth: {
    getUser: () => Promise<{ data: { user: AdminAuthUser | null } }>;
  };
  from: (table: "profiles") => {
    select: (columns: string) => {
      eq: (column: "id", value: string) => {
        maybeSingle: () => Promise<{ data: AdminProfileRecord | null }>;
      };
    };
  };
};

type GetAdminAccessOptions = {
  configuredAdminEmail?: string | null;
  supabase?: AdminAuthSupabase;
};

export function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function hasAdminEmailAccess(
  userEmail: string | null | undefined,
  configuredAdminEmail: string | null | undefined = process.env.ADMIN_EMAIL
) {
  const normalizedConfiguredAdminEmail = normalizeEmail(configuredAdminEmail);

  return Boolean(
    normalizedConfiguredAdminEmail &&
      normalizeEmail(userEmail) === normalizedConfiguredAdminEmail
  );
}

export function resolveIsAdmin(params: {
  configuredAdminEmail?: string | null;
  profileIsAdmin?: boolean | null;
  userEmail?: string | null;
}) {
  return (
    hasAdminEmailAccess(params.userEmail, params.configuredAdminEmail) ||
    Boolean(params.profileIsAdmin)
  );
}

export async function getAdminAccess(options: GetAdminAccessOptions = {}) {
  const supabase =
    options.supabase ?? ((await createClient()) as unknown as AdminAuthSupabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      isAdmin: false,
    } as const;
  }

  const configuredAdminEmail = options.configuredAdminEmail;

  if (hasAdminEmailAccess(user.email, configuredAdminEmail)) {
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
    isAdmin: resolveIsAdmin({
      userEmail: user.email,
      configuredAdminEmail,
      profileIsAdmin: profile?.is_admin,
    }),
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
