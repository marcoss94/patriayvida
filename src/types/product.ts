import type { Tables } from './database';

// Base types from database
export type Category = Tables<'categories'>;
export type Product = Tables<'products'>;
export type ProductVariant = Tables<'product_variants'>;

// Extended types for UI components
export type ProductWithCategory = Product & {
  category: Pick<Category, 'name' | 'slug'>;
};

export type ProductCardData = Pick<Product, 'id' | 'name' | 'slug' | 'base_price' | 'images'> & {
  category: Pick<Category, 'name' | 'slug'>;
};

export type ProductDetailData = Product & {
  category: Category;
  variants: ProductVariant[];
};

// Variant attributes type (from JSONB field)
export type VariantAttributes = {
  size?: string;
  color?: string;
  [key: string]: string | undefined;
};
