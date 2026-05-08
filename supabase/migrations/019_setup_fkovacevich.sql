-- ============================================================
-- 019_setup_fkovacevich.sql
-- Alta / actualización del perfil de F. Kovacevich (director Ushuaia)
-- en public.usuarios. El usuario en auth.users ya existe.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Datos:
--   UUID:    766a6742-e77f-44f3-88d2-33c863dbab33
--   Email:   fkovacevich@lasac.com.ar
--   Rol:     director
--   Sucursal: Ushuaia
--
-- Nota: con sucursal='Ushuaia' los listados que filtran por sucursal del
-- perfil van a mostrar solo Ushuaia. Si más adelante necesita ver ambas
-- sucursales, hacer:
--   UPDATE public.usuarios SET sucursal = 'Ambas'
--    WHERE id = '766a6742-e77f-44f3-88d2-33c863dbab33';
-- ============================================================

INSERT INTO public.usuarios (id, email, nombre_completo, rol, sucursal, activo)
VALUES (
  '766a6742-e77f-44f3-88d2-33c863dbab33',
  'fkovacevich@lasac.com.ar',
  'F. Kovacevich',
  'director',
  'Ushuaia',
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
WHERE id = '766a6742-e77f-44f3-88d2-33c863dbab33';
