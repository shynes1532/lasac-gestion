import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, DollarSign, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { COLORES_TIPO, TIPO_LABEL } from '../../lib/constants'
import { Skeleton } from '../../components/ui'
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
  estado_actual: string
  pagos_saldo: { monto: number }[]
}

export function SaldosPendientes() {
  const navigate = useNavigate()

  const { data: operaciones, isLoading } = useQuery({
    queryKey: ['saldos-pendientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operaciones')
        .select(`
          id, numero_operacion, cliente_nombre, cliente_telefono,
          tipo_operacion, sucursal, saldo_cliente, saldo_pagado, estado_actual,
          pagos_saldo ( monto )
        `)
        .gt('saldo_cliente', 0)
        .neq('estado_actual', 'caida')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as OpConSaldo[]
    },
  })

  const ops = operaciones ?? []
  const conDeuda = ops.filter(o => {
    const pagado = o.pagos_saldo?.reduce((s, p) => s + Number(p.monto), 0) ?? 0
    return pagado < o.saldo_cliente
  })
  const saldados = ops.filter(o => {
    const pagado = o.pagos_saldo?.reduce((s, p) => s + Number(p.monto), 0) ?? 0
    return pagado >= o.saldo_cliente
  })

  const totalPendiente = conDeuda.reduce((sum, o) => {
    const pagado = o.pagos_saldo?.reduce((s, p) => s + Number(p.monto), 0) ?? 0
    return sum + (o.saldo_cliente - pagado)
  }, 0)

  if (isLoading) return <Skeleton className="h-64" />

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <DollarSign className="h-6 w-6 text-action" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Saldos pendientes</h1>
          <p className="text-sm text-text-secondary">
            {conDeuda.length} cliente{conDeuda.length !== 1 ? 's' : ''} con saldo pendiente
            {totalPendiente > 0 && ` — Total: ${formatMoney(totalPendiente)}`}
          </p>
        </div>
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
