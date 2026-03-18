-- ============================================================
-- 005_setup_director.sql
-- Ejecutar SOLO UNA VEZ para crear el usuario director inicial.
--
-- INSTRUCCIONES:
-- 1. Ir a Supabase Dashboard → Authentication → Users
-- 2. Copiar el UUID del usuario
-- 3. Reemplazar 'TU-UUID-AQUI' con ese UUID
-- 4. Ejecutar en Supabase → SQL Editor
-- ============================================================

-- OPCIÓN A: Insertar director manualmente (reemplazá los valores)
INSERT INTO public.usuarios (id, email, nombre_completo, rol, sucursal, activo)
VALUES (
  'TU-UUID-AQUI',                        -- UUID de Authentication → Users
  'tu-email@liendoautomotores.com.ar',   -- tu email
  'Nombre Apellido',                     -- tu nombre completo
  'director',
  'Ambas',
  true
)
ON CONFLICT (id) DO NOTHING;


-- OPCIÓN B: Si ya estás logueado y querés insertarte a vos mismo
-- (ejecutar con la sesión activa en el SQL Editor)
INSERT INTO public.usuarios (id, email, nombre_completo, rol, sucursal, activo)
VALUES (
  auth.uid(),
  (SELECT email FROM auth.users WHERE id = auth.uid()),
  'Nombre Apellido',   -- cambiar
  'director',
  'Ambas',
  true
)
ON CONFLICT (id) DO NOTHING;


-- VERIFICAR que quedó bien:
SELECT id, email, nombre_completo, rol, sucursal, activo FROM public.usuarios;
