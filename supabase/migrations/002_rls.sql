-- ============================================================
-- 002_rls.sql — Políticas RLS para LASAC APP
-- ============================================================

-- ============================================================
-- 1. FUNCIONES HELPER
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM public.usuarios WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_sucursal()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sucursal FROM public.usuarios WHERE id = auth.uid();
$$;

-- ============================================================
-- 2. HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================

ALTER TABLE public.usuarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operaciones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titulares           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestoria_tramites   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alistamiento_pdi    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encuestas_csi       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelos_fiat        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. POLÍTICAS — USUARIOS
-- ============================================================

-- Cada usuario lee su propio registro
CREATE POLICY usuarios_select_own ON public.usuarios
  FOR SELECT USING (id = auth.uid());

-- Director lee todos los usuarios
CREATE POLICY usuarios_select_director ON public.usuarios
  FOR SELECT USING (get_user_role() = 'director');

-- Solo director puede insertar usuarios
CREATE POLICY usuarios_insert_director ON public.usuarios
  FOR INSERT WITH CHECK (get_user_role() = 'director');

-- Solo director puede actualizar usuarios
CREATE POLICY usuarios_update_director ON public.usuarios
  FOR UPDATE USING (get_user_role() = 'director');

-- Solo director puede eliminar usuarios
CREATE POLICY usuarios_delete_director ON public.usuarios
  FOR DELETE USING (get_user_role() = 'director');

-- ============================================================
-- 4. POLÍTICAS — OPERACIONES
-- ============================================================

-- Director: acceso total
CREATE POLICY operaciones_all_director ON public.operaciones
  FOR ALL USING (get_user_role() = 'director');

-- Gestor: SELECT/INSERT/UPDATE — solo su sucursal o 'Ambas'
CREATE POLICY operaciones_select_gestor ON public.operaciones
  FOR SELECT USING (
    get_user_role() = 'gestor'
    AND (sucursal = get_user_sucursal() OR sucursal = 'Ambas' OR get_user_sucursal() = 'Ambas')
  );

CREATE POLICY operaciones_insert_gestor ON public.operaciones
  FOR INSERT WITH CHECK (
    get_user_role() = 'gestor'
    AND (sucursal = get_user_sucursal() OR sucursal = 'Ambas' OR get_user_sucursal() = 'Ambas')
  );

CREATE POLICY operaciones_update_gestor ON public.operaciones
  FOR UPDATE USING (
    get_user_role() = 'gestor'
    AND (sucursal = get_user_sucursal() OR sucursal = 'Ambas' OR get_user_sucursal() = 'Ambas')
  );

-- Asesor Ushuaia: SELECT operaciones de su sucursal
CREATE POLICY operaciones_select_asesor_ush ON public.operaciones
  FOR SELECT USING (
    get_user_role() = 'asesor_ush'
    AND sucursal = 'Ushuaia'
  );

-- Asesor Rio Grande: SELECT operaciones de su sucursal
CREATE POLICY operaciones_select_asesor_rg ON public.operaciones
  FOR SELECT USING (
    get_user_role() = 'asesor_rg'
    AND sucursal = 'Rio Grande'
  );

-- Preparador: SELECT en operaciones
CREATE POLICY operaciones_select_preparador ON public.operaciones
  FOR SELECT USING (get_user_role() = 'preparador');

-- Calidad: SELECT en operaciones
CREATE POLICY operaciones_select_calidad ON public.operaciones
  FOR SELECT USING (get_user_role() = 'calidad');

-- ============================================================
-- 5. POLÍTICAS — TITULARES
-- ============================================================

-- Director: acceso total
CREATE POLICY titulares_all_director ON public.titulares
  FOR ALL USING (get_user_role() = 'director');

-- Gestor: SELECT/INSERT/UPDATE — solo su sucursal (via operacion)
CREATE POLICY titulares_select_gestor ON public.titulares
  FOR SELECT USING (
    get_user_role() = 'gestor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR o.sucursal = 'Ambas' OR get_user_sucursal() = 'Ambas')
    )
  );

CREATE POLICY titulares_insert_gestor ON public.titulares
  FOR INSERT WITH CHECK (
    get_user_role() = 'gestor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR o.sucursal = 'Ambas' OR get_user_sucursal() = 'Ambas')
    )
  );

CREATE POLICY titulares_update_gestor ON public.titulares
  FOR UPDATE USING (
    get_user_role() = 'gestor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR o.sucursal = 'Ambas' OR get_user_sucursal() = 'Ambas')
    )
  );

-- Asesor Ushuaia: SELECT titulares de operaciones de su sucursal
CREATE POLICY titulares_select_asesor_ush ON public.titulares
  FOR SELECT USING (
    get_user_role() = 'asesor_ush'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Ushuaia'
    )
  );

-- Asesor Rio Grande: SELECT titulares de operaciones de su sucursal
CREATE POLICY titulares_select_asesor_rg ON public.titulares
  FOR SELECT USING (
    get_user_role() = 'asesor_rg'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Rio Grande'
    )
  );

-- Preparador: NO puede ver titulares (privacidad) — sin política = sin acceso

-- Calidad: SELECT en titulares
CREATE POLICY titulares_select_calidad ON public.titulares
  FOR SELECT USING (get_user_role() = 'calidad');

-- ============================================================
-- 6. POLÍTICAS — UNIDADES
-- ============================================================

-- Director: acceso total
CREATE POLICY unidades_all_director ON public.unidades
  FOR ALL USING (get_user_role() = 'director');

-- Gestor: SELECT/INSERT/UPDATE — solo su sucursal (via operacion)
CREATE POLICY unidades_select_gestor ON public.unidades
  FOR SELECT USING (
    get_user_role() = 'gestor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR o.sucursal = 'Ambas' OR get_user_sucursal() = 'Ambas')
    )
  );

CREATE POLICY unidades_insert_gestor ON public.unidades
  FOR INSERT WITH CHECK (
    get_user_role() = 'gestor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR o.sucursal = 'Ambas' OR get_user_sucursal() = 'Ambas')
    )
  );

CREATE POLICY unidades_update_gestor ON public.unidades
  FOR UPDATE USING (
    get_user_role() = 'gestor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR o.sucursal = 'Ambas' OR get_user_sucursal() = 'Ambas')
    )
  );

-- Asesor Ushuaia: SELECT unidades de operaciones de su sucursal
CREATE POLICY unidades_select_asesor_ush ON public.unidades
  FOR SELECT USING (
    get_user_role() = 'asesor_ush'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Ushuaia'
    )
  );

-- Asesor Rio Grande: SELECT unidades de operaciones de su sucursal
CREATE POLICY unidades_select_asesor_rg ON public.unidades
  FOR SELECT USING (
    get_user_role() = 'asesor_rg'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Rio Grande'
    )
  );

-- Preparador: SELECT en unidades
CREATE POLICY unidades_select_preparador ON public.unidades
  FOR SELECT USING (get_user_role() = 'preparador');

-- Calidad: SELECT en unidades
CREATE POLICY unidades_select_calidad ON public.unidades
  FOR SELECT USING (get_user_role() = 'calidad');

-- ============================================================
-- 7. POLÍTICAS — GESTORIA_TRAMITES
-- ============================================================

-- Director: acceso total
CREATE POLICY gestoria_tramites_all_director ON public.gestoria_tramites
  FOR ALL USING (get_user_role() = 'director');

-- Gestor: SELECT/INSERT/UPDATE — solo su sucursal (via operacion)
CREATE POLICY gestoria_tramites_select_gestor ON public.gestoria_tramites
  FOR SELECT USING (
    get_user_role() = 'gestor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR o.sucursal = 'Ambas' OR get_user_sucursal() = 'Ambas')
    )
  );

CREATE POLICY gestoria_tramites_insert_gestor ON public.gestoria_tramites
  FOR INSERT WITH CHECK (
    get_user_role() = 'gestor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR o.sucursal = 'Ambas' OR get_user_sucursal() = 'Ambas')
    )
  );

CREATE POLICY gestoria_tramites_update_gestor ON public.gestoria_tramites
  FOR UPDATE USING (
    get_user_role() = 'gestor'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id
      AND (o.sucursal = get_user_sucursal() OR o.sucursal = 'Ambas' OR get_user_sucursal() = 'Ambas')
    )
  );

-- Calidad: SELECT en gestoria_tramites
CREATE POLICY gestoria_tramites_select_calidad ON public.gestoria_tramites
  FOR SELECT USING (get_user_role() = 'calidad');

-- ============================================================
-- 8. POLÍTICAS — ALISTAMIENTO_PDI
-- ============================================================

-- Director: acceso total
CREATE POLICY alistamiento_pdi_all_director ON public.alistamiento_pdi
  FOR ALL USING (get_user_role() = 'director');

-- Preparador: SELECT/INSERT/UPDATE
CREATE POLICY alistamiento_pdi_select_preparador ON public.alistamiento_pdi
  FOR SELECT USING (get_user_role() = 'preparador');

CREATE POLICY alistamiento_pdi_insert_preparador ON public.alistamiento_pdi
  FOR INSERT WITH CHECK (get_user_role() = 'preparador');

CREATE POLICY alistamiento_pdi_update_preparador ON public.alistamiento_pdi
  FOR UPDATE USING (get_user_role() = 'preparador');

-- Calidad: SELECT + INSERT/UPDATE (para campos de no_conformidades)
CREATE POLICY alistamiento_pdi_select_calidad ON public.alistamiento_pdi
  FOR SELECT USING (get_user_role() = 'calidad');

CREATE POLICY alistamiento_pdi_insert_calidad ON public.alistamiento_pdi
  FOR INSERT WITH CHECK (get_user_role() = 'calidad');

CREATE POLICY alistamiento_pdi_update_calidad ON public.alistamiento_pdi
  FOR UPDATE USING (get_user_role() = 'calidad');

-- Gestor: NO tiene acceso a alistamiento_pdi (sin política = sin acceso)

-- ============================================================
-- 9. POLÍTICAS — ENTREGAS
-- ============================================================

-- Director: acceso total
CREATE POLICY entregas_all_director ON public.entregas
  FOR ALL USING (get_user_role() = 'director');

-- Asesor Ushuaia: INSERT/UPDATE en entregas de operaciones de su sucursal
CREATE POLICY entregas_select_asesor_ush ON public.entregas
  FOR SELECT USING (
    get_user_role() = 'asesor_ush'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Ushuaia'
    )
  );

CREATE POLICY entregas_insert_asesor_ush ON public.entregas
  FOR INSERT WITH CHECK (
    get_user_role() = 'asesor_ush'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Ushuaia'
    )
  );

CREATE POLICY entregas_update_asesor_ush ON public.entregas
  FOR UPDATE USING (
    get_user_role() = 'asesor_ush'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Ushuaia'
    )
  );

-- Asesor Rio Grande: INSERT/UPDATE en entregas de operaciones de su sucursal
CREATE POLICY entregas_select_asesor_rg ON public.entregas
  FOR SELECT USING (
    get_user_role() = 'asesor_rg'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Rio Grande'
    )
  );

CREATE POLICY entregas_insert_asesor_rg ON public.entregas
  FOR INSERT WITH CHECK (
    get_user_role() = 'asesor_rg'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Rio Grande'
    )
  );

CREATE POLICY entregas_update_asesor_rg ON public.entregas
  FOR UPDATE USING (
    get_user_role() = 'asesor_rg'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Rio Grande'
    )
  );

-- Calidad: SELECT en entregas
CREATE POLICY entregas_select_calidad ON public.entregas
  FOR SELECT USING (get_user_role() = 'calidad');

-- Gestor: NO tiene acceso a entregas (sin política = sin acceso)

-- ============================================================
-- 10. POLÍTICAS — ENCUESTAS_CSI
-- ============================================================

-- Director: acceso total
CREATE POLICY encuestas_csi_all_director ON public.encuestas_csi
  FOR ALL USING (get_user_role() = 'director');

-- Asesor Ushuaia: SELECT/INSERT/UPDATE en encuestas de operaciones de su sucursal
CREATE POLICY encuestas_csi_select_asesor_ush ON public.encuestas_csi
  FOR SELECT USING (
    get_user_role() = 'asesor_ush'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Ushuaia'
    )
  );

CREATE POLICY encuestas_csi_insert_asesor_ush ON public.encuestas_csi
  FOR INSERT WITH CHECK (
    get_user_role() = 'asesor_ush'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Ushuaia'
    )
  );

CREATE POLICY encuestas_csi_update_asesor_ush ON public.encuestas_csi
  FOR UPDATE USING (
    get_user_role() = 'asesor_ush'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Ushuaia'
    )
  );

-- Asesor Rio Grande: SELECT/INSERT/UPDATE en encuestas de operaciones de su sucursal
CREATE POLICY encuestas_csi_select_asesor_rg ON public.encuestas_csi
  FOR SELECT USING (
    get_user_role() = 'asesor_rg'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Rio Grande'
    )
  );

CREATE POLICY encuestas_csi_insert_asesor_rg ON public.encuestas_csi
  FOR INSERT WITH CHECK (
    get_user_role() = 'asesor_rg'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Rio Grande'
    )
  );

CREATE POLICY encuestas_csi_update_asesor_rg ON public.encuestas_csi
  FOR UPDATE USING (
    get_user_role() = 'asesor_rg'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id = operacion_id AND o.sucursal = 'Rio Grande'
    )
  );

-- Calidad: SELECT en encuestas_csi
CREATE POLICY encuestas_csi_select_calidad ON public.encuestas_csi
  FOR SELECT USING (get_user_role() = 'calidad');

-- ============================================================
-- 11. POLÍTICAS — NOTIFICACIONES
-- ============================================================

-- Cada usuario solo ve sus propias notificaciones
CREATE POLICY notificaciones_select_own ON public.notificaciones
  FOR SELECT USING (destinatario_id = auth.uid());

-- Director: acceso total a notificaciones
CREATE POLICY notificaciones_all_director ON public.notificaciones
  FOR ALL USING (get_user_role() = 'director');

-- Cualquier usuario autenticado puede insertar notificaciones (el sistema las genera)
CREATE POLICY notificaciones_insert_authenticated ON public.notificaciones
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Cada usuario puede actualizar sus propias notificaciones (marcar como leída)
CREATE POLICY notificaciones_update_own ON public.notificaciones
  FOR UPDATE USING (destinatario_id = auth.uid());

-- ============================================================
-- 12. POLÍTICAS — MODELOS_FIAT
-- ============================================================

-- Todos los autenticados pueden leer modelos_fiat
CREATE POLICY modelos_fiat_select_authenticated ON public.modelos_fiat
  FOR SELECT USING (auth.role() = 'authenticated');

-- Solo director puede gestionar modelos_fiat
CREATE POLICY modelos_fiat_all_director ON public.modelos_fiat
  FOR ALL USING (get_user_role() = 'director');
