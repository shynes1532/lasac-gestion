import { useQuery } from '@tanstack/react-query'
import {
  PieChart, Users, Award, XCircle, ArrowRightLeft, TrendingUp,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Ahorrista, GrupoAhorro, EstadoAhorrista } from '../../lib/types'
import { ESTADOS_AHORRISTA, ESTADOS_GRUPO } from '../../lib/constants'
import { Skeleton } from '../../components/ui'
import { useNavigate } from 'react-router-dom'

function formatMoney(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

interface AhorristaConGrupo extends Ahorrista {
  grupo: Pick<GrupoAhorro, 'numero_grupo' | 'modelo' | 'valor_movil' | 'estado'> | null
}

export function CarteraPage() {
  const navigate = useNavigate()

  const { data: ahorristas, isLoading: loadingAhorristas } = useQuery({
    queryKey: ['cartera-ahorristas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ahorristas')
        .select('*, grupo:grupos_ahorro(numero_grupo, modelo, valor_movil, estado)')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as AhorristaConGrupo[]
    },
  })

  const { data: grupos, isLoading: loadingGrupos } = useQuery({
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

  if (loadingAhorristas || loadingGrupos) return <Skeleton className="h-64" />

  const all = ahorristas ?? []
  const allGrupos = grupos ?? []

  // Counts by estado
  const countByEstado = (estado: EstadoAhorrista) => all.filter(a => a.estado === estado).length
  const activos = countByEstado('activo')
  const adjudicados = countByEstado('adjudicado')
  const renunciados = countByEstado('renunciado')
  const rescindidos = countByEstado('rescindido')
  const transferidos = countByEstado('transferido')

  // Grupos stats
  const gruposActivos = allGrupos.filter(g => g.estado === 'activo')
  const valorTotalCartera = gruposActivos.reduce((s, g) => s + g.valor_movil * g.cantidad_integrantes, 0)
  const tasaAdjudicacion = all.length > 0 ? Math.round((adjudicados / all.length) * 100) : 0
  const tasaDesercion = all.length > 0 ? Math.round(((renunciados + rescindidos) / all.length) * 100) : 0

  // Adjudicados recientes (ultimos 10)
  const adjudicadosRecientes = all
    .filter(a => a.adjudicado && a.fecha_adjudicacion)
    .sort((a, b) => (b.fecha_adjudicacion ?? '').localeCompare(a.fecha_adjudicacion ?? ''))
    .slice(0, 10)

  // Bajas recientes
  const bajasRecientes = all
    .filter(a => a.estado === 'renunciado' || a.estado === 'rescindido')
    .slice(0, 10)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <PieChart className="h-6 w-6 text-action" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Cartera de Ahorro</h1>
          <p className="text-sm text-text-secondary">
            Vision general del portfolio de planes de ahorro
          </p>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-green-400" />
            <p className="text-xs text-text-muted uppercase tracking-wider">Activos</p>
          </div>
          <p className="text-2xl font-bold text-green-400">{activos}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Award className="h-4 w-4 text-blue-400" />
            <p className="text-xs text-text-muted uppercase tracking-wider">Adjudicados</p>
          </div>
          <p className="text-2xl font-bold text-blue-400">{adjudicados}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-orange-400" />
            <p className="text-xs text-text-muted uppercase tracking-wider">Renuncias</p>
          </div>
          <p className="text-2xl font-bold text-orange-400">{renunciados}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-red-400" />
            <p className="text-xs text-text-muted uppercase tracking-wider">Rescindidos</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{rescindidos}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowRightLeft className="h-4 w-4 text-purple-400" />
            <p className="text-xs text-text-muted uppercase tracking-wider">Transferidos</p>
          </div>
          <p className="text-2xl font-bold text-purple-400">{transferidos}</p>
        </div>
      </div>

      {/* Indicadores clave */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Valor total cartera</p>
          <p className="text-xl font-bold text-text-primary mt-1">{formatMoney(valorTotalCartera)}</p>
          <p className="text-xs text-text-muted mt-1">{gruposActivos.length} grupos activos</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Tasa de adjudicacion</p>
          <p className="text-xl font-bold text-blue-400 mt-1">{tasaAdjudicacion}%</p>
          <div className="w-full bg-bg-tertiary rounded-full h-2 mt-2">
            <div className="bg-blue-500 rounded-full h-2" style={{ width: `${tasaAdjudicacion}%` }} />
          </div>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Tasa de desercion</p>
          <p className="text-xl font-bold text-red-400 mt-1">{tasaDesercion}%</p>
          <div className="w-full bg-bg-tertiary rounded-full h-2 mt-2">
            <div className="bg-red-500 rounded-full h-2" style={{ width: `${tasaDesercion}%` }} />
          </div>
        </div>
      </div>

      {/* Two columns: adjudicados recientes + bajas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Adjudicados recientes */}
        <div>
          <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1 mb-3">
            <Award className="h-3.5 w-3.5" />
            Adjudicaciones recientes
          </h2>
          {adjudicadosRecientes.length === 0 ? (
            <div className="bg-bg-secondary border border-border rounded-xl p-6 text-center text-text-muted text-sm">
              Sin adjudicaciones recientes
            </div>
          ) : (
            <div className="space-y-2">
              {adjudicadosRecientes.map(a => (
                <div
                  key={a.id}
                  onClick={() => navigate('/ahorristas')}
                  className="bg-bg-secondary border border-blue-500/20 rounded-xl p-3 cursor-pointer hover:border-blue-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{a.nombre_apellido}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-text-muted">
                        {a.grupo && <span>{a.grupo.numero_grupo} - {a.grupo.modelo}</span>}
                        {a.tipo_adjudicacion && (
                          <span className="capitalize">{a.tipo_adjudicacion}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-blue-400 font-medium">{a.fecha_adjudicacion}</p>
                      {a.vehiculo_retirado ? (
                        <span className="text-green-400">Retirado</span>
                      ) : (
                        <span className="text-yellow-400">Pendiente retiro</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bajas recientes */}
        <div>
          <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1 mb-3">
            <XCircle className="h-3.5 w-3.5" />
            Bajas recientes (renuncias / rescisiones)
          </h2>
          {bajasRecientes.length === 0 ? (
            <div className="bg-bg-secondary border border-border rounded-xl p-6 text-center text-text-muted text-sm">
              Sin bajas recientes
            </div>
          ) : (
            <div className="space-y-2">
              {bajasRecientes.map(a => {
                const estadoInfo = ESTADOS_AHORRISTA[a.estado]
                return (
                  <div
                    key={a.id}
                    className="bg-bg-secondary border border-red-500/20 rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{a.nombre_apellido}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-text-muted">
                          <span>DNI: {a.dni_cuil}</span>
                          {a.grupo && <span>{a.grupo.numero_grupo}</span>}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${estadoInfo.color}`}>
                        {estadoInfo.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Resumen grupos */}
      <div className="mt-6">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1 mb-3">
          <TrendingUp className="h-3.5 w-3.5" />
          Grupos por estado
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.entries(ESTADOS_GRUPO) as [string, { label: string; color: string }][]).map(([estado, info]) => {
            const count = allGrupos.filter(g => g.estado === estado).length
            return (
              <div
                key={estado}
                onClick={() => navigate('/planes-ahorro')}
                className="bg-bg-secondary border border-border rounded-xl p-4 cursor-pointer hover:border-action/40 transition-colors text-center"
              >
                <span className={`text-xs px-2 py-0.5 rounded-full ${info.color}`}>{info.label}</span>
                <p className="text-2xl font-bold text-text-primary mt-2">{count}</p>
                <p className="text-xs text-text-muted">grupos</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
