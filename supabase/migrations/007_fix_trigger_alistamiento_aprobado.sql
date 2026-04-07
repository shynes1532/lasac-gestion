-- ============================================================
-- FIX: Trigger fn_alistamiento_aprobado
--
-- Problema 1: Si operaciones.asesor_id apunta a un usuario borrado o
-- inválido, el INSERT en entregas falla por la FK entregas_asesor_id_fkey.
--
-- Problema 2: El trigger forzaba estado_actual='entrega' incluso si la
-- operación ya había avanzado a 'entregado' o 'caida', lo cual era un
-- retroceso y bloqueado por algún check previo.
--
-- Solución: validar el asesor_id contra la tabla usuarios y respetar
-- estados posteriores a 'entrega'.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_alistamiento_aprobado()
RETURNS TRIGGER AS $$
DECLARE
  v_operacion RECORD;
  v_asesor_id UUID;
  v_modelo TEXT;
  v_cliente TEXT;
BEGIN
  IF NEW.aprobado = true AND (OLD.aprobado IS DISTINCT FROM true) THEN

    -- Obtener datos de la operación (incluyendo estado actual)
    SELECT o.id, o.asesor_id, o.sucursal, o.estado_actual INTO v_operacion
    FROM operaciones o WHERE o.id = NEW.operacion_id;

    SELECT u.modelo INTO v_modelo FROM unidades u WHERE u.operacion_id = NEW.operacion_id LIMIT 1;
    SELECT t.nombre_apellido INTO v_cliente FROM titulares t WHERE t.operacion_id = NEW.operacion_id LIMIT 1;

    -- Validar que el asesor_id exista en usuarios, sino NULL
    -- (evita que la FK entregas_asesor_id_fkey falle)
    v_asesor_id := NULL;
    IF v_operacion.asesor_id IS NOT NULL THEN
      SELECT id INTO v_asesor_id
      FROM usuarios
      WHERE id = v_operacion.asesor_id
      LIMIT 1;
    END IF;

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

    -- Crear registro de entrega (con asesor_id NULL si no es válido)
    INSERT INTO entregas (operacion_id, asesor_id, fecha_programada)
    VALUES (NEW.operacion_id, v_asesor_id, CURRENT_DATE + INTERVAL '3 days')
    ON CONFLICT DO NOTHING;

    -- Notificar al asesor solo si existe
    IF v_asesor_id IS NOT NULL THEN
      INSERT INTO notificaciones (operacion_id, destinatario_id, tipo, mensaje, prioridad)
      VALUES (
        NEW.operacion_id,
        v_asesor_id,
        'aprobado_pdi',
        'Unidad aprobada para entrega: ' || COALESCE(v_modelo, 'N/A') || ' - ' || COALESCE(v_cliente, 'N/A'),
        'alta'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
