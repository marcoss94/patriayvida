"use server";

import { revalidatePath } from "next/cache";
import { assertAdminActionAccess } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSlug } from "@/lib/utils/slug";

export type CategoryFormState = {
  error?: string;
  success?: boolean;
};

export async function createCategory(
  _prev: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  try {
    await assertAdminActionAccess();
  } catch {
    return { error: "No tenés permisos de administrador." };
  }

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const sortOrder = parseInt(formData.get("sort_order") as string) || 0;

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const slug = generateSlug(name);
  if (!slug) {
    return { error: "El nombre no genera un slug válido." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("categories").insert({
    name,
    slug,
    description,
    sort_order: sortOrder,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe una categoría con ese nombre." };
    }
    return { error: `Error al crear categoría: ${error.message}` };
  }

  revalidatePath("/admin/categorias");
  return { success: true };
}

export async function updateCategory(
  _prev: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  try {
    await assertAdminActionAccess();
  } catch {
    return { error: "No tenés permisos de administrador." };
  }

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const sortOrder = parseInt(formData.get("sort_order") as string) || 0;

  if (!id || !name) {
    return { error: "Faltan datos obligatorios." };
  }

  const slug = generateSlug(name);
  if (!slug) {
    return { error: "El nombre no genera un slug válido." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("categories")
    .update({ name, slug, description, sort_order: sortOrder })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe una categoría con ese nombre." };
    }
    return { error: `Error al actualizar: ${error.message}` };
  }

  revalidatePath("/admin/categorias");
  return { success: true };
}

export async function deleteCategory(
  id: string
): Promise<{ error?: string }> {
  try {
    await assertAdminActionAccess();
  } catch {
    return { error: "No tenés permisos de administrador." };
  }

  const supabase = createAdminClient();

  // Check if category has products
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (count && count > 0) {
    return { error: `No se puede eliminar: tiene ${count} producto(s) asociado(s).` };
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    return { error: `Error al eliminar: ${error.message}` };
  }

  revalidatePath("/admin/categorias");
  return {};
}
