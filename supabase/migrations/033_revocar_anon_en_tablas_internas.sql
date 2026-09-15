-- 033 · Segunda capa: sacarle a `anon` el permiso de tabla.
-- APLICADA EN PRODUCCIÓN el 15/09/2026 vía MCP. Este archivo versiona el estado.
--
-- La RLS de las migraciones 030 a 032 ya bloquea a anon por falta de policies,
-- pero el permiso de tabla seguía otorgado y conviene cerrarlo también: anon
-- tenía INSERT, UPDATE, DELETE y TRUNCATE en las quince. El caso más feo era
-- `ahorristas`: anon no podía leerla —alguien le había revocado el SELECT— pero
-- sí podía BORRAR las 281 filas. Ninguna pantalla de la app funciona sin login,
-- así que anon no necesita nada de esto.
revoke all on public.usuarios from anon;
revoke all on public.ahorristas from anon;
revoke all on public.pagos_saldo from anon;
revoke all on public.grupos_ahorro from anon;
revoke all on public.cuotas_ahorro from anon;
revoke all on public.gestiones_mora from anon;
revoke all on public.adjudicacion_eventos from anon;
revoke all on public.importaciones from anon;
revoke all on public.avisos_whatsapp from anon;
revoke all on public.garantias_clientes from anon;
revoke all on public.garantias_expedientes from anon;
revoke all on public.garantias_repuestos from anon;
revoke all on public.siniestros_clientes from anon;
revoke all on public.siniestros_expedientes from anon;
revoke all on public.siniestros_repuestos from anon;

-- Contracara: a `authenticated` le faltaba el SELECT en ahorristas (revocado
-- junto con el de anon en su momento). Ahora quién ve qué lo decide la RLS por
-- sucursal, así que el permiso de tabla vuelve.
grant select on public.ahorristas to authenticated;
