-- =====================================================
-- 015_cliente_mostrador.sql
-- Cliente "Mostrador" (Consumidor Final / TDF / tier publico).
-- Es el cliente default cuando no hay razón social asociada
-- a la venta de repuestos (mostrador físico, ventas rápidas).
-- =====================================================

INSERT INTO public.clientes (id, nombre, condicion_iva, provincia, tier_id, observaciones, activo)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  'MOSTRADOR — Consumidor Final',
  'CF',
  'TDF',
  (SELECT id FROM public.pricing_tiers WHERE nombre = 'publico' AND activo = true),
  'Cliente default para ventas de mostrador. NO eliminar.',
  true
WHERE EXISTS (SELECT 1 FROM public.pricing_tiers WHERE nombre = 'publico' AND activo = true)
ON CONFLICT (id) DO NOTHING;

-- Verificación
SELECT id, nombre, condicion_iva, provincia, (SELECT nombre FROM public.pricing_tiers WHERE id = c.tier_id) AS tier
FROM public.clientes c
WHERE c.id = '00000000-0000-0000-0000-000000000001'::uuid;
