-- ============================================================
-- LASAC APP - Triggers de Notificaciones Automáticas
-- Liendo Automotores - Tierra del Fuego
-- ============================================================

-- ============================================================
-- 1. TRIGGER: Gestoría → Listo para alistar
-- Cuando estado_gestoria cambia a 'listo':
--   - Crear registro en alistamiento_pdi
--   - Actualizar estado_actual a 'alistamiento'
--   - Notificar a todos los preparadores de esa sucursal
-- ============================================================
CREATE OR REPLACE FUNCTION fn_gestoria_listo_para_alistar()
RETURNS TRIGGER AS $$
DECLARE
  v_preparador RECORD;
  v_modelo TEXT;
  v_vin TEXT;
  v_cliente TEXT;
  v_checklist JSONB;
BEGIN
  -- Solo actuar si estado_gestoria cambió a 'listo'
  IF NEW.estado_gestoria = 'listo' AND (OLD.estado_gestoria IS DISTINCT FROM 'listo') THEN

    -- Obtener datos de la unidad y titular
    SELECT u.modelo, u.vin_chasis INTO v_modelo, v_vin
    FROM unidades u WHERE u.operacion_id = NEW.id LIMIT 1;

    SELECT t.nombre_apellido INTO v_cliente
    FROM titulares t WHERE t.operacion_id = NEW.id LIMIT 1;

    -- Template de checklist PDI base
    v_checklist := '{"items": [
      {"id":1,"seccion":"Documentación y legales","item":"Manual del propietario presente","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":2,"seccion":"Documentación y legales","item":"Certificado de garantía","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":3,"seccion":"Documentación y legales","item":"Kit de herramientas y gato","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":4,"seccion":"Documentación y legales","item":"Rueda de auxilio","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":5,"seccion":"Exterior - Carrocería","item":"Pintura sin rayaduras ni abolladuras","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":6,"seccion":"Exterior - Carrocería","item":"Paragolpes delantero sin daños","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":7,"seccion":"Exterior - Carrocería","item":"Paragolpes trasero sin daños","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":8,"seccion":"Exterior - Carrocería","item":"Puertas alinean correctamente","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":9,"seccion":"Exterior - Carrocería","item":"Capot cierra correctamente","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":10,"seccion":"Exterior - Vidrios y ópticos","item":"Parabrisas sin fisuras","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":11,"seccion":"Exterior - Vidrios y ópticos","item":"Ópticas delanteras funcionan","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":12,"seccion":"Exterior - Vidrios y ópticos","item":"Ópticas traseras funcionan","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":13,"seccion":"Exterior - Vidrios y ópticos","item":"Espejos retrovisores completos","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":14,"seccion":"Neumáticos y llantas","item":"Presión de neumáticos correcta","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":15,"seccion":"Neumáticos y llantas","item":"Profundidad de banda de rodamiento","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":16,"seccion":"Neumáticos y llantas","item":"Llantas sin daños","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":17,"seccion":"Interior - Tapizado","item":"Asientos sin manchas ni daños","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":18,"seccion":"Interior - Tapizado","item":"Alfombras presentes y limpias","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":19,"seccion":"Interior - Tapizado","item":"Cinturones de seguridad funcionales","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":20,"seccion":"Interior - Equipamiento","item":"Aire acondicionado funciona","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":21,"seccion":"Interior - Equipamiento","item":"Sistema multimedia funciona","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":22,"seccion":"Interior - Equipamiento","item":"Tablero sin alertas activas","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":23,"seccion":"Interior - Equipamiento","item":"Levantavidrios eléctricos","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":24,"seccion":"Motor y fluidos","item":"Nivel de aceite de motor","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":25,"seccion":"Motor y fluidos","item":"Nivel de refrigerante","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":26,"seccion":"Motor y fluidos","item":"Nivel de líquido de frenos","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":27,"seccion":"Motor y fluidos","item":"Sin pérdidas visibles","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":28,"seccion":"Sistemas electrónicos","item":"Arranque del motor correcto","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":29,"seccion":"Sistemas electrónicos","item":"ABS funcional","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":30,"seccion":"Sistemas electrónicos","item":"Airbags sin alertas","es_critico":true,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":31,"seccion":"Sistemas electrónicos","item":"Cierre centralizado funciona","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":32,"seccion":"Sistemas electrónicos","item":"Sensor de estacionamiento","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":33,"seccion":"Accesorios pactados","item":"Accesorios según contrato verificados","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":34,"seccion":"Presentación final","item":"Vehículo lavado y aspirado","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":35,"seccion":"Presentación final","item":"Stickers y protecciones retirados","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":36,"seccion":"Presentación final","item":"Combustible mínimo cargado","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null},
      {"id":37,"seccion":"Presentación final","item":"Olor interior agradable","es_critico":false,"estado":null,"observacion":"","foto_url":null,"validado_por":null,"validado_at":null}
    ]}'::jsonb;

    -- Crear registro en alistamiento_pdi
    INSERT INTO alistamiento_pdi (operacion_id, checklist_pdi, no_conformidades)
    VALUES (NEW.id, v_checklist, '[]'::jsonb)
    ON CONFLICT DO NOTHING;

    -- Actualizar estado_actual
    NEW.estado_actual := 'alistamiento';

    -- Notificar a preparadores de la sucursal
    FOR v_preparador IN
      SELECT id FROM usuarios
      WHERE rol = 'preparador'
        AND activo = true
        AND (sucursal = NEW.sucursal OR sucursal = 'Ambas')
    LOOP
      INSERT INTO notificaciones (operacion_id, destinatario_id, tipo, mensaje, prioridad)
      VALUES (
        NEW.id,
        v_preparador.id,
        'nuevo_alistamiento',
        'Nueva unidad lista para PDI: ' || COALESCE(v_modelo, 'N/A') || ' (VIN ...' || RIGHT(COALESCE(v_vin, ''), 6) || ') - ' || COALESCE(v_cliente, 'N/A'),
        'alta'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_gestoria_listo ON operaciones;
CREATE TRIGGER trg_gestoria_listo
  BEFORE UPDATE ON operaciones
  FOR EACH ROW
  EXECUTE FUNCTION fn_gestoria_listo_para_alistar();

-- ============================================================
-- 2. TRIGGER: Alistamiento → Aprobado
-- Cuando alistamiento_pdi.aprobado cambia a true:
--   - Actualizar operación
--   - Crear registro en entregas
--   - Notificar al asesor asignado
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

    -- Obtener datos de la operación
    SELECT o.id, o.asesor_id, o.sucursal INTO v_operacion
    FROM operaciones o WHERE o.id = NEW.operacion_id;

    SELECT u.modelo INTO v_modelo FROM unidades u WHERE u.operacion_id = NEW.operacion_id LIMIT 1;
    SELECT t.nombre_apellido INTO v_cliente FROM titulares t WHERE t.operacion_id = NEW.operacion_id LIMIT 1;

    v_asesor_id := v_operacion.asesor_id;

    -- Actualizar operación
    UPDATE operaciones
    SET estado_alistamiento = 'aprobado', estado_actual = 'entrega'
    WHERE id = NEW.operacion_id;

    -- Crear registro de entrega
    INSERT INTO entregas (operacion_id, asesor_id, fecha_programada)
    VALUES (NEW.operacion_id, v_asesor_id, CURRENT_DATE + INTERVAL '3 days')
    ON CONFLICT DO NOTHING;

    -- Notificar al asesor
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

DROP TRIGGER IF EXISTS trg_alistamiento_aprobado ON alistamiento_pdi;
CREATE TRIGGER trg_alistamiento_aprobado
  AFTER UPDATE ON alistamiento_pdi
  FOR EACH ROW
  EXECUTE FUNCTION fn_alistamiento_aprobado();

-- ============================================================
-- 3. TRIGGER: Alistamiento → Rechazado
-- ============================================================
CREATE OR REPLACE FUNCTION fn_alistamiento_rechazado()
RETURNS TRIGGER AS $$
DECLARE
  v_director RECORD;
  v_modelo TEXT;
  v_vin TEXT;
BEGIN
  IF NEW.aprobado = false AND (OLD.aprobado IS DISTINCT FROM false) THEN

    SELECT u.modelo, u.vin_chasis INTO v_modelo, v_vin
    FROM unidades u WHERE u.operacion_id = NEW.operacion_id LIMIT 1;

    -- Actualizar operación
    UPDATE operaciones
    SET estado_alistamiento = 'rechazado'
    WHERE id = NEW.operacion_id;

    -- Notificar a directores y gestores
    FOR v_director IN
      SELECT id FROM usuarios
      WHERE rol IN ('director', 'gestor') AND activo = true
    LOOP
      INSERT INTO notificaciones (operacion_id, destinatario_id, tipo, mensaje, prioridad)
      VALUES (
        NEW.operacion_id,
        v_director.id,
        'rechazado_pdi',
        'PDI rechazado: ' || COALESCE(v_modelo, 'N/A') || ' - VIN ...' || RIGHT(COALESCE(v_vin, ''), 6) || ' - requiere atención de taller',
        'critica'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_alistamiento_rechazado ON alistamiento_pdi;
CREATE TRIGGER trg_alistamiento_rechazado
  AFTER UPDATE ON alistamiento_pdi
  FOR EACH ROW
  EXECUTE FUNCTION fn_alistamiento_rechazado();

-- ============================================================
-- 4. TRIGGER: CSI bajo → Alerta
-- Cuando se inserta una encuesta con promedio < 4 o NPS < 7
-- ============================================================
CREATE OR REPLACE FUNCTION fn_alerta_csi()
RETURNS TRIGGER AS $$
DECLARE
  v_supervisor RECORD;
  v_cliente TEXT;
  v_promedio DECIMAL;
BEGIN
  v_promedio := (NEW.p1_proceso_entrega + NEW.p2_atencion_asesor + NEW.p3_estado_unidad + NEW.p4_tiempo_espera)::decimal / 4;

  IF v_promedio < 4 OR NEW.p5_nps < 7 THEN
    SELECT t.nombre_apellido INTO v_cliente
    FROM titulares t WHERE t.operacion_id = NEW.operacion_id LIMIT 1;

    -- Notificar a director y calidad
    FOR v_supervisor IN
      SELECT id FROM usuarios
      WHERE rol IN ('director', 'calidad') AND activo = true
    LOOP
      INSERT INTO notificaciones (operacion_id, destinatario_id, tipo, mensaje, prioridad)
      VALUES (
        NEW.operacion_id,
        v_supervisor.id,
        'alerta_csi',
        'Alerta CSI: ' || COALESCE(v_cliente, 'N/A') || ' calificó ' || ROUND(v_promedio, 1) || '/5 (NPS: ' || NEW.p5_nps || ') - contacto urgente requerido',
        'critica'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_alerta_csi ON encuestas_csi;
CREATE TRIGGER trg_alerta_csi
  AFTER INSERT ON encuestas_csi
  FOR EACH ROW
  EXECUTE FUNCTION fn_alerta_csi();
