-- 031 · Cerrar tablas abiertas (tramo 1 de 2). Riesgo cero.
-- APLICADA EN PRODUCCIÓN el 15/09/2026 vía MCP. Este archivo versiona el estado.
--
-- Punto de partida: 15 tablas de esta base tenían RLS apagado, o sea que
-- cualquiera con la clave pública —la que viaja en el JavaScript del navegador—
-- podía leer y MODIFICAR todas sus filas. Entre ellas `usuarios`: un visitante
-- anónimo podía hacerse director.
--
-- El caso `usuarios` es distinto al resto: 002_rls.sql le había puesto RLS y
-- cinco policies, y alguien lo apagó después a mano (ninguna migración lo hace).
-- El motivo se ve en el código: AhorristasPage, NuevaOperacion y BusquedaCliente
-- listan a TODOS los usuarios para el desplegable de vendedor, y con esas cinco
-- policies un asesor veía la lista vacía y no podía cargar una operación. Lo que
-- faltaba era una policy de directorio, no apagar la seguridad.
--
-- `usuarios` no guarda nada sensible: id, email interno, nombre, rol, sucursal,
-- activo y avatar. Que el equipo se vea entre sí es lo normal; lo que se corta
-- es la ESCRITURA, que queda solo para director.
drop policy if exists "usuarios_select_directorio" on public.usuarios;
create policy "usuarios_select_directorio"
  on public.usuarios for select to authenticated
  using (true);

alter table public.usuarios enable row level security;

-- Sin una sola referencia en src/ y sin filas: se cierran del todo, como
-- avisos_whatsapp en la 030. Si alguna se empieza a usar, primero su policy.
alter table public.cuotas_ahorro enable row level security;
alter table public.adjudicacion_eventos enable row level security;
alter table public.importaciones enable row level security;

comment on table public.cuotas_ahorro is
  'Cerrada el 15/09/2026: RLS sin policies. Sin uso en el código y sin filas.';
comment on table public.adjudicacion_eventos is
  'Cerrada el 15/09/2026: RLS sin policies. Sin uso en el código y sin filas.';
comment on table public.importaciones is
  'Cerrada el 15/09/2026: RLS sin policies. Sin uso en el código y sin filas.';

-- Verificado en producción después de aplicar:
--   · authenticated ve el directorio de 37 usuarios → los desplegables siguen andando.
--   · anon ve 0 filas de usuarios → la clave pública ya no entra.
--   · un authenticated que no es director intentó `update usuarios set rol='director'`
--     sobre todos los activos: modificó 0 filas. Antes lo lograba, y un anónimo también.
--
-- Queda pendiente el tramo 2, que necesita diseñar policies por rol:
--   · ahorristas (281 filas) y pagos_saldo (125) — la exposición real de datos.
--   · grupos_ahorro, gestiones_mora y las seis de garantías/siniestros, hoy vacías.
