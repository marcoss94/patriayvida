-- Seed inicial para Patria y Vida
-- Base de datos de remeras cubanas para mercado uruguayo
-- 
-- IMPORTANTE: Este archivo fue generado para coincidir con el esquema REAL de Supabase
-- - base_price es NUMERIC (no integer en cents) → 990 = $990 pesos
-- - images es ARRAY text[] (no string simple)
-- - product_variants usa price_override (nullable), NO price_adjustment
-- - categories NO tiene is_active

-- Limpieza (descomenta si necesitas resetear)
-- DELETE FROM product_variants;
-- DELETE FROM products;
-- DELETE FROM categories;

-- Categorías
INSERT INTO categories (id, name, slug, description, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Hombre', 'hombre', 'Remeras y merchandising para hombre', 1),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Mujer', 'mujer', 'Remeras y merchandising para mujer', 2)
ON CONFLICT (slug) DO NOTHING;

-- Productos para Hombre
INSERT INTO products (id, category_id, name, slug, description, base_price, images) VALUES
  ('a1111111-1111-1111-1111-111111111111'::uuid, 
   '11111111-1111-1111-1111-111111111111'::uuid,
   'Patria y Vida Clásica',
   'patria-y-vida-clasica',
   'Remera con el emblemático lema de libertad cubana',
   990,
   ARRAY['https://placehold.co/600x600/0a0f1e/f0ebe0?text=Patria+y+Vida+Clasica']),
   
  ('a2222222-2222-2222-2222-222222222222'::uuid,
   '11111111-1111-1111-1111-111111111111'::uuid,
   'Libertad Cuba',
   'libertad-cuba',
   'Diseño que celebra la lucha por la libertad',
   1090,
   ARRAY['https://placehold.co/600x600/0a0f1e/f0ebe0?text=Libertad+Cuba']),
   
  ('a3333333-3333-3333-3333-333333333333'::uuid,
   '11111111-1111-1111-1111-111111111111'::uuid,
   'Orishas Tribute',
   'orishas-tribute',
   'Homenaje al icónico grupo de hip hop cubano',
   1190,
   ARRAY['https://placehold.co/600x600/0a0f1e/f0ebe0?text=Orishas+Tribute'])
ON CONFLICT (slug) DO NOTHING;

-- Productos para Mujer
INSERT INTO products (id, category_id, name, slug, description, base_price, images) VALUES
  ('b1111111-1111-1111-1111-111111111111'::uuid,
   '22222222-2222-2222-2222-222222222222'::uuid,
   'Patria y Vida Floral',
   'patria-y-vida-floral',
   'Versión femenina con detalles florales',
   990,
   ARRAY['https://placehold.co/600x600/0a0f1e/f0ebe0?text=Patria+y+Vida+Floral']),
   
  ('b2222222-2222-2222-2222-222222222222'::uuid,
   '22222222-2222-2222-2222-222222222222'::uuid,
   'Libre Corazón',
   'libre-corazon',
   'Diseño que expresa libertad y pasión',
   1090,
   ARRAY['https://placehold.co/600x600/0a0f1e/f0ebe0?text=Libre+Corazon']),
   
  ('b3333333-3333-3333-3333-333333333333'::uuid,
   '22222222-2222-2222-2222-222222222222'::uuid,
   'Resistencia Femenina',
   'resistencia-femenina',
   'Homenaje a las mujeres en la lucha cubana',
   1190,
   ARRAY['https://placehold.co/600x600/0a0f1e/f0ebe0?text=Resistencia+Femenina'])
ON CONFLICT (slug) DO NOTHING;

-- Variantes para "Patria y Vida Clásica" (Hombre)
INSERT INTO product_variants (product_id, name, sku, stock, attributes) VALUES
  ('a1111111-1111-1111-1111-111111111111'::uuid, 'Talle S', 'PATRIA_Y_VIDA_CLASICA_S', 12, '{"size": "S"}'::jsonb),
  ('a1111111-1111-1111-1111-111111111111'::uuid, 'Talle M', 'PATRIA_Y_VIDA_CLASICA_M', 8, '{"size": "M"}'::jsonb),
  ('a1111111-1111-1111-1111-111111111111'::uuid, 'Talle L', 'PATRIA_Y_VIDA_CLASICA_L', 15, '{"size": "L"}'::jsonb),
  ('a1111111-1111-1111-1111-111111111111'::uuid, 'Talle XL', 'PATRIA_Y_VIDA_CLASICA_XL', 10, '{"size": "XL"}'::jsonb),
  ('a1111111-1111-1111-1111-111111111111'::uuid, 'Talle XXL', 'PATRIA_Y_VIDA_CLASICA_XXL', 6, '{"size": "XXL"}'::jsonb)
ON CONFLICT (sku) DO NOTHING;

-- Variantes para "Libertad Cuba" (Hombre)
INSERT INTO product_variants (product_id, name, sku, stock, attributes) VALUES
  ('a2222222-2222-2222-2222-222222222222'::uuid, 'Talle S', 'LIBERTAD_CUBA_S', 9, '{"size": "S"}'::jsonb),
  ('a2222222-2222-2222-2222-222222222222'::uuid, 'Talle M', 'LIBERTAD_CUBA_M', 14, '{"size": "M"}'::jsonb),
  ('a2222222-2222-2222-2222-222222222222'::uuid, 'Talle L', 'LIBERTAD_CUBA_L', 11, '{"size": "L"}'::jsonb),
  ('a2222222-2222-2222-2222-222222222222'::uuid, 'Talle XL', 'LIBERTAD_CUBA_XL', 7, '{"size": "XL"}'::jsonb),
  ('a2222222-2222-2222-2222-222222222222'::uuid, 'Talle XXL', 'LIBERTAD_CUBA_XXL', 13, '{"size": "XXL"}'::jsonb)
ON CONFLICT (sku) DO NOTHING;

-- Variantes para "Orishas Tribute" (Hombre)
INSERT INTO product_variants (product_id, name, sku, stock, attributes) VALUES
  ('a3333333-3333-3333-3333-333333333333'::uuid, 'Talle S', 'ORISHAS_TRIBUTE_S', 10, '{"size": "S"}'::jsonb),
  ('a3333333-3333-3333-3333-333333333333'::uuid, 'Talle M', 'ORISHAS_TRIBUTE_M', 5, '{"size": "M"}'::jsonb),
  ('a3333333-3333-3333-3333-333333333333'::uuid, 'Talle L', 'ORISHAS_TRIBUTE_L', 12, '{"size": "L"}'::jsonb),
  ('a3333333-3333-3333-3333-333333333333'::uuid, 'Talle XL', 'ORISHAS_TRIBUTE_XL', 15, '{"size": "XL"}'::jsonb),
  ('a3333333-3333-3333-3333-333333333333'::uuid, 'Talle XXL', 'ORISHAS_TRIBUTE_XXL', 8, '{"size": "XXL"}'::jsonb)
ON CONFLICT (sku) DO NOTHING;

-- Variantes para "Patria y Vida Floral" (Mujer)
INSERT INTO product_variants (product_id, name, sku, stock, attributes) VALUES
  ('b1111111-1111-1111-1111-111111111111'::uuid, 'Talle S', 'PATRIA_Y_VIDA_FLORAL_S', 11, '{"size": "S"}'::jsonb),
  ('b1111111-1111-1111-1111-111111111111'::uuid, 'Talle M', 'PATRIA_Y_VIDA_FLORAL_M', 9, '{"size": "M"}'::jsonb),
  ('b1111111-1111-1111-1111-111111111111'::uuid, 'Talle L', 'PATRIA_Y_VIDA_FLORAL_L', 14, '{"size": "L"}'::jsonb),
  ('b1111111-1111-1111-1111-111111111111'::uuid, 'Talle XL', 'PATRIA_Y_VIDA_FLORAL_XL', 6, '{"size": "XL"}'::jsonb),
  ('b1111111-1111-1111-1111-111111111111'::uuid, 'Talle XXL', 'PATRIA_Y_VIDA_FLORAL_XXL', 13, '{"size": "XXL"}'::jsonb)
ON CONFLICT (sku) DO NOTHING;

-- Variantes para "Libre Corazón" (Mujer)
INSERT INTO product_variants (product_id, name, sku, stock, attributes) VALUES
  ('b2222222-2222-2222-2222-222222222222'::uuid, 'Talle S', 'LIBRE_CORAZON_S', 7, '{"size": "S"}'::jsonb),
  ('b2222222-2222-2222-2222-222222222222'::uuid, 'Talle M', 'LIBRE_CORAZON_M', 12, '{"size": "M"}'::jsonb),
  ('b2222222-2222-2222-2222-222222222222'::uuid, 'Talle L', 'LIBRE_CORAZON_L', 10, '{"size": "L"}'::jsonb),
  ('b2222222-2222-2222-2222-222222222222'::uuid, 'Talle XL', 'LIBRE_CORAZON_XL', 15, '{"size": "XL"}'::jsonb),
  ('b2222222-2222-2222-2222-222222222222'::uuid, 'Talle XXL', 'LIBRE_CORAZON_XXL', 8, '{"size": "XXL"}'::jsonb)
ON CONFLICT (sku) DO NOTHING;

-- Variantes para "Resistencia Femenina" (Mujer)
INSERT INTO product_variants (product_id, name, sku, stock, attributes) VALUES
  ('b3333333-3333-3333-3333-333333333333'::uuid, 'Talle S', 'RESISTENCIA_FEMENINA_S', 13, '{"size": "S"}'::jsonb),
  ('b3333333-3333-3333-3333-333333333333'::uuid, 'Talle M', 'RESISTENCIA_FEMENINA_M', 11, '{"size": "M"}'::jsonb),
  ('b3333333-3333-3333-3333-333333333333'::uuid, 'Talle L', 'RESISTENCIA_FEMENINA_L', 9, '{"size": "L"}'::jsonb),
  ('b3333333-3333-3333-3333-333333333333'::uuid, 'Talle XL', 'RESISTENCIA_FEMENINA_XL', 14, '{"size": "XL"}'::jsonb),
  ('b3333333-3333-3333-3333-333333333333'::uuid, 'Talle XXL', 'RESISTENCIA_FEMENINA_XXL', 5, '{"size": "XXL"}'::jsonb)
ON CONFLICT (sku) DO NOTHING;

-- Verificación de datos (descomenta para ver resultados)
-- SELECT 
--   (SELECT COUNT(*) FROM categories) as categories_count,
--   (SELECT COUNT(*) FROM products) as products_count,
--   (SELECT COUNT(*) FROM product_variants) as variants_count;

-- Ver un producto completo con relaciones
-- SELECT 
--   p.name as producto,
--   p.base_price,
--   c.name as categoria,
--   pv.name as variante,
--   pv.sku,
--   pv.stock
-- FROM products p
-- JOIN categories c ON p.category_id = c.id
-- JOIN product_variants pv ON pv.product_id = p.id
-- ORDER BY c.name, p.name, pv.name;
