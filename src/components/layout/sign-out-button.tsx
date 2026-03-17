"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenuItem
      onClick={handleSignOut}
      className="cursor-pointer text-destructive transition-colors duration-200 focus:text-destructive"
    >
      <LogOut className="mr-2 size-4" />
      Cerrar sesión
    </DropdownMenuItem>
  );
}
