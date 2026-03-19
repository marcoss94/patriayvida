"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { deleteProduct } from "./actions";
import { formatPrice } from "@/lib/utils/currency";
import { Pencil, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  isActive: boolean;
  categoryName: string;
  activeVariants: number;
  totalVariants: number;
  images: string[];
};

export function ProductsTable({ products }: { products: ProductRow[] }) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <ImageOff className="size-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No hay productos todavía.
        </p>
        <Link
          href="/admin/productos/nuevo"
          className="text-sm text-primary underline underline-offset-2"
        >
          Crear el primero
        </Link>
      </div>
    );
  }

  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Imagen</TableHead>
          <TableHead className="w-[34%]">Nombre</TableHead>
          <TableHead className="w-[18%]">Categoría</TableHead>
          <TableHead className="text-right">Precio</TableHead>
          <TableHead className="text-center">Variantes</TableHead>
          <TableHead className="text-center">Estado</TableHead>
          <TableHead className="w-24 text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell>
              {product.images.length > 0 ? (
                <div className="size-10 overflow-hidden rounded-md bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="size-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                  <ImageOff className="size-4 text-muted-foreground" />
                </div>
              )}
            </TableCell>
            <TableCell className="max-w-[16rem] truncate font-medium lg:max-w-[20rem]">
              {product.name}
            </TableCell>
            <TableCell className="max-w-[10rem] truncate text-muted-foreground lg:max-w-[12rem]">
              {product.categoryName}
            </TableCell>
            <TableCell className="text-right">
              {formatPrice(product.basePrice)}
            </TableCell>
            <TableCell className="text-center">
              <span className="text-sm">
                {product.activeVariants}/{product.totalVariants}
              </span>
            </TableCell>
            <TableCell className="text-center">
              <Badge variant={product.isActive ? "default" : "secondary"}>
                {product.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Link
                  href={`/admin/productos/${product.id}`}
                  aria-label="Editar"
                  className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                >
                  <Pencil className="size-3.5" />
                </Link>
                <DeleteConfirmDialog
                  itemName={product.name}
                  onConfirm={() => deleteProduct(product.id)}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
