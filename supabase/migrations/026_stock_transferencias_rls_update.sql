-- =====================================================
-- 026_stock_transferencias_rls_update.sql
-- Fix de RLS en stock_transferencias.
--
-- La migration 009 creó la tabla con policies de SELECT e INSERT, pero
-- olvidó la policy de UPDATE. Resultado: los cambios de estado
-- (pendiente → en_transito → completada / cancelada) fallaban en
-- silencio (devolvían 0 rows affected sin error).
-- =====================================================

-- Limpiar policy de update si existiera con otro nombre
DROP POLICY IF EXISTS "Usuarios autenticados actualizan transferencias" ON public.stock_transferencias;
DROP POLICY IF EXISTS "stock_transf_update_auth" ON public.stock_transferencias;

CREATE POLICY "stock_transf_update_auth" ON public.stock_transferencias
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Bonus: también policy de DELETE (por si alguna vez hace falta limpiar
-- transferencias canceladas viejas; solo director debería usarla).
DROP POLICY IF EXISTS "stock_transf_delete_director" ON public.stock_transferencias;
CREATE POLICY "stock_transf_delete_director" ON public.stock_transferencias
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol = 'director' AND activo = true
  ));

-- Verificación: deberían aparecer 4 policies (SELECT, INSERT, UPDATE, DELETE)
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'stock_transferencias'
ORDER BY cmd;
