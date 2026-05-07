-- =====================================================
-- 012_repuestos_clientes_pricing.sql
-- Extiende public.repuestos con campos de pricing.
-- Crea public.clientes (B2B/B2C) con condicion fiscal y tier.
-- Trigger de auditoría que escribe en historico_precios.
-- =====================================================

-- ----------------------------------------------------------------
-- 1. Extender public.repuestos con campos de pricing
--    (la tabla repuestos ya existe desde 008_repuestos.sql)
-- ----------------------------------------------------------------
ALTER TABLE public.repuestos
  ADD COLUMN IF NOT EXISTS precio_lista              NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS descuento_fabricante      NUMERIC(5,2) DEFAULT 0
    CHECK (descuento_fabricante BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS moneda                    TEXT DEFAULT 'ARS'
    CHECK (moneda IN ('ARS','USD')),
  ADD COLUMN IF NOT EXISTS vigencia_desde            DATE,
  ADD COLUMN IF NOT EXISTS vigencia_hasta            DATE,
  ADD COLUMN IF NOT EXISTS familia_fiscal            TEXT DEFAULT 'gravado_normal'
    CHECK (familia_fiscal IN ('gravado_normal','exento_19640','no_gravado')),
  ADD COLUMN IF NOT EXISTS precio_minimo_autorizado  NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS marca                     TEXT,
  ADD COLUMN IF NOT EXISTS discontinuado             BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_repuestos_vigencia
  ON public.repuestos(vigencia_desde, vigencia_hasta);

CREATE INDEX IF NOT EXISTS idx_repuestos_marca
  ON public.repuestos(marca);

CREATE INDEX IF NOT EXISTS idx_repuestos_discontinuado
  ON public.repuestos(discontinuado) WHERE discontinuado = false;

COMMENT ON COLUMN public.repuestos.precio_lista IS
  'Precio de lista FIAT/Mopar previo a descuento de fabricante. Moneda según columna moneda.';
COMMENT ON COLUMN public.repuestos.familia_fiscal IS
  'Determina IVA en combinación con cliente.condicion_iva y cliente.provincia.';
COMMENT ON COLUMN public.repuestos.precio_minimo_autorizado IS
  'Piso por debajo del cual la venta requiere aprobación director (warning desde calcular_precio_venta).';


-- ----------------------------------------------------------------
-- 2. Tabla public.clientes (B2B/B2C de repuestos)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  cuit          TEXT UNIQUE,
  condicion_iva TEXT NOT NULL DEFAULT 'CF'
                CHECK (condicion_iva IN ('CF','RI','MT','EX','RNI')),
  provincia     TEXT NOT NULL DEFAULT 'TDF',
  tier_id       UUID REFERENCES public.pricing_tiers(id),
  telefono      TEXT,
  email         TEXT,
  direccion     TEXT,
  observaciones TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES public.usuarios(id)
);

CREATE OR REPLACE TRIGGER trg_updated_at_clientes
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON public.clientes (lower(nombre));
CREATE INDEX IF NOT EXISTS idx_clientes_cuit   ON public.clientes (cuit);
CREATE INDEX IF NOT EXISTS idx_clientes_tier   ON public.clientes (tier_id);
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON public.clientes (activo) WHERE activo = true;

-- Asignar tier 'publico' como default a clientes que se carguen sin tier_id.
-- (No hay datos preexistentes, pero queda para inserts manuales sin tier).
CREATE OR REPLACE FUNCTION public.trg_clientes_default_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tier_id IS NULL THEN
    SELECT id INTO NEW.tier_id
    FROM public.pricing_tiers
    WHERE nombre = 'publico' AND activo = true
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clientes_default_tier ON public.clientes;
CREATE TRIGGER clientes_default_tier
  BEFORE INSERT ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.trg_clientes_default_tier();


-- ----------------------------------------------------------------
-- 3. Trigger de auditoría sobre repuestos.precio_*
--    Escribe en historico_precios cuando cambian precio_lista,
--    descuento_fabricante o moneda. SECURITY DEFINER para
--    poder insertar aunque la RLS de historico_precios no
--    permita inserts desde cliente.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_audit_precios_repuestos()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.precio_lista          IS DISTINCT FROM OLD.precio_lista)
     OR (NEW.descuento_fabricante IS DISTINCT FROM OLD.descuento_fabricante)
     OR (NEW.moneda               IS DISTINCT FROM OLD.moneda) THEN
    INSERT INTO public.historico_precios (
      producto_id,
      precio_lista_anterior, precio_lista_nuevo,
      descuento_anterior,    descuento_nuevo,
      moneda_anterior,       moneda_nueva,
      motivo, cambiado_por
    ) VALUES (
      NEW.id,
      OLD.precio_lista,         NEW.precio_lista,
      OLD.descuento_fabricante, NEW.descuento_fabricante,
      OLD.moneda,               NEW.moneda,
      'update', auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_precios_repuestos ON public.repuestos;
CREATE TRIGGER audit_precios_repuestos
  BEFORE UPDATE ON public.repuestos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_audit_precios_repuestos();


-- ----------------------------------------------------------------
-- 4. RLS sobre clientes
--    - Lectura: cualquier usuario autenticado
--    - Escritura: director y gestor
-- ----------------------------------------------------------------
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clientes_select ON public.clientes;
CREATE POLICY clientes_select ON public.clientes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS clientes_write_dir_gestor ON public.clientes;
CREATE POLICY clientes_write_dir_gestor ON public.clientes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol IN ('director','gestor') AND activo = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol IN ('director','gestor') AND activo = true
  ));


-- ----------------------------------------------------------------
-- Verificación
-- ----------------------------------------------------------------
-- \d public.repuestos
-- \d public.clientes
-- SELECT trigger_name FROM information_schema.triggers
--  WHERE event_object_table IN ('repuestos','clientes');
