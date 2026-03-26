import { useQuery } from '@tanstack/react-query'
import {
  PieChart, Users, Award, XCircle, ArrowRightLeft, AlertTriangle,
  Phone, Mail, Skull, Clock,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Ahorrista, GrupoAhorro, EstadoAhorrista } from '../../lib/types'
import { ESTADOS_AHORRISTA, ESTADOS_GRUPO, REGLAS_FIAT_PLAN } from '../../lib/constants'
import { Skeleton } from '../../components/ui'
import { useNavigate } from 'react-router-dom'

function formatMoney(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

export function CarteraPage() {
  const navigate = useNavigate()

  const { data: ahorristas, isLoading: loadingA } = useQuery({
    queryKey: ['cartera-ahorristas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ahorristas')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Ahorrista[]
    },
  })

  const { data: grupos, isLoading: loadingG } = useQuery({
    queryKey: ['cartera-grupos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grupos_ahorro')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as GrupoAhorro[]
    },
  })

  if (loadingA || loadingG) return <Skeleton className="h-64" />

  const all = ahorristas ?? []
  const allGrupos = grupos ?? []

  // Conteos por estado
  const countEstado = (e: EstadoAhorrista) => all.filter(a => a.estado === e).length
  const activos = countEstado('activo')
  const adjudicados = countEstado('adjudicado')
  const entregados = countEstado('entregado')
  const renunciados = countEstado('renunciado')
  const rescindidos = countEstado('rescindido')
  const transferidos = countEstado('transferido')

  // Alertas críticas
  const enRiesgoRescision = all.filter(a => a.en_riesgo_rescision && a.estado === 'activo')
  const adjSinIntegrarH = all.filter(a => a.adjudicado && !a.integracion_completa && a.tipo_plan === 'H' && a.estado === 'adjudicado')
  const adjPendienteRetiro = all.filter(a => a.adjudicado && !a.vehiculo_retirado && a.integracion_completa && a.estado === 'adjudicado')

  // Tasas
  const totalConHistoria = activos + adjudicados + entregados + renunciados + rescindidos + transferidos
  const tasaAdj = totalConHistoria > 0 ? Math.round(((adjudicados + entregados) / totalConHistoria) * 100) : 0
  const tasaDesercion = totalConHistoria > 0 ? Math.round(((renunciados + rescindidos) / totalConHistoria) * 100) : 0

  // Grupos activos
  const gruposActivos = allGrupos.filter(g => g.estado === 'activo')

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6">
        <PieChart className="h-6 w-6 text-action" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Cartera de Ahorro</h1>
          <p className="text-sm text-text-secondary">Visión general del portfolio FIAT Plan</p>
        </div>
      </div>

      {/* Alertas críticas */}
      {(enRiesgoRescision.length > 0 || adjSinIntegrarH.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {enRiesgoRescision.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 cursor-pointer hover:border-red-500/50 transition-colors"
              onClick={() => navigate('/mora')}>
              <div className="flex items-center gap-2 mb-2">
                <Skull className="h-5 w-5 text-red-400" />
                <p className="text-sm font-bold text-red-400">RIESGO RESCISIÓN</p>
              </div>
              <p className="text-2xl font-bold text-red-400">{enRiesgoRescision.length}</p>
              <p className="text-xs text-text-muted mt-1">clientes con 3+ cuotas impagas — atención inmediata</p>
              <div className="mt-2 space-y-1">
                {enRiesgoRescision.slice(0, 3).map(a => (
                  <p key={a.id} className="text-xs text-text-secondary">
                    {a.nombre_apellido} — {a.cuotas_impagas_total} impagas — Vendedor: {a.vendedor_nombre || '—'}
                  </p>
                ))}
                {enRiesgoRescision.length > 3 && (
                  <p className="text-xs text-red-400">y {enRiesgoRescision.length - 3} más...</p>
                )}
              </div>
            </div>
          )}
          {adjSinIntegrarH.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 cursor-pointer hover:border-yellow-500/50 transition-colors"
              onClick={() => navigate('/ahorristas')}>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-yellow-400" />
                <p className="text-sm font-bold text-yellow-400">ADJUDICADOS SIN INTEGRAR (Plan H)</p>
              </div>
              <p className="text-2xl font-bold text-yellow-400">{adjSinIntegrarH.length}</p>
              <p className="text-xs text-text-muted mt-1">necesitan 24 cuotas para retirar — gestionar integración</p>
              <div className="mt-2 space-y-1">
                {adjSinIntegrarH.slice(0, 3).map(a => (
                  <p key={a.id} className="text-xs text-text-secondary">
                    {a.nombre_apellido} — {a.cuotas_integradas}/24 integradas — Vendedor: {a.vendedor_nombre || '—'}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPIs estados */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {([
          { label: 'Activos', count: activos, color: 'text-green-400', icon: Users },
          { label: 'Adjudicados', count: adjudicados, color: 'text-blue-400', icon: Award },
          { label: 'Entregados', count: entregados, color: 'text-emerald-400', icon: Award },
          { label: 'Renuncias', count: renunciados, color: 'text-orange-400', icon: XCircle },
          { label: 'Rescindidos', count: rescindidos, color: 'text-red-400', icon: XCircle },
          { label: 'Transferidos', count: transferidos, color: 'text-purple-400', icon: ArrowRightLeft },
        ]).map(kpi => (
          <div key={kpi.label} className="bg-bg-secondary border border-border rounded-xl p-3 text-center">
            <kpi.icon className={`h-4 w-4 mx-auto mb-1 ${kpi.color}`} />
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.count}</p>
            <p className="text-xs text-text-muted">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Tasa de adjudicación</p>
          <p className="text-xl font-bold text-blue-400 mt-1">{tasaAdj}%</p>
          <div className="w-full bg-bg-tertiary rounded-full h-2 mt-2">
            <div className="bg-blue-500 rounded-full h-2" style={{ width: `${tasaAdj}%` }} />
          </div>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Tasa de deserción</p>
          <p className="text-xl font-bold text-red-400 mt-1">{tasaDesercion}%</p>
          <div className="w-full bg-bg-tertiary rounded-full h-2 mt-2">
            <div className="bg-red-500 rounded-full h-2" style={{ width: `${tasaDesercion}%` }} />
          </div>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Pendientes retiro</p>
          <p className="text-xl font-bold text-green-400 mt-1">{adjPendienteRetiro.length}</p>
          <p className="text-xs text-text-muted mt-1">adjudicados con integración completa</p>
        </div>
      </div>

      {/* Dos columnas: adjudicados sin integrar + riesgo rescisión por vendedor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Pendientes retiro */}
        <div>
          <h2 className="text-xs font-semibold text-green-400 uppercase tracking-wider flex items-center gap-1 mb-3">
            <Award className="h-3.5 w-3.5" /> Listos para retirar
          </h2>
          {adjPendienteRetiro.length === 0 ? (
            <div className="bg-bg-secondary border border-border rounded-xl p-6 text-center text-text-muted text-sm">
              Sin adjudicados pendientes de retiro
            </div>
          ) : (
            <div className="space-y-2">
              {adjPendienteRetiro.map(a => (
                <div key={a.id} className="bg-bg-secondary border border-green-500/20 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{a.nombre_apellido}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-text-muted">
                        <span>{a.vehiculo_modelo}</span>
                        <span>Vendedor: {a.vendedor_nombre || '—'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.telefono && (
                        <a href={`https://wa.me/${a.telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 text-green-500 hover:text-green-400"><Phone className="h-3.5 w-3.5" /></a>
                      )}
                      {a.email && (
                        <a href={`mailto:${a.email}`}
                          className="p-1.5 text-blue-400 hover:text-blue-300"><Mail className="h-3.5 w-3.5" /></a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grupos por estado */}
        <div>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1 mb-3">
            Grupos por estado
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(ESTADOS_GRUPO) as [string, { label: string; color: string }][]).map(([estado, info]) => {
              const count = allGrupos.filter(g => g.estado === estado).length
              return (
                <div key={estado} onClick={() => navigate('/planes-ahorro')}
                  className="bg-bg-secondary border border-border rounded-xl p-4 cursor-pointer hover:border-action/40 transition-colors text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${info.color}`}>{info.label}</span>
                  <p className="text-2xl font-bold text-text-primary mt-2">{count}</p>
                  <p className="text-xs text-text-muted">grupos</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
