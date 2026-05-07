-- =====================================================
-- 011_pricing_engine_tables.sql
-- Motor de precios LASAC Repuestos:
--   pricing_tiers, cotizacion_diaria, settings, historico_precios
--
-- Adaptado al stack del repo:
--   - Roles desde public.usuarios.rol (no profiles.role)
--   - Sucursales con la convención del repo: 'Ushuaia', 'Rio Grande'
--   - Numeración 011 (las 001..009 ya existen, 010 es setup_silvana)
-- =====================================================

-- ----------------------------------------------------------------
-- Tabla: pricing_tiers (tiers B2B / B2C)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_tiers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL UNIQUE
                CHECK (nombre IN ('repuestero','taller','flota','publico','interno')),
  factor_markup NUMERIC(5,4) NOT NULL CHECK (factor_markup BETWEEN 1.0000 AND 2.0000),
  descripcion   TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_updated_at_pricing_tiers
  BEFORE UPDATE ON public.pricing_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO public.pricing_tiers (nombre, factor_markup, descripcion) VALUES
  ('repuestero', 1.0500, 'Casa de repuestos — markup mínimo, alto volumen'),
  ('taller',     1.1000, 'Taller mecánico independiente'),
  ('flota',      1.0800, 'Empresa con flota propia, condiciones especiales'),
  ('publico',    1.2000, 'Consumidor final mostrador'),
  ('interno',    1.0000, 'Uso interno LASAC — sin markup')
ON CONFLICT (nombre) DO NOTHING;


-- ----------------------------------------------------------------
-- Tabla: cotizacion_diaria (multi-fuente)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cotizacion_diaria (
  fecha       DATE NOT NULL,
  fuente      TEXT NOT NULL
              CHECK (fuente IN ('bna_vendedor','bna_divisa','mep','oficial_fiat','manual')),
  valor       NUMERIC(12,4) NOT NULL CHECK (valor > 0),
  cargado_por UUID REFERENCES public.usuarios(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (fecha, fuente)
);

CREATE INDEX IF NOT EXISTS idx_cotizacion_fuente_fecha
  ON public.cotizacion_diaria(fuente, fecha DESC);


-- ----------------------------------------------------------------
-- Tabla: settings (clave/valor JSON, parámetros globales)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
  clave       TEXT PRIMARY KEY,
  valor       JSONB NOT NULL,
  descripcion TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES public.usuarios(id)
);

CREATE OR REPLACE TRIGGER trg_updated_at_settings
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO public.settings (clave, valor, descripcion) VALUES
  ('flete_logistico_porcentaje',
   '{"Ushuaia": 0.00, "Rio Grande": 0.00, "Deposito Central": 0.00}'::jsonb,
   'Recargo logístico por sucursal (decimal 0..1, ej 0.05 = 5%). Editable.'),
  ('cotizacion_default_fuente',
   '"bna_vendedor"'::jsonb,
   'Fuente de cotización USD a usar por defecto en calcular_precio_venta'),
  ('stock_descuenta_reservas',
   'true'::jsonb,
   'Si true, calcular_stock_disponible descuenta reservas activas'),
  ('stock_descuenta_transito',
   'true'::jsonb,
   'Si true, calcular_stock_disponible considera transferencias en tránsito como NO disponibles en origen')
ON CONFLICT (clave) DO NOTHING;


-- ----------------------------------------------------------------
-- Tabla: historico_precios (auditoría de cambios de precio en repuestos)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.historico_precios (
  id                       BIGSERIAL PRIMARY KEY,
  producto_id              UUID NOT NULL,                 -- repuestos.id (FK soft, sin ON DELETE para preservar auditoría)
  precio_lista_anterior    NUMERIC(14,2),
  precio_lista_nuevo       NUMERIC(14,2),
  descuento_anterior       NUMERIC(5,2),
  descuento_nuevo          NUMERIC(5,2),
  moneda_anterior          TEXT,
  moneda_nueva             TEXT,
  motivo                   TEXT,
  cambiado_por             UUID REFERENCES public.usuarios(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historico_precios_producto
  ON public.historico_precios(producto_id, created_at DESC);


-- ----------------------------------------------------------------
-- RLS
-- Política de roles del repo:
--   - director       → todo permitido en pricing
--   - gestor         → puede gestionar cotización (insert/update),
--                      NO puede tocar tiers ni settings globales
--   - resto          → solo lectura
-- ----------------------------------------------------------------

ALTER TABLE public.pricing_tiers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_precios ENABLE ROW LEVEL SECURITY;

-- pricing_tiers: lectura todos, escritura solo director
DROP POLICY IF EXISTS pricing_tiers_select ON public.pricing_tiers;
CREATE POLICY pricing_tiers_select ON public.pricing_tiers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS pricing_tiers_write_director ON public.pricing_tiers;
CREATE POLICY pricing_tiers_write_director ON public.pricing_tiers
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol = 'director' AND activo = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol = 'director' AND activo = true
  ));

-- cotizacion_diaria: lectura todos, escritura director + gestor
DROP POLICY IF EXISTS cotizacion_select ON public.cotizacion_diaria;
CREATE POLICY cotizacion_select ON public.cotizacion_diaria
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cotizacion_write_dir_gestor ON public.cotizacion_diaria;
CREATE POLICY cotizacion_write_dir_gestor ON public.cotizacion_diaria
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol IN ('director','gestor') AND activo = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol IN ('director','gestor') AND activo = true
  ));

-- settings: lectura todos, escritura solo director
DROP POLICY IF EXISTS settings_select ON public.settings;
CREATE POLICY settings_select ON public.settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS settings_write_director ON public.settings;
CREATE POLICY settings_write_director ON public.settings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol = 'director' AND activo = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol = 'director' AND activo = true
  ));

-- historico_precios: solo lectura desde cliente. INSERTs vienen del trigger (SECURITY DEFINER).
DROP POLICY IF EXISTS historico_precios_select ON public.historico_precios;
CREATE POLICY historico_precios_select ON public.historico_precios
  FOR SELECT TO authenticated USING (true);


-- ----------------------------------------------------------------
-- Verificación
-- ----------------------------------------------------------------
-- SELECT * FROM public.pricing_tiers ORDER BY factor_markup;
-- SELECT * FROM public.settings;
