import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdminRouteAccess } from "@/lib/admin-auth";
import { ProductForm } from "../product-form";
import type { TShirtSize } from "@/lib/constants/sizes";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminRouteAccess("/admin/productos");
  const { id } = await params;

  const supabase = await createClient();

  // Fetch product
  const { data: product, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !product) {
    notFound();
  }

  // Fetch variants
  const { data: variants } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", id);

  // Fetch categories
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order");

  const productData = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    categoryId: product.category_id,
    basePrice: product.base_price,
    isActive: product.is_active,
    images: product.images ?? [],
    variants: (variants ?? []).map((v) => ({
      size: (v.attributes as { size: string }).size as TShirtSize,
      stock: v.stock,
      isActive: v.is_active,
    })),
  };

  return (
    <ProductForm categories={categories ?? []} product={productData} />
  );
}
