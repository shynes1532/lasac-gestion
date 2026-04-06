-- ============================================================
-- Modulo Recepcion — Registro de visitas al concesionario
-- ============================================================

CREATE TABLE IF NOT EXISTS visitas_recepcion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Datos del visitante
  visitante_nombre TEXT NOT NULL,
  visitante_telefono TEXT,
  visitante_email TEXT,

  -- Contexto
  sucursal TEXT NOT NULL CHECK (sucursal IN ('Ushuaia', 'Rio Grande')),
  tipo_consulta TEXT NOT NULL CHECK (tipo_consulta IN ('administracion', 'ventas', 'postventa', 'repuestos')),
  estado TEXT NOT NULL DEFAULT 'en_espera' CHECK (estado IN ('en_espera', 'atendido', 'finalizado')),

  -- Timestamps de flujo
  fecha_hora_ingreso TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_hora_atencion TIMESTAMPTZ,
  fecha_hora_finalizacion TIMESTAMPTZ,

  -- Campos Administracion
  admin_motivo TEXT,
  admin_resuelto BOOLEAN,
  admin_observaciones TEXT,

  -- Campos Ventas
  ventas_asesor_asignado TEXT,
  ventas_consulta_resuelta BOOLEAN,
  ventas_calificacion_atencion INTEGER CHECK (ventas_calificacion_atencion BETWEEN 1 AND 5),
  ventas_quiere_que_lo_llamen BOOLEAN,
  ventas_telefono_callback TEXT,

  -- General
  observaciones TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indice principal: visitas del dia por sucursal
CREATE INDEX idx_visitas_recepcion_fecha_sucursal
  ON visitas_recepcion (sucursal, fecha_hora_ingreso DESC);

-- RLS
ALTER TABLE visitas_recepcion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visitas_recepcion_select" ON visitas_recepcion
  FOR SELECT USING (true);

CREATE POLICY "visitas_recepcion_insert" ON visitas_recepcion
  FOR INSERT WITH CHECK (true);

CREATE POLICY "visitas_recepcion_update" ON visitas_recepcion
  FOR UPDATE USING (true);
