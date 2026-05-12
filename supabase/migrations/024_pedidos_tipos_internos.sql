-- =====================================================
-- 024_pedidos_tipos_internos.sql
-- Extiende pedidos_repuestos con dos tipos internos:
--   - 'transferencia_sucursal' (de una sucursal a otra)
--   - 'fiat_faltante' (pedido a la terminal FIAT, lista de faltantes)
--
-- Agrega columna sucursal_origen (NULL excepto para transferencias).
-- =====================================================

-- 1. Drop el CHECK viejo de tipo y crear uno nuevo con los 2 valores adicionales.
ALTER TABLE public.pedidos_repuestos
  DROP CONSTRAINT IF EXISTS pedidos_repuestos_tipo_check;

ALTER TABLE public.pedidos_repuestos
  ADD CONSTRAINT pedidos_repuestos_tipo_check
  CHECK (tipo IN ('garantia','mostrador','siniestro','transferencia_sucursal','fiat_faltante'));

-- 2. Columna sucursal_origen (solo aplica a transferencia_sucursal,
--    en el resto queda NULL).
ALTER TABLE public.pedidos_repuestos
  ADD COLUMN IF NOT EXISTS sucursal_origen TEXT
  CHECK (sucursal_origen IS NULL
         OR sucursal_origen IN ('Ushuaia','Rio Grande','Deposito Central'));

-- 3. Constraint coherente:
--    - Si tipo='transferencia_sucursal' → sucursal_origen NOT NULL
--      y debe ser distinta de sucursal (destino).
--    - Si otro tipo → sucursal_origen debe ser NULL.
ALTER TABLE public.pedidos_repuestos
  DROP CONSTRAINT IF EXISTS pedidos_transferencia_coherente;

ALTER TABLE public.pedidos_repuestos
  ADD CONSTRAINT pedidos_transferencia_coherente
  CHECK (
    (tipo = 'transferencia_sucursal' AND sucursal_origen IS NOT NULL AND sucursal_origen <> sucursal)
    OR
    (tipo <> 'transferencia_sucursal' AND sucursal_origen IS NULL)
  );

-- Verificación
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.pedidos_repuestos'::regclass AND contype = 'c';
