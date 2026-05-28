-- ============================================================
-- 029_seed_vendedores.sql — Perfiles de los 15 vendedores
-- ============================================================
-- IMPORTANTE: correr este script DESPUÉS de haber creado los
-- usuarios en Supabase Auth (Dashboard → Authentication → Users
-- → Add user, con "Auto Confirm User" tildado).
--
-- Crea el perfil en public.usuarios buscando el id por email
-- (no hace falta copiar UUIDs). El email cargado en Auth debe
-- coincidir con el de la lista de abajo (matchea en minúsculas).
--
-- Es idempotente: si se re-corre, actualiza rol/sucursal/nombre.
--
-- ⚠ REVISAR 2 mails antes de crear los usuarios en Auth:
--   - Ana Castillo: venía 'gmail.con' → se asume 'gmail.com'
--   - German Lapa:  venía 'Ggerman.lapa' (doble g) → confirmar
-- ============================================================

INSERT INTO public.usuarios (id, email, nombre_completo, rol, sucursal, activo)
SELECT au.id, au.email, v.nombre, 'vendedor', v.sucursal, true
FROM (VALUES
  ('alejocapasso@gmail.com',              'Alejo Capasso',           'Rio Grande'),
  ('sofiavillagra1988@gmail.com',         'Sofia Villagra',          'Rio Grande'),
  ('jm.y.jl@hotmail.com',                 'Rivadeo Juan Miguel',     'Rio Grande'),
  ('dianaheredia019@gmail.com',           'Heredia Diana Elizabeth', 'Rio Grande'),
  ('annaelizabethcastillo.09@gmail.com',  'Ana Elizabeth Castillo',  'Ushuaia'),     -- ⚠ venía .con
  ('roespinola277@gmail.com',             'Espinola Rocio',          'Rio Grande'),
  ('viviana.igarzabal07@gmail.com',       'Viviana Igarzabal',       'Rio Grande'),
  ('maciel.felipe@lasac.com.ar',          'Felipe Carlos Maciel',    'Rio Grande'),
  ('dayan.sorda@lasac.com.ar',            'Dayan Sorda Paschiero',   'Ushuaia'),
  ('leonardo.carron@lasac.com.ar',        'Leonardo Carron',         'Rio Grande'),
  ('poncemauroj@gmail.com',               'Mauro Ponce',             'Ushuaia'),
  ('garinlasac@gmail.com',                'Gisela Garin',            'Ushuaia'),
  ('astrid.rocha@lasac.com.ar',           'Astrid Rocha',            'Ushuaia'),
  ('ggerman.lapa@lasac.com.ar',           'German Lapa',             'Ushuaia'),     -- ⚠ ¿german o ggerman?
  ('ronald.bardales@lasac.com.ar',        'Ronald Bardales',         'Rio Grande')
) AS v(email, nombre, sucursal)
JOIN auth.users au ON lower(au.email) = lower(v.email)
ON CONFLICT (id) DO UPDATE
  SET rol             = 'vendedor',
      sucursal        = EXCLUDED.sucursal,
      nombre_completo = EXCLUDED.nombre_completo;

-- ------------------------------------------------------------
-- Control: ¿quiénes existen en Auth y quiénes ya tienen perfil?
-- Las filas con existe_en_auth = false son mails que NO matchearon
-- (revisar cómo se cargó el usuario en Auth).
-- ------------------------------------------------------------
SELECT v.email,
       (au.id IS NOT NULL)                          AS existe_en_auth,
       (u.id  IS NOT NULL AND u.rol = 'vendedor')   AS perfil_vendedor_ok
FROM (VALUES
  ('alejocapasso@gmail.com'),
  ('sofiavillagra1988@gmail.com'),
  ('jm.y.jl@hotmail.com'),
  ('dianaheredia019@gmail.com'),
  ('annaelizabethcastillo.09@gmail.com'),
  ('roespinola277@gmail.com'),
  ('viviana.igarzabal07@gmail.com'),
  ('maciel.felipe@lasac.com.ar'),
  ('dayan.sorda@lasac.com.ar'),
  ('leonardo.carron@lasac.com.ar'),
  ('poncemauroj@gmail.com'),
  ('garinlasac@gmail.com'),
  ('astrid.rocha@lasac.com.ar'),
  ('ggerman.lapa@lasac.com.ar'),
  ('ronald.bardales@lasac.com.ar')
) AS v(email)
LEFT JOIN auth.users au   ON lower(au.email) = lower(v.email)
LEFT JOIN public.usuarios u ON u.id = au.id
ORDER BY existe_en_auth, v.email;
