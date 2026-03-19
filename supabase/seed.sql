-- F9 operational seed: admin catalog baseline
-- Safe to run multiple times.

WITH upsert_categories AS (
  INSERT INTO public.categories (name, slug, description, sort_order)
  VALUES
    ('Hombre', 'hombre', 'Catalogo operativo hombre', 0),
    ('Mujer', 'mujer', 'Catalogo operativo mujer', 1)
  ON CONFLICT (slug) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order
  RETURNING id, slug
),
category_ids AS (
  SELECT id, slug FROM upsert_categories
  UNION
  SELECT id, slug
  FROM public.categories
  WHERE slug IN ('hombre', 'mujer')
),
upsert_products AS (
  INSERT INTO public.products (name, slug, description, category_id, base_price, is_active, images)
  SELECT
    p.name,
    p.slug,
    p.description,
    c.id,
    p.base_price,
    TRUE,
    ARRAY[]::text[]
  FROM (
    VALUES
      ('Patria y Vida Clasica', 'patria-y-vida-clasica', 'Remera de corte clasico para uso diario.', 'hombre', 1290::numeric),
      ('Cuba Libre Street', 'cuba-libre-street', 'Diseno urbano para campanas de alto movimiento.', 'hombre', 1390::numeric),
      ('Patria y Vida', 'patria-y-vida', 'Modelo base de operacion en categoria mujer.', 'mujer', 1290::numeric),
      ('Mujer Resiste', 'mujer-resiste', 'Diseno de rotacion frecuente en talla chica y media.', 'mujer', 1350::numeric)
  ) AS p(name, slug, description, category_slug, base_price)
  JOIN category_ids c ON c.slug = p.category_slug
  ON CONFLICT (slug) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category_id = EXCLUDED.category_id,
    base_price = EXCLUDED.base_price,
    is_active = TRUE,
    images = COALESCE(public.products.images, ARRAY[]::text[])
  RETURNING id, slug
),
product_ids AS (
  SELECT id, slug FROM upsert_products
  UNION
  SELECT id, slug
  FROM public.products
  WHERE slug IN ('patria-y-vida-clasica', 'cuba-libre-street', 'patria-y-vida', 'mujer-resiste')
)
INSERT INTO public.product_variants (product_id, name, sku, stock, attributes, is_active)
SELECT
  p.id,
  'Talle ' || v.size,
  p.slug || '-' || lower(v.size),
  v.stock,
  jsonb_build_object('size', v.size),
  TRUE
FROM product_ids p
JOIN (
  VALUES
    ('patria-y-vida-clasica', 'S', 14),
    ('patria-y-vida-clasica', 'M', 18),
    ('patria-y-vida-clasica', 'L', 12),
    ('patria-y-vida-clasica', 'XL', 9),
    ('cuba-libre-street', 'XS', 8),
    ('cuba-libre-street', 'M', 15),
    ('cuba-libre-street', 'XL', 11),
    ('cuba-libre-street', 'XXL', 6),
    ('patria-y-vida', 'S', 16),
    ('patria-y-vida', 'M', 20),
    ('patria-y-vida', 'L', 14),
    ('patria-y-vida', 'XL', 10),
    ('mujer-resiste', 'XS', 10),
    ('mujer-resiste', 'S', 17),
    ('mujer-resiste', 'M', 13),
    ('mujer-resiste', 'L', 9)
) AS v(product_slug, size, stock) ON v.product_slug = p.slug
ON CONFLICT (sku) DO UPDATE
SET
  stock = EXCLUDED.stock,
  attributes = EXCLUDED.attributes,
  is_active = TRUE;

-- Verification query
-- SELECT
--   c.name AS category,
--   COUNT(DISTINCT p.id) AS products,
--   COUNT(v.id) FILTER (WHERE v.is_active) AS active_variants
-- FROM public.categories c
-- LEFT JOIN public.products p ON p.category_id = c.id
-- LEFT JOIN public.product_variants v ON v.product_id = p.id
-- WHERE c.slug IN ('hombre', 'mujer')
-- GROUP BY c.name
-- ORDER BY c.name;
