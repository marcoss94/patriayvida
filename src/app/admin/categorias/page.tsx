import { createClient } from "@/lib/supabase/server";
import { requireAdminRouteAccess } from "@/lib/admin-auth";
import { CategoryList } from "./category-list";

export default async function AdminCategoriasPage() {
  await requireAdminRouteAccess("/admin/categorias");

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Categorías</h2>
      <CategoryList categories={categories ?? []} />
    </div>
  );
}
