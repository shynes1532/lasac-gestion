-- ============================================================================
-- LASAC APP - Migración 006: Pipeline 6 pasos
-- Fecha: 2026-03-19
-- ============================================================================

-- ============================================================================
-- 0. FUNCIONES AUXILIARES (crear si no existen)
-- ============================================================================

-- update_updated_at: actualiza updated_at en cada UPDATE
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- get_user_role: devuelve el rol del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT rol FROM public.usuarios WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 1. ACTUALIZAR estado_actual en operaciones (6 pasos + terminal)
-- ============================================================================

ALTER TABLE public.operaciones
  DROP CONSTRAINT IF EXISTS operaciones_estado_actual_check;

-- Migrar datos existentes antes de agregar el nuevo constraint
UPDATE public.operaciones SET estado_actual = 'entregado'
  WHERE estado_actual IN ('entrega','cerrada');

ALTER TABLE public.operaciones
  ADD CONSTRAINT operaciones_estado_actual_check
  CHECK (estado_actual IN ('cierre','documentacion','gestoria','alistamiento','calidad','entrega','entregado','caida'));

-- ============================================================================
-- 2. ACTUALIZAR tipo_operacion (normalizar a minúsculas)
-- ============================================================================

ALTER TABLE public.operaciones
  DROP CONSTRAINT IF EXISTS operaciones_tipo_operacion_check;

-- Normalizar valores existentes antes del nuevo constraint
UPDATE public.operaciones SET tipo_operacion = '0km'        WHERE tipo_operacion = '0KM';
UPDATE public.operaciones SET tipo_operacion = 'plan_ahorro' WHERE tipo_operacion IN ('Plan de Ahorro','plan ahorro');
UPDATE public.operaciones SET tipo_operacion = 'usados'      WHERE tipo_operacion = 'Usado';

ALTER TABLE public.operaciones
  ADD CONSTRAINT operaciones_tipo_operacion_check
  CHECK (tipo_operacion IN ('0km','usados','plan_ahorro'));

-- ============================================================================
-- 3. AGREGAR CAMPOS A operaciones
-- ============================================================================

-- Paso 1 — Cierre comercial
ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS nro_epod              TEXT,
  ADD COLUMN IF NOT EXISTS cliente_nombre        TEXT,
  ADD COLUMN IF NOT EXISTS cliente_telefono      TEXT,
  ADD COLUMN IF NOT EXISTS fecha_compromiso      DATE,
  ADD COLUMN IF NOT EXISTS estado_paso1          TEXT DEFAULT 'creada'
    CHECK (estado_paso1 IN ('creada','confirmada','caida')),
  ADD COLUMN IF NOT EXISTS motivo_caida          TEXT
    CHECK (motivo_caida IN ('desiste','no_califica','otra_marca','otro')),
  ADD COLUMN IF NOT EXISTS historial_estados     JSONB DEFAULT '[]'::jsonb;

-- Paso 1 — Financiero / Prenda
ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS forma_pago            TEXT
    CHECK (forma_pago IN ('contado','financiado_banco','plan_ahorro')),
  ADD COLUMN IF NOT EXISTS banco_entidad         TEXT
    CHECK (banco_entidad IN ('Santander Río','FIAT Crédito','Galicia','Otro')),
  ADD COLUMN IF NOT EXISTS estado_prenda         TEXT DEFAULT NULL
    CHECK (estado_prenda IN ('pendiente','enviada')),
  ADD COLUMN IF NOT EXISTS fecha_envio_prenda    DATE;

-- Paso 1 — Plan de Ahorro
ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS nro_grupo_orden       TEXT,
  ADD COLUMN IF NOT EXISTS fecha_adjudicacion    DATE;

-- Paso 2 — Documentación y Pagos
ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS pago_cliente_completo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pago_banco_recibido   BOOLEAN,
  ADD COLUMN IF NOT EXISTS carpeta_ok            BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS chasis_verificado     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS unidad_disponible     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS papeles_preparados    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cliente_citado        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS papeles_terminal_recibidos BOOLEAN,
  ADD COLUMN IF NOT EXISTS firmas_adelantadas    BOOLEAN,
  ADD COLUMN IF NOT EXISTS unidad_en_sucursal    BOOLEAN,
  ADD COLUMN IF NOT EXISTS estado_paso2          TEXT DEFAULT 'pagos_pendientes'
    CHECK (estado_paso2 IN ('pagos_pendientes','armando_carpeta','cliente_citado','paso_3',
                             'papeles_terminal','firmas','esperando_unidad','unidad_llego'));

-- Paso 3 — Gestoría y Patentamiento
ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS carpeta_registral_lista BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cliente_firmo          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS o2_solicitado          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS resultado_o2           TEXT
    CHECK (resultado_o2 IN ('libre','inhibido')),
  ADD COLUMN IF NOT EXISTS ingresado_registro     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_ingreso_registro DATE,
  ADD COLUMN IF NOT EXISTS egresado_registro      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_egreso_registro  DATE,
  ADD COLUMN IF NOT EXISTS dominio_patente        TEXT,
  ADD COLUMN IF NOT EXISTS estado_paso3           TEXT DEFAULT 'preparando_carpeta'
    CHECK (estado_paso3 IN ('preparando_carpeta','esperando_firma','o2_solicitado',
                             'en_registro','patentado','inhibido'));

-- Paso 6 — Entrega final
ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS unidad_entregada       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_entrega_real     DATE,
  ADD COLUMN IF NOT EXISTS entrega_con_incidente  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS detalle_incidente      TEXT,
  ADD COLUMN IF NOT EXISTS dias_totales           INTEGER,
  ADD COLUMN IF NOT EXISTS diferencia_compromiso  INTEGER;

-- ============================================================================
-- 4. TABLA contactos_calidad (Paso 5)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contactos_calidad (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id              UUID NOT NULL REFERENCES public.operaciones(id) ON DELETE CASCADE,

  -- Momento 1: 2 días hábiles antes
  contacto_2d_antes         BOOLEAN DEFAULT false,
  cliente_confirmo          TEXT CHECK (cliente_confirmo IN ('si','no','reprograma')),
  fecha_entrega_confirmada  DATE,

  -- Momento 2: 1 hora antes
  contacto_1h_antes         BOOLEAN DEFAULT false,
  resultado_1h              TEXT CHECK (resultado_1h IN ('confirma','reprograma')),

  -- Momento 3: Carta felicitaciones (día de entrega)
  carta_enviada             BOOLEAN DEFAULT false,

  -- Momento 4: 2 días hábiles después
  intentos_post             INTEGER DEFAULT 0,
  contacto_efectivo_post    BOOLEAN DEFAULT false,
  satisfaccion              TEXT CHECK (satisfaccion IN ('satisfecho','insatisfecho')),
  verbatim                  TEXT,
  alerta_gpv                BOOLEAN DEFAULT false,

  estado_calidad            TEXT DEFAULT 'citar_2d'
    CHECK (estado_calidad IN ('citar_2d','confirmar_1h','entregado','post_2d','cerrado')),

  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contactos_calidad_operacion
  ON public.contactos_calidad(operacion_id);

-- updated_at automático
CREATE OR REPLACE TRIGGER trg_updated_at_contactos_calidad
  BEFORE UPDATE ON public.contactos_calidad
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 5. RLS para contactos_calidad
-- ============================================================================

ALTER TABLE public.contactos_calidad ENABLE ROW LEVEL SECURITY;

CREATE POLICY contactos_calidad_all_director ON public.contactos_calidad
  FOR ALL USING (get_user_role() = 'director');

CREATE POLICY contactos_calidad_select_calidad ON public.contactos_calidad
  FOR SELECT USING (get_user_role() = 'calidad');

CREATE POLICY contactos_calidad_insert_calidad ON public.contactos_calidad
  FOR INSERT WITH CHECK (get_user_role() = 'calidad');

CREATE POLICY contactos_calidad_update_calidad ON public.contactos_calidad
  FOR UPDATE USING (get_user_role() = 'calidad');

CREATE POLICY contactos_calidad_select_asesor_ush ON public.contactos_calidad
  FOR SELECT USING (
    get_user_role() IN ('asesor_ush','asesor_rg')
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
    )
  );

-- ============================================================================
-- 6. FUNCIÓN: calcular semáforo por días
-- ============================================================================

CREATE OR REPLACE FUNCTION public.semaforo_dias(
  fecha_inicio TIMESTAMPTZ,
  umbral_amarillo INTEGER,
  umbral_rojo INTEGER
) RETURNS TEXT AS $$
DECLARE
  dias_transcurridos INTEGER;
BEGIN
  dias_transcurridos := EXTRACT(EPOCH FROM (now() - fecha_inicio)) / 86400;
  IF dias_transcurridos < umbral_amarillo THEN RETURN 'verde';
  ELSIF dias_transcurridos < umbral_rojo THEN RETURN 'amarillo';
  ELSE RETURN 'rojo';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 7. TRIGGER: bloqueo inhibido 02
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_o2_inhibido()
RETURNS TRIGGER AS $$
BEGIN
  -- Si intenta marcar ingresado_registro = true y resultado_o2 = 'inhibido' → bloquear
  IF NEW.ingresado_registro = true AND NEW.resultado_o2 = 'inhibido' THEN
    RAISE EXCEPTION 'No se puede ingresar al registro: titular inhibido en 02';
  END IF;

  -- Si resultado_o2 = 'inhibido' → actualizar estado_paso3 + notificar
  IF NEW.resultado_o2 = 'inhibido' AND (OLD.resultado_o2 IS DISTINCT FROM 'inhibido') THEN
    NEW.estado_paso3 := 'inhibido';

    -- Notificación crítica al director
    INSERT INTO public.notificaciones (operacion_id, destinatario_id, tipo, mensaje, prioridad)
    SELECT
      NEW.id,
      u.id,
      'general',
      'ALERTA: Titular inhibido en 02 en operación ' || COALESCE(NEW.numero_operacion, 'nueva'),
      'critica'
    FROM public.usuarios u
    WHERE u.rol = 'director' AND u.activo = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_o2_inhibido ON public.operaciones;
CREATE TRIGGER trg_check_o2_inhibido
  BEFORE UPDATE ON public.operaciones
  FOR EACH ROW
  WHEN (NEW.o2_solicitado = true OR NEW.ingresado_registro IS DISTINCT FROM OLD.ingresado_registro)
  EXECUTE FUNCTION public.check_o2_inhibido();

-- ============================================================================
-- 8. TRIGGER: métricas al cerrar entrega
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calc_metricas_entrega()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unidad_entregada = true AND OLD.unidad_entregada = false THEN
    NEW.fecha_entrega_real := COALESCE(NEW.fecha_entrega_real, CURRENT_DATE);
    NEW.dias_totales := (NEW.fecha_entrega_real - NEW.created_at::DATE);
    IF NEW.fecha_compromiso IS NOT NULL THEN
      NEW.diferencia_compromiso := (NEW.fecha_entrega_real - NEW.fecha_compromiso);
    END IF;
    NEW.estado_actual := 'entregado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_metricas_entrega ON public.operaciones;
CREATE TRIGGER trg_calc_metricas_entrega
  BEFORE UPDATE ON public.operaciones
  FOR EACH ROW
  WHEN (NEW.unidad_entregada IS DISTINCT FROM OLD.unidad_entregada)
  EXECUTE FUNCTION public.calc_metricas_entrega();

-- ============================================================================
-- 9. TRIGGER: alerta GPV si insatisfecho
-- ============================================================================

CREATE OR REPLACE FUNCTION public.alerta_gpv_insatisfecho()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.satisfaccion = 'insatisfecho' AND OLD.satisfaccion IS DISTINCT FROM 'insatisfecho' THEN
    NEW.alerta_gpv := true;

    -- Notificar al director y calidad
    INSERT INTO public.notificaciones (operacion_id, destinatario_id, tipo, mensaje, prioridad)
    SELECT
      NEW.operacion_id,
      u.id,
      'alerta_csi',
      'Cliente insatisfecho: contactar telefónicamente mañana. Op: ' ||
        COALESCE((SELECT numero_operacion FROM operaciones WHERE id = NEW.operacion_id), ''),
      'critica'
    FROM public.usuarios u
    WHERE u.rol IN ('director','calidad') AND u.activo = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alerta_gpv ON public.contactos_calidad;
CREATE TRIGGER trg_alerta_gpv
  BEFORE UPDATE ON public.contactos_calidad
  FOR EACH ROW
  WHEN (NEW.satisfaccion IS DISTINCT FROM OLD.satisfaccion)
  EXECUTE FUNCTION public.alerta_gpv_insatisfecho();

-- ============================================================================
-- 10. PDI — agregar items faltantes si no existen
-- ============================================================================
-- Nota: los items del PDI están en JSONB, los nuevos se agregan en constants.ts.
-- Esta migración no modifica datos JSONB existentes.

-- ============================================================================
-- FIN DE MIGRACIÓN 006
-- ============================================================================
