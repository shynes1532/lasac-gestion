-- ============================================================
-- Módulo Repuestos — Stock con scanner de código de barras
-- ============================================================

-- Tabla principal de repuestos (catálogo)
CREATE TABLE IF NOT EXISTS public.repuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_fiat TEXT NOT NULL UNIQUE,        -- Código FIAT escaneado del código de barras
  descripcion TEXT NOT NULL,
  ubicacion TEXT,                           -- Ej: Estante A3, Depósito, etc.
  stock_actual INTEGER NOT NULL DEFAULT 0,
  stock_minimo INTEGER NOT NULL DEFAULT 0,  -- Alerta si baja de acá
  precio_costo NUMERIC(12,2),
  precio_venta NUMERIC(12,2),
  sucursal TEXT NOT NULL CHECK (sucursal IN ('Ushuaia', 'Rio Grande')),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Movimientos (ingreso/egreso)
CREATE TABLE IF NOT EXISTS public.repuestos_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repuesto_id UUID NOT NULL REFERENCES public.repuestos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  motivo TEXT,                             -- Ej: "Compra proveedor", "Venta mostrador", "Uso taller OT-123"
  operacion_id UUID REFERENCES public.operaciones(id),  -- Si el egreso está vinculado a una operación
  stock_anterior INTEGER NOT NULL,
  stock_posterior INTEGER NOT NULL,
  realizado_por UUID REFERENCES public.usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger updated_at
CREATE TRIGGER set_repuestos_updated_at
  BEFORE UPDATE ON public.repuestos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_repuestos_codigo ON public.repuestos(codigo_fiat);
CREATE INDEX idx_repuestos_sucursal ON public.repuestos(sucursal);
CREATE INDEX idx_repuestos_stock_bajo ON public.repuestos(stock_actual) WHERE stock_actual <= stock_minimo;
CREATE INDEX idx_movimientos_repuesto ON public.repuestos_movimientos(repuesto_id, created_at DESC);
CREATE INDEX idx_movimientos_fecha ON public.repuestos_movimientos(created_at DESC);

-- RLS
ALTER TABLE public.repuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repuestos_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY repuestos_select ON public.repuestos FOR SELECT USING (true);
CREATE POLICY repuestos_insert ON public.repuestos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY repuestos_update ON public.repuestos FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY repuestos_delete ON public.repuestos FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY movimientos_select ON public.repuestos_movimientos FOR SELECT USING (true);
CREATE POLICY movimientos_insert ON public.repuestos_movimientos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
