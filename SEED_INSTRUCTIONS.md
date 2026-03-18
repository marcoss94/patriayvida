# 🌱 Instrucciones para Seed de Base de Datos

## ⚡ Ejecución Rápida

```bash
# 1. Instalar tsx (si no lo tenés)
npm install

# 2. Configurar tu Service Key de Supabase
# En Windows PowerShell:
$env:SUPABASE_SERVICE_KEY="tu_service_key_aqui"

# En Windows CMD:
set SUPABASE_SERVICE_KEY=tu_service_key_aqui

# En Linux/Mac:
export SUPABASE_SERVICE_KEY="tu_service_key_aqui"

# 3. Ejecutar el seed
npm run seed
```

## 🔑 Obtener tu Service Key

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard/project/bejdqkbnqzhjcngjzxir)
2. Project Settings → API
3. Copiar la key que dice **"service_role"** (secret)

⚠️ **IMPORTANTE**: Esta key tiene privilegios de admin. NUNCA la commitees a git ni la expongas públicamente.

## 📊 Qué se va a crear

### ✅ 2 Categorías
- **Hombre** - Remeras para hombre
- **Mujer** - Remeras para mujer

### ✅ 6 Productos (3 por categoría)

**Categoría Hombre:**
1. Patria y Vida Clásica - $990 UYU
2. Libertad Cuba - $1090 UYU
3. Orishas Tribute - $1190 UYU

**Categoría Mujer:**
1. Patria y Vida Floral - $990 UYU
2. Libre Corazón - $1090 UYU
3. Resistencia Femenina - $1190 UYU

### ✅ 30 Variantes
- Cada producto tiene 5 tallas: S, M, L, XL, XXL
- Stock aleatorio entre 5-15 unidades por talla
- Total: 6 productos × 5 tallas = 30 variantes

## 🎨 Imágenes

El seed usa placeholders temporales con el tema oscuro del store:
- Fondo: `#0a0f1e` (negro azulado)
- Texto: `#f0ebe0` (beige claro)
- URL: `https://placehold.co/600x600/0a0f1e/f0ebe0?text=NOMBRE_PRODUCTO`

Podés reemplazar estas URLs más adelante con las imágenes reales de los diseños.

## 🔄 Seguridad de Re-ejecución

El script usa **upsert** con `onConflict` en los slugs, lo que significa que:
- ✅ Podes ejecutarlo múltiples veces sin crear duplicados
- ✅ Actualiza los registros existentes si el slug ya existe
- ✅ Es seguro para testing y development

## 🐛 Troubleshooting

### Error: "SUPABASE_SERVICE_KEY is required"
→ No configuraste la variable de entorno. Seguí el paso 2 de arriba.

### Error: "tsx: command not found"
→ Ejecutá `npm install` primero para instalar las dependencias.

### Error: "permission denied for table"
→ Estás usando la **anon key** en vez de la **service_role key**. Necesitás la service key para hacer seed.

### Error: "connect ECONNREFUSED"
→ Problemas de red o la URL de Supabase es incorrecta. Verificá que `https://bejdqkbnqzhjcngjzxir.supabase.co` sea la URL correcta de tu proyecto.

## 🔄 Alternativa: Seed SQL Directo

Si preferís no usar el script de TypeScript, podés ejecutar el SQL directamente:

1. Abrí [Supabase SQL Editor](https://supabase.com/dashboard/project/bejdqkbnqzhjcngjzxir/sql/new)
2. Copiá el contenido de `supabase/seed.sql`
3. Pegalo en el editor y ejecutá

Esta opción no requiere configurar variables de entorno ni instalar dependencias.

## 📚 Más Info

Ver `scripts/README.md` para documentación detallada sobre la estructura de datos y opciones avanzadas.
