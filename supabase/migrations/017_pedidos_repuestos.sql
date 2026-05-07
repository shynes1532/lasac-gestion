-- =====================================================
-- 017_pedidos_repuestos.sql
-- Pedidos de repuestos al cliente (venta), con multi-flags de espera.
--
-- Modelo:
--   pedidos_repuestos       — cabecera (cliente, sucursal, flags, recibo, FK garantia/siniestro)
--   pedidos_repuestos_items — líneas (uno o varios repuestos, cantidades, recepción y entrega por item)
--
-- Flags (booleans) — pueden ser true en paralelo:
--   esperando_repuesto   → todavía no llegó del proveedor
--   esperando_garantia   → caso de garantía abierto con terminal
--   esperando_siniestro  → caso de siniestro abierto con aseguradora
--   esperando_cliente    → ya está listo, falta que el cliente venga a retirar
--   recibo_emitido       → cliente ya pagó / tiene recibo en mano
--
-- Estados terminales:
--   entregado_at NOT NULL → entregado (ya no aparece en "en espera")
--   cancelado = true       → cancelado
-- =====================================================

-- ----------------------------------------------------------------
-- 1. Tabla cabecera
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pedidos_repuestos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido       TEXT NOT NULL,                              -- generado por trigger: PED-USH-001 / PED-RG-001
  sucursal            TEXT NOT NULL CHECK (sucursal IN ('Ushuaia','Rio Grande','Deposito Central')),
  cliente_id          UUID REFERENCES public.clientes(id),

  -- Links a expedientes existentes (FK soft, ON DELETE SET NULL para no romper si borran el expediente).
  garantia_id         UUID REFERENCES public.garantias_expedientes(id) ON DELETE SET NULL,
  siniestro_id        UUID REFERENCES public.siniestros_expedientes(id) ON DELETE SET NULL,

  -- Pago / recibo
  numero_recibo       TEXT,
  monto_pagado        NUMERIC(14,2),

  -- Flags de espera (multi-flag, paralelos)
  esperando_repuesto  BOOLEAN NOT NULL DEFAULT false,
  esperando_garantia  BOOLEAN NOT NULL DEFAULT false,
  esperando_siniestro BOOLEAN NOT NULL DEFAULT false,
  esperando_cliente   BOOLEAN NOT NULL DEFAULT false,
  recibo_emitido      BOOLEAN NOT NULL DEFAULT false,

  -- Cierre / cancelación
  entregado_at        TIMESTAMPTZ,
  entregado_por       UUID REFERENCES public.usuarios(id),
  cancelado           BOOLEAN NOT NULL DEFAULT false,
  motivo_cancelacion  TEXT,

  observaciones       TEXT,

  -- Auditoría
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID REFERENCES public.usuarios(id),

  CONSTRAINT pedidos_repuestos_numero_unique UNIQUE (numero_pedido),
  -- Si tiene flag esperando_garantia, debería tener garantia_id (warning, no constraint dura).
  CHECK (NOT cancelado OR motivo_cancelacion IS NOT NULL)
);

CREATE OR REPLACE TRIGGER trg_updated_at_pedidos_repuestos
  BEFORE UPDATE ON public.pedidos_repuestos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_pedidos_repuestos_sucursal
  ON public.pedidos_repuestos(sucursal);
CREATE INDEX IF NOT EXISTS idx_pedidos_repuestos_cliente
  ON public.pedidos_repuestos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_repuestos_garantia
  ON public.pedidos_repuestos(garantia_id) WHERE garantia_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_repuestos_siniestro
  ON public.pedidos_repuestos(siniestro_id) WHERE siniestro_id IS NOT NULL;

-- Pedidos abiertos (no entregados, no cancelados) — la lista principal del front
CREATE INDEX IF NOT EXISTS idx_pedidos_repuestos_abiertos
  ON public.pedidos_repuestos(sucursal, created_at DESC)
  WHERE entregado_at IS NULL AND cancelado = false;


-- ----------------------------------------------------------------
-- 2. Tabla de items
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pedidos_repuestos_items (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id                UUID NOT NULL REFERENCES public.pedidos_repuestos(id) ON DELETE CASCADE,
  producto_id              UUID NOT NULL REFERENCES public.repuestos(id),
  cantidad                 INTEGER NOT NULL CHECK (cantidad > 0),

  -- Snapshot del precio al momento de cargar el pedido (opcional, informativo).
  precio_unitario_snapshot NUMERIC(14,2),

  -- Recepción (cuando llegó del proveedor)
  recibido                 BOOLEAN NOT NULL DEFAULT false,
  recibido_at              TIMESTAMPTZ,

  -- Reserva de stock (link a reservas_stock cuando se reserva)
  reserva_id               UUID REFERENCES public.reservas_stock(id) ON DELETE SET NULL,

  -- Entrega física (cuando se le da al cliente)
  entregado                BOOLEAN NOT NULL DEFAULT false,
  entregado_at             TIMESTAMPTZ,

  observacion              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pri_pedido          ON public.pedidos_repuestos_items(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pri_producto        ON public.pedidos_repuestos_items(producto_id);
CREATE INDEX IF NOT EXISTS idx_pri_no_recibido     ON public.pedidos_repuestos_items(pedido_id) WHERE recibido = false;
CREATE INDEX IF NOT EXISTS idx_pri_no_entregado    ON public.pedidos_repuestos_items(pedido_id) WHERE entregado = false;


-- ----------------------------------------------------------------
-- 3. Trigger: auto-generar numero_pedido tipo PED-USH-001 / PED-RG-001
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_pedidos_repuestos_numero()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix TEXT;
  v_count  INTEGER;
BEGIN
  IF NEW.numero_pedido IS NOT NULL AND NEW.numero_pedido <> '' THEN
    RETURN NEW;
  END IF;

  v_prefix := CASE NEW.sucursal
    WHEN 'Ushuaia'          THEN 'PED-USH'
    WHEN 'Rio Grande'       THEN 'PED-RG'
    WHEN 'Deposito Central' THEN 'PED-DC'
    ELSE                         'PED'
  END;

  -- Contamos los pedidos existentes de esa sucursal para asignar el siguiente número
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.pedidos_repuestos
  WHERE sucursal = NEW.sucursal;

  NEW.numero_pedido := v_prefix || '-' || lpad(v_count::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pedidos_repuestos_numero ON public.pedidos_repuestos;
CREATE TRIGGER pedidos_repuestos_numero
  BEFORE INSERT ON public.pedidos_repuestos
  FOR EACH ROW EXECUTE FUNCTION public.trg_pedidos_repuestos_numero();


-- ----------------------------------------------------------------
-- 4. Helper SQL: marcar pedido como entregado (descuenta stock + cierra)
--    Hace en una sola transacción: recorrer items, descontar de stock_sucursal,
--    consumir reservas asociadas, marcar items y cabecera como entregados.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.entregar_pedido_repuestos(
  p_pedido_id UUID,
  p_usuario_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_pedido RECORD;
  v_item   RECORD;
  v_stock  INTEGER;
  v_total_descontado INTEGER := 0;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos_repuestos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % no existe', p_pedido_id USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.entregado_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pedido % ya está entregado', p_pedido_id USING ERRCODE = 'P0001';
  END IF;
  IF v_pedido.cancelado THEN
    RAISE EXCEPTION 'Pedido % está cancelado', p_pedido_id USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN
    SELECT * FROM public.pedidos_repuestos_items
    WHERE pedido_id = p_pedido_id AND entregado = false
  LOOP
    -- Verificar stock disponible en la sucursal del pedido
    SELECT stock_fisico INTO v_stock
    FROM public.stock_sucursal
    WHERE producto_id = v_item.producto_id AND sucursal = v_pedido.sucursal
    FOR UPDATE;

    IF v_stock IS NULL OR v_stock < v_item.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente en % para producto % (necesita %, hay %)',
        v_pedido.sucursal, v_item.producto_id, v_item.cantidad, COALESCE(v_stock, 0)
        USING ERRCODE = 'P0001';
    END IF;

    -- Descontar stock
    UPDATE public.stock_sucursal
    SET stock_fisico = stock_fisico - v_item.cantidad,
        updated_at = now()
    WHERE producto_id = v_item.producto_id AND sucursal = v_pedido.sucursal;

    -- Consumir reserva si la hay
    IF v_item.reserva_id IS NOT NULL THEN
      UPDATE public.reservas_stock
      SET estado = 'consumida'
      WHERE id = v_item.reserva_id AND estado = 'activa';
    END IF;

    -- Marcar item entregado
    UPDATE public.pedidos_repuestos_items
    SET entregado = true,
        entregado_at = now()
    WHERE id = v_item.id;

    v_total_descontado := v_total_descontado + v_item.cantidad;
  END LOOP;

  -- Cerrar cabecera
  UPDATE public.pedidos_repuestos
  SET entregado_at      = now(),
      entregado_por     = p_usuario_id,
      esperando_repuesto = false,
      esperando_cliente  = false,
      esperando_garantia = false,
      esperando_siniestro = false
  WHERE id = p_pedido_id;

  RETURN jsonb_build_object(
    'pedido_id',          p_pedido_id,
    'unidades_descontadas', v_total_descontado,
    'sucursal',           v_pedido.sucursal,
    'entregado_at',       now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.entregar_pedido_repuestos(UUID, UUID) TO authenticated;


-- ----------------------------------------------------------------
-- 5. RLS
--    Lectura: todos los autenticados.
--    Escritura: director + gestor (igual que el resto del módulo).
-- ----------------------------------------------------------------
ALTER TABLE public.pedidos_repuestos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_repuestos_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedidos_select ON public.pedidos_repuestos;
CREATE POLICY pedidos_select ON public.pedidos_repuestos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS pedidos_write_dir_gestor ON public.pedidos_repuestos;
CREATE POLICY pedidos_write_dir_gestor ON public.pedidos_repuestos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol IN ('director','gestor') AND activo = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol IN ('director','gestor') AND activo = true
  ));

DROP POLICY IF EXISTS pri_select ON public.pedidos_repuestos_items;
CREATE POLICY pri_select ON public.pedidos_repuestos_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS pri_write_dir_gestor ON public.pedidos_repuestos_items;
CREATE POLICY pri_write_dir_gestor ON public.pedidos_repuestos_items
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
-- SELECT * FROM public.pedidos_repuestos LIMIT 1;
-- SELECT * FROM public.pedidos_repuestos_items LIMIT 1;
-- SELECT proname FROM pg_proc WHERE proname = 'entregar_pedido_repuestos';
