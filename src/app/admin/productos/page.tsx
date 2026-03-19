import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdminRouteAccess } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { ProductsTable } from "./products-table";
import { Plus } from "lucide-react";

export default async function AdminProductosPage() {
  await requireAdminRouteAccess("/admin/productos");

  const supabase = await createClient();

  // Fetch products with category name + variant count
  const { data: products } = await supabase
    .from("products")
    .select("*, categories(name), product_variants(id, is_active)")
    .order("created_at", { ascending: false });

  const productList = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    basePrice: p.base_price,
    isActive: p.is_active,
    categoryName: (p.categories as { name: string } | null)?.name ?? "Sin categoría",
    activeVariants: (p.product_variants as { id: string; is_active: boolean }[])
      ?.filter((v) => v.is_active).length ?? 0,
    totalVariants: (p.product_variants as { id: string; is_active: boolean }[])?.length ?? 0,
    images: p.images,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Productos</h2>
        <Link href="/admin/productos/nuevo">
          <Button size="sm">
            <Plus className="size-4" />
            Nuevo producto
          </Button>
        </Link>
      </div>

      <ProductsTable products={productList} />
    </div>
  );
}
