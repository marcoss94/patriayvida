"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ImagePlus,
  X,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Upload,
} from "lucide-react";
import {
  deleteProductImageFile,
  uploadProductImageFiles,
} from "@/app/admin/productos/actions";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type UploadingFile = {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  url?: string;
  error?: string;
};

type ImageUploadProps = {
  productId: string | null;
  existingImages: string[];
  onImagesChange: (images: string[]) => Promise<{ error?: string } | void> | void;
  onUploadStateChange?: (isUploading: boolean) => void;
  disabled?: boolean;
};

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `Tipo no permitido: ${file.type}. Usá JPEG, PNG, WebP o GIF.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    return `Archivo muy grande (${sizeMB}MB). Máximo: 5MB.`;
  }
  return null;
}

export function ImageUpload({
  productId,
  existingImages,
  onImagesChange,
  onUploadStateChange,
  disabled = false,
}: ImageUploadProps) {
  const [images, setImages] = useState<string[]>(existingImages);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAnyUploading = uploading.some(
    (u) => u.status === "uploading" || u.status === "pending"
  );

  useEffect(() => {
    setImages(existingImages);
  }, [existingImages]);

  useEffect(() => {
    onUploadStateChange?.(isAnyUploading);
  }, [isAnyUploading, onUploadStateChange]);

  const persistImages = useCallback(
    async (nextImages: string[], previousImages: string[]) => {
      const result = await onImagesChange(nextImages);
      if (result && typeof result === "object" && "error" in result && result.error) {
        setImages(previousImages);
        setActionError(result.error);
        return false;
      }

      setActionError(null);
      return true;
    },
    [onImagesChange]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!productId) return;

      const fileArray = Array.from(files);
      const newUploading: UploadingFile[] = [];

      for (const file of fileArray) {
        const validationError = validateFile(file);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const preview = URL.createObjectURL(file);

        if (validationError) {
          newUploading.push({
            id,
            file,
            preview,
            status: "error",
            progress: 0,
            error: validationError,
          });
        } else {
          newUploading.push({
            id,
            file,
            preview,
            status: "pending",
            progress: 0,
          });
        }
      }

      setUploading((prev) => [...prev, ...newUploading]);

      // Upload valid files
      const uploadedUrls: string[] = [];

      for (const item of newUploading) {
        if (item.status === "error") continue;

        // Mark as uploading
        setUploading((prev) =>
          prev.map((u) =>
            u.id === item.id ? { ...u, status: "uploading", progress: 30 } : u
          )
        );

        const formData = new FormData();
        formData.append("files", item.file);
        const result = await uploadProductImageFiles(productId, formData);

        if (result.failed.length > 0 || result.uploaded.length === 0) {
          const uploadError = result.failed[0]?.error ?? "No se pudo subir la imagen.";
          setUploading((prev) =>
            prev.map((u) =>
              u.id === item.id
                ? { ...u, status: "error", error: uploadError }
                : u
            )
          );
        } else {
          const publicUrl = result.uploaded[0];

          uploadedUrls.push(publicUrl);

          setUploading((prev) =>
            prev.map((u) =>
              u.id === item.id
                ? { ...u, status: "done", progress: 100, url: publicUrl }
                : u
            )
          );
        }
      }

      // Update images list with newly uploaded URLs
      if (uploadedUrls.length > 0) {
        const previousImages = [...images];
        const nextImages = [...previousImages, ...uploadedUrls];
        setImages(nextImages);
        await persistImages(nextImages, previousImages);
      }
    },
    [images, persistImages, productId]
  );

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      // Reset input so the same file can be re-selected
      e.target.value = "";
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  async function removeImage(url: string) {
    const previousImages = [...images];
    const nextImages = previousImages.filter((img) => img !== url);

    setImages(nextImages);
    const persisted = await persistImages(nextImages, previousImages);
    if (!persisted || !productId) {
      return;
    }

    const deleteResult = await deleteProductImageFile(url);
    if (deleteResult.error) {
      setActionError(`Se guardaron los cambios, pero no se pudo borrar el archivo: ${deleteResult.error}`);
    }
  }

  async function moveImage(index: number, direction: "up" | "down") {
    const previousImages = [...images];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= previousImages.length) return;

    const nextImages = [...previousImages];
    [nextImages[index], nextImages[targetIndex]] = [nextImages[targetIndex], nextImages[index]];

    setImages(nextImages);
    await persistImages(nextImages, previousImages);
  }

  function dismissUploadItem(id: string) {
    setUploading((prev) => {
      const item = prev.find((u) => u.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((u) => u.id !== id);
    });
  }

  const isDisabled = disabled || !productId;

  return (
    <div className="space-y-4">
      {/* Existing images grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((url, index) => (
            <div
              key={url}
              className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Producto imagen ${index + 1}`}
                className="size-full object-cover"
              />
              {/* Overlay controls */}
              <div className="absolute inset-0 flex items-start justify-end gap-1 bg-black/0 p-1.5 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  onClick={() => moveImage(index, "up")}
                  disabled={index === 0}
                  className="size-7"
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  onClick={() => moveImage(index, "down")}
                  disabled={index === images.length - 1}
                  className="size-7"
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  onClick={() => removeImage(url)}
                  className="size-7"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              {/* Position badge */}
              {index === 0 && (
                <span className="absolute bottom-1.5 left-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  Principal
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload progress items */}
      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {actionError}
        </div>
      )}

      {uploading.length > 0 && (
        <div className="space-y-2">
          {uploading.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border p-2"
            >
              {/* Thumbnail */}
              <div className="size-10 shrink-0 overflow-hidden rounded">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.preview}
                  alt=""
                  className="size-full object-cover"
                />
              </div>
              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {item.file.name}
                </p>
                {item.status === "uploading" && (
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === "pending" && (
                  <p className="text-[10px] text-muted-foreground">
                    En cola...
                  </p>
                )}
                {item.status === "error" && (
                  <p className="text-[10px] text-destructive">{item.error}</p>
                )}
                {item.status === "done" && (
                  <p className="text-[10px] text-emerald-500">Subida</p>
                )}
              </div>
              {/* Status icon / dismiss */}
              <div className="shrink-0">
                {item.status === "uploading" && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
                {item.status === "done" && (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                )}
                {item.status === "error" && (
                  <AlertCircle className="size-4 text-destructive" />
                )}
              </div>
              {(item.status === "done" || item.status === "error") && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-6"
                  onClick={() => dismissUploadItem(item.id)}
                >
                  <X className="size-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isDisabled && fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          isDisabled
            ? "cursor-not-allowed border-muted bg-muted/30 opacity-50"
            : dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
        }`}
      >
        {isAnyUploading ? (
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        ) : (
          <>
            {productId ? (
              <ImagePlus className="size-8 text-muted-foreground" />
            ) : (
              <Upload className="size-8 text-muted-foreground" />
            )}
          </>
        )}
        <div>
          {!productId ? (
            <p className="text-sm text-muted-foreground">
              Guardá el producto primero para poder subir imágenes.
            </p>
          ) : isAnyUploading ? (
            <p className="text-sm text-muted-foreground">Subiendo...</p>
          ) : (
            <>
              <p className="text-sm font-medium">
                Arrastrá imágenes o hacé clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground">
                JPEG, PNG, WebP o GIF. Máximo 5MB cada una.
              </p>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={handleFileInput}
        disabled={isDisabled}
      />
    </div>
  );
}

/**
 * Exported helper: whether the upload component has in-progress uploads.
 * Used by parent form to disable submit while uploading.
 */
export type { ImageUploadProps };
