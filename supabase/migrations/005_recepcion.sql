-- ============================================================
-- Módulo Recepción — Control de ingreso de clientes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recepciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  area TEXT NOT NULL CHECK (area IN ('posventa', 'administracion', 'ventas')),
  subarea TEXT NOT NULL CHECK (subarea IN ('repuestos', 'taller', 'siniestro', 'plan', 'convencional', '0km')),
  notas TEXT,
  estado TEXT NOT NULL DEFAULT 'en_espera' CHECK (estado IN ('en_espera', 'atendido', 'contactado')),
  atendido_por UUID REFERENCES public.usuarios(id),
  contactado_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.usuarios(id),
  sucursal TEXT NOT NULL CHECK (sucursal IN ('Ushuaia', 'Rio Grande')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger updated_at
CREATE TRIGGER set_recepciones_updated_at
  BEFORE UPDATE ON public.recepciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_recepciones_fecha ON public.recepciones(created_at DESC);
CREATE INDEX idx_recepciones_estado ON public.recepciones(estado);
CREATE INDEX idx_recepciones_area ON public.recepciones(area);
CREATE INDEX idx_recepciones_sucursal ON public.recepciones(sucursal);

-- RLS
ALTER TABLE public.recepciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY recepciones_select ON public.recepciones
  FOR SELECT USING (true);

CREATE POLICY recepciones_insert ON public.recepciones
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY recepciones_update ON public.recepciones
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.recepciones;
