import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/account/profile-form";

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/cuenta");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <ProfileForm
      profile={{
        id: user.id,
        full_name: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
        address: profile?.address ?? null,
        city: profile?.city ?? null,
      }}
      email={user.email ?? ""}
    />
  );
}
