import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { requireEnv } from "@/lib/env";

export function createAdminClient() {
  const supabaseUrl = requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "Set the Supabase project URL for admin reconciliation and admin mutations."
  );
  const serviceRoleKey = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "Set the Supabase service role key for webhook reconciliation and privileged writes."
  );

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
