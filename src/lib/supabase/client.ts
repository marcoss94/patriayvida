import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing required env var NEXT_PUBLIC_SUPABASE_URL. Set the Supabase project URL for client-side auth sessions."
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "Missing required env var NEXT_PUBLIC_SUPABASE_ANON_KEY. Set the Supabase anon key for client-side auth sessions."
    );
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  );
}
