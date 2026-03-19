/**
 * Seed script for Patria y Vida admin catalog.
 * Run with: npx tsx scripts/seed.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("SUPABASE env vars are required (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type SeedProduct = {
  categorySlug: "hombre" | "mujer";
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  variants: Array<{ size: "XS" | "S" | "M" | "L" | "XL" | "XXL"; stock: number }>;
};

const categories = [
  {
    name: "Hombre",
    slug: "hombre",
    description: "Remeras para hombre",
    sort_order: 0,
  },
  {
    name: "Mujer",
    slug: "mujer",
    description: "Remeras para mujer",
    sort_order: 1,
  },
];

const products: SeedProduct[] = [
  {
    categorySlug: "hombre",
    name: "Patria y Vida Clasica",
    slug: "patria-y-vida-clasica",
    description: "Remera de corte clasico con identidad Patria y Vida.",
    basePrice: 1290,
    variants: [
      { size: "S", stock: 14 },
      { size: "M", stock: 18 },
      { size: "L", stock: 12 },
      { size: "XL", stock: 9 },
    ],
  },
  {
    categorySlug: "hombre",
    name: "Cuba Libre Street",
    slug: "cuba-libre-street",
    description: "Diseno urbano con mensaje de libertad.",
    basePrice: 1390,
    variants: [
      { size: "XS", stock: 8 },
      { size: "M", stock: 15 },
      { size: "XL", stock: 11 },
      { size: "XXL", stock: 6 },
    ],
  },
  {
    categorySlug: "mujer",
    name: "Patria y Vida",
    slug: "patria-y-vida",
    description: "Modelo base de operacion diaria para la coleccion mujer.",
    basePrice: 1290,
    variants: [
      { size: "S", stock: 16 },
      { size: "M", stock: 20 },
      { size: "L", stock: 14 },
      { size: "XL", stock: 10 },
    ],
  },
  {
    categorySlug: "mujer",
    name: "Mujer Resiste",
    slug: "mujer-resiste",
    description: "Diseno orientado a campanas activas y reposicion frecuente.",
    basePrice: 1350,
    variants: [
      { size: "XS", stock: 10 },
      { size: "S", stock: 17 },
      { size: "M", stock: 13 },
      { size: "L", stock: 9 },
    ],
  },
];

function makeSku(slug: string, size: string) {
  return `${slug}-${size.toLowerCase()}`;
}

async function main() {
  console.log("Seeding categories...");
  const { error: categoriesError } = await supabase
    .from("categories")
    .upsert(categories, { onConflict: "slug" });

  if (categoriesError) throw categoriesError;

  const { data: categoryRows, error: categoryFetchError } = await supabase
    .from("categories")
    .select("id, slug");

  if (categoryFetchError) throw categoryFetchError;

  const categoryIdBySlug = new Map((categoryRows ?? []).map((row) => [row.slug, row.id]));

  const productRows = products.map((product) => {
    const categoryId = categoryIdBySlug.get(product.categorySlug);
    if (!categoryId) {
      throw new Error(`Category not found for slug: ${product.categorySlug}`);
    }

    return {
      name: product.name,
      slug: product.slug,
      description: product.description,
      category_id: categoryId,
      base_price: product.basePrice,
      is_active: true,
      images: [] as string[],
    };
  });

  console.log("Seeding products...");
  const { error: productUpsertError } = await supabase
    .from("products")
    .upsert(productRows, { onConflict: "slug" });

  if (productUpsertError) throw productUpsertError;

  const { data: dbProducts, error: productFetchError } = await supabase
    .from("products")
    .select("id, slug")
    .in("slug", products.map((product) => product.slug));

  if (productFetchError) throw productFetchError;

  const productIdBySlug = new Map((dbProducts ?? []).map((row) => [row.slug, row.id]));

  const variantRows = products.flatMap((product) => {
    const productId = productIdBySlug.get(product.slug);
    if (!productId) {
      throw new Error(`Product not found for slug: ${product.slug}`);
    }

    return product.variants.map((variant) => ({
      product_id: productId,
      name: `Talle ${variant.size}`,
      sku: makeSku(product.slug, variant.size),
      stock: variant.stock,
      attributes: { size: variant.size },
      is_active: true,
    }));
  });

  console.log("Seeding variants...");
  const { error: variantsError } = await supabase
    .from("product_variants")
    .upsert(variantRows, { onConflict: "sku" });

  if (variantsError) throw variantsError;

  const { data: summaryRows, error: summaryError } = await supabase
    .from("products")
    .select("id, slug, categories(name), product_variants(id)")
    .in("slug", products.map((product) => product.slug));

  if (summaryError) throw summaryError;

  const totalProducts = summaryRows?.length ?? 0;
  const totalVariants =
    summaryRows?.reduce((acc, row) => {
      const variants = row.product_variants as Array<{ id: string }> | null;
      return acc + (variants?.length ?? 0);
    }, 0) ?? 0;

  console.log("Seed completed.");
  console.log(`Products seeded: ${totalProducts}`);
  console.log(`Variants available: ${totalVariants}`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
