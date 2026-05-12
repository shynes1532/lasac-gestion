-- =====================================================
-- 025_stock_transferencias_estados.sql
-- Agrega ciclo de vida a stock_transferencias de vehículos.
--
-- Estados:
--   'pendiente'   → solicitud creada, vehículo todavía en sucursal_origen
--   'en_transito' → vehículo cargado en batea, ya salió
--   'completada'  → vehículo llegó a destino. Recién acá se cambia
--                   stock_vehiculos.sucursal.
--   'cancelada'   → solicitud anulada (no hubo movimiento físico).
--
-- Las transferencias preexistentes (si las hay) se marcan como
-- 'completada' (asumimos que ya se ejecutaron al insertarlas con el flow viejo).
-- =====================================================

ALTER TABLE public.stock_transferencias
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','en_transito','completada','cancelada')),
  ADD COLUMN IF NOT EXISTS fecha_completada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS solicitado_por UUID REFERENCES auth.users(id);

-- Backfill: las transferencias viejas que estaban en 'pendiente' por default
-- y que NO tenemos forma de saber su estado real, las marcamos completadas
-- si la sucursal del vehículo ya coincide con sucursal_destino.
UPDATE public.stock_transferencias t
SET estado = 'completada',
    fecha_completada = t.created_at
FROM public.stock_vehiculos v
WHERE t.stock_id = v.id
  AND v.sucursal = t.sucursal_destino
  AND t.estado = 'pendiente';

-- Índice parcial — solo pendientes/en_tránsito (las activas para logística)
CREATE INDEX IF NOT EXISTS idx_stock_transf_activas
  ON public.stock_transferencias(sucursal_origen, created_at DESC)
  WHERE estado IN ('pendiente','en_transito');

CREATE INDEX IF NOT EXISTS idx_stock_transf_destino_activas
  ON public.stock_transferencias(sucursal_destino, created_at DESC)
  WHERE estado IN ('pendiente','en_transito');

-- Verificación
SELECT estado, COUNT(*) FROM public.stock_transferencias GROUP BY estado;
