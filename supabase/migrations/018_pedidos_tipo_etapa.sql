-- =====================================================
-- 018_pedidos_tipo_etapa.sql
-- Refactor del modelo de pedidos_repuestos:
--   - Reemplaza los 5 flags booleanos por dos categorías ortogonales:
--       tipo  (origen):     garantia | mostrador | siniestro
--       etapa (ciclo vida): comprado | en_viaje | en_stock | entregado | cancelado
--   - Mantiene recibo_emitido / numero_recibo / monto_pagado (info de pago).
--   - Migra datos existentes (si los hay) a los nuevos campos.
-- =====================================================

-- ----------------------------------------------------------------
-- 1. Agregar columnas nuevas (con default temporal para que pasen NOT NULL)
-- ----------------------------------------------------------------
ALTER TABLE public.pedidos_repuestos
  ADD COLUMN IF NOT EXISTS tipo  TEXT
    CHECK (tipo IN ('garantia','mostrador','siniestro')),
  ADD COLUMN IF NOT EXISTS etapa TEXT
    CHECK (etapa IN ('comprado','en_viaje','en_stock','entregado','cancelado'));

-- ----------------------------------------------------------------
-- 2. Migrar datos preexistentes (si los hay) a los nuevos campos.
--    Reglas de migración:
--      - tipo: si esperando_garantia → garantia
--              si esperando_siniestro → siniestro
--              en otro caso → mostrador
--      - etapa: cancelado=true → cancelado
--               entregado_at NOT NULL → entregado
--               esperando_cliente=true → en_stock
--               esperando_repuesto=true → en_viaje
--               default → comprado
-- ----------------------------------------------------------------
UPDATE public.pedidos_repuestos
SET
  tipo = COALESCE(tipo, CASE
    WHEN esperando_garantia  THEN 'garantia'
    WHEN esperando_siniestro THEN 'siniestro'
    ELSE 'mostrador'
  END),
  etapa = COALESCE(etapa, CASE
    WHEN cancelado            THEN 'cancelado'
    WHEN entregado_at IS NOT NULL THEN 'entregado'
    WHEN esperando_cliente    THEN 'en_stock'
    WHEN esperando_repuesto   THEN 'en_viaje'
    ELSE 'comprado'
  END)
WHERE tipo IS NULL OR etapa IS NULL;

-- ----------------------------------------------------------------
-- 3. Forzar NOT NULL una vez que están poblados
-- ----------------------------------------------------------------
ALTER TABLE public.pedidos_repuestos
  ALTER COLUMN tipo  SET NOT NULL,
  ALTER COLUMN etapa SET NOT NULL,
  ALTER COLUMN tipo  SET DEFAULT 'mostrador',
  ALTER COLUMN etapa SET DEFAULT 'comprado';

-- ----------------------------------------------------------------
-- 4. Drop columnas viejas (flags + cancelado)
--    motivo_cancelacion se mantiene (sigue sirviendo cuando etapa='cancelado').
-- ----------------------------------------------------------------
ALTER TABLE public.pedidos_repuestos
  DROP COLUMN IF EXISTS esperando_repuesto,
  DROP COLUMN IF EXISTS esperando_garantia,
  DROP COLUMN IF EXISTS esperando_siniestro,
  DROP COLUMN IF EXISTS esperando_cliente,
  DROP COLUMN IF EXISTS cancelado;

-- 4b. Reemplazar el CHECK que dependía de la columna `cancelado` por uno
--     equivalente sobre la nueva columna `etapa`.
ALTER TABLE public.pedidos_repuestos
  DROP CONSTRAINT IF EXISTS pedidos_repuestos_check;
ALTER TABLE public.pedidos_repuestos
  ADD CONSTRAINT pedidos_etapa_cancelado_motivo
  CHECK (etapa <> 'cancelado' OR motivo_cancelacion IS NOT NULL);

-- ----------------------------------------------------------------
-- 5. Actualizar índices
-- ----------------------------------------------------------------
DROP INDEX IF EXISTS idx_pedidos_repuestos_abiertos;
CREATE INDEX IF NOT EXISTS idx_pedidos_repuestos_abiertos
  ON public.pedidos_repuestos(sucursal, created_at DESC)
  WHERE etapa NOT IN ('entregado','cancelado');

CREATE INDEX IF NOT EXISTS idx_pedidos_repuestos_tipo
  ON public.pedidos_repuestos(tipo);
CREATE INDEX IF NOT EXISTS idx_pedidos_repuestos_etapa
  ON public.pedidos_repuestos(etapa);

-- ----------------------------------------------------------------
-- 6. Actualizar función entregar_pedido_repuestos
--    (ya no setea flags, ahora setea etapa='entregado')
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.entregar_pedido_repuestos(
  p_pedido_id UUID,
  p_usuario_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_pedido RECORD;
  v_item   RECORD;
  v_stock  INTEGER;
  v_total_descontado INTEGER := 0;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos_repuestos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % no existe', p_pedido_id USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.etapa = 'entregado' THEN
    RAISE EXCEPTION 'Pedido % ya está entregado', p_pedido_id USING ERRCODE = 'P0001';
  END IF;
  IF v_pedido.etapa = 'cancelado' THEN
    RAISE EXCEPTION 'Pedido % está cancelado', p_pedido_id USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN
    SELECT * FROM public.pedidos_repuestos_items
    WHERE pedido_id = p_pedido_id AND entregado = false
  LOOP
    SELECT stock_fisico INTO v_stock
    FROM public.stock_sucursal
    WHERE producto_id = v_item.producto_id AND sucursal = v_pedido.sucursal
    FOR UPDATE;

    IF v_stock IS NULL OR v_stock < v_item.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente en % para producto % (necesita %, hay %)',
        v_pedido.sucursal, v_item.producto_id, v_item.cantidad, COALESCE(v_stock, 0)
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.stock_sucursal
    SET stock_fisico = stock_fisico - v_item.cantidad,
        updated_at = now()
    WHERE producto_id = v_item.producto_id AND sucursal = v_pedido.sucursal;

    IF v_item.reserva_id IS NOT NULL THEN
      UPDATE public.reservas_stock
      SET estado = 'consumida'
      WHERE id = v_item.reserva_id AND estado = 'activa';
    END IF;

    UPDATE public.pedidos_repuestos_items
    SET entregado = true,
        entregado_at = now()
    WHERE id = v_item.id;

    v_total_descontado := v_total_descontado + v_item.cantidad;
  END LOOP;

  UPDATE public.pedidos_repuestos
  SET etapa         = 'entregado',
      entregado_at  = now(),
      entregado_por = p_usuario_id
  WHERE id = p_pedido_id;

  RETURN jsonb_build_object(
    'pedido_id',          p_pedido_id,
    'unidades_descontadas', v_total_descontado,
    'sucursal',           v_pedido.sucursal,
    'entregado_at',       now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregar_pedido_repuestos(UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------
-- Verificación
-- ----------------------------------------------------------------
-- SELECT id, numero_pedido, tipo, etapa FROM public.pedidos_repuestos LIMIT 5;
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'pedidos_repuestos'
--    AND column_name IN ('tipo','etapa','esperando_repuesto','cancelado');
-- (esperando_*, cancelado deben NO existir; tipo y etapa deben ser NOT NULL)
