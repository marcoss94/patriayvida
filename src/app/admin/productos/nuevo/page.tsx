import { createClient } from "@/lib/supabase/server";
import { requireAdminRouteAccess } from "@/lib/admin-auth";
import { ProductForm } from "../product-form";

export default async function NuevoProductoPage() {
  await requireAdminRouteAccess("/admin/productos/nuevo");

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order");

  return (
    <ProductForm categories={categories ?? []} />
  );
}
