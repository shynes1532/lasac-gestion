import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Filter, AlertTriangle, Trash2, Activity, DollarSign, CheckCircle2, XCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { notify } from '../../components/ui/Toast'
import { COLORES_TIPO, TIPO_LABEL, ESTADO_LABEL, SEMAFORO_EMOJI, SUCURSALES_SELECT } from '../../lib/constants'
import { getSemaforoCompromiso } from '../../lib/types'
import type { EstadoActual, TipoOperacion } from '../../lib/types'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'

// Vista virtual: 'activas' = todas las que están en pipeline (no entregadas ni caídas)
// 'saldo' = entregadas pero con saldo pendiente
type FiltroVista = 'activas' | 'saldo' | 'entregadas' | 'caidas' | EstadoActual

const ESTADOS_PIPELINE: { value: EstadoActual; label: string }[] = [
  { value: 'cierre', label: 'Cierre' },
  { value: 'documentacion', label: 'Documentación' },
  { value: 'gestoria', label: 'Gestoría' },
  { value: 'alistamiento', label: 'PDI' },
  { value: 'calidad', label: 'Calidad' },
  { value: 'entrega', label: 'Entrega' },
]

const ESTADOS_PIPELINE_VALUES: EstadoActual[] = ['cierre','documentacion','gestoria','alistamiento','calidad','entrega']

export function ListaOperaciones() {
  const navigate = useNavigate()
  useAuth()
  const [searchParams] = useSearchParams()

  const tipoValidos: (TipoOperacion | 'todos')[] = ['todos','0km','usados','plan_ahorro']
  const tipoParam = searchParams.get('tipo') as TipoOperacion | null

  const [busqueda, setBusqueda] = useState('')
  const [vista, setVista] = useState<FiltroVista>('activas')
  const [filtroTipo, setFiltroTipo] = useState<TipoOperacion | 'todos'>(
    tipoParam && tipoValidos.includes(tipoParam) ? tipoParam : 'todos'
  )
  const [filtroSucursal, setFiltroSucursal] = useState<string>('todas')

  // Query principal — trae operaciones según la vista seleccionada
  const { data: operaciones, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['operaciones', vista, filtroTipo, filtroSucursal],
    queryFn: async () => {
      let q = supabase
        .from('operaciones')
        .select(`
          id, numero_operacion, sucursal, tipo_operacion, estado_actual,
          cliente_nombre, fecha_compromiso, estado_prenda, forma_pago,
          created_at, nro_epod, saldo_cliente, saldo_pagado, fecha_entrega_real,
          unidades (modelo, vin_chasis)
        `)
        .order('created_at', { ascending: false })
        .limit(150)

      // Aplicar filtro según vista
      if (vista === 'activas') {
        q = q.in('estado_actual', ESTADOS_PIPELINE_VALUES)
      } else if (vista === 'saldo') {
        // Saldo pendiente: cualquier estado, pero saldo_pagado = false y saldo > 0
        q = q.eq('saldo_pagado', false).gt('saldo_cliente', 0)
      } else if (vista === 'entregadas') {
        q = q.eq('estado_actual', 'entregado')
      } else if (vista === 'caidas') {
        q = q.eq('estado_actual', 'caida')
      } else {
        // Filtro por estado específico
        q = q.eq('estado_actual', vista)
      }

      if (filtroTipo !== 'todos') q = q.eq('tipo_operacion', filtroTipo)
      if (filtroSucursal !== 'todas') q = q.eq('sucursal', filtroSucursal)

      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  // Query de contadores — trae solo lo necesario para los KPIs (sin filtro de tipo/sucursal)
  const { data: counts } = useQuery({
    queryKey: ['operaciones-counts', filtroTipo, filtroSucursal],
    queryFn: async () => {
      let q = supabase
        .from('operaciones')
        .select('id, estado_actual, saldo_cliente, saldo_pagado', { count: 'exact' })

      if (filtroTipo !== 'todos') q = q.eq('tipo_operacion', filtroTipo)
      if (filtroSucursal !== 'todas') q = q.eq('sucursal', filtroSucursal)

      const { data, error } = await q
      if (error) throw error
      const rows = data || []

      return {
        activas: rows.filter(r => ESTADOS_PIPELINE_VALUES.includes(r.estado_actual as EstadoActual)).length,
        saldo: rows.filter(r => r.saldo_pagado === false && (r.saldo_cliente || 0) > 0).length,
        entregadas: rows.filter(r => r.estado_actual === 'entregado').length,
        caidas: rows.filter(r => r.estado_actual === 'caida').length,
      }
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

  const queryClient = useQueryClient()
  const [eliminando, setEliminando] = useState<string | null>(null)

  async function eliminarOp(e: React.MouseEvent, opId: string) {
    e.stopPropagation()
    if (eliminando === opId) {
      // Segundo click = confirmar
      const { error } = await supabase.from('operaciones').delete().eq('id', opId)
      if (error) { notify.error(error.message); setEliminando(null); return }
      notify.success('Operación eliminada')
      setEliminando(null)
      queryClient.invalidateQueries({ queryKey: ['operaciones'] })
    } else {
      setEliminando(opId)
      setTimeout(() => setEliminando(null), 3000)
    }
  }

  const tituloVista: Record<string, string> = {
    activas: 'Operaciones activas',
    saldo: 'Pendientes de cobro',
    entregadas: 'Entregadas',
    caidas: 'Operaciones caídas',
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Operaciones</h1>
          <p className="text-sm text-text-secondary">Gestión de operaciones en curso</p>
        </div>
        <Button onClick={() => navigate('/operaciones/nueva')}>
          <Plus className="h-4 w-4 mr-1" /> Nueva operación
        </Button>
      </div>

      {/* KPIs clickeables */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <button
          onClick={() => setVista('activas')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            vista === 'activas'
              ? 'bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/30'
              : 'bg-bg-secondary border-border hover:border-blue-500/30'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-text-muted">Activas</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{counts?.activas ?? '—'}</p>
          <p className="text-[10px] text-text-muted mt-0.5">En pipeline</p>
        </button>

        <button
          onClick={() => setVista('saldo')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            vista === 'saldo'
              ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
              : (counts?.saldo ?? 0) > 0
                ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50'
                : 'bg-bg-secondary border-border hover:border-amber-500/30'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-text-muted">Pte. saldo</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{counts?.saldo ?? '—'}</p>
          <p className="text-[10px] text-text-muted mt-0.5">A cobrar</p>
        </button>

        <button
          onClick={() => setVista('entregadas')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            vista === 'entregadas'
              ? 'bg-green-500/10 border-green-500/50 ring-1 ring-green-500/30'
              : 'bg-bg-secondary border-border hover:border-green-500/30'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span className="text-xs text-text-muted">Entregadas</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{counts?.entregadas ?? '—'}</p>
          <p className="text-[10px] text-text-muted mt-0.5">Cerradas</p>
        </button>

        <button
          onClick={() => setVista('caidas')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            vista === 'caidas'
              ? 'bg-red-500/10 border-red-500/50 ring-1 ring-red-500/30'
              : 'bg-bg-secondary border-border hover:border-red-500/30'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-xs text-text-muted">Caídas</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{counts?.caidas ?? '—'}</p>
          <p className="text-[10px] text-text-muted mt-0.5">Canceladas</p>
        </button>
      </div>

      {/* Banner alerta de saldos pendientes (solo si NO estamos en esa vista y hay saldos) */}
      {vista !== 'saldo' && (counts?.saldo ?? 0) > 0 && (
        <button
          onClick={() => setVista('saldo')}
          className="w-full mb-4 bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 flex items-center gap-3 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
        >
          <DollarSign className="h-5 w-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-200">
              Hay {counts?.saldo} {counts?.saldo === 1 ? 'operación' : 'operaciones'} con saldo pendiente de cobro
            </p>
            <p className="text-xs text-amber-200/70">Click para revisarlas</p>
          </div>
          <span className="text-amber-400">→</span>
        </button>
      )}

      {/* Título de la vista actual */}
      <h2 className="text-sm font-semibold text-text-secondary mb-2">
        {tituloVista[vista] || `Estado: ${ESTADO_LABEL[vista as EstadoActual] || vista}`}
      </h2>

      {/* Filtros */}
      <div className="bg-bg-secondary rounded-xl border border-border p-3 mb-4 space-y-3">
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

        {/* Tabs de estado del pipeline (solo si vista === 'activas') */}
        {vista === 'activas' && (
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setVista('activas')}
              className="px-3 py-1 text-xs rounded-full font-medium bg-action text-white cursor-pointer"
            >
              Todas activas
            </button>
            {ESTADOS_PIPELINE.map(e => (
              <button
                key={e.value}
                onClick={() => setVista(e.value)}
                className="px-3 py-1 text-xs rounded-full font-medium transition-colors cursor-pointer bg-bg-primary text-text-secondary hover:bg-bg-tertiary"
              >
                {e.label}
              </button>
            ))}
          </div>
        )}

        {/* Si está en un estado específico, mostrar botón "volver a activas" */}
        {ESTADOS_PIPELINE_VALUES.includes(vista as EstadoActual) && (
          <div className="flex gap-1 flex-wrap items-center">
            <button
              onClick={() => setVista('activas')}
              className="px-3 py-1 text-xs rounded-full font-medium bg-bg-primary text-text-secondary hover:bg-bg-tertiary cursor-pointer"
            >
              ← Todas activas
            </button>
            {ESTADOS_PIPELINE.map(e => (
              <button
                key={e.value}
                onClick={() => setVista(e.value)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors cursor-pointer ${
                  vista === e.value
                    ? 'bg-action text-white'
                    : 'bg-bg-primary text-text-secondary hover:bg-bg-tertiary'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        )}

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
      ) : isError ? (
        <EmptyState
          icon={<AlertTriangle className="h-12 w-12 text-red-400" />}
          title="Error al cargar"
          description={`No se pudieron cargar las operaciones: ${(queryError as any)?.message || 'Error desconocido'}`}
        />
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

                    {/* Saldo pendiente */}
                    {(op as any).saldo_pagado === false && ((op as any).saldo_cliente || 0) > 0 && (
                      <span className="text-xs text-amber-400 font-bold flex items-center gap-0.5">
                        💰 ${new Intl.NumberFormat('es-AR').format((op as any).saldo_cliente)}
                      </span>
                    )}

                    {/* Eliminar */}
                    <button
                      onClick={e => eliminarOp(e, op.id)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg cursor-pointer transition-colors ${
                        eliminando === op.id
                          ? 'bg-red-600 text-white'
                          : 'text-text-muted hover:text-red-400 hover:bg-red-500/10'
                      }`}
                      title={eliminando === op.id ? 'Click para confirmar' : 'Eliminar'}
                    >
                      <Trash2 className="h-3 w-3" />
                      {eliminando === op.id ? 'Confirmar' : ''}
                    </button>
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
