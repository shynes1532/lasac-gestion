import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Filter } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { COLORES_TIPO, TIPO_LABEL, ESTADO_LABEL, SEMAFORO_EMOJI, SUCURSALES_SELECT } from '../../lib/constants'
import { getSemaforoCompromiso } from '../../lib/types'
import type { EstadoActual, TipoOperacion } from '../../lib/types'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'

const ESTADOS: { value: EstadoActual | 'todas'; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'cierre', label: 'Cierre' },
  { value: 'documentacion', label: 'Documentación' },
  { value: 'gestoria', label: 'Gestoría' },
  { value: 'alistamiento', label: 'PDI' },
  { value: 'calidad', label: 'Calidad' },
  { value: 'entrega', label: 'Entrega' },
  { value: 'entregado', label: 'Entregadas' },
  { value: 'caida', label: 'Caídas' },
]

export function ListaOperaciones() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoActual | 'todas'>('todas')
  const [filtroTipo, setFiltroTipo] = useState<TipoOperacion | 'todos'>('todos')
  const [filtroSucursal, setFiltroSucursal] = useState<string>('todas')

  const { data: operaciones, isLoading } = useQuery({
    queryKey: ['operaciones', filtroEstado, filtroTipo, filtroSucursal],
    queryFn: async () => {
      let q = supabase
        .from('operaciones')
        .select(`
          id, numero_operacion, sucursal, tipo_operacion, estado_actual,
          cliente_nombre, fecha_compromiso, estado_prenda, forma_pago,
          created_at, nro_epod,
          unidades (modelo, vin_chasis),
          usuarios!asesor_id (nombre_completo)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (filtroEstado !== 'todas') q = q.eq('estado_actual', filtroEstado)
      if (filtroTipo !== 'todos') q = q.eq('tipo_operacion', filtroTipo)
      if (filtroSucursal !== 'todas') q = q.eq('sucursal', filtroSucursal)

      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  const filtradas = (operaciones || []).filter(op => {
    if (!busqueda.trim()) return true
    const b = busqueda.toLowerCase()
    return (
      op.numero_operacion?.toLowerCase().includes(b) ||
      op.cliente_nombre?.toLowerCase().includes(b) ||
      op.nro_epod?.toLowerCase().includes(b) ||
      (op.unidades as any)?.[0]?.modelo?.toLowerCase().includes(b)
    )
  })

  const puedeCrear = perfil && ['director','asesor_ush','asesor_rg'].includes(perfil.rol)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Operaciones</h1>
          <p className="text-sm text-text-secondary">Pipeline de gestión de entregas</p>
        </div>
        {puedeCrear && (
          <Button onClick={() => navigate('/operaciones/nueva')}>
            <Plus className="h-4 w-4 mr-1" /> Nueva operación
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-bg-secondary rounded-xl border border-border p-4 mb-4 space-y-3">
        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por N° op, cliente, ePOD, modelo..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-action/30"
          />
        </div>

        {/* Tabs de estado */}
        <div className="flex gap-1 flex-wrap">
          {ESTADOS.map(e => (
            <button
              key={e.value}
              onClick={() => setFiltroEstado(e.value as any)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors cursor-pointer ${
                filtroEstado === e.value
                  ? 'bg-action text-white'
                  : 'bg-bg-primary text-text-secondary hover:bg-bg-tertiary'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>

        {/* Filtros adicionales */}
        <div className="flex gap-2">
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value as any)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-bg-primary text-text-secondary focus:outline-none"
          >
            <option value="todos">Todos los tipos</option>
            <option value="0km">0 KM</option>
            <option value="usados">Usados</option>
            <option value="plan_ahorro">Plan de Ahorro</option>
          </select>
          <select
            value={filtroSucursal}
            onChange={e => setFiltroSucursal(e.target.value)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-bg-primary text-text-secondary focus:outline-none"
          >
            <option value="todas">Todas las sucursales</option>
            {SUCURSALES_SELECT.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <LoadingSkeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtradas.length === 0 ? (
        <EmptyState
          icon={<Filter className="h-12 w-12" />}
          title="Sin operaciones"
          description={busqueda ? 'No se encontraron resultados para tu búsqueda' : 'No hay operaciones con los filtros seleccionados'}
        />
      ) : (
        <div className="space-y-2">
          {filtradas.map(op => {
            const tipo = op.tipo_operacion as TipoOperacion
            const colores = COLORES_TIPO[tipo] || COLORES_TIPO['0km']
            const modelo = (op.unidades as any)?.[0]?.modelo || '—'
            const asesor = (op.usuarios as any)?.nombre_completo
            const semaforo = op.fecha_compromiso ? getSemaforoCompromiso(op.fecha_compromiso) : null
            const requierePrenda = op.forma_pago === 'financiado_banco' || op.tipo_operacion === 'plan_ahorro'

            return (
              <div
                key={op.id}
                onClick={() => navigate(`/operaciones/${op.id}`)}
                className="bg-bg-secondary rounded-xl border border-border p-4 cursor-pointer hover:border-action/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Badge tipo */}
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap mt-0.5 shrink-0"
                      style={{ backgroundColor: colores.bg, color: colores.text, border: `1px solid ${colores.border}` }}
                    >
                      {TIPO_LABEL[tipo]}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-text-primary">{op.numero_operacion}</span>
                        {op.nro_epod && <span className="text-xs text-text-muted">ePOD: {op.nro_epod}</span>}
                      </div>
                      <p className="text-sm text-text-secondary truncate">{op.cliente_nombre || '—'}</p>
                      <p className="text-xs text-text-muted">{modelo} · {op.sucursal}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {/* Estado */}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      op.estado_actual === 'caida' ? 'bg-red-100 text-red-700' :
                      op.estado_actual === 'entregado' ? 'bg-green-100 text-green-700' :
                      'bg-bg-tertiary text-text-secondary'
                    }`}>
                      {ESTADO_LABEL[op.estado_actual as EstadoActual] || op.estado_actual}
                    </span>

                    {/* Semáforo compromiso */}
                    {semaforo && op.estado_actual !== 'entregado' && op.estado_actual !== 'caida' && (
                      <span className="text-xs" title={`Compromiso: ${op.fecha_compromiso}`}>
                        {SEMAFORO_EMOJI[semaforo]}
                      </span>
                    )}

                    {/* Prenda pendiente */}
                    {requierePrenda && op.estado_prenda === 'pendiente' && (
                      <span className="text-xs text-yellow-600 font-medium">🔒 Prenda</span>
                    )}
                  </div>
                </div>

                {asesor && (
                  <p className="text-xs text-text-muted mt-2">Asesor: {asesor}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
