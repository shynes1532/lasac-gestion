-- ============================================================
-- 028_rol_vendedor.sql — Rol "vendedor" de solo lectura
-- ============================================================
-- Agrega el rol 'vendedor': puede VER (SELECT) pero no editar.
-- Filtrado por su sucursal (usa get_user_sucursal()).
--
-- Solo se agregan políticas en el módulo central de operaciones,
-- porque el resto de las tablas (repuestos, stock, recepciones,
-- plan de ahorro, pricing, clientes) ya tienen SELECT abierto a
-- cualquier usuario autenticado. El filtro por sucursal en esos
-- módulos lo hace el frontend.
--
-- NO se crean políticas INSERT/UPDATE/DELETE para vendedor:
-- sin política de escritura, RLS bloquea toda edición.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Ampliar el CHECK del rol para incluir 'vendedor'
--    (busca el constraint por definición, sin asumir su nombre)
-- ------------------------------------------------------------
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'public.usuarios'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%rol%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.usuarios DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('director','asesor_ush','asesor_rg','gestor','preparador','calidad','vendedor'));

-- ------------------------------------------------------------
-- 2. Políticas SELECT (solo lectura) para vendedor
-- ------------------------------------------------------------

-- operaciones — filtro de sucursal directo
DROP POLICY IF EXISTS operaciones_select_vendedor ON public.operaciones;
CREATE POLICY operaciones_select_vendedor ON public.operaciones
  FOR SELECT USING (
    get_user_role() = 'vendedor'
    AND (sucursal = get_user_sucursal() OR get_user_sucursal() = 'Ambas')
  );

-- titulares — vía operación
DROP POLICY IF EXISTS titulares_select_vendedor ON public.titulares;
CREATE POLICY titulares_select_vendedor ON public.titulares
  FOR SELECT USING (
    get_user_role() = 'vendedor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR get_user_sucursal() = 'Ambas')
    )
  );

-- unidades — vía operación
DROP POLICY IF EXISTS unidades_select_vendedor ON public.unidades;
CREATE POLICY unidades_select_vendedor ON public.unidades
  FOR SELECT USING (
    get_user_role() = 'vendedor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR get_user_sucursal() = 'Ambas')
    )
  );

-- gestoria_tramites — vía operación
DROP POLICY IF EXISTS gestoria_tramites_select_vendedor ON public.gestoria_tramites;
CREATE POLICY gestoria_tramites_select_vendedor ON public.gestoria_tramites
  FOR SELECT USING (
    get_user_role() = 'vendedor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR get_user_sucursal() = 'Ambas')
    )
  );

-- alistamiento_pdi — vía operación
DROP POLICY IF EXISTS alistamiento_pdi_select_vendedor ON public.alistamiento_pdi;
CREATE POLICY alistamiento_pdi_select_vendedor ON public.alistamiento_pdi
  FOR SELECT USING (
    get_user_role() = 'vendedor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR get_user_sucursal() = 'Ambas')
    )
  );

-- entregas — vía operación
DROP POLICY IF EXISTS entregas_select_vendedor ON public.entregas;
CREATE POLICY entregas_select_vendedor ON public.entregas
  FOR SELECT USING (
    get_user_role() = 'vendedor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR get_user_sucursal() = 'Ambas')
    )
  );

-- encuestas_csi — vía operación
DROP POLICY IF EXISTS encuestas_csi_select_vendedor ON public.encuestas_csi;
CREATE POLICY encuestas_csi_select_vendedor ON public.encuestas_csi
  FOR SELECT USING (
    get_user_role() = 'vendedor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR get_user_sucursal() = 'Ambas')
    )
  );

-- contactos_calidad — vía operación
DROP POLICY IF EXISTS contactos_calidad_select_vendedor ON public.contactos_calidad;
CREATE POLICY contactos_calidad_select_vendedor ON public.contactos_calidad
  FOR SELECT USING (
    get_user_role() = 'vendedor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR get_user_sucursal() = 'Ambas')
    )
  );
