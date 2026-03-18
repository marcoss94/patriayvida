/**
 * Seed script for Patria y Vida database
 * Run with: npx tsx scripts/seed.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bejdqkbnqzhjcngjzxir.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Seed data definitions
const categories = [
  {
    name: 'Hombre',
    slug: 'hombre',
    description: 'Remeras para hombre',
    is_active: true
  },
  {
    name: 'Mujer',
    slug: 'mujer',
    description: 'Remeras para mujer',
    is_active: true
  }
];

const productsData = {
  hombre: [
    {
      name: 'Patria y Vida Clásica',
      slug: 'patria-y-vida-clasica',
      description: 'Diseño clásico con letras en blanco sobre fondo negro',
      base_price: 990,
      image_url: 'https://placehold.co/600x600/0a0f1e/f0ebe0?text=Patria+y+Vida+Clasica'
    },
    {
      name: 'Libertad Cuba',
      slug: 'libertad-cuba',
      description: 'Bandera cubana estilizada con mensaje de libertad',
      base_price: 1090,
      image_url: 'https://placehold.co/600x600/0a0f1e/f0ebe0?text=Libertad+Cuba'
    },
    {
      name: 'Orishas Tribute',
      slug: 'orishas-tribute',
      description: 'Homenaje a los Orishas con arte urbano',
      base_price: 1190,
      image_url: 'https://placehold.co/600x600/0a0f1e/f0ebe0?text=Orishas+Tribute'
    }
  ],
  mujer: [
    {
      name: 'Patria y Vida Floral',
      slug: 'patria-y-vida-floral',
      description: 'Diseño con flores cubanas y mensaje empoderador',
      base_price: 990,
      image_url: 'https://placehold.co/600x600/0a0f1e/f0ebe0?text=Patria+y+Vida+Floral'
    },
    {
      name: 'Libre Corazón',
      slug: 'libre-corazon',
      description: 'Corazón cubano con bandera y mensaje de libertad',
      base_price: 1090,
      image_url: 'https://placehold.co/600x600/0a0f1e/f0ebe0?text=Libre+Corazon'
    },
    {
      name: 'Resistencia Femenina',
      slug: 'resistencia-femenina',
      description: 'Diseño urbano celebrando la resistencia de las mujeres cubanas',
      base_price: 1190,
      image_url: 'https://placehold.co/600x600/0a0f1e/f0ebe0?text=Resistencia+Femenina'
    }
  ]
};

const sizes = ['S', 'M', 'L', 'XL', 'XXL'];

function randomStock(): number {
  return Math.floor(Math.random() * 11) + 5; // Random between 5-15
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    // 1. Insert Categories
    console.log('📦 Inserting categories...');
    const { data: insertedCategories, error: categoriesError } = await supabase
      .from('categories')
      .upsert(categories, { onConflict: 'slug' })
      .select();

    if (categoriesError) throw categoriesError;
    console.log(`✅ Inserted ${insertedCategories?.length || 0} categories\n`);

    // Get category IDs
    const { data: allCategories, error: fetchError } = await supabase
      .from('categories')
      .select('id, slug');

    if (fetchError) throw fetchError;

    const categoryMap = new Map(
      allCategories?.map(cat => [cat.slug, cat.id]) || []
    );

    // 2. Insert Products
    console.log('👕 Inserting products...');
    const allProducts = [];

    for (const [categorySlug, products] of Object.entries(productsData)) {
      const categoryId = categoryMap.get(categorySlug);
      if (!categoryId) {
        console.warn(`⚠️  Category ${categorySlug} not found, skipping products`);
        continue;
      }

      const productsWithCategory = products.map(product => ({
        ...product,
        category_id: categoryId,
        is_active: true
      }));

      allProducts.push(...productsWithCategory);
    }

    const { data: insertedProducts, error: productsError } = await supabase
      .from('products')
      .upsert(allProducts, { onConflict: 'slug' })
      .select();

    if (productsError) throw productsError;
    console.log(`✅ Inserted ${insertedProducts?.length || 0} products\n`);

    // 3. Insert Product Variants
    console.log('📏 Inserting product variants...');
    const allVariants = [];

    for (const product of insertedProducts || []) {
      for (const size of sizes) {
        allVariants.push({
          product_id: product.id,
          size,
          stock: randomStock(),
          is_active: true
        });
      }
    }

    const { data: insertedVariants, error: variantsError } = await supabase
      .from('product_variants')
      .upsert(allVariants, { onConflict: 'product_id,size' })
      .select();

    if (variantsError) throw variantsError;
    console.log(`✅ Inserted ${insertedVariants?.length || 0} product variants\n`);

    // 4. Summary
    console.log('📊 Seed Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Categories:       ${insertedCategories?.length || 0}`);
    console.log(`Products:         ${insertedProducts?.length || 0}`);
    console.log(`Product Variants: ${insertedVariants?.length || 0}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✨ Database seeded successfully!');

    // Verify data by category
    console.log('\n🔍 Verification by Category:');
    for (const [slug, categoryId] of categoryMap.entries()) {
      const { data: products } = await supabase
        .from('products')
        .select('name, base_price')
        .eq('category_id', categoryId);
      
      console.log(`\n  ${slug.toUpperCase()}:`);
      products?.forEach(product => {
        console.log(`    • ${product.name} - $${product.base_price}`);
      });
    }

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

main();
