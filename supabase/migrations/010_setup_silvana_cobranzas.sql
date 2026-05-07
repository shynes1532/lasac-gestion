-- ============================================================
-- 010_setup_silvana_cobranzas.sql
-- Alta / actualización del perfil de Silvana Videla (Cobranzas)
-- en public.usuarios. El usuario en auth.users ya existe.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Datos:
--   UUID:    2313e211-e81d-4fff-87d2-3f2668df46e4
--   Email:   silvana.videla@lasac.com.ar
--   Rol:     gestor   (controla pagos en paso 2 del pipeline,
--                      saldos pendientes, cartera y mora)
--   Sucursal: Ambas
-- ============================================================

INSERT INTO public.usuarios (id, email, nombre_completo, rol, sucursal, activo)
VALUES (
  '2313e211-e81d-4fff-87d2-3f2668df46e4',
  'silvana.videla@lasac.com.ar',
  'Silvana Videla — Cobranzas',
  'gestor',
  'Ambas',
  true
)
ON CONFLICT (id) DO UPDATE SET
  email           = EXCLUDED.email,
  nombre_completo = EXCLUDED.nombre_completo,
  rol             = EXCLUDED.rol,
  sucursal        = EXCLUDED.sucursal,
  activo          = true;

-- Verificación
SELECT id, email, nombre_completo, rol, sucursal, activo
FROM public.usuarios
WHERE id = '2313e211-e81d-4fff-87d2-3f2668df46e4';
