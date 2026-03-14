-- ============================================================================
-- LASAC APP - Schema completo para Liendo Automotores (FIAT Tierra del Fuego)
-- Migración: 001_schema.sql
-- Fecha: 2026-03-14
-- ============================================================================

-- ============================================================================
-- 1. TABLAS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1.1 USUARIOS
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email         TEXT UNIQUE NOT NULL,
    nombre_completo TEXT NOT NULL,
    rol           TEXT NOT NULL CHECK (rol IN ('director','asesor_ush','asesor_rg','gestor','preparador','calidad')),
    sucursal      TEXT CHECK (sucursal IN ('Ushuaia','Rio Grande','Ambas')),
    activo        BOOLEAN DEFAULT true,
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE usuarios IS 'Perfiles extendidos vinculados a auth.users';

-- --------------------------------------------------------------------------
-- 1.2 OPERACIONES
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operaciones (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_operacion  TEXT UNIQUE,  -- se autogenera via trigger OP-YYYY-NNNN
    sucursal          TEXT NOT NULL CHECK (sucursal IN ('Ushuaia','Rio Grande')),
    tipo_operacion    TEXT NOT NULL CHECK (tipo_operacion IN ('0KM','Plan de Ahorro','Usado')),
    estado_actual     TEXT NOT NULL DEFAULT 'gestoria' CHECK (estado_actual IN ('gestoria','alistamiento','entrega','cerrada')),
    estado_gestoria   TEXT NOT NULL DEFAULT 'ingresado' CHECK (estado_gestoria IN ('ingresado','en_tramite','listo','egresado','suspendido')),
    estado_alistamiento TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado_alistamiento IN ('pendiente','en_proceso','observado','aprobado','rechazado')),
    estado_entrega    TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado_entrega IN ('pendiente','programada','entregada','cerrada')),
    asesor_id         UUID REFERENCES auth.users(id),
    created_by        UUID REFERENCES auth.users(id),
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE operaciones IS 'Operación principal que atraviesa gestoría → alistamiento → entrega';

-- --------------------------------------------------------------------------
-- 1.3 TITULARES
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS titulares (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion_id    UUID NOT NULL REFERENCES operaciones(id) ON DELETE CASCADE,
    nombre_apellido TEXT NOT NULL CHECK (length(nombre_apellido) >= 3),
    dni_cuil        TEXT NOT NULL,
    domicilio       TEXT,
    localidad       TEXT,
    telefono        TEXT NOT NULL,
    email           TEXT,
    es_empresa      BOOLEAN DEFAULT false,
    razon_social    TEXT,
    cuit_empresa    TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE titulares IS 'Titular/comprador asociado a una operación';

-- --------------------------------------------------------------------------
-- 1.4 UNIDADES
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unidades (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion_id    UUID NOT NULL REFERENCES operaciones(id) ON DELETE CASCADE,
    marca           TEXT DEFAULT 'FIAT',
    modelo          TEXT NOT NULL,
    version         TEXT,
    color           TEXT,
    vin_chasis      TEXT NOT NULL UNIQUE,
    patente_actual  TEXT,
    patente_nueva   TEXT,
    kilometraje     INTEGER,
    anio            INTEGER,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE unidades IS 'Unidad/vehículo asociado a una operación';

-- --------------------------------------------------------------------------
-- 1.5 GESTORÍA - TRÁMITES
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gestoria_tramites (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion_id            UUID NOT NULL REFERENCES operaciones(id) ON DELETE CASCADE,
    fecha_ingreso           DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_egreso_estimada   DATE,
    fecha_egreso_real       DATE,
    gestor_responsable      UUID REFERENCES auth.users(id),
    documentacion_completa  BOOLEAN DEFAULT false,
    observaciones           TEXT,
    checklist_doc           JSONB DEFAULT '[]'::jsonb,
    historial_estados       JSONB DEFAULT '[]'::jsonb,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE gestoria_tramites IS 'Detalle del trámite de gestoría para cada operación';

-- --------------------------------------------------------------------------
-- 1.6 ALISTAMIENTO / PDI
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alistamiento_pdi (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion_id          UUID NOT NULL REFERENCES operaciones(id) ON DELETE CASCADE,
    preparador_id         UUID REFERENCES auth.users(id),
    fecha_inicio          TIMESTAMPTZ,
    fecha_fin             TIMESTAMPTZ,
    checklist_pdi         JSONB DEFAULT '{"items":[]}'::jsonb,
    no_conformidades      JSONB DEFAULT '[]'::jsonb,
    aprobado              BOOLEAN,
    aprobado_por          UUID REFERENCES auth.users(id),
    observaciones_tecnicas TEXT,
    fotos_evidencia       TEXT[] DEFAULT '{}',
    created_at            TIMESTAMPTZ DEFAULT now(),
    updated_at            TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE alistamiento_pdi IS 'Pre-delivery inspection y alistamiento del vehículo';

-- --------------------------------------------------------------------------
-- 1.7 ENTREGAS
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entregas (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion_id      UUID NOT NULL REFERENCES operaciones(id) ON DELETE CASCADE,
    asesor_id         UUID REFERENCES auth.users(id),
    fecha_programada  DATE NOT NULL,
    hora_programada   TIME,
    checklist_entrega JSONB DEFAULT '[]'::jsonb,
    acto_entregado_at TIMESTAMPTZ,
    compromisos       JSONB DEFAULT '[]'::jsonb,
    observaciones     TEXT,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE entregas IS 'Acto de entrega del vehículo al cliente';

-- --------------------------------------------------------------------------
-- 1.8 ENCUESTAS CSI
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS encuestas_csi (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion_id        UUID NOT NULL REFERENCES operaciones(id) ON DELETE CASCADE,
    fecha_envio         TIMESTAMPTZ,
    fecha_respuesta     TIMESTAMPTZ,
    p1_proceso_entrega  INTEGER CHECK (p1_proceso_entrega BETWEEN 1 AND 5),
    p2_atencion_asesor  INTEGER CHECK (p2_atencion_asesor BETWEEN 1 AND 5),
    p3_estado_unidad    INTEGER CHECK (p3_estado_unidad BETWEEN 1 AND 5),
    p4_tiempo_espera    INTEGER CHECK (p4_tiempo_espera BETWEEN 1 AND 5),
    p5_nps              INTEGER CHECK (p5_nps BETWEEN 0 AND 10),
    comentarios         TEXT,
    promedio            DECIMAL GENERATED ALWAYS AS (
        (p1_proceso_entrega + p2_atencion_asesor + p3_estado_unidad + p4_tiempo_espera)::decimal / 4
    ) STORED,
    alerta_activa       BOOLEAN GENERATED ALWAYS AS (
        ((p1_proceso_entrega + p2_atencion_asesor + p3_estado_unidad + p4_tiempo_espera)::decimal / 4) < 4
        OR p5_nps < 7
    ) STORED,
    contacto_realizado  BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE encuestas_csi IS 'Encuesta de satisfacción post-entrega (Customer Satisfaction Index)';

-- --------------------------------------------------------------------------
-- 1.9 NOTIFICACIONES
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion_id    UUID REFERENCES operaciones(id),
    destinatario_id UUID NOT NULL REFERENCES auth.users(id),
    tipo            TEXT NOT NULL,
    mensaje         TEXT NOT NULL,
    prioridad       TEXT DEFAULT 'normal' CHECK (prioridad IN ('baja','normal','alta','critica')),
    leida           BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE notificaciones IS 'Notificaciones in-app para los usuarios del sistema';

-- --------------------------------------------------------------------------
-- 1.10 MODELOS FIAT (tabla de referencia)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS modelos_fiat (
    id        SERIAL PRIMARY KEY,
    categoria TEXT NOT NULL,
    nombre    TEXT NOT NULL UNIQUE,
    activo    BOOLEAN DEFAULT true
);

COMMENT ON TABLE modelos_fiat IS 'Catálogo de modelos FIAT disponibles';


-- ============================================================================
-- 2. FUNCIONES
-- ============================================================================

-- --------------------------------------------------------------------------
-- 2.1 Generar número de operación OP-YYYY-NNNN
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_numero_operacion()
RETURNS TRIGGER AS $$
DECLARE
    anio TEXT;
    siguiente INTEGER;
BEGIN
    anio := to_char(now(), 'YYYY');

    SELECT COALESCE(MAX(
        CAST(split_part(numero_operacion, '-', 3) AS INTEGER)
    ), 0) + 1
    INTO siguiente
    FROM operaciones
    WHERE numero_operacion LIKE 'OP-' || anio || '-%';

    NEW.numero_operacion := 'OP-' || anio || '-' || lpad(siguiente::text, 4, '0');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 2.2 Actualizar updated_at automáticamente
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 2.3 Obtener rol del usuario
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_rol TEXT;
BEGIN
    SELECT rol INTO user_rol
    FROM usuarios
    WHERE id = user_id AND activo = true;

    RETURN user_rol;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 2.4 Obtener sucursal del usuario
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_sucursal(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_sucursal TEXT;
BEGIN
    SELECT sucursal INTO user_sucursal
    FROM usuarios
    WHERE id = user_id AND activo = true;

    RETURN user_sucursal;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ============================================================================
-- 3. TRIGGERS
-- ============================================================================

-- Número de operación automático
CREATE OR REPLACE TRIGGER auto_numero_operacion
    BEFORE INSERT ON operaciones
    FOR EACH ROW
    WHEN (NEW.numero_operacion IS NULL)
    EXECUTE FUNCTION generate_numero_operacion();

-- updated_at automático en todas las tablas que lo requieren
CREATE OR REPLACE TRIGGER trg_updated_at_operaciones
    BEFORE UPDATE ON operaciones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_updated_at_titulares
    BEFORE UPDATE ON titulares
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_updated_at_unidades
    BEFORE UPDATE ON unidades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_updated_at_gestoria_tramites
    BEFORE UPDATE ON gestoria_tramites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_updated_at_alistamiento_pdi
    BEFORE UPDATE ON alistamiento_pdi
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_updated_at_entregas
    BEFORE UPDATE ON entregas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_updated_at_usuarios
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- 4. ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_operaciones_sucursal_estado
    ON operaciones(sucursal, estado_actual);

CREATE INDEX IF NOT EXISTS idx_operaciones_numero
    ON operaciones(numero_operacion);

CREATE INDEX IF NOT EXISTS idx_titulares_dni
    ON titulares(dni_cuil);

CREATE INDEX IF NOT EXISTS idx_titulares_operacion
    ON titulares(operacion_id);

CREATE INDEX IF NOT EXISTS idx_unidades_vin
    ON unidades(vin_chasis);

CREATE INDEX IF NOT EXISTS idx_unidades_operacion
    ON unidades(operacion_id);

CREATE INDEX IF NOT EXISTS idx_notificaciones_destinatario_leida
    ON notificaciones(destinatario_id, leida);

CREATE INDEX IF NOT EXISTS idx_gestoria_operacion
    ON gestoria_tramites(operacion_id);

CREATE INDEX IF NOT EXISTS idx_alistamiento_operacion
    ON alistamiento_pdi(operacion_id);

CREATE INDEX IF NOT EXISTS idx_entregas_operacion
    ON entregas(operacion_id);


-- ============================================================================
-- 5. REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE operaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones;


-- ============================================================================
-- FIN DE MIGRACIÓN 001_schema.sql
-- ============================================================================
