import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, ExternalLink } from 'lucide-react'
import { supabase, supabaseAnon } from '../../lib/supabase'
import { SUCURSALES_SELECT } from '../../lib/constants'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'
import { notify } from '../../components/ui/Toast'

type FiltroEstado = 'todas' | 'pendiente' | 'enviada'
type FiltroBanco = 'todos' | 'Santander Río' | 'FIAT Crédito' | 'Galicia' | 'Otro'

export function ControlPrendas() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas')
  const [filtroBanco, setFiltroBanco] = useState<FiltroBanco>('todos')
  const [filtroSucursal, setFiltroSucursal] = useState('todas')

  const { data, isLoading } = useQuery({
    queryKey: ['prendas', filtroEstado, filtroBanco, filtroSucursal],
    queryFn: async () => {
      let q = supabaseAnon
        .from('operaciones')
        .select(`
          id, numero_operacion, sucursal, tipo_operacion, forma_pago,
          cliente_nombre, banco_entidad, estado_prenda, fecha_envio_prenda,
          estado_actual, created_at,
          unidades (modelo)
        `)
        .in('forma_pago', ['financiado_banco', 'plan_ahorro'])
        .not('estado_actual', 'in', '("caida")')
        .order('created_at', { ascending: false })

      if (filtroEstado !== 'todas') q = q.eq('estado_prenda', filtroEstado)
      if (filtroBanco !== 'todos') q = q.eq('banco_entidad', filtroBanco)
      if (filtroSucursal !== 'todas') q = q.eq('sucursal', filtroSucursal)

      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  const marcarEnviada = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('operaciones')
        .update({ estado_prenda: 'enviada', fecha_envio_prenda: new Date().toISOString().split('T')[0] })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prendas'] })
      notify.success('Prenda marcada como enviada')
    },
    onError: (e: any) => notify.error(e.message),
  })

  const diasPendiente = (createdAt: string) => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <CreditCard className="h-5 w-5" /> Control de Prendas
        </h1>
        <p className="text-sm text-text-secondary">Operaciones financiadas que requieren gestión de prenda</p>
      </div>

      {/* Filtros */}
      <div className="bg-bg-secondary rounded-xl border border-border p-4 mb-4 flex flex-wrap gap-2">
        {(['todas', 'pendiente', 'enviada'] as FiltroEstado[]).map(f => (
          <button key={f} onClick={() => setFiltroEstado(f)}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors cursor-pointer ${
              filtroEstado === f ? 'bg-action text-white' : 'bg-bg-primary text-text-secondary hover:bg-bg-tertiary'
            }`}>
            {f === 'todas' ? 'Todas' : f === 'pendiente' ? '🔴 Pendientes' : '🟢 Enviadas'}
          </button>
        ))}
        <select value={filtroBanco} onChange={e => setFiltroBanco(e.target.value as FiltroBanco)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-bg-primary text-text-secondary focus:outline-none">
          <option value="todos">Todos los bancos</option>
          {['Santander Río','FIAT Crédito','Galicia','Otro'].map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filtroSucursal} onChange={e => setFiltroSucursal(e.target.value)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-bg-primary text-text-secondary focus:outline-none">
          <option value="todas">Todas las sucursales</option>
          {SUCURSALES_SELECT.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <LoadingSkeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : !data?.length ? (
        <EmptyState icon={<CreditCard className="h-12 w-12" />} title="Sin prendas" description="No hay operaciones con los filtros seleccionados" />
      ) : (
        <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-xs text-text-muted uppercase tracking-wide">
                <th className="text-left p-3">Operación</th>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Tipo / Banco</th>
                <th className="text-left p-3">Paso actual</th>
                <th className="text-left p-3">Días pendiente</th>
                <th className="text-left p-3">Prenda</th>
                <th className="text-left p-3">Sucursal</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map(op => {
                const dias = diasPendiente(op.created_at)
                const modelo = (op.unidades as any)?.[0]?.modelo || '—'
                return (
                  <tr key={op.id} className="hover:bg-bg-tertiary transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-text-primary">{op.numero_operacion}</div>
                      <div className="text-xs text-text-muted">{modelo}</div>
                    </td>
                    <td className="p-3 text-text-secondary">{op.cliente_nombre || '—'}</td>
                    <td className="p-3">
                      <div className="text-text-secondary">{op.tipo_operacion === 'plan_ahorro' ? 'Plan de Ahorro' : 'Financiado'}</div>
                      {op.banco_entidad && <div className="text-xs text-text-muted">{op.banco_entidad}</div>}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-bg-primary text-text-secondary border border-border">
                        {op.estado_actual}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`font-medium ${dias > 30 ? 'text-red-600' : dias > 15 ? 'text-yellow-600' : 'text-text-secondary'}`}>
                        {dias}d
                      </span>
                    </td>
                    <td className="p-3">
                      {op.estado_prenda === 'enviada' ? (
                        <span className="text-green-600 font-medium text-xs">🟢 Enviada{op.fecha_envio_prenda ? ` (${op.fecha_envio_prenda})` : ''}</span>
                      ) : (
                        <button
                          onClick={() => marcarEnviada.mutate(op.id)}
                          disabled={marcarEnviada.isPending}
                          className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          🔴 Marcar enviada
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-text-muted text-xs">{op.sucursal}</td>
                    <td className="p-3">
                      <button onClick={() => navigate(`/operaciones/${op.id}`)}
                        className="p-1 text-text-muted hover:text-action transition-colors cursor-pointer">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
