import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Truck, ExternalLink, MessageCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { COLORES_TIPO, TIPO_LABEL, SUCURSALES_SELECT, waConfirmacion2dRG, waConfirmacion2dUSH } from '../../lib/constants'
import type { TipoOperacion } from '../../lib/types'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'

export function EntregasProgramadas() {
  const navigate = useNavigate()
  const [filtroSucursal, setFiltroSucursal] = useState('todas')

  const { data, isLoading } = useQuery({
    queryKey: ['entregas-programadas', filtroSucursal],
    queryFn: async () => {
      let q = supabase
        .from('operaciones')
        .select(`
          id, numero_operacion, cliente_nombre, cliente_telefono,
          sucursal, tipo_operacion, estado_actual, forma_pago,
          unidades (modelo),
          usuarios!asesor_id (nombre_completo),
          contactos_calidad (fecha_entrega_confirmada, estado_calidad)
        `)
        .in('estado_actual', ['calidad', 'entrega'])
        .order('created_at', { ascending: false })

      if (filtroSucursal !== 'todas') q = q.eq('sucursal', filtroSucursal)

      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Truck className="h-5 w-5" /> Entregas programadas
          </h1>
          <p className="text-sm text-text-secondary">Operaciones en Paso 5 y 6</p>
        </div>
        <div className="flex gap-2">
          <select value={filtroSucursal} onChange={e => setFiltroSucursal(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-bg-secondary text-text-secondary focus:outline-none">
            <option value="todas">Todas las sucursales</option>
            {SUCURSALES_SELECT.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <LoadingSkeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : !data?.length ? (
        <EmptyState icon={<Truck className="h-12 w-12" />} title="Sin entregas programadas" description="No hay operaciones en Paso 5 o 6 actualmente" />
      ) : (
        <div className="space-y-3">
          {data.map(op => {
            const tipo = op.tipo_operacion as TipoOperacion
            const colores = COLORES_TIPO[tipo] || COLORES_TIPO['0km']
            const modelo = (op.unidades as any)?.[0]?.modelo || '—'
            const asesor = (op.usuarios as any)?.nombre_completo || '—'
            const calidad = (op.contactos_calidad as any)?.[0]
            const fechaEntrega = calidad?.fecha_entrega_confirmada

            const waMsg = op.sucursal === 'Rio Grande'
              ? waConfirmacion2dRG(op.cliente_nombre || '', modelo, fechaEntrega || '—', '—', asesor)
              : waConfirmacion2dUSH(op.cliente_nombre || '', modelo, fechaEntrega || '—', '—', asesor)

            const waLink = `https://wa.me/${(op.cliente_telefono || '').replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}`

            return (
              <div key={op.id}
                className="bg-bg-secondary rounded-xl border border-border p-4 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex gap-3 min-w-0">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 h-fit mt-0.5"
                      style={{ backgroundColor: colores.bg, color: colores.text, border: `1px solid ${colores.border}` }}>
                      {TIPO_LABEL[tipo]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary">{op.cliente_nombre}</p>
                      <p className="text-sm text-text-secondary">{modelo}</p>
                      <p className="text-xs text-text-muted">{op.numero_operacion} · {op.sucursal} · {asesor}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {fechaEntrega ? (
                      <span className="text-sm font-semibold text-text-primary">{fechaEntrega}</span>
                    ) : (
                      <span className="text-xs text-text-muted">Sin fecha confirmada</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      op.estado_actual === 'entrega' ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {op.estado_actual === 'entrega' ? 'Paso 6' : 'Paso 5'}
                    </span>
                    <div className="flex gap-2">
                      {op.cliente_telefono && (
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors">
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                      <button onClick={() => navigate(`/operaciones/${op.id}`)}
                        className="p-1.5 text-text-muted hover:text-action transition-colors cursor-pointer">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
