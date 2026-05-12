import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, DollarSign, Phone, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { COLORES_TIPO, TIPO_LABEL } from '../../lib/constants'
import { Skeleton, Tabs } from '../../components/ui'
import { useNavigate } from 'react-router-dom'

function formatMoney(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

interface OpConSaldo {
  id: string
  numero_operacion: string | null
  cliente_nombre: string | null
  cliente_telefono: string | null
  tipo_operacion: string
  sucursal: string
  saldo_cliente: number
  saldo_pagado: boolean
  banco_saldo_cancelado: boolean | null
  estado_actual: string
  created_at: string
  pagos_saldo: { monto: number }[]
}

/** Una operación cuenta como saldada si:
 *   - tiene saldo_pagado=true (marca explícita desde DetalleOperacion), o
 *   - tiene banco_saldo_cancelado=true (banco cubrió el saldo), o
 *   - los pagos parciales suman >= saldo_cliente.
 * Cualquiera de los tres → no aparece en "Deben saldo". */
function estaSaldada(o: OpConSaldo): boolean {
  if (o.saldo_pagado) return true
  if (o.banco_saldo_cancelado) return true
  const pagado = o.pagos_saldo?.reduce((s, p) => s + Number(p.monto), 0) ?? 0
  return pagado >= o.saldo_cliente
}

export function SaldosPendientes() {
  const navigate = useNavigate()
  const [sucursalTab, setSucursalTab] = useState<'Rio Grande' | 'Ushuaia' | 'todas'>('Rio Grande')
  const [filtroMes, setFiltroMes] = useState<string>('') // 'YYYY-MM' o '' = todos

  const { data: operaciones, isLoading } = useQuery({
    queryKey: ['saldos-pendientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operaciones')
        .select(`
          id, numero_operacion, cliente_nombre, cliente_telefono,
          tipo_operacion, sucursal, saldo_cliente, saldo_pagado, banco_saldo_cancelado, estado_actual, created_at,
          pagos_saldo ( monto )
        `)
        .gt('saldo_cliente', 0)
        .neq('estado_actual', 'caida')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as OpConSaldo[]
    },
  })

  const todasOps = operaciones ?? []

  // Filtros aplicados en cliente (sucursal + mes)
  const ops = todasOps.filter(o => {
    if (sucursalTab !== 'todas' && o.sucursal !== sucursalTab) return false
    if (filtroMes && o.created_at?.slice(0, 7) !== filtroMes) return false
    return true
  })

  // Conteos por sucursal (sobre el universo con filtro de mes aplicado, sin sucursal)
  const baseConteos = todasOps.filter(o =>
    !filtroMes || o.created_at?.slice(0, 7) === filtroMes,
  )
  const conteosSucursal = {
    'Rio Grande': baseConteos.filter(o => o.sucursal === 'Rio Grande').length,
    'Ushuaia':    baseConteos.filter(o => o.sucursal === 'Ushuaia').length,
    'todas':      baseConteos.length,
  }

  const conDeuda = ops.filter(o => !estaSaldada(o))
  const saldados = ops.filter(estaSaldada)

  const totalPendiente = conDeuda.reduce((sum, o) => {
    const pagado = o.pagos_saldo?.reduce((s, p) => s + Number(p.monto), 0) ?? 0
    return sum + (o.saldo_cliente - pagado)
  }, 0)

  if (isLoading) return <Skeleton className="h-64" />

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <DollarSign className="h-6 w-6 text-action" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Saldos pendientes</h1>
          <p className="text-sm text-text-secondary">
            {conDeuda.length} cliente{conDeuda.length !== 1 ? 's' : ''} con saldo pendiente
            {totalPendiente > 0 && ` — Total: ${formatMoney(totalPendiente)}`}
          </p>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'Rio Grande', label: `Río Grande (${conteosSucursal['Rio Grande']})` },
          { id: 'Ushuaia',    label: `Ushuaia (${conteosSucursal.Ushuaia})` },
          { id: 'todas',      label: `Todas (${conteosSucursal.todas})` },
        ]}
        activeTab={sucursalTab}
        onChange={(id) => setSucursalTab(id as 'Rio Grande' | 'Ushuaia' | 'todas')}
        className="mb-4"
      />

      <div className="flex items-center gap-2 mb-6">
        <label className="text-xs text-text-muted">Mes de carga:</label>
        <input
          type="month"
          value={filtroMes}
          onChange={e => setFiltroMes(e.target.value)}
          max={new Date().toISOString().slice(0, 7)}
          className="px-3 py-1.5 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary"
          title="Filtrar por mes de creación de la operación"
        />
        {filtroMes && (
          <button
            onClick={() => setFiltroMes('')}
            className="p-1.5 text-text-muted hover:text-text-primary border border-border rounded-lg cursor-pointer"
            title="Limpiar filtro"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Clientes que deben */}
      {conDeuda.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-400" />
          <p className="text-lg font-semibold">Sin saldos pendientes</p>
          <p className="text-sm">Todos los clientes tienen su saldo cubierto</p>
        </div>
      )}

      {conDeuda.length > 0 && (
        <div className="space-y-3 mb-8">
          <h2 className="text-xs font-semibold text-red-500 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Deben saldo ({conDeuda.length})
          </h2>
          {conDeuda.map(o => {
            const pagado = o.pagos_saldo?.reduce((s, p) => s + Number(p.monto), 0) ?? 0
            const pendiente = o.saldo_cliente - pagado
            const pct = Math.round((pagado / o.saldo_cliente) * 100)
            return (
              <div
                key={o.id}
                onClick={() => navigate(`/operaciones/${o.id}`)}
                className="bg-bg-secondary border border-red-500/30 rounded-xl p-4 cursor-pointer hover:border-red-500/60 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{o.cliente_nombre || 'Sin nombre'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${COLORES_TIPO[o.tipo_operacion as keyof typeof COLORES_TIPO] || 'bg-gray-100 text-gray-600'}`}>
                        {TIPO_LABEL[o.tipo_operacion as keyof typeof TIPO_LABEL] || o.tipo_operacion}
                      </span>
                      <span className="text-xs text-text-muted">{o.sucursal}</span>
                      {o.numero_operacion && (
                        <span className="text-xs text-text-muted">#{o.numero_operacion}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600">{formatMoney(pendiente)}</p>
                    <p className="text-xs text-text-muted">pendiente</p>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-bg-tertiary rounded-full h-2">
                    <div
                      className="bg-green-500 rounded-full h-2 transition-all"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-muted">{pct}%</span>
                </div>

                <div className="flex items-center justify-between mt-2 text-xs text-text-muted">
                  <span>Pagado: {formatMoney(pagado)} / {formatMoney(o.saldo_cliente)}</span>
                  {o.cliente_telefono && (
                    <a
                      href={`https://wa.me/${o.cliente_telefono.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 text-green-600 hover:text-green-500"
                    >
                      <Phone className="h-3 w-3" /> WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Saldados */}
      {saldados.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-green-500 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Saldados ({saldados.length})
          </h2>
          {saldados.map(o => (
            <div
              key={o.id}
              onClick={() => navigate(`/operaciones/${o.id}`)}
              className="bg-bg-secondary border border-green-500/20 rounded-xl p-3 cursor-pointer hover:border-green-500/40 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">{o.cliente_nombre || 'Sin nombre'}</p>
                <span className="text-xs text-text-muted">{o.sucursal}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-green-600">{formatMoney(o.saldo_cliente)}</p>
                <p className="text-xs text-green-500">Pagado</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
