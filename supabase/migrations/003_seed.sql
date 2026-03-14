-- ============================================================
-- 003_seed.sql — Seed data para LASAC APP
-- ============================================================

-- ============================================================
-- 1. MODELOS FIAT 2026
-- ============================================================

-- AUTOS
INSERT INTO public.modelos_fiat (nombre, categoria) VALUES
  ('MOBI TREKKING 1.0', 'Autos'),
  ('ARGO DRIVE 1.3L MT', 'Autos'),
  ('ARGO DRIVE 1.3L CVT', 'Autos'),
  ('CRONOS LIKE 1.3 GSE MY26', 'Autos'),
  ('CRONOS DRIVE 1.3 GSE PACK PLUS MY26', 'Autos'),
  ('CRONOS DRIVE 1.3L GSE CVT PACK PLUS MY26', 'Autos'),
  ('CRONOS PRECISION 1.3 GSE CVT MY26', 'Autos')
ON CONFLICT DO NOTHING;

-- SUV/HATCH
INSERT INTO public.modelos_fiat (nombre, categoria) VALUES
  ('PULSE DRIVE 1.3 MT5 MY26', 'SUV/Hatch'),
  ('PULSE DRIVE 1.3 CVT MY26', 'SUV/Hatch'),
  ('PULSE AUDACE 1.0T CVT MY26', 'SUV/Hatch'),
  ('PULSE IMPETUS 1.0T CVT MY26', 'SUV/Hatch'),
  ('PULSE ABARTH TURBO 270 AT6 MY26', 'SUV/Hatch'),
  ('FASTBACK TURBO 270 AT MY26', 'SUV/Hatch'),
  ('FASTBACK ABARTH TURBO 270 AT6 MY26', 'SUV/Hatch'),
  ('600 HYBRID 1.2 eDCT', 'SUV/Hatch')
ON CONFLICT DO NOTHING;

-- COMERCIALES
INSERT INTO public.modelos_fiat (nombre, categoria) VALUES
  ('FIORINO ENDURANCE 1.3 FIREFLY', 'Comerciales'),
  ('STRADA FREEDOM CS 1.3 MT', 'Comerciales'),
  ('STRADA FREEDOM 1.3 8V CD', 'Comerciales'),
  ('STRADA VOLCANO 1.3 8V CD CVT', 'Comerciales'),
  ('STRADA RANCH T200 CD CVT', 'Comerciales'),
  ('STRADA ULTRA T200 CD CVT', 'Comerciales')
ON CONFLICT DO NOTHING;

-- TORO
INSERT INTO public.modelos_fiat (nombre, categoria) VALUES
  ('TORO FREEDOM T270 AT6 4X2', 'Toro'),
  ('TORO VOLCANO T270 AT6 4X2', 'Toro'),
  ('TORO VOLCANO TD350 AT9 4X4', 'Toro'),
  ('TORO ULTRA TD350 AT9 4X4', 'Toro'),
  ('TORO FREEDOM 1.3T AT6 4X2', 'Toro'),
  ('TORO VOLCANO 1.3T AT6 4X2', 'Toro'),
  ('TORO VOLCANO 2.2TD AT9 4X4', 'Toro')
ON CONFLICT DO NOTHING;

-- TITANO
INSERT INTO public.modelos_fiat (nombre, categoria) VALUES
  ('TITANO ENDURANCE MT 4X2', 'Titano'),
  ('TITANO ENDURANCE MT 4X4', 'Titano'),
  ('TITANO FREEDOM MT 4X4', 'Titano'),
  ('TITANO FREEDOM PLUS AT 4X4', 'Titano'),
  ('TITANO RANCH AT 4X4', 'Titano')
ON CONFLICT DO NOTHING;

-- ============================================================
-- NOTA: No se insertan usuarios.
-- Los usuarios se crean al registrarse en Supabase Auth
-- y se insertan manualmente o mediante trigger.
-- ============================================================
