-- 032 · Cerrar las diez tablas que faltaban, por sucursal (tramo 2 de 2).
-- APLICADA EN PRODUCCIÓN el 15/09/2026 vía MCP. Este archivo versiona el estado.
--
-- Regla elegida: cada asesor ve y trabaja los registros de SU sucursal; director
-- y los roles transversales (sucursal 'Ambas': gestor y calidad) ven todo.
-- Se eligió sucursal y no vendedor_id porque si un asesor está de franco, el
-- compañero de la misma sucursal tiene que poder atender a su cliente.
--
-- Escritura con el MISMO alcance que la lectura. La idea original era dejarla
-- solo para director y cobranzas, pero el código la contradice: la app escribe
-- en las diez tablas, y en `ahorristas` hay doce lugares que insertan o
-- actualizan. Restringir la escritura habría dejado a los asesores sin poder
-- cargar ni editar un ahorrista.
--
-- Los valores coinciden entre tablas, que era el riesgo real de este diseño:
-- usuarios.sucursal usa 'Ushuaia' / 'Rio Grande' / 'Ambas' y ahorristas.sucursal
-- usa 'Ushuaia' (124) / 'Rio Grande' (157). Sin nulos.
create or replace function public.alcanza_sucursal(p_sucursal text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select case
    when public.get_user_role() = 'director' then true
    when public.get_user_sucursal() = 'Ambas' then true
    when p_sucursal is null then true
    else p_sucursal = public.get_user_sucursal()
  end;
$fn$;

revoke execute on function public.alcanza_sucursal(text) from public, anon;
grant execute on function public.alcanza_sucursal(text) to authenticated;

-- Tablas con sucursal propia
drop policy if exists "ahorristas_por_sucursal" on public.ahorristas;
create policy "ahorristas_por_sucursal" on public.ahorristas for all to authenticated
  using (public.alcanza_sucursal(sucursal))
  with check (public.alcanza_sucursal(sucursal));
alter table public.ahorristas enable row level security;

drop policy if exists "grupos_ahorro_por_sucursal" on public.grupos_ahorro;
create policy "grupos_ahorro_por_sucursal" on public.grupos_ahorro for all to authenticated
  using (public.alcanza_sucursal(sucursal))
  with check (public.alcanza_sucursal(sucursal));
alter table public.grupos_ahorro enable row level security;

drop policy if exists "garantias_clientes_por_sucursal" on public.garantias_clientes;
create policy "garantias_clientes_por_sucursal" on public.garantias_clientes for all to authenticated
  using (public.alcanza_sucursal(sucursal))
  with check (public.alcanza_sucursal(sucursal));
alter table public.garantias_clientes enable row level security;

drop policy if exists "garantias_expedientes_por_sucursal" on public.garantias_expedientes;
create policy "garantias_expedientes_por_sucursal" on public.garantias_expedientes for all to authenticated
  using (public.alcanza_sucursal(sucursal))
  with check (public.alcanza_sucursal(sucursal));
alter table public.garantias_expedientes enable row level security;

drop policy if exists "siniestros_clientes_por_sucursal" on public.siniestros_clientes;
create policy "siniestros_clientes_por_sucursal" on public.siniestros_clientes for all to authenticated
  using (public.alcanza_sucursal(sucursal))
  with check (public.alcanza_sucursal(sucursal));
alter table public.siniestros_clientes enable row level security;

drop policy if exists "siniestros_expedientes_por_sucursal" on public.siniestros_expedientes;
create policy "siniestros_expedientes_por_sucursal" on public.siniestros_expedientes for all to authenticated
  using (public.alcanza_sucursal(sucursal))
  with check (public.alcanza_sucursal(sucursal));
alter table public.siniestros_expedientes enable row level security;

-- Tablas hijas: heredan el alcance del padre. El subselect corre con los
-- permisos de quien consulta, así que la RLS del padre se aplica sola y no hay
-- que repetir la regla de sucursal en cada una.
drop policy if exists "pagos_saldo_hereda_operacion" on public.pagos_saldo;
create policy "pagos_saldo_hereda_operacion" on public.pagos_saldo for all to authenticated
  using (exists (select 1 from public.operaciones o where o.id = pagos_saldo.operacion_id))
  with check (exists (select 1 from public.operaciones o where o.id = pagos_saldo.operacion_id));
alter table public.pagos_saldo enable row level security;

drop policy if exists "gestiones_mora_hereda_ahorrista" on public.gestiones_mora;
create policy "gestiones_mora_hereda_ahorrista" on public.gestiones_mora for all to authenticated
  using (exists (select 1 from public.ahorristas a where a.id = gestiones_mora.ahorrista_id))
  with check (exists (select 1 from public.ahorristas a where a.id = gestiones_mora.ahorrista_id));
alter table public.gestiones_mora enable row level security;

drop policy if exists "garantias_repuestos_hereda_expediente" on public.garantias_repuestos;
create policy "garantias_repuestos_hereda_expediente" on public.garantias_repuestos for all to authenticated
  using (exists (select 1 from public.garantias_expedientes e where e.id = garantias_repuestos.expediente_id))
  with check (exists (select 1 from public.garantias_expedientes e where e.id = garantias_repuestos.expediente_id));
alter table public.garantias_repuestos enable row level security;

drop policy if exists "siniestros_repuestos_hereda_expediente" on public.siniestros_repuestos;
create policy "siniestros_repuestos_hereda_expediente" on public.siniestros_repuestos for all to authenticated
  using (exists (select 1 from public.siniestros_expedientes e where e.id = siniestros_repuestos.expediente_id))
  with check (exists (select 1 from public.siniestros_expedientes e where e.id = siniestros_repuestos.expediente_id));
alter table public.siniestros_repuestos enable row level security;

-- Verificado en producción con usuarios reales:
--   · asesor_ush (Ana Castillo, Ushuaia) .......... 124 ahorristas
--   · asesor_rg  (Hernán Videla, Río Grande) ...... 157 ahorristas
--   · gestor cobranzas (Silvana Videla, Ambas) .... 281 ahorristas
--   · asesor de Ushuaia editando filas de Río Grande → 0 filas modificadas
