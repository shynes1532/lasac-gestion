-- =====================================================
-- 013_stock_movimientos_reservas.sql
-- Stock por sucursal + reservas + transferencias entre sucursales.
-- Migra repuestos.stock_actual → stock_sucursal (multi-sucursal),
-- y mantiene repuestos.stock_actual sincronizada por trigger
-- como denormalización legacy (suma de stock_sucursal por producto).
-- =====================================================

-- ----------------------------------------------------------------
-- 1. stock_sucursal — stock físico por (producto, sucursal)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_sucursal (
  producto_id  UUID NOT NULL REFERENCES public.repuestos(id) ON DELETE CASCADE,
  sucursal     TEXT NOT NULL CHECK (sucursal IN ('Ushuaia','Rio Grande','Deposito Central')),
  stock_fisico INTEGER NOT NULL DEFAULT 0 CHECK (stock_fisico >= 0),
  ubicacion    TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (producto_id, sucursal)
);

CREATE OR REPLACE TRIGGER trg_updated_at_stock_sucursal
  BEFORE UPDATE ON public.stock_sucursal
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_stock_sucursal_sucursal
  ON public.stock_sucursal(sucursal);


-- ----------------------------------------------------------------
-- 2. reservas_stock — reservas activas por orden de venta
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservas_stock (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id    UUID NOT NULL REFERENCES public.repuestos(id) ON DELETE CASCADE,
  sucursal       TEXT NOT NULL CHECK (sucursal IN ('Ushuaia','Rio Grande','Deposito Central')),
  cantidad       INTEGER NOT NULL CHECK (cantidad > 0),
  cliente_id     UUID REFERENCES public.clientes(id),
  orden_venta_id UUID,
  estado         TEXT NOT NULL DEFAULT 'activa'
                 CHECK (estado IN ('activa','consumida','cancelada','vencida')),
  vence_en       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES public.usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_reservas_producto_sucursal_activa
  ON public.reservas_stock(producto_id, sucursal)
  WHERE estado = 'activa';

CREATE INDEX IF NOT EXISTS idx_reservas_vence_en
  ON public.reservas_stock(vence_en)
  WHERE estado = 'activa' AND vence_en IS NOT NULL;


-- ----------------------------------------------------------------
-- 3. transferencias_stock — entre sucursales LASAC
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transferencias_stock (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id      UUID NOT NULL REFERENCES public.repuestos(id) ON DELETE CASCADE,
  sucursal_origen  TEXT NOT NULL CHECK (sucursal_origen IN ('Ushuaia','Rio Grande','Deposito Central')),
  sucursal_destino TEXT NOT NULL CHECK (sucursal_destino IN ('Ushuaia','Rio Grande','Deposito Central')),
  cantidad         INTEGER NOT NULL CHECK (cantidad > 0),
  estado           TEXT NOT NULL DEFAULT 'en_transito'
                   CHECK (estado IN ('solicitada','en_transito','recibida','cancelada')),
  fecha_envio      TIMESTAMPTZ,
  fecha_recepcion  TIMESTAMPTZ,
  observacion      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES public.usuarios(id),
  CHECK (sucursal_origen <> sucursal_destino)
);

CREATE INDEX IF NOT EXISTS idx_transferencias_producto_origen_pending
  ON public.transferencias_stock(producto_id, sucursal_origen)
  WHERE estado IN ('solicitada','en_transito');

CREATE INDEX IF NOT EXISTS idx_transferencias_producto_destino_pending
  ON public.transferencias_stock(producto_id, sucursal_destino)
  WHERE estado IN ('solicitada','en_transito');


-- ----------------------------------------------------------------
-- 4. Migración de stock legacy:
--    poblar stock_sucursal con (producto_id, repuestos.sucursal, repuestos.stock_actual)
--    para los repuestos preexistentes.
-- ----------------------------------------------------------------
INSERT INTO public.stock_sucursal (producto_id, sucursal, stock_fisico, ubicacion)
SELECT r.id, r.sucursal, COALESCE(r.stock_actual, 0), r.ubicacion
FROM public.repuestos r
WHERE r.sucursal IN ('Ushuaia','Rio Grande')
ON CONFLICT (producto_id, sucursal) DO NOTHING;


-- ----------------------------------------------------------------
-- 5. Sync de stock_actual legacy (denormalización)
--    Trigger que recalcula repuestos.stock_actual = SUM(stock_sucursal.stock_fisico)
--    cada vez que cambia stock_sucursal. Permite que el frontend
--    actual siga viendo un total agregado en repuestos.stock_actual
--    sin tener que refactorizar useRepuestos.ts ya.
-- ----------------------------------------------------------------
COMMENT ON COLUMN public.repuestos.stock_actual IS
  'DEPRECADO. Mantener solo lectura. Es denormalización auto-sincronizada por trigger desde stock_sucursal. Para escrituras usar movimientos sobre stock_sucursal.';

CREATE OR REPLACE FUNCTION public.trg_sync_stock_actual()
RETURNS TRIGGER AS $$
DECLARE
  v_producto_id UUID;
  v_total       INTEGER;
BEGIN
  v_producto_id := COALESCE(NEW.producto_id, OLD.producto_id);

  SELECT COALESCE(SUM(stock_fisico), 0) INTO v_total
  FROM public.stock_sucursal
  WHERE producto_id = v_producto_id;

  UPDATE public.repuestos
  SET stock_actual = v_total
  WHERE id = v_producto_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_stock_actual ON public.stock_sucursal;
CREATE TRIGGER sync_stock_actual
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_sucursal
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_stock_actual();


-- ----------------------------------------------------------------
-- 6. RLS
-- ----------------------------------------------------------------
ALTER TABLE public.stock_sucursal       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas_stock       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencias_stock ENABLE ROW LEVEL SECURITY;

-- stock_sucursal: lectura todos, escritura director + gestor
DROP POLICY IF EXISTS stock_sucursal_select ON public.stock_sucursal;
CREATE POLICY stock_sucursal_select ON public.stock_sucursal
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS stock_sucursal_write_dir_gestor ON public.stock_sucursal;
CREATE POLICY stock_sucursal_write_dir_gestor ON public.stock_sucursal
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol IN ('director','gestor') AND activo = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol IN ('director','gestor') AND activo = true
  ));

-- reservas_stock: lectura todos, INSERT y UPDATE director + gestor
DROP POLICY IF EXISTS reservas_select ON public.reservas_stock;
CREATE POLICY reservas_select ON public.reservas_stock
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS reservas_write_dir_gestor ON public.reservas_stock;
CREATE POLICY reservas_write_dir_gestor ON public.reservas_stock
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol IN ('director','gestor') AND activo = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol IN ('director','gestor') AND activo = true
  ));

-- transferencias_stock: lectura todos, escritura director + gestor
DROP POLICY IF EXISTS transferencias_select ON public.transferencias_stock;
CREATE POLICY transferencias_select ON public.transferencias_stock
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS transferencias_write_dir_gestor ON public.transferencias_stock;
CREATE POLICY transferencias_write_dir_gestor ON public.transferencias_stock
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
-- SELECT producto_id, sucursal, stock_fisico FROM public.stock_sucursal LIMIT 20;
-- SELECT id, codigo_fiat, sucursal, stock_actual FROM public.repuestos LIMIT 20;
