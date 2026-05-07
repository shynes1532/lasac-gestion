-- =====================================================
-- 014_pricing_stock_functions.sql
-- Funciones SQL del motor:
--   calcular_precio_venta(producto, cliente, sucursal, fecha) → jsonb
--   calcular_stock_disponible(producto, sucursal?)            → jsonb
-- =====================================================

-- ----------------------------------------------------------------
-- calcular_precio_venta
--
-- Pasos:
--   1. precio_neto = precio_lista * (1 - descuento_fabricante/100)
--   2. Si moneda=USD, convertir a ARS con cotización del día (fuente de settings)
--   3. Aplicar flete logístico por sucursal (sobre el costo, no sobre markup)
--   4. Aplicar markup según tier B2B del cliente
--   5. IVA según familia_fiscal × condicion_iva × provincia
--   6. Validar piso de precio_minimo_autorizado (warning, no bloqueo)
--
-- Devuelve un jsonb con todos los pasos visibles + warnings[].
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_precio_venta(
  p_producto_id UUID,
  p_cliente_id  UUID,
  p_sucursal    TEXT DEFAULT NULL,
  p_fecha       DATE DEFAULT CURRENT_DATE
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_prod         RECORD;
  v_cli          RECORD;
  v_tier         RECORD;
  v_cot_fuente   TEXT;
  v_cot_valor    NUMERIC;
  v_flete_cfg    JSONB;
  v_flete_pct    NUMERIC := 0;
  v_precio_neto  NUMERIC;
  v_precio_ars   NUMERIC;
  v_precio_costo NUMERIC;
  v_precio_markup NUMERIC;
  v_iva_rate     NUMERIC;
  v_precio_final NUMERIC;
  v_warnings     TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 0a. Cargar producto (de la tabla repuestos)
  SELECT * INTO v_prod FROM public.repuestos WHERE id = p_producto_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repuesto % no existe', p_producto_id USING ERRCODE = 'P0002';
  END IF;

  IF v_prod.precio_lista IS NULL THEN
    RAISE EXCEPTION 'El repuesto % no tiene precio_lista cargado', p_producto_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 0b. Cargar cliente
  SELECT * INTO v_cli FROM public.clientes WHERE id = p_cliente_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente % no existe', p_cliente_id USING ERRCODE = 'P0002';
  END IF;

  -- 0c. Cargar tier (con fallback a 'publico' si el cliente no tiene)
  SELECT * INTO v_tier
  FROM public.pricing_tiers
  WHERE id = v_cli.tier_id AND activo = true;
  IF NOT FOUND THEN
    SELECT * INTO v_tier FROM public.pricing_tiers WHERE nombre = 'publico' AND activo = true;
    v_warnings := array_append(v_warnings, 'Cliente sin tier asignado, se usó "publico"');
  END IF;

  -- 0d. Validaciones soft (warnings, no bloquean cálculo)
  IF v_prod.vigencia_hasta IS NOT NULL AND v_prod.vigencia_hasta < p_fecha THEN
    v_warnings := array_append(v_warnings, 'Lista de precios vencida el ' || v_prod.vigencia_hasta::text);
  END IF;

  IF v_prod.discontinuado THEN
    v_warnings := array_append(v_warnings, 'Producto discontinuado');
  END IF;

  -- 1. Precio neto = precio_lista * (1 - descuento_fabricante/100)
  v_precio_neto := v_prod.precio_lista * (1 - COALESCE(v_prod.descuento_fabricante, 0) / 100.0);

  -- 2. Conversión USD → ARS si corresponde
  IF v_prod.moneda = 'USD' THEN
    -- Leer fuente default desde settings (jsonb string -> texto sin comillas)
    SELECT trim(both '"' from valor::text) INTO v_cot_fuente
    FROM public.settings WHERE clave = 'cotizacion_default_fuente';

    SELECT valor INTO v_cot_valor
    FROM public.cotizacion_diaria
    WHERE fuente = v_cot_fuente AND fecha <= p_fecha
    ORDER BY fecha DESC
    LIMIT 1;

    IF v_cot_valor IS NULL THEN
      RAISE EXCEPTION 'No hay cotización USD disponible para % al %', v_cot_fuente, p_fecha
        USING ERRCODE = 'P0001';
    END IF;

    v_precio_ars := v_precio_neto * v_cot_valor;
  ELSE
    v_precio_ars := v_precio_neto;
  END IF;

  -- 3. Flete logístico por sucursal (sobre el costo, antes del markup)
  IF p_sucursal IS NOT NULL THEN
    SELECT valor INTO v_flete_cfg FROM public.settings WHERE clave = 'flete_logistico_porcentaje';
    v_flete_pct := COALESCE((v_flete_cfg ->> p_sucursal)::numeric, 0);
  END IF;
  v_precio_costo := v_precio_ars * (1 + v_flete_pct);

  -- 4. Markup por tier B2B
  v_precio_markup := v_precio_costo * v_tier.factor_markup;

  -- 5. IVA según familia fiscal del producto + condición/provincia del cliente
  --    Reglas:
  --      - no_gravado    → 0
  --      - exento_19640 + cliente provincia TDF → 0
  --      - cliente condicion_iva = 'EX'         → 0
  --      - resto                                 → 0.21
  v_iva_rate := CASE
    WHEN v_prod.familia_fiscal = 'no_gravado'                            THEN 0
    WHEN v_prod.familia_fiscal = 'exento_19640' AND v_cli.provincia = 'TDF' THEN 0
    WHEN v_cli.condicion_iva = 'EX'                                      THEN 0
    ELSE 0.21
  END;

  v_precio_final := v_precio_markup * (1 + v_iva_rate);

  -- 6. Piso autorizado (warning, no bloquea — el front decide UX)
  IF v_prod.precio_minimo_autorizado IS NOT NULL
     AND v_precio_final < v_prod.precio_minimo_autorizado THEN
    v_warnings := array_append(v_warnings,
      'Precio calculado (' || round(v_precio_final, 2) ||
      ') por debajo del mínimo autorizado (' || v_prod.precio_minimo_autorizado ||
      '). Requiere aprobación director.');
  END IF;

  RETURN jsonb_build_object(
    'producto_id',     v_prod.id,
    'cliente_id',      v_cli.id,
    'sucursal',        p_sucursal,
    'fecha_calculo',   p_fecha,
    'moneda_origen',   v_prod.moneda,
    'cotizacion_usd',  v_cot_valor,
    'fuente_cotiz',    v_cot_fuente,
    'precio_lista',    v_prod.precio_lista,
    'descuento_pct',   COALESCE(v_prod.descuento_fabricante, 0),
    'precio_neto',     round(v_precio_neto, 2),
    'precio_ars',      round(v_precio_ars, 2),
    'flete_pct',       v_flete_pct,
    'precio_costo',    round(v_precio_costo, 2),
    'tier',            v_tier.nombre,
    'factor_markup',   v_tier.factor_markup,
    'precio_markup',   round(v_precio_markup, 2),
    'iva_rate',        v_iva_rate,
    'precio_final',    round(v_precio_final, 2),
    'condicion_iva',   v_cli.condicion_iva,
    'familia_fiscal',  v_prod.familia_fiscal,
    'warnings',        v_warnings
  );
END;
$$;


-- ----------------------------------------------------------------
-- calcular_stock_disponible
--
-- Modos:
--   - p_sucursal NOT NULL: devuelve detalle de UNA sucursal
--   - p_sucursal NULL    : devuelve agregado de todas las sucursales
--                          + array detalle_por_sucursal
--
-- Reglas:
--   - disponible = stock_fisico − reservado − en_transito_saliente
--     (toggleables por settings.stock_descuenta_reservas y stock_descuenta_transito)
--   - reservas vencidas (vence_en < now) NO descuentan
--   - en modo agregado, no se descuenta tránsito porque sigue
--     siendo stock LASAC en movimiento
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_stock_disponible(
  p_producto_id UUID,
  p_sucursal    TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_fisico              INTEGER := 0;
  v_reservado           INTEGER := 0;
  v_en_transito_out     INTEGER := 0;
  v_en_transito_in      INTEGER := 0;
  v_disponible          INTEGER;
  v_descuenta_res       BOOLEAN;
  v_descuenta_tra       BOOLEAN;
  v_detalle_sucursales  JSONB;
BEGIN
  SELECT (valor::text)::boolean INTO v_descuenta_res
  FROM public.settings WHERE clave = 'stock_descuenta_reservas';

  SELECT (valor::text)::boolean INTO v_descuenta_tra
  FROM public.settings WHERE clave = 'stock_descuenta_transito';

  v_descuenta_res := COALESCE(v_descuenta_res, true);
  v_descuenta_tra := COALESCE(v_descuenta_tra, true);

  IF p_sucursal IS NOT NULL THEN
    -- Modo: una sucursal específica
    SELECT COALESCE(SUM(stock_fisico), 0) INTO v_fisico
    FROM public.stock_sucursal
    WHERE producto_id = p_producto_id AND sucursal = p_sucursal;

    IF v_descuenta_res THEN
      SELECT COALESCE(SUM(cantidad), 0) INTO v_reservado
      FROM public.reservas_stock
      WHERE producto_id = p_producto_id
        AND sucursal    = p_sucursal
        AND estado      = 'activa'
        AND (vence_en IS NULL OR vence_en > now());
    END IF;

    IF v_descuenta_tra THEN
      SELECT COALESCE(SUM(cantidad), 0) INTO v_en_transito_out
      FROM public.transferencias_stock
      WHERE producto_id     = p_producto_id
        AND sucursal_origen = p_sucursal
        AND estado IN ('solicitada','en_transito');
    END IF;

    -- en_transito entrante: informativo
    SELECT COALESCE(SUM(cantidad), 0) INTO v_en_transito_in
    FROM public.transferencias_stock
    WHERE producto_id      = p_producto_id
      AND sucursal_destino = p_sucursal
      AND estado IN ('solicitada','en_transito');

    v_disponible := GREATEST(v_fisico - v_reservado - v_en_transito_out, 0);

    RETURN jsonb_build_object(
      'producto_id',          p_producto_id,
      'sucursal',             p_sucursal,
      'stock_fisico',         v_fisico,
      'reservado',            v_reservado,
      'en_transito_saliente', v_en_transito_out,
      'en_transito_entrante', v_en_transito_in,
      'disponible',           v_disponible,
      'descuenta_reservas',   v_descuenta_res,
      'descuenta_transito',   v_descuenta_tra
    );
  ELSE
    -- Modo: agregado de todas las sucursales
    SELECT jsonb_agg(
             jsonb_build_object(
               'sucursal', s.sucursal,
               'detalle',  public.calcular_stock_disponible(p_producto_id, s.sucursal)
             )
           )
      INTO v_detalle_sucursales
      FROM (SELECT DISTINCT sucursal
              FROM public.stock_sucursal
             WHERE producto_id = p_producto_id) s;

    SELECT COALESCE(SUM(stock_fisico), 0) INTO v_fisico
    FROM public.stock_sucursal
    WHERE producto_id = p_producto_id;

    IF v_descuenta_res THEN
      SELECT COALESCE(SUM(cantidad), 0) INTO v_reservado
      FROM public.reservas_stock
      WHERE producto_id = p_producto_id
        AND estado      = 'activa'
        AND (vence_en IS NULL OR vence_en > now());
    END IF;

    -- En modo agregado no se descuenta tránsito (sigue siendo stock LASAC).
    v_disponible := GREATEST(v_fisico - v_reservado, 0);

    RETURN jsonb_build_object(
      'producto_id',          p_producto_id,
      'sucursal',             'TODAS',
      'stock_fisico_total',   v_fisico,
      'reservado_total',      v_reservado,
      'disponible_total',     v_disponible,
      'detalle_por_sucursal', COALESCE(v_detalle_sucursales, '[]'::jsonb)
    );
  END IF;
END;
$$;


-- ----------------------------------------------------------------
-- Permisos: cualquier usuario autenticado puede invocar las funciones.
-- (Las funciones son SECURITY INVOKER y respetan la RLS de las tablas.)
-- ----------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.calcular_precio_venta(UUID, UUID, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_stock_disponible(UUID, TEXT)         TO authenticated;


-- ----------------------------------------------------------------
-- Smoke tests sugeridos (correr manualmente con datos reales):
-- ----------------------------------------------------------------
-- 1) Producto ARS gravado normal + cliente CF TDF → IVA 21%, sin USD
--    SELECT public.calcular_precio_venta('<repuesto_uuid>','<cliente_uuid>','Ushuaia');
--
-- 2) Producto USD + cliente RI Buenos Aires → factura A, IVA 21% sobre markup
--    SELECT public.calcular_precio_venta('<repuesto_usd>','<cliente_ri_baires>','Ushuaia');
--
-- 3) Producto exento_19640 + cliente CF TDF → IVA 0
--    SELECT public.calcular_precio_venta('<repuesto_exento>','<cliente_cf_tdf>','Ushuaia');
--
-- 4) Stock sin movimientos → disponible = stock_fisico
--    SELECT public.calcular_stock_disponible('<repuesto_uuid>','Ushuaia');
--
-- 5) Stock agregado todas las sucursales
--    SELECT public.calcular_stock_disponible('<repuesto_uuid>');
