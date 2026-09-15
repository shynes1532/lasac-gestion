-- 030 · Desactivar el bot de reclamos de mora por WhatsApp.
-- APLICADA EN PRODUCCIÓN el 15/09/2026 vía MCP. Este archivo versiona el estado.
--
-- Qué se encontró:
--   · La tabla `avisos_whatsapp` tiene 191 filas, todas del 05/07/2026. Una
--     sola corrida, lanzada a mano, y nunca más.
--   · 49 se enviaron y 142 fallaron con "n8n respondió 429 Too many requests":
--     disparó los 191 de una y n8n lo frenó por pedidos simultáneos.
--   · De los 191, 133 eran para ahorristas AL DÍA, con cero cuotas impagas.
--     Los 133 cayeron dentro de los fallados: el 429 evitó mandarle un reclamo
--     de deuda a gente que no debía nada. Los 49 que salieron tenían mora real.
--   · `deuda_total` venía en 0 en los 191, incluso en los de 6 cuotas impagas.
--   · No hay pg_cron ni pg_net en esta base, ninguna función SQL manda WhatsApp,
--     y ni este repo ni sus migraciones mencionan la tabla: la creó y la usó
--     algo externo que hoy no existe. Tampoco queda ningún workflow de WhatsApp
--     en n8n, así que el endpoint al que le pegaba ya no responde.
--
-- Qué hace esta migración: cierra la tabla con RLS y sin policies. Nadie con la
-- clave pública puede leerla ni escribirla; service_role sigue entrando, así que
-- un rearmado deliberado desde el servidor sigue siendo posible. Nada del código
-- vigente la toca, así que no rompe ninguna pantalla.
--
-- Antes de revivir el bot hay que arreglar dos cosas: la selección (que no
-- incluya a los que están al día) y el cálculo de la deuda.
alter table public.avisos_whatsapp enable row level security;

comment on table public.avisos_whatsapp is
  'Reclamos de mora por WhatsApp. DESACTIVADA el 15/09/2026: RLS sin policies. '
  'Corrió una sola vez (05/07/2026): 49 enviados y 142 caídos por 429 de n8n. '
  'De los 191, 133 eran para ahorristas AL DÍA — el fallo evitó el papelón. '
  'Antes de revivirla hay que arreglar la selección y el cálculo de deuda, que '
  'venía en 0 en los 191 casos.';
