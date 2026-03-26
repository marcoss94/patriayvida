"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateSlug } from "@/lib/utils/slug";
import { AVAILABLE_SIZES, type TShirtSize } from "@/lib/constants/sizes";
import {
  createProduct,
  updateProduct,
  updateProductImages,
  type ProductFormState,
} from "./actions";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { ImageUpload } from "@/components/admin/image-upload";
import { ProductDescription } from "@/components/shop/product-description";
import {
  applyProductDescriptionToolbarAction,
  type ProductDescriptionToolbarAction,
} from "@/lib/product-description";

type Category = {
  id: string;
  name: string;
};

type ExistingVariant = {
  size: TShirtSize;
  stock: number;
  isActive: boolean;
};

type ProductData = {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  basePrice: number;
  isActive: boolean;
  images: string[];
  variants: ExistingVariant[];
};

type ProductFormProps = {
  categories: Category[];
  product?: ProductData;
};

const initialState: ProductFormState = {};

export function ProductForm({ categories, product }: ProductFormProps) {
  const router = useRouter();
  const [isSavingImages, setIsSavingImages] = useState(false);
  const action = product ? updateProduct : createProduct;
  const [state, formAction, isPending] = useActionState(action, initialState);

  // Form state
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [description, setDescription] = useState(product?.description ?? "");
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  // Variant state: map of size -> { checked, stock }
  const [variants, setVariants] = useState<
    Record<TShirtSize, { checked: boolean; stock: number }>
  >(() => {
    const initial: Record<string, { checked: boolean; stock: number }> = {};
    for (const size of AVAILABLE_SIZES) {
      const existing = product?.variants.find((v) => v.size === size);
      initial[size] = {
        checked: existing?.isActive ?? false,
        stock: existing?.stock ?? 0,
      };
    }
    return initial as Record<TShirtSize, { checked: boolean; stock: number }>;
  });

  // Derive slug from name (unless manually edited)
  const derivedSlug = slugManuallyEdited ? slug : (name ? generateSlug(name) : "");
  const effectiveSlug = slugManuallyEdited ? slug : derivedSlug;
  // Redirect on success
  useEffect(() => {
    if (state.success) {
      if (!product && state.productId) {
        router.push(`/admin/productos/${state.productId}?created=1`);
      } else {
        router.push("/admin/productos");
      }
    }
  }, [state.success, state.productId, product, router]);

  async function handleImagesChange(nextImages: string[]): Promise<{ error?: string }> {
    setImagesError(null);

    if (!product?.id) {
      setImages(nextImages);
      return {};
    }

    setIsSavingImages(true);
    const result = await updateProductImages(product.id, nextImages);
    setIsSavingImages(false);

    if (result.error) {
      setImagesError(result.error);
      return result;
    }

    setImages(nextImages);
    return {};
  }

  function toggleSize(size: TShirtSize) {
    setVariants((prev) => ({
      ...prev,
      [size]: { ...prev[size], checked: !prev[size].checked },
    }));
  }

  function setStock(size: TShirtSize, stock: number) {
    setVariants((prev) => ({
      ...prev,
      [size]: { ...prev[size], stock: Math.max(0, stock) },
    }));
  }

  function handleDescriptionToolbar(action: ProductDescriptionToolbarAction) {
    const textarea = descriptionRef.current;

    if (!textarea) {
      return;
    }

    const nextState = applyProductDescriptionToolbarAction(
      {
        value: description,
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd,
      },
      action,
    );

    setDescription(nextState.value);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextState.selectionStart, nextState.selectionEnd);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/productos">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h2 className="text-xl font-semibold">
          {product ? "Editar producto" : "Nuevo producto"}
        </h2>
      </div>

      <form action={formAction} className="space-y-6">
        {product && <input type="hidden" name="id" value={product.id} />}

        {/* Hidden fields for state managed by React */}
        <input type="hidden" name="slug" value={effectiveSlug} />
        <input type="hidden" name="is_active" value={isActive ? "on" : ""} />

        {/* Hidden fields for variant data */}
        {AVAILABLE_SIZES.map((size) => (
          <div key={size}>
            {variants[size].checked && (
              <>
                <input type="hidden" name={`size_${size}`} value="on" />
                <input
                  type="hidden"
                  name={`stock_${size}`}
                  value={variants[size].stock}
                />
              </>
            )}
          </div>
        ))}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left column: basic info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información básica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Remera Patria y Vida"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={effectiveSlug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugManuallyEdited(true);
                    }}
                    placeholder="remera-patria-y-vida"
                    className="text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se genera automáticamente del nombre. Editá solo si necesitás
                    uno diferente.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Categoría *</Label>
                  {categories.length === 0 ? (
                    <p className="text-sm text-destructive">
                      No hay categorías.{" "}
                      <Link
                        href="/admin/categorias"
                        className="underline underline-offset-2"
                      >
                        Creá una primero.
                      </Link>
                    </p>
                  ) : (
                    <select
                      name="category_id"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                      required
                    >
                      <option value="" disabled>
                        Seleccionar categoría
                      </option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Descripción</Label>
                  <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
                    <div className="border-b border-border bg-background/80">
                      <div className="flex items-center justify-between gap-3 px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Editor
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Formato simple y seguro.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDescriptionToolbar("bold")}
                        >
                          Negrita
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDescriptionToolbar("italic")}
                        >
                          Cursiva
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDescriptionToolbar("bulletList")}
                        >
                          Lista
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDescriptionToolbar("lineBreak")}
                        >
                          Salto de linea
                        </Button>
                      </div>
                    </div>

                    <Textarea
                      ref={descriptionRef}
                      id="description"
                      name="description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Conta materiales, detalles y cuidados. Usa los botones para destacar partes importantes."
                      rows={8}
                      className="min-h-48 resize-y rounded-none border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0"
                    />

                    <div className="border-t border-border bg-background/65 px-3 py-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Vista previa
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Se actualiza mientras escribis.
                        </p>
                      </div>

                      <div className="min-h-28 rounded-lg border border-dashed border-border/70 bg-background px-4 py-3">
                        {description.trim() ? (
                          <ProductDescription content={description} tone="adminPreview" />
                        ) : (
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            La vista previa aparece aca con el mismo formato que se usa en la tienda.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formato simple y seguro: parrafos, **negrita**, *cursiva*, listas con guion y saltos de linea.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Precio y estado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="base_price">Precio base (UYU) *</Label>
                  <Input
                    id="base_price"
                    name="base_price"
                    type="number"
                    min="1"
                    step="1"
                    required
                    defaultValue={product?.basePrice ?? ""}
                    placeholder="990"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    id="is_active_toggle"
                  />
                  <Label htmlFor="is_active_toggle">
                    Producto activo
                  </Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Imágenes del producto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ImageUpload
                  productId={product?.id ?? null}
                  existingImages={images}
                  onImagesChange={handleImagesChange}
                  onUploadStateChange={setIsUploadingImages}
                  disabled={isPending || isSavingImages}
                />
                {isSavingImages && (
                  <p className="text-xs text-muted-foreground">
                    Guardando imágenes...
                  </p>
                )}
                {imagesError && (
                  <p className="text-xs text-destructive">{imagesError}</p>
                )}
                {!product && (
                  <p className="text-xs text-muted-foreground">
                    Creá el producto primero. Después te llevamos al editor para subir varias imágenes.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column: variants */}
          <Card>
            <CardHeader>
              <CardTitle>Talles y stock *</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Seleccioná los talles disponibles e ingresá el stock para cada
                uno.
              </p>
              {AVAILABLE_SIZES.map((size) => (
                <div
                  key={size}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <Checkbox
                    id={`size-${size}`}
                    checked={variants[size].checked}
                    onCheckedChange={() => toggleSize(size)}
                  />
                  <Label
                    htmlFor={`size-${size}`}
                    className="w-12 font-mono text-sm"
                  >
                    {size}
                  </Label>
                  {variants[size].checked && (
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`stock-${size}`}
                        className="text-xs text-muted-foreground"
                      >
                        Stock:
                      </Label>
                      <Input
                        id={`stock-${size}`}
                        type="number"
                        min="0"
                        value={variants[size].stock}
                        onChange={(e) =>
                          setStock(size, parseInt(e.target.value) || 0)
                        }
                        className="h-7 w-20"
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Show SKU preview */}
              {effectiveSlug && AVAILABLE_SIZES.some((s) => variants[s].checked) && (
                <div className="mt-3 rounded-md bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    SKUs generados:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {AVAILABLE_SIZES.filter((s) => variants[s].checked).map(
                      (size) => (
                        <span
                          key={size}
                          className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
                        >
                          {effectiveSlug}-{size.toLowerCase()}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Error display */}
        {state.error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{state.error}</p>
          </div>
        )}

        {isUploadingImages && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm text-primary">
              Esperá a que terminen de subirse las imágenes para guardar.
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending || isUploadingImages || isSavingImages}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending
              ? "Guardando..."
              : product
                ? "Actualizar producto"
                : "Crear producto"}
          </Button>
          <Link href="/admin/productos">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
