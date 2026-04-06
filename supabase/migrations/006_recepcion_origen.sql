-- Agregar origen y modelo de interés a recepciones
ALTER TABLE public.recepciones
  ADD COLUMN IF NOT EXISTS origen TEXT CHECK (origen IN ('redes_sociales', 'recomendacion', 'paso_por_puerta', 'llamada', 'whatsapp', 'web', 'otro')),
  ADD COLUMN IF NOT EXISTS modelo_interes TEXT;
