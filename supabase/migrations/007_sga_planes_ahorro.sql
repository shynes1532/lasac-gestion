-- ============================================================
-- SGA: Sistema de Gestion de Ahorro — FIAT Plan
-- Esquema real con planes, condiciones, vehiculos y etapas
-- ============================================================

-- =====================
-- Grupos de ahorro
-- =====================
CREATE TABLE IF NOT EXISTS grupos_ahorro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_grupo TEXT NOT NULL UNIQUE,
  tipo_plan TEXT NOT NULL DEFAULT 'H'
    CHECK (tipo_plan IN ('H','E')),           -- H=84 cuotas/168 pers, E=50 cuotas/100 pers
  modelo TEXT NOT NULL,
  valor_movil NUMERIC(14,2) NOT NULL DEFAULT 0,
  cantidad_integrantes INTEGER NOT NULL DEFAULT 168,
  cantidad_cuotas INTEGER NOT NULL DEFAULT 84,
  cuotas_acto INTEGER NOT NULL DEFAULT 0,     -- cuotas transcurridas del grupo
  fecha_formacion DATE,
  estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('formando','activo','cerrado','disuelto')),
  sucursal TEXT NOT NULL DEFAULT 'Ushuaia'
    CHECK (sucursal IN ('Ushuaia','Rio Grande')),
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Ahorristas (suscriptores)
-- =====================
CREATE TABLE IF NOT EXISTS ahorristas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Alta (Etapa 1)
  numero_solicitud TEXT NOT NULL UNIQUE,
  grupo_id UUID REFERENCES grupos_ahorro(id) ON DELETE SET NULL,
  operacion_id UUID REFERENCES operaciones(id) ON DELETE SET NULL,
  nombre_apellido TEXT NOT NULL,
  dni_cuil TEXT NOT NULL,
  domicilio TEXT,
  localidad TEXT,
  telefono TEXT,
  email TEXT,
  numero_orden INTEGER,
  tipo_plan TEXT NOT NULL DEFAULT 'H'
    CHECK (tipo_plan IN ('H','E')),
  codigo_plan TEXT NOT NULL,                    -- B72, B90, M81, M80, B70, B71, B61
  vehiculo_codigo TEXT NOT NULL,                -- AR2, DP1, MB1, FP1, FS1, NT1, FO1, FT1, DT1
  vehiculo_modelo TEXT NOT NULL,                -- nombre completo del modelo
  valor_movil NUMERIC(14,2) NOT NULL,
  cuota_pura NUMERIC(12,2) NOT NULL,           -- importe cuota cobrada (C1 suscripcion)
  fecha_arranque DATE NOT NULL,                 -- fecha de inicio del plan
  nro_recibo_c1 TEXT,                           -- recibo primera cuota
  es_subite BOOLEAN NOT NULL DEFAULT false,     -- promo Subite
  vendedor_id UUID REFERENCES auth.users(id),
  vendedor_nombre TEXT,

  -- Estado general
  estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo','adjudicado','entregado','renunciado','rescindido','transferido')),
  sucursal TEXT NOT NULL DEFAULT 'Ushuaia'
    CHECK (sucursal IN ('Ushuaia','Rio Grande')),

  -- Cuotas
  cuotas_pagas INTEGER NOT NULL DEFAULT 1,      -- arranca en 1 (C1 ya paga)
  cuotas_impagas_consecutivas INTEGER NOT NULL DEFAULT 0,
  cuotas_impagas_total INTEGER NOT NULL DEFAULT 0,
  en_riesgo_rescision BOOLEAN NOT NULL DEFAULT false, -- 3 cuotas impagas

  -- Adjudicacion (Etapa 2)
  adjudicado BOOLEAN NOT NULL DEFAULT false,
  fecha_adjudicacion DATE,
  tipo_adjudicacion TEXT
    CHECK (tipo_adjudicacion IS NULL OR tipo_adjudicacion IN ('sorteo','licitacion')),
  monto_licitacion NUMERIC(14,2),
  acepto_adjudicacion BOOLEAN,                  -- tiene 5 dias para aceptar
  fecha_limite_aceptacion DATE,

  -- Integracion (Etapa 3) — Solo Plan H: necesita 24 cuotas para retirar
  integracion_completa BOOLEAN NOT NULL DEFAULT false,
  cuotas_integradas INTEGER NOT NULL DEFAULT 0, -- cuantas lleva de las 24

  -- Gastos adjudicacion (Etapa 4)
  derecho_admision NUMERIC(12,2),               -- 2.5% valor movil (al suscribir)
  derecho_adjudicacion NUMERIC(12,2),           -- 2.0% + IVA valor movil
  gastos_entrega NUMERIC(12,2),                 -- registro + prenda + flete
  cambio_modelo BOOLEAN NOT NULL DEFAULT false,
  modelo_elegido TEXT,                          -- si cambio modelo
  diferencia_modelo NUMERIC(12,2),

  -- Entrega (Etapa 5)
  vehiculo_retirado BOOLEAN NOT NULL DEFAULT false,
  fecha_retiro DATE,
  fecha_notificacion_retiro DATE,               -- 15 dias para retirar
  cobra_estadia BOOLEAN NOT NULL DEFAULT false,

  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Cuotas de ahorro
-- =====================
CREATE TABLE IF NOT EXISTS cuotas_ahorro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ahorrista_id UUID NOT NULL REFERENCES ahorristas(id) ON DELETE CASCADE,
  numero_cuota INTEGER NOT NULL,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,       -- monto segun valor movil vigente
  valor_movil_vigente NUMERIC(14,2),             -- valor movil al momento del vencimiento
  fecha_vencimiento DATE NOT NULL,
  fecha_pago DATE,
  monto_pagado NUMERIC(12,2) DEFAULT 0,
  nro_recibo TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','pagada','vencida','en_mora','bonificada')),
  dias_mora INTEGER NOT NULL DEFAULT 0,
  interes_mora NUMERIC(12,2) NOT NULL DEFAULT 0,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ahorrista_id, numero_cuota)
);

-- =====================
-- Gestiones de mora
-- =====================
CREATE TABLE IF NOT EXISTS gestiones_mora (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ahorrista_id UUID NOT NULL REFERENCES ahorristas(id) ON DELETE CASCADE,
  cuota_id UUID REFERENCES cuotas_ahorro(id) ON DELETE SET NULL,
  tipo_gestion TEXT NOT NULL DEFAULT 'llamada'
    CHECK (tipo_gestion IN ('llamada','whatsapp','email','carta_documento','visita','otro')),
  fecha_gestion TIMESTAMPTZ NOT NULL DEFAULT now(),
  resultado TEXT NOT NULL DEFAULT 'sin_contacto'
    CHECK (resultado IN ('sin_contacto','promesa_pago','pago_parcial','pago_total','rechazo','otro')),
  fecha_promesa DATE,
  monto_prometido NUMERIC(12,2),
  observaciones TEXT,
  gestionado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- Indices
-- =====================
CREATE INDEX IF NOT EXISTS idx_ahorristas_grupo ON ahorristas(grupo_id);
CREATE INDEX IF NOT EXISTS idx_ahorristas_estado ON ahorristas(estado);
CREATE INDEX IF NOT EXISTS idx_ahorristas_vendedor ON ahorristas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_ahorristas_rescision ON ahorristas(en_riesgo_rescision) WHERE en_riesgo_rescision = true;
CREATE INDEX IF NOT EXISTS idx_ahorristas_adjudicado ON ahorristas(adjudicado) WHERE adjudicado = true;
CREATE INDEX IF NOT EXISTS idx_cuotas_ahorrista ON cuotas_ahorro(ahorrista_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_estado ON cuotas_ahorro(estado);
CREATE INDEX IF NOT EXISTS idx_cuotas_vencimiento ON cuotas_ahorro(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_gestiones_mora_ahorrista ON gestiones_mora(ahorrista_id);

-- =====================
-- Triggers
-- =====================
CREATE OR REPLACE TRIGGER update_grupos_ahorro_updated_at
  BEFORE UPDATE ON grupos_ahorro
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_ahorristas_updated_at
  BEFORE UPDATE ON ahorristas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_cuotas_ahorro_updated_at
  BEFORE UPDATE ON cuotas_ahorro
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================
-- RLS
-- =====================
ALTER TABLE grupos_ahorro ENABLE ROW LEVEL SECURITY;
ALTER TABLE ahorristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas_ahorro ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestiones_mora ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grupos_ahorro_select" ON grupos_ahorro FOR SELECT TO authenticated USING (true);
CREATE POLICY "ahorristas_select" ON ahorristas FOR SELECT TO authenticated USING (true);
CREATE POLICY "cuotas_ahorro_select" ON cuotas_ahorro FOR SELECT TO authenticated USING (true);
CREATE POLICY "gestiones_mora_select" ON gestiones_mora FOR SELECT TO authenticated USING (true);

CREATE POLICY "grupos_ahorro_modify" ON grupos_ahorro FOR ALL TO authenticated
  USING (get_user_role() IN ('director','gestor','asesor_ush','asesor_rg'))
  WITH CHECK (get_user_role() IN ('director','gestor','asesor_ush','asesor_rg'));

CREATE POLICY "ahorristas_modify" ON ahorristas FOR ALL TO authenticated
  USING (get_user_role() IN ('director','gestor','asesor_ush','asesor_rg'))
  WITH CHECK (get_user_role() IN ('director','gestor','asesor_ush','asesor_rg'));

CREATE POLICY "cuotas_ahorro_modify" ON cuotas_ahorro FOR ALL TO authenticated
  USING (get_user_role() IN ('director','gestor','asesor_ush','asesor_rg'))
  WITH CHECK (get_user_role() IN ('director','gestor','asesor_ush','asesor_rg'));

CREATE POLICY "gestiones_mora_modify" ON gestiones_mora FOR ALL TO authenticated
  USING (get_user_role() IN ('director','gestor','asesor_ush','asesor_rg'))
  WITH CHECK (get_user_role() IN ('director','gestor','asesor_ush','asesor_rg'));

-- Publicar a realtime
ALTER PUBLICATION supabase_realtime ADD TABLE grupos_ahorro;
ALTER PUBLICATION supabase_realtime ADD TABLE ahorristas;
ALTER PUBLICATION supabase_realtime ADD TABLE cuotas_ahorro;
