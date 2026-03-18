# F3 - Product Catalog Implementation

**Project:** Patria y Vida E-commerce  
**Date:** March 17, 2026  
**Status:** ✅ Complete

---

## Overview

Complete implementation of the product catalog (F3.2, F3.3, F3.4) for the Patria y Vida e-commerce platform using Next.js 16 + Supabase + shadcn/ui v4.

---

## Architecture Decisions

### 1. Server Components First
- **Decision:** All data fetching happens in Server Components
- **Why:** Better performance, SEO, and reduced client bundle size
- **Where:** `/productos/page.tsx`, `/productos/[slug]/page.tsx`
- **Pattern:**
  ```typescript
  const supabase = await createClient();
  const { data } = await supabase.from('products').select('...');
  ```

### 2. Type-Safe Database Queries
- **Decision:** Use auto-generated TypeScript types from Supabase
- **Why:** Compile-time safety for database queries
- **Where:** `src/types/database.ts` (auto-generated), `src/types/product.ts` (derived)
- **Pattern:**
  ```typescript
  export type Product = Tables<'products'>;
  export type ProductWithCategory = Product & { category: Category };
  ```

### 3. Price Format as Cents
- **Decision:** Store prices as integers representing cents (e.g., 99000 = $990.00)
- **Why:** Avoids floating-point precision issues
- **Where:** Database `base_price` and `price_override` columns, `formatPrice()` helper
- **Format:** Argentine pesos with Intl.NumberFormat

### 4. Variant-First Product Model
- **Decision:** Products have multiple variants (sizes) with independent stock/price
- **Why:** Real-world e-commerce needs size variants with different availability
- **Where:** `product_variants` table, variant selector UI
- **Pattern:**
  ```typescript
  // Each variant has: name, sku, stock, price_override, attributes JSONB
  // UI shows all sizes, disables out-of-stock variants
  ```

### 5. Temporary Native `<img>` for Product Images
- **Decision:** Use native `<img>` instead of `next/image` for current product cards/detail placeholders
- **Why:** Catalog F3 currently renders placeholder/external image URLs that do not fit a controlled optimization pipeline, and switching to `<img>` fixed broken placeholder rendering immediately
- **Where:** `src/components/shop/product-card.tsx`, `src/app/(shop)/productos/[slug]/page.tsx`
- **Tradeoff:** `<img>` is simpler and reliable for uncontrolled placeholder URLs now; `next/image` should be restored once admin product uploads exist and images come from a trusted source such as Supabase Storage

---

## Files Created

### Components
1. **`src/components/shop/product-card.tsx`**
   - Display: product image, name, category badge, price
   - Heart icon (placeholder for favorites)
   - "Ver producto" CTA → `/productos/{slug}`
   - Dark theme styling with hover effects
   - Responsive grid layout

### Pages
2. **`src/app/(shop)/productos/page.tsx`**
   - Server Component fetching products + categories
   - Category filter tabs using searchParams
   - Product grid (1 col mobile, 3-4 cols desktop)
   - Empty state UI
   - Metadata for SEO

3. **`src/app/(shop)/productos/[slug]/page.tsx`**
   - Server Component fetching product by slug with JOIN
   - Image display (first image only for now)
   - Variant selector (size buttons)
   - Stock indicator per variant
   - Quantity input (1-max)
   - Dynamic price (uses price_override if set)
   - Breadcrumbs navigation
   - generateMetadata() for dynamic SEO

### Utilities
4. **`src/lib/utils/currency.ts`**
   - `formatPrice(price: number)`: "$990" format
   - `formatStock(stock: number)`: "Quedan 5", "Sin stock"
   - `hasStock(stock: number)`: boolean check
   - `getMaxQuantity(stock, maxAllowed)`: cart limits

### Types
5. **`src/types/product.ts`**
   - Derived types from database schema
   - `ProductCardData`, `ProductWithCategory`, `ProductDetailData`
   - `VariantAttributes` for JSONB parsing

---

## Supabase Query Patterns

### Products Listing (with Category Filter)
```typescript
let query = supabase
  .from('products')
  .select(`
    id, name, slug, base_price, images,
    category:categories!inner(name, slug)
  `)
  .eq('is_active', true)
  .order('created_at', { ascending: false });

// Optional filter by category slug
if (categorySlug) {
  query = query.eq('categories.slug', categorySlug);
}

const { data: products } = await query;
```

**Key Points:**
- `!inner` JOIN ensures products without categories are excluded
- Filter applies on joined table: `.eq('categories.slug', categorySlug)`
- Type assertion needed: `product.category as unknown as { name, slug }`

### Product Detail (with Variants)
```typescript
const { data: product } = await supabase
  .from('products')
  .select(`
    *,
    category:categories!inner(id, name, slug, description),
    variants:product_variants(
      id, name, sku, stock, price_override, attributes, is_active
    )
  `)
  .eq('slug', slug)
  .eq('is_active', true)
  .eq('variants.is_active', true)
  .order('name', { referencedTable: 'product_variants', ascending: true })
  .single();

if (error || !product) notFound();
```

**Key Points:**
- `.single()` returns one product or error
- Filter nested variants: `.eq('variants.is_active', true)`
- Sort nested: `.order('name', { referencedTable: '...', ... })`
- Call `notFound()` for 404 handling

---

## UI/UX Decisions

### Dark Theme Colors
- Background: `#0a0f1e` (navy)
- Primary text: `#f0ebe0` (off-white)
- Accent: `#cc2936` (red)
- Cards: `bg-slate-800/40` with `border-slate-700/50`
- Hover: `border-red-500/50` with `shadow-red-500/10`

### Responsive Grid
- Mobile: 1 column (full width)
- Tablet: 2 columns
- Desktop: 3 columns
- XL: 4 columns

### Stock Display Logic
```typescript
stock === 0        → "Sin stock" (button disabled)
stock <= 3         → "Quedan {n}" (urgency indicator)
stock > 3          → "{n} disponibles"
```

### Variant Selector
- Size buttons: XS, S, M, L, XL, XXL (sorted)
- Out of stock: grayed out, line-through, disabled
- Available: hover effect with red accent

---

## Placeholder Features (For Future Implementation)

1. **Favorites Heart Icon**
   - UI present in ProductCard
   - No functionality yet (requires auth + favorites table)

2. **Add to Cart Button**
   - UI present in product detail
   - No functionality yet (requires cart context/state)

3. **Image Gallery**
   - Only shows first image
   - Future: carousel/thumbnails for multiple images

4. **Quantity Selector**
   - Input present but not connected to cart logic
   - Future: integrate with variant selection

---

## Testing Checklist

- [x] TypeScript compiles without errors
- [x] Server Components fetch data correctly
- [x] Category filter works via searchParams
- [x] Product card displays all required info
- [x] Product detail shows variants with stock
- [x] Price formatting shows ARS currency
- [x] Breadcrumbs navigation works
- [x] 404 handling for invalid slugs
- [x] Metadata for SEO

---

## Next Steps

1. **F4 - Shopping Cart:** Context, add/remove, persist in localStorage
2. **F5 - Checkout Flow:** Shipping, payment, order creation
3. **Image Gallery:** Multi-image carousel for product detail
4. **Favorites:** Auth-gated favorites with heart toggle
5. **Filters:** Price range, search, sorting
6. **Admin Panel:** Product CRUD, inventory management, and migrate product rendering back to `next/image` once uploads use controlled images (for example Supabase Storage)
