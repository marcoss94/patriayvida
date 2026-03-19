"use server";

import { revalidatePath } from "next/cache";
import { assertAdminActionAccess } from "@/lib/admin-auth";
import {
  extractStoragePathFromPublicUrl,
  generateSku,
  isAllowedProductImageUrl,
  parseVariantsFromFormData,
  sanitizeFileName,
  type VariantInput,
} from "@/lib/product-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSlug } from "@/lib/utils/slug";

export type ProductFormState = {
  error?: string;
  success?: boolean;
  productId?: string;
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  try {
    await assertAdminActionAccess();
  } catch {
    return { error: "No tenés permisos de administrador." };
  }

  const name = (formData.get("name") as string)?.trim();
  const slugInput = (formData.get("slug") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || "";
  const categoryId = formData.get("category_id") as string;
  const basePrice = parseFloat(formData.get("base_price") as string);
  const isActive = formData.get("is_active") === "on";
  const variants = parseVariantsFromFormData(formData);

  // Validation
  if (!name) return { error: "El nombre es obligatorio." };
  if (!categoryId) return { error: "La categoría es obligatoria." };
  if (!basePrice || basePrice <= 0) return { error: "El precio debe ser mayor a 0." };
  if (variants.length === 0) return { error: "Seleccioná al menos un talle." };

  const slug = slugInput ? generateSlug(slugInput) : generateSlug(name);
  if (!slug) return { error: "El nombre no genera un slug válido." };

  const supabase = createAdminClient();

  // Create product
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      name,
      slug,
      description,
      category_id: categoryId,
      base_price: basePrice,
      is_active: isActive,
      images: [],
    })
    .select("id")
    .single();

  if (productError) {
    if (productError.code === "23505") {
      return { error: "Ya existe un producto con ese slug." };
    }
    return { error: "No se pudo crear el producto. Probá de nuevo." };
  }

  // Create variants
  const variantRows = variants.map((v) => ({
    product_id: product.id,
    name: `Talle ${v.size}`,
    sku: generateSku(slug, v.size),
    stock: v.stock,
    attributes: { size: v.size },
    is_active: true,
  }));

  const { error: variantError } = await supabase
    .from("product_variants")
    .insert(variantRows);

  if (variantError) {
    // Rollback: delete the product we just created
    await supabase.from("products").delete().eq("id", product.id);
    return { error: "No se pudieron crear los talles del producto." };
  }

  revalidatePath("/admin/productos");
  return { success: true, productId: product.id };
}

export async function updateProduct(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  try {
    await assertAdminActionAccess();
  } catch {
    return { error: "No tenés permisos de administrador." };
  }

  const productId = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const slugInput = (formData.get("slug") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || "";
  const categoryId = formData.get("category_id") as string;
  const basePrice = parseFloat(formData.get("base_price") as string);
  const isActive = formData.get("is_active") === "on";
  const variants = parseVariantsFromFormData(formData);

  // Validation
  if (!productId) return { error: "ID de producto inválido." };
  if (!name) return { error: "El nombre es obligatorio." };
  if (!categoryId) return { error: "La categoría es obligatoria." };
  if (!basePrice || basePrice <= 0) return { error: "El precio debe ser mayor a 0." };
  if (variants.length === 0) return { error: "Seleccioná al menos un talle." };

  const slug = slugInput ? generateSlug(slugInput) : generateSlug(name);
  if (!slug) return { error: "El nombre no genera un slug válido." };

  const supabase = createAdminClient();

  // Update product
  const { error: productError } = await supabase
    .from("products")
    .update({
      name,
      slug,
      description,
      category_id: categoryId,
      base_price: basePrice,
      is_active: isActive,
    })
    .eq("id", productId);

  if (productError) {
    if (productError.code === "23505") {
      return { error: "Ya existe un producto con ese slug." };
    }
    return { error: "No se pudo actualizar el producto. Probá de nuevo." };
  }

  // Get existing variants for this product
  const { data: existingVariants, error: existingVariantsError } = await supabase
    .from("product_variants")
    .select("id, sku, attributes")
    .eq("product_id", productId);

  if (existingVariantsError) {
    return { error: "No se pudieron leer las variantes actuales del producto." };
  }

  const existingBySize = new Map<string, { id: string; sku: string }>();
  for (const v of existingVariants ?? []) {
    const attrs = v.attributes as { size?: string };
    if (attrs?.size) {
      existingBySize.set(attrs.size, { id: v.id, sku: v.sku });
    }
  }

  const selectedSizes = new Set(variants.map((v) => v.size));

  // Upsert: create new, update existing, deactivate unchecked
  for (const v of variants) {
    const existing = existingBySize.get(v.size);
    if (existing) {
      // Update existing variant
      const { error: updateVariantError } = await supabase
        .from("product_variants")
        .update({
          stock: v.stock,
          sku: generateSku(slug, v.size),
          is_active: true,
        })
        .eq("id", existing.id);

      if (updateVariantError) {
        return { error: "No se pudo actualizar uno de los talles." };
      }
    } else {
      // Create new variant
      const { error: createVariantError } = await supabase.from("product_variants").insert({
        product_id: productId,
        name: `Talle ${v.size}`,
        sku: generateSku(slug, v.size),
        stock: v.stock,
        attributes: { size: v.size },
        is_active: true,
      });

      if (createVariantError) {
        return { error: "No se pudo crear uno de los talles seleccionados." };
      }
    }
  }

  // Deactivate unchecked sizes
  for (const [size, existing] of existingBySize) {
    if (!selectedSizes.has(size as VariantInput["size"])) {
      const { error: deactivateVariantError } = await supabase
        .from("product_variants")
        .update({ is_active: false })
        .eq("id", existing.id);

      if (deactivateVariantError) {
        return { error: "No se pudo desactivar un talle no seleccionado." };
      }
    }
  }

  revalidatePath("/admin/productos");
  return { success: true };
}

export async function deleteProduct(
  id: string
): Promise<{ error?: string }> {
  try {
    await assertAdminActionAccess();
  } catch {
    return { error: "No tenés permisos de administrador." };
  }

  const supabase = createAdminClient();

  // Delete variants first (cascade isn't guaranteed via RLS)
  await supabase.from("product_variants").delete().eq("product_id", id);

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    return { error: `Error al eliminar: ${error.message}` };
  }

  revalidatePath("/admin/productos");
  return {};
}

export async function updateProductImages(
  productId: string,
  images: string[]
): Promise<{ error?: string }> {
  try {
    await assertAdminActionAccess();
  } catch {
    return { error: "No tenés permisos de administrador." };
  }

  if (!productId) return { error: "ID de producto inválido." };

  // Validate URLs correspond to Supabase public files in product-images bucket.
  for (const url of images) {
    if (!isAllowedProductImageUrl(url)) {
      return { error: "URL de imagen inválida." };
    }
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("products")
    .update({ images })
    .eq("id", productId);

  if (error) {
    return { error: "No se pudieron guardar las imágenes del producto." };
  }

  revalidatePath("/admin/productos");
  revalidatePath(`/admin/productos/${productId}`);
  return {};
}

export async function uploadProductImageFiles(
  productId: string,
  formData: FormData
): Promise<{ uploaded: string[]; failed: Array<{ fileName: string; error: string }> }> {
  try {
    await assertAdminActionAccess();
  } catch {
    return { uploaded: [], failed: [{ fileName: "", error: "No tenés permisos de administrador." }] };
  }

  if (!productId) {
    return { uploaded: [], failed: [{ fileName: "", error: "Producto inválido." }] };
  }

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return { uploaded: [], failed: [] };
  }

  const supabase = createAdminClient();
  const uploaded: string[] = [];
  const failed: Array<{ fileName: string; error: string }> = [];

  for (const file of files) {
    const fileName = file.name || "archivo";

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      failed.push({
        fileName,
        error: "Formato no permitido. Usá JPEG, PNG, WebP o GIF.",
      });
      continue;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      failed.push({
        fileName,
        error: "El archivo supera 5MB.",
      });
      continue;
    }

    const storagePath = `products/${productId}/${Date.now()}-${sanitizeFileName(fileName)}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      failed.push({ fileName, error: error.message });
      continue;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("product-images").getPublicUrl(storagePath);

    uploaded.push(publicUrl);
  }

  return { uploaded, failed };
}

export async function deleteProductImageFile(
  imageUrl: string
): Promise<{ error?: string }> {
  try {
    await assertAdminActionAccess();
  } catch {
    return { error: "No tenés permisos de administrador." };
  }

  const path = extractStoragePathFromPublicUrl(imageUrl);

  if (!path) {
    return { error: "No se pudo resolver la ruta de la imagen." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from("product-images").remove([path]);

  if (error) {
    return { error: error.message };
  }

  return {};
}
