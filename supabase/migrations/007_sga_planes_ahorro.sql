-- ============================================================
-- SGA: Sistema de Gestion de Ahorro
-- Tablas para grupos, cuotas, ahorristas y mora
-- ============================================================

-- =====================
-- Grupos de ahorro
-- =====================
CREATE TABLE IF NOT EXISTS grupos_ahorro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_grupo TEXT NOT NULL UNIQUE,          -- ej: "G-1234"
  modelo TEXT NOT NULL,                        -- modelo del vehiculo
  valor_movil NUMERIC(12,2) NOT NULL DEFAULT 0,
  cantidad_integrantes INTEGER NOT NULL DEFAULT 0,
  cantidad_cuotas INTEGER NOT NULL DEFAULT 84, -- tipicamente 84 cuotas
  cuotas_pagas INTEGER NOT NULL DEFAULT 0,
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
-- Ahorristas (suscriptores de plan de ahorro)
-- =====================
CREATE TABLE IF NOT EXISTS ahorristas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID REFERENCES grupos_ahorro(id) ON DELETE SET NULL,
  operacion_id UUID REFERENCES operaciones(id) ON DELETE SET NULL,
  nombre_apellido TEXT NOT NULL,
  dni_cuil TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  numero_orden INTEGER,                        -- nro de orden dentro del grupo
  fecha_suscripcion DATE,
  estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo','adjudicado','renunciado','rescindido','transferido')),
  adjudicado BOOLEAN NOT NULL DEFAULT false,
  fecha_adjudicacion DATE,
  tipo_adjudicacion TEXT                       -- 'sorteo','licitacion','acto_especial'
    CHECK (tipo_adjudicacion IS NULL OR tipo_adjudicacion IN ('sorteo','licitacion','acto_especial')),
  monto_licitacion NUMERIC(12,2),
  vehiculo_retirado BOOLEAN NOT NULL DEFAULT false,
  fecha_retiro DATE,
  sucursal TEXT NOT NULL DEFAULT 'Ushuaia'
    CHECK (sucursal IN ('Ushuaia','Rio Grande')),
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
  grupo_id UUID NOT NULL REFERENCES grupos_ahorro(id) ON DELETE CASCADE,
  numero_cuota INTEGER NOT NULL,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  fecha_vencimiento DATE NOT NULL,
  fecha_pago DATE,
  monto_pagado NUMERIC(12,2) DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','pagada','vencida','en_mora','bonificada')),
  dias_mora INTEGER NOT NULL DEFAULT 0,
  interes_mora NUMERIC(12,2) NOT NULL DEFAULT 0,
  comprobante TEXT,                            -- ref a comprobante de pago
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
CREATE INDEX IF NOT EXISTS idx_cuotas_ahorrista ON cuotas_ahorro(ahorrista_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_estado ON cuotas_ahorro(estado);
CREATE INDEX IF NOT EXISTS idx_cuotas_vencimiento ON cuotas_ahorro(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_gestiones_mora_ahorrista ON gestiones_mora(ahorrista_id);

-- =====================
-- Triggers updated_at
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

-- Todos los usuarios autenticados pueden leer
CREATE POLICY "grupos_ahorro_select" ON grupos_ahorro FOR SELECT TO authenticated USING (true);
CREATE POLICY "ahorristas_select" ON ahorristas FOR SELECT TO authenticated USING (true);
CREATE POLICY "cuotas_ahorro_select" ON cuotas_ahorro FOR SELECT TO authenticated USING (true);
CREATE POLICY "gestiones_mora_select" ON gestiones_mora FOR SELECT TO authenticated USING (true);

-- Insert/update/delete solo para director y gestor
CREATE POLICY "grupos_ahorro_modify" ON grupos_ahorro FOR ALL TO authenticated
  USING (get_user_role() IN ('director','gestor'))
  WITH CHECK (get_user_role() IN ('director','gestor'));

CREATE POLICY "ahorristas_modify" ON ahorristas FOR ALL TO authenticated
  USING (get_user_role() IN ('director','gestor'))
  WITH CHECK (get_user_role() IN ('director','gestor'));

CREATE POLICY "cuotas_ahorro_modify" ON cuotas_ahorro FOR ALL TO authenticated
  USING (get_user_role() IN ('director','gestor'))
  WITH CHECK (get_user_role() IN ('director','gestor'));

CREATE POLICY "gestiones_mora_modify" ON gestiones_mora FOR ALL TO authenticated
  USING (get_user_role() IN ('director','gestor'))
  WITH CHECK (get_user_role() IN ('director','gestor'));

-- Publicar a realtime
ALTER PUBLICATION supabase_realtime ADD TABLE grupos_ahorro;
ALTER PUBLICATION supabase_realtime ADD TABLE ahorristas;
ALTER PUBLICATION supabase_realtime ADD TABLE cuotas_ahorro;
