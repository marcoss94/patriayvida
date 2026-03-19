import { AVAILABLE_SIZES, type TShirtSize } from "@/lib/constants/sizes";

export type VariantInput = {
  size: TShirtSize;
  stock: number;
};

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function extractStoragePathFromPublicUrl(publicUrl: string) {
  const match = publicUrl.match(/\/storage\/v1\/object\/public\/product-images\/(.+)$/);
  return match?.[1] ?? null;
}

export function isAllowedProductImageUrl(url: string) {
  try {
    const parsed = new URL(url);
    const isSupabaseHost = parsed.hostname.endsWith(".supabase.co");
    const hasExpectedPath = parsed.pathname.startsWith("/storage/v1/object/public/product-images/");
    return isSupabaseHost && hasExpectedPath;
  } catch {
    return false;
  }
}

export function parseVariantsFromFormData(formData: FormData): VariantInput[] {
  const variants: VariantInput[] = [];

  for (const size of AVAILABLE_SIZES) {
    if (formData.get(`size_${size}`) === "on") {
      const stock = parseInt(formData.get(`stock_${size}`) as string) || 0;
      variants.push({ size, stock });
    }
  }

  return variants;
}

export function generateSku(slug: string, size: string): string {
  return `${slug}-${size.toLowerCase()}`;
}
