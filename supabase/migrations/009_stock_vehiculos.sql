-- ============================================================
-- Stock de Vehículos
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_vehiculos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vin         text NOT NULL,
  marca       text NOT NULL DEFAULT 'FIAT',
  modelo      text NOT NULL,
  version     text,
  color       text,
  anio        integer,
  tipo        text NOT NULL CHECK (tipo IN ('0km', 'plan_ahorro', 'usado')),
  estado      text NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'reservado', 'vendido', 'en_transito')),
  sucursal    text NOT NULL CHECK (sucursal IN ('Ushuaia', 'Rio Grande', 'Austral')),
  precio      numeric,
  kilometraje integer,
  -- Plan de ahorro
  grupo_orden   text,
  titular_plan  text,
  -- Usado
  patente     text,
  -- Link a operación
  operacion_id uuid REFERENCES operaciones(id),
  observaciones text,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_stock_vehiculos_sucursal ON stock_vehiculos(sucursal);
CREATE INDEX idx_stock_vehiculos_tipo ON stock_vehiculos(tipo);
CREATE INDEX idx_stock_vehiculos_estado ON stock_vehiculos(estado);
CREATE INDEX idx_stock_vehiculos_vin ON stock_vehiculos(vin);
CREATE UNIQUE INDEX idx_stock_vehiculos_vin_unique ON stock_vehiculos(vin) WHERE estado != 'vendido';

-- Transferencias entre sucursales
CREATE TABLE IF NOT EXISTS stock_transferencias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id        uuid NOT NULL REFERENCES stock_vehiculos(id),
  sucursal_origen text NOT NULL,
  sucursal_destino text NOT NULL,
  motivo          text,
  realizado_por   uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE stock_vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados ven stock" ON stock_vehiculos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados insertan stock" ON stock_vehiculos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados actualizan stock" ON stock_vehiculos
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados ven transferencias" ON stock_transferencias
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados insertan transferencias" ON stock_transferencias
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION fn_stock_vehiculos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_vehiculos_updated_at
  BEFORE UPDATE ON stock_vehiculos
  FOR EACH ROW EXECUTE FUNCTION fn_stock_vehiculos_updated_at();
