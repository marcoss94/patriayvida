"use client";

import { useState, useActionState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryFormState,
} from "./actions";
import { Plus, Pencil, X } from "lucide-react";
import type { Tables } from "@/types/database";

type Category = Tables<"categories">;

const initialState: CategoryFormState = {};

export function CategoryList({ categories }: { categories: Category[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-4">
      {/* Create form */}
      {showCreate ? (
        <CategoryForm
          onCancel={() => setShowCreate(false)}
          onSuccess={() => setShowCreate(false)}
        />
      ) : (
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="size-4" />
          Nueva categoría
        </Button>
      )}

      {/* Table */}
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No hay categorías creadas.
        </p>
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[24%]">Nombre</TableHead>
              <TableHead className="w-[22%]">Slug</TableHead>
              <TableHead className="w-[40%]">Descripción</TableHead>
              <TableHead className="w-20 text-center">Orden</TableHead>
              <TableHead className="w-24 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) =>
              editingId === cat.id ? (
                <TableRow key={cat.id}>
                  <TableCell colSpan={5} className="p-0">
                    <CategoryForm
                      category={cat}
                      onCancel={() => setEditingId(null)}
                      onSuccess={() => setEditingId(null)}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={cat.id}>
                  <TableCell className="max-w-[12rem] truncate font-medium">
                    {cat.name}
                  </TableCell>
                  <TableCell className="max-w-[11rem] truncate text-muted-foreground">
                    {cat.slug}
                  </TableCell>
                  <TableCell className="max-w-[20rem] truncate text-muted-foreground">
                    {cat.description || "—"}
                  </TableCell>
                  <TableCell className="text-center">{cat.sort_order}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingId(cat.id)}
                        aria-label="Editar"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <DeleteConfirmDialog
                        itemName={cat.name}
                        onConfirm={() => deleteCategory(cat.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function CategoryForm({
  category,
  onCancel,
  onSuccess,
}: {
  category?: Category;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const action = category ? updateCategory : createCategory;
  const [state, formAction, isPending] = useActionState(action, initialState);

  // If success, notify parent
  if (state.success) {
    // We use a micro-task to avoid updating parent state during render
    queueMicrotask(onSuccess);
  }

  return (
    <Card className="border-dashed">
      <CardContent>
        <form action={formAction} className="space-y-3">
          {category && <input type="hidden" name="id" value={category.id} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Nombre *</Label>
              <Input
                id="cat-name"
                name="name"
                required
                defaultValue={category?.name ?? ""}
                placeholder="Ej: Remeras"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-sort">Orden</Label>
              <Input
                id="cat-sort"
                name="sort_order"
                type="number"
                defaultValue={category?.sort_order ?? 0}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Descripción</Label>
            <Textarea
              id="cat-desc"
              name="description"
              defaultValue={category?.description ?? ""}
              placeholder="Descripción opcional"
              rows={2}
            />
          </div>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending
                ? "Guardando..."
                : category
                  ? "Actualizar"
                  : "Crear"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onCancel}
            >
              <X className="size-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
