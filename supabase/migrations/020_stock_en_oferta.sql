-- =====================================================
-- 020_stock_en_oferta.sql
-- Marca de "en oferta" para destacar visualmente unidades
-- en stock_vehiculos. Toggle simple boolean.
-- =====================================================

ALTER TABLE public.stock_vehiculos
  ADD COLUMN IF NOT EXISTS en_oferta BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.stock_vehiculos.en_oferta IS
  'Si true, la unidad se destaca visualmente en el listado de stock como oferta.';

-- Índice parcial — la mayoría no estará en oferta, así que indexar solo las activas.
CREATE INDEX IF NOT EXISTS idx_stock_vehiculos_en_oferta
  ON public.stock_vehiculos(sucursal, tipo)
  WHERE en_oferta = true;

-- ----------------------------------------------------------------
-- Marcar los 37 VINs de la carga inicial Rio Grande como en oferta.
-- Si algún VIN ya estaba en oferta o no existe, no rompe.
-- ----------------------------------------------------------------
UPDATE public.stock_vehiculos
SET en_oferta = true
WHERE vin IN (
  '8AP359AFKTU492144','8AP359AFKTU492768','8AP359AFKTU492305',
  '8AP359AF2TU487920','8AP359AF2TU491081','8AP359AF2TU488719',
  '8AP359AF2TU487709','8AP359AF2TU487890','8AP359AF2TU488926',
  '8AP359AF2TU491338','8AP359AF2TU492846','8AP359AF2TU491273',
  '8AP359AF2TU492780','8AP359AF2TU487430','8AP359AF2TU487846',
  '8AP359AF2TU487951','8AP359AF2TU494423','8AP359AF2TU495492',
  '8AP359AF2TU494501','8AP359AF2TU495114','8AP359AF2TU486151',
  '8AP359AF2TU495219','8AP359AF2TU482617',
  '9BD376BM8TYC58225',
  'ZFA5FBAT9SJ082548','ZFA5FBAT1SJ077604','ZFA5FBAT3SJ080696',
  '9BD2654PNT9324094','9BD2654PNT9324228',
  '9BD341AB1TYA54723','9BD341AB1TYA49128',
  '9BD281DNXT9997089','9BD281DNXSYG67828',
  '9BD281DMXT9900932','9BD281DMXSYG42180',
  '8AP5791N6TU705363',
  '9882264SNTKG38547'
);

-- Verificación
SELECT
  COUNT(*) FILTER (WHERE en_oferta = true) AS en_oferta,
  COUNT(*) FILTER (WHERE en_oferta = false) AS sin_oferta,
  COUNT(*) AS total
FROM public.stock_vehiculos
WHERE sucursal = 'Rio Grande' AND tipo = '0km';
