-- ============================================================
-- 022_setup_karen_liendo.sql
-- Alta del perfil de Karen Liendo (director Ambas sucursales)
-- en public.usuarios. El usuario en auth.users ya existe.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Datos:
--   UUID:    00f606e3-4158-463a-b1ed-e08af81ed357
--   Email:   karen.liendo@lasac.com.ar
--   Rol:     director
--   Sucursal: Ambas
-- ============================================================

INSERT INTO public.usuarios (id, email, nombre_completo, rol, sucursal, activo)
VALUES (
  '00f606e3-4158-463a-b1ed-e08af81ed357',
  'karen.liendo@lasac.com.ar',
  'Karen Liendo',
  'director',
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
WHERE id = '00f606e3-4158-463a-b1ed-e08af81ed357';
