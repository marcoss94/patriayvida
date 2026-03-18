# Database Seeding Scripts

Scripts para poblar la base de datos de Patria y Vida con datos iniciales.

## Prerrequisitos

1. Tener configurada la variable de entorno `SUPABASE_SERVICE_KEY` con tu service key de Supabase
2. Instalar dependencias: `npm install`

## Métodos de Seed

### Opción 1: TypeScript Script (Recomendado)

```bash
# Instalar dependencias si no lo hiciste
npm install

# Ejecutar el seed
npm run seed
```

Este script:
- ✅ Inserta 2 categorías (Hombre, Mujer)
- ✅ Inserta 6 productos (3 por categoría)
- ✅ Inserta 30 variantes (5 tallas por producto: S, M, L, XL, XXL)
- ✅ Stock aleatorio entre 5-15 unidades por variante
- ✅ Usa `upsert` para evitar duplicados
- ✅ Muestra resumen y verificación al finalizar

### Opción 2: SQL Directo

Puedes ejecutar el archivo `supabase/seed.sql` directamente en el SQL Editor de Supabase:

1. Ve a tu proyecto en Supabase Dashboard
2. Abre el SQL Editor
3. Copia y pega el contenido de `../supabase/seed.sql`
4. Ejecuta la query

## Variables de Entorno Necesarias

Crea un archivo `.env.local` con:

```env
NEXT_PUBLIC_SUPABASE_URL=https://bejdqkbnqzhjcngjzxir.supabase.co
SUPABASE_SERVICE_KEY=tu_service_key_aqui
```

**IMPORTANTE:** El `SUPABASE_SERVICE_KEY` tiene privilegios administrativos. NUNCA lo expongas en código cliente ni lo commitees a git.

## Estructura de Datos

### Categories
- **Hombre** - Remeras para hombre
- **Mujer** - Remeras para mujer

### Products (Hombre)
1. **Patria y Vida Clásica** - $990 UYU
2. **Libertad Cuba** - $1090 UYU
3. **Orishas Tribute** - $1190 UYU

### Products (Mujer)
1. **Patria y Vida Floral** - $990 UYU
2. **Libre Corazón** - $1090 UYU
3. **Resistencia Femenina** - $1190 UYU

### Variants
Cada producto tiene 5 variantes (S, M, L, XL, XXL) con stock entre 5-15 unidades.

## Troubleshooting

### Error: "SUPABASE_SERVICE_KEY is required"
Asegúrate de tener la variable de entorno configurada. Puedes obtener tu service key en:
Supabase Dashboard → Project Settings → API → service_role (secret)

### Error: "duplicate key value violates unique constraint"
El script usa `upsert` con `onConflict` para evitar duplicados. Si ves este error, verifica que los slugs sean únicos.

### Error: "permission denied for table"
Verifica que estés usando el `SUPABASE_SERVICE_KEY` (no la anon key) ya que necesitas permisos de admin para hacer seed.
