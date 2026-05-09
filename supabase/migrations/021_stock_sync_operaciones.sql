-- =====================================================
-- 021_stock_sync_operaciones.sql
-- Sincroniza stock_vehiculos con el ciclo de vida de las operaciones.
--
-- Reglas:
--   1. Al insertar una fila en `unidades` con vin_chasis que matche un
--      stock_vehiculos disponible → vincular operacion_id y pasar a 'reservado'.
--   2. Al pasar la operación a estado_actual='entregado' → stock 'vendido'.
--   3. Al pasar la operación a estado_actual='caida' → desvincular y volver
--      a 'disponible' (el auto vuelve al pool).
-- =====================================================

-- ----------------------------------------------------------------
-- 1. Trigger AFTER INSERT en `unidades`
--    Vincula la unidad con stock_vehiculos si existe el VIN.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_unidad_vincula_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vin_chasis IS NULL OR NEW.vin_chasis = '' THEN
    RETURN NEW;
  END IF;

  -- Vincular el primer stock disponible con ese VIN.
  -- Ignoramos si el stock ya está vendido o ya está reservado para otra op.
  UPDATE public.stock_vehiculos
  SET operacion_id = NEW.operacion_id,
      estado       = 'reservado',
      updated_at   = now()
  WHERE vin = NEW.vin_chasis
    AND (operacion_id IS NULL OR operacion_id = NEW.operacion_id)
    AND estado IN ('disponible','reservado');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_unidad_vincula_stock ON public.unidades;
CREATE TRIGGER trg_unidad_vincula_stock
  AFTER INSERT ON public.unidades
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_unidad_vincula_stock();


-- ----------------------------------------------------------------
-- 2. Trigger AFTER UPDATE en `operaciones`
--    Cuando cambia estado_actual:
--      - 'entregado' → todos los stocks vinculados pasan a 'vendido'
--      - 'caida'     → todos los stocks vinculados se liberan ('disponible' + operacion_id=NULL)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_operacion_sync_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo reaccionar si cambia estado_actual
  IF NEW.estado_actual IS NOT DISTINCT FROM OLD.estado_actual THEN
    RETURN NEW;
  END IF;

  IF NEW.estado_actual = 'entregado' THEN
    UPDATE public.stock_vehiculos
    SET estado     = 'vendido',
        updated_at = now()
    WHERE operacion_id = NEW.id
      AND estado <> 'vendido';
  ELSIF NEW.estado_actual = 'caida' THEN
    UPDATE public.stock_vehiculos
    SET estado       = 'disponible',
        operacion_id = NULL,
        updated_at   = now()
    WHERE operacion_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_operacion_sync_stock ON public.operaciones;
CREATE TRIGGER trg_operacion_sync_stock
  AFTER UPDATE ON public.operaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_operacion_sync_stock();


-- ----------------------------------------------------------------
-- 3. Backfill — sincronizar el estado actual con las operaciones
--    existentes (las que se cargaron antes de instalar el trigger).
-- ----------------------------------------------------------------

-- 3a. Vincular stocks cuyos VINs ya están en operaciones activas
UPDATE public.stock_vehiculos sv
SET operacion_id = u.operacion_id,
    estado       = 'reservado',
    updated_at   = now()
FROM public.unidades u
JOIN public.operaciones o ON o.id = u.operacion_id
WHERE sv.vin = u.vin_chasis
  AND sv.operacion_id IS NULL
  AND sv.estado IN ('disponible','reservado')
  AND o.estado_actual NOT IN ('caida','entregado');

-- 3b. Marcar como vendido los que tienen operación entregada
UPDATE public.stock_vehiculos sv
SET estado     = 'vendido',
    updated_at = now()
FROM public.unidades u
JOIN public.operaciones o ON o.id = u.operacion_id
WHERE sv.vin = u.vin_chasis
  AND o.estado_actual = 'entregado'
  AND sv.estado <> 'vendido';

-- 3c. Si llegó a quedar vinculado a operación caída, liberar
UPDATE public.stock_vehiculos sv
SET operacion_id = NULL,
    estado       = 'disponible',
    updated_at   = now()
FROM public.operaciones o
WHERE sv.operacion_id = o.id
  AND o.estado_actual = 'caida';


-- ----------------------------------------------------------------
-- Verificación
-- ----------------------------------------------------------------
SELECT estado, COUNT(*) AS total
FROM public.stock_vehiculos
GROUP BY estado
ORDER BY estado;
