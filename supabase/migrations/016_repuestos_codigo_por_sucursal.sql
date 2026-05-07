-- =====================================================
-- 016_repuestos_codigo_por_sucursal.sql
-- Permite cargar el mismo codigo_fiat en distintas sucursales
-- como filas separadas de la tabla repuestos.
--
-- Cambio:
--   - DROP UNIQUE (codigo_fiat)
--   - ADD UNIQUE (codigo_fiat, sucursal)
--
-- Resultado:
--   - codigo_fiat='X' + sucursal='Rio Grande'  → permitido
--   - codigo_fiat='X' + sucursal='Ushuaia'     → permitido (otra fila)
--   - codigo_fiat='X' + sucursal='Rio Grande'  → bloqueado (duplicado)
--
-- IMPORTANTE: cada fila tiene su propio id (uuid), su propio precio_lista,
-- su propio stock_sucursal, etc. Lógicamente son productos distintos
-- aunque compartan código FIAT. Si después querés consolidar reportes
-- por código se hace con GROUP BY codigo_fiat.
-- =====================================================

-- 1. Quitar el UNIQUE simple sobre codigo_fiat (creado por la columna en 008).
ALTER TABLE public.repuestos
  DROP CONSTRAINT IF EXISTS repuestos_codigo_fiat_key;

-- 2. Agregar UNIQUE compuesto (codigo_fiat, sucursal).
ALTER TABLE public.repuestos
  ADD CONSTRAINT repuestos_codigo_sucursal_unique
  UNIQUE (codigo_fiat, sucursal);

-- 3. El índice idx_repuestos_codigo (de 008) sigue sirviendo para búsqueda.
--    No hace falta tocarlo.

-- ----------------------------------------------------------------
-- Verificación
-- ----------------------------------------------------------------
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.repuestos'::regclass
--   AND contype = 'u';
-- Debería listar repuestos_codigo_sucursal_unique con (codigo_fiat, sucursal).
