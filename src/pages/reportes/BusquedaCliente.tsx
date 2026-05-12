import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, User, Car, Calendar, DollarSign, MapPin, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { TIPO_LABEL, ESTADO_LABEL } from '../../lib/constants'
import type { EstadoActual, TipoOperacion } from '../../lib/types'

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

interface OpRow {
  id: string
  numero_operacion: string
  sucursal: string
  tipo_operacion: TipoOperacion
  estado_actual: EstadoActual
  cliente_nombre: string | null
  cliente_telefono: string | null
  nro_epod: string | null
  nro_grupo_orden: string | null
  forma_pago: string | null
  banco_entidad: string | null
  fecha_compromiso: string | null
  fecha_entrega_real: string | null
  dias_totales: number | null
  valor_unidad: number | null
  valor_credito: number | null
  quebranto_monto: number | null
  quebranto_porcentaje: number | null
  saldo_cliente: number | null
  saldo_pagado: boolean
  fecha_cancelacion_total: string | null
  asesor_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  unidades: { modelo: string; vin_chasis: string; color: string | null; patente_nueva: string | null } | null
  pagos_saldo: { id: string; monto: number; forma_pago: string; fecha: string; numero_recibo: string | null; observacion: string | null }[]
}

const ESTADO_COLOR: Record<string, string> = {
  cierre: 'bg-blue-500/15 text-blue-300',
  documentacion: 'bg-yellow-500/15 text-yellow-300',
  gestoria: 'bg-purple-500/15 text-purple-300',
  alistamiento: 'bg-orange-500/15 text-orange-300',
  calidad: 'bg-cyan-500/15 text-cyan-300',
  entrega: 'bg-teal-500/15 text-teal-300',
  entregado: 'bg-green-500/15 text-green-300',
  caida: 'bg-red-500/15 text-red-300',
}

export function BusquedaCliente() {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const termino = busqueda.trim()
  const habilitada = termino.length >= 2

  const { data: ops, isLoading } = useQuery({
    queryKey: ['reportes-busqueda-cliente', termino],
    enabled: habilitada,
    queryFn: async () => {
      const b = termino
      const orFilter = [
        `cliente_nombre.ilike.%${b}%`,
        `cliente_telefono.ilike.%${b}%`,
        `numero_operacion.ilike.%${b}%`,
        `nro_epod.ilike.%${b}%`,
        `dominio_patente.ilike.%${b}%`,
      ].join(',')

      const { data, error } = await supabase
        .from('operaciones')
        .select(`
          id, numero_operacion, sucursal, tipo_operacion, estado_actual,
          cliente_nombre, cliente_telefono, nro_epod, nro_grupo_orden, forma_pago, banco_entidad,
          fecha_compromiso, fecha_entrega_real, dias_totales,
          valor_unidad, valor_credito, quebranto_monto, quebranto_porcentaje,
          saldo_cliente, saldo_pagado, fecha_cancelacion_total,
          asesor_id, created_by, created_at, updated_at,
          unidades ( modelo, vin_chasis, color, patente_nueva ),
          pagos_saldo ( id, monto, forma_pago, fecha, numero_recibo, observacion )
        `)
        .or(orFilter)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      // También buscar por VIN/patente en la tabla unidades y traer esas operaciones
      const { data: unids } = await supabase
        .from('unidades')
        .select('operacion_id')
        .or(`vin_chasis.ilike.%${b}%,patente_nueva.ilike.%${b}%`)
        .limit(20)

      const extraIds = (unids ?? [])
        .map(u => (u as any).operacion_id)
        .filter(id => id && !(data ?? []).some(d => d.id === id))

      if (extraIds.length > 0) {
        const { data: extras } = await supabase
          .from('operaciones')
          .select(`
            id, numero_operacion, sucursal, tipo_operacion, estado_actual,
            cliente_nombre, cliente_telefono, nro_epod, nro_grupo_orden, forma_pago, banco_entidad,
            fecha_compromiso, fecha_entrega_real, dias_totales,
            valor_unidad, valor_credito, quebranto_monto, quebranto_porcentaje,
            saldo_cliente, saldo_pagado, fecha_cancelacion_total,
            asesor_id, created_by, created_at, updated_at,
            unidades ( modelo, vin_chasis, color, patente_nueva ),
            pagos_saldo ( id, monto, forma_pago, fecha, numero_recibo, observacion )
          `)
          .in('id', extraIds)
        return [...(data ?? []), ...(extras ?? [])] as unknown as OpRow[]
      }

      // Normalizar `unidades` (Supabase devuelve array en relaciones 1-N)
      return (data ?? []).map((d: any) => ({
        ...d,
        unidades: Array.isArray(d.unidades) ? d.unidades[0] ?? null : d.unidades,
      })) as OpRow[]
    },
  })

  // IDs de usuario únicos (asesor + created_by) para traer nombres en una sola query
  const userIds = useMemo(() => {
    const s = new Set<string>()
    for (const o of ops ?? []) {
      if (o.asesor_id) s.add(o.asesor_id)
      if (o.created_by) s.add(o.created_by)
    }
    return Array.from(s)
  }, [ops])

  const { data: usuarios } = useQuery({
    queryKey: ['reportes-busqueda-usuarios', userIds.sort().join(',')],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre_completo, rol, sucursal')
        .in('id', userIds)
      if (error) throw error
      return data ?? []
    },
  })

  const userMap = useMemo(() => {
    const m = new Map<string, { nombre: string; rol: string; sucursal: string }>()
    for (const u of usuarios ?? []) {
      m.set(u.id, { nombre: u.nombre_completo, rol: u.rol, sucursal: u.sucursal })
    }
    return m
  }, [usuarios])

  // Lista normalizada — mismas operaciones que ya vinieron, pero con unidades aplanada
  const filas = useMemo(() => {
    return (ops ?? []).map(o => ({
      ...o,
      unidades: Array.isArray(o.unidades) ? (o.unidades as any)[0] ?? null : o.unidades,
    }))
  }, [ops])

  function toggle(id: string) {
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  return (
    <div>
      <div className="text-center mb-6 print:mb-4">
        <h2 className="text-lg font-bold">LIENDO AUTOMOTORES S.A. — FIAT</h2>
        <p className="text-sm text-text-muted">Búsqueda histórica de operaciones</p>
      </div>

      {/* Buscador — se oculta al imprimir */}
      <div className="print:hidden mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Nombre, teléfono, N° operación, ePOD, VIN o patente..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-bg-secondary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-action/30"
          />
        </div>
        <p className="text-xs text-text-muted mt-1.5">
          Mínimo 2 caracteres. Busca en operaciones activas, entregadas y caídas.
        </p>
      </div>

      {!habilitada && (
        <p className="text-center text-text-muted py-12 text-sm">
          Empezá a escribir para buscar
        </p>
      )}

      {habilitada && isLoading && (
        <p className="text-center text-text-muted py-12 text-sm">Buscando…</p>
      )}

      {habilitada && !isLoading && filas.length === 0 && (
        <p className="text-center text-text-muted py-12 text-sm">
          Sin resultados para "{termino}"
        </p>
      )}

      {filas.length > 0 && (
        <p className="text-xs text-text-muted mb-2 print:hidden">
          {filas.length} {filas.length === 1 ? 'resultado' : 'resultados'}
        </p>
      )}

      <div className="space-y-2">
        {filas.map(o => {
          const isOpen = expanded.has(o.id)
          const asesor = o.asesor_id ? userMap.get(o.asesor_id) : null
          const creador = o.created_by ? userMap.get(o.created_by) : null
          const totalPagado = (o.pagos_saldo ?? []).reduce((s, p) => s + Number(p.monto), 0)
          const pendiente = Math.max(0, (o.saldo_cliente ?? 0) - totalPagado)
          const unidad = o.unidades

          return (
            <div key={o.id} className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
              {/* Header — siempre visible */}
              <button
                onClick={() => toggle(o.id)}
                className="w-full p-3 flex items-start justify-between gap-3 hover:bg-bg-tertiary/50 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-1 text-text-muted">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">{o.cliente_nombre || '—'}</span>
                      <span className="text-xs text-text-muted font-mono">{o.numero_operacion}</span>
                      {o.nro_epod && <span className="text-xs text-text-muted">ePOD: {o.nro_epod}</span>}
                    </div>
                    <p className="text-xs text-text-muted truncate">
                      {TIPO_LABEL[o.tipo_operacion] || o.tipo_operacion} · {unidad?.modelo || 'Sin unidad'} · {o.sucursal}
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded uppercase ${ESTADO_COLOR[o.estado_actual] || 'bg-bg-tertiary text-text-muted'}`}>
                  {ESTADO_LABEL[o.estado_actual as EstadoActual] || o.estado_actual}
                </span>
              </button>

              {/* Detalle expandido */}
              {isOpen && (
                <div className="border-t border-border p-4 space-y-4 text-xs">
                  {/* Resumen */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Columna 1 — Cliente y venta */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase text-text-muted mb-1 flex items-center gap-1">
                        <User className="h-3 w-3" /> Cliente y venta
                      </h4>
                      <div className="space-y-1">
                        <p><span className="text-text-muted">Cliente:</span> <strong>{o.cliente_nombre || '—'}</strong></p>
                        <p><span className="text-text-muted">Teléfono:</span> {o.cliente_telefono || '—'}</p>
                        <p><span className="text-text-muted">Sucursal:</span> {o.sucursal}</p>
                        <p><span className="text-text-muted">Tipo:</span> {TIPO_LABEL[o.tipo_operacion] || o.tipo_operacion}</p>
                        <p><span className="text-text-muted">Forma de pago:</span> {o.forma_pago || '—'}</p>
                        {o.banco_entidad && <p><span className="text-text-muted">Banco:</span> {o.banco_entidad}</p>}
                        {o.nro_grupo_orden && <p><span className="text-text-muted">Grupo / Orden:</span> {o.nro_grupo_orden}</p>}
                        <p><span className="text-text-muted">N° operación:</span> <span className="font-mono">{o.numero_operacion}</span></p>
                        {o.nro_epod && <p><span className="text-text-muted">ePOD:</span> <span className="font-mono">{o.nro_epod}</span></p>}
                      </div>

                      <h4 className="text-[10px] font-bold uppercase text-text-muted mb-1 mt-3 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Equipo
                      </h4>
                      <div className="space-y-1">
                        <p>
                          <span className="text-text-muted">Vendedor (asesor):</span>{' '}
                          <strong>{asesor ? asesor.nombre : <span className="text-text-muted italic">Sin asignar</span>}</strong>
                          {asesor && <span className="text-text-muted"> · {asesor.sucursal}</span>}
                        </p>
                        <p>
                          <span className="text-text-muted">Cargó la operación:</span>{' '}
                          <strong>{creador ? creador.nombre : <span className="text-text-muted italic">—</span>}</strong>
                          {creador && <span className="text-text-muted"> · {creador.rol}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Columna 2 — Vehículo + fechas */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase text-text-muted mb-1 flex items-center gap-1">
                        <Car className="h-3 w-3" /> Vehículo
                      </h4>
                      <div className="space-y-1">
                        <p><span className="text-text-muted">Modelo:</span> <strong>{unidad?.modelo || '—'}</strong></p>
                        <p><span className="text-text-muted">VIN:</span> <span className="font-mono">{unidad?.vin_chasis || '—'}</span></p>
                        {unidad?.color && <p><span className="text-text-muted">Color:</span> {unidad.color}</p>}
                        <p><span className="text-text-muted">Patente:</span> <span className="font-mono">{unidad?.patente_nueva || '—'}</span></p>
                      </div>

                      <h4 className="text-[10px] font-bold uppercase text-text-muted mb-1 mt-3 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Fechas clave
                      </h4>
                      <div className="space-y-1">
                        <p><span className="text-text-muted">Carga de la operación:</span> {fmtDateTime(o.created_at)}</p>
                        <p><span className="text-text-muted">Compromiso de entrega:</span> {fmtDate(o.fecha_compromiso)}</p>
                        <p><span className="text-text-muted">Entrega real:</span> {fmtDate(o.fecha_entrega_real)}</p>
                        {o.dias_totales != null && <p><span className="text-text-muted">Días totales:</span> {o.dias_totales}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Financiero */}
                  <div className="border-t border-border pt-3">
                    <h4 className="text-[10px] font-bold uppercase text-text-muted mb-2 flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Financiero
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {o.valor_unidad != null && (
                        <div className="bg-bg-tertiary/50 rounded p-2">
                          <p className="text-[10px] text-text-muted">Valor unidad</p>
                          <p className="font-semibold">{fmt(o.valor_unidad)}</p>
                        </div>
                      )}
                      {o.valor_credito != null && (
                        <div className="bg-bg-tertiary/50 rounded p-2">
                          <p className="text-[10px] text-text-muted">Crédito aprobado</p>
                          <p className="font-semibold">{fmt(o.valor_credito)}</p>
                        </div>
                      )}
                      {o.quebranto_monto != null && (
                        <div className="bg-bg-tertiary/50 rounded p-2">
                          <p className="text-[10px] text-text-muted">Quebranto ({o.quebranto_porcentaje ?? 0}%)</p>
                          <p className="font-semibold text-red-400">– {fmt(o.quebranto_monto)}</p>
                        </div>
                      )}
                      {o.saldo_cliente != null && o.saldo_cliente > 0 && (
                        <>
                          <div className="bg-bg-tertiary/50 rounded p-2">
                            <p className="text-[10px] text-text-muted">Saldo total cliente</p>
                            <p className="font-semibold">{fmt(o.saldo_cliente)}</p>
                          </div>
                          <div className="bg-bg-tertiary/50 rounded p-2">
                            <p className="text-[10px] text-text-muted">Total pagado</p>
                            <p className="font-semibold text-green-400">{fmt(totalPagado)}</p>
                          </div>
                          <div className="bg-bg-tertiary/50 rounded p-2">
                            <p className="text-[10px] text-text-muted">Pendiente</p>
                            <p className={`font-semibold ${pendiente > 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {fmt(pendiente)}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {o.fecha_cancelacion_total && (
                      <p className="mt-2 text-text-muted">
                        Saldo cancelado el {fmtDate(o.fecha_cancelacion_total)}
                      </p>
                    )}

                    {/* Pagos detallados */}
                    {(o.pagos_saldo ?? []).length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Pagos registrados</p>
                        <table className="w-full text-[11px] border-collapse">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-1">Recibo</th>
                              <th className="text-left py-1">Fecha</th>
                              <th className="text-left py-1">Método</th>
                              <th className="text-left py-1">Observación</th>
                              <th className="text-right py-1">Monto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {[...o.pagos_saldo].sort((a, b) => a.fecha.localeCompare(b.fecha)).map(p => (
                              <tr key={p.id}>
                                <td className="py-1 font-mono">{p.numero_recibo || '—'}</td>
                                <td className="py-1">{fmtDate(p.fecha)}</td>
                                <td className="py-1 capitalize">{p.forma_pago}</td>
                                <td className="py-1 text-text-muted">{p.observacion || ''}</td>
                                <td className="py-1 text-right font-semibold">{fmt(Number(p.monto))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Link al detalle completo de la operación */}
                  <div className="border-t border-border pt-3 print:hidden">
                    <button
                      onClick={() => navigate(`/operaciones/${o.id}`)}
                      className="text-xs text-action hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Abrir ficha completa de la operación
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
