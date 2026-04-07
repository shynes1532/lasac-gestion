-- ============================================================
-- FIX: Trigger fn_alistamiento_aprobado
--
-- Problema 1: La FK entregas.asesor_id apunta a auth.users (no a la
-- tabla pública usuarios). Operaciones con asesor_id que apuntaban a
-- un usuario borrado del auth hacían fallar el trigger.
--
-- Problema 2: El trigger forzaba estado_actual='entrega' incluso si la
-- operación ya había avanzado a 'entregado' o 'caida', lo cual era un
-- retroceso bloqueado por checks/triggers.
--
-- Solución: omitir asesor_id en el INSERT inicial (la app lo asigna
-- después) y respetar estados posteriores a 'entrega'.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_alistamiento_aprobado()
RETURNS TRIGGER AS $$
DECLARE
  v_operacion RECORD;
  v_modelo TEXT;
  v_cliente TEXT;
BEGIN
  IF NEW.aprobado = true AND (OLD.aprobado IS DISTINCT FROM true) THEN

    -- Obtener datos de la operación (incluyendo estado actual)
    SELECT o.id, o.asesor_id, o.sucursal, o.estado_actual INTO v_operacion
    FROM operaciones o WHERE o.id = NEW.operacion_id;

    SELECT u.modelo INTO v_modelo FROM unidades u WHERE u.operacion_id = NEW.operacion_id LIMIT 1;
    SELECT t.nombre_apellido INTO v_cliente FROM titulares t WHERE t.operacion_id = NEW.operacion_id LIMIT 1;

    -- Actualizar operación: solo avanzar estado_actual si NO está ya
    -- en un estado posterior (entrega/entregado/caida)
    IF v_operacion.estado_actual IN ('entrega', 'entregado', 'caida') THEN
      UPDATE operaciones
      SET estado_alistamiento = 'aprobado'
      WHERE id = NEW.operacion_id;
    ELSE
      UPDATE operaciones
      SET estado_alistamiento = 'aprobado', estado_actual = 'entrega'
      WHERE id = NEW.operacion_id;
    END IF;

    -- Crear entrega SIN asesor_id para evitar FK violations
    -- (operaciones.asesor_id puede apuntar a un usuario borrado)
    -- La app asigna el asesor desde el módulo de Entregas cuando corresponda.
    INSERT INTO entregas (operacion_id, fecha_programada)
    VALUES (NEW.operacion_id, CURRENT_DATE + INTERVAL '3 days')
    ON CONFLICT DO NOTHING;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
