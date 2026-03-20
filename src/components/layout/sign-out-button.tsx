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
      variant="destructive"
      className="cursor-pointer rounded-md font-medium transition-colors duration-200 hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
    >
      <LogOut className="mr-2 size-4" />
      Cerrar sesión
    </DropdownMenuItem>
  );
}
