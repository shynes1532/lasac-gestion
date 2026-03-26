import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, Search, ChevronRight, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { GrupoAhorro, EstadoGrupo, TipoPlan } from '../../lib/types'
import { ESTADOS_GRUPO, SUCURSALES_SELECT, TIPOS_PLAN, CATALOGO_VEHICULOS } from '../../lib/constants'
import { Skeleton } from '../../components/ui'
import toast from 'react-hot-toast'

function formatMoney(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

export function PlanesAhorroPage() {
  const queryClient = useQueryClient()
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoGrupo | ''>('')
  const [showModal, setShowModal] = useState(false)
  const [selectedGrupo, setSelectedGrupo] = useState<GrupoAhorro | null>(null)

  const [form, setForm] = useState({
    numero_grupo: '',
    tipo_plan: 'H' as TipoPlan,
    modelo: '',
    valor_movil: '',
    fecha_formacion: '',
    estado: 'formando' as EstadoGrupo,
    sucursal: 'Ushuaia' as 'Ushuaia' | 'Rio Grande',
    observaciones: '',
  })

  const { data: grupos, isLoading } = useQuery({
    queryKey: ['grupos-ahorro', filtroEstado],
    queryFn: async () => {
      let q = supabase.from('grupos_ahorro').select('*').order('created_at', { ascending: false })
      if (filtroEstado) q = q.eq('estado', filtroEstado)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as GrupoAhorro[]
    },
  })

  const planInfo = TIPOS_PLAN.find(p => p.value === form.tipo_plan)!

  const crearGrupo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('grupos_ahorro').insert({
        numero_grupo: form.numero_grupo,
        tipo_plan: form.tipo_plan,
        modelo: form.modelo,
        valor_movil: parseFloat(form.valor_movil) || 0,
        cantidad_integrantes: planInfo.integrantes,
        cantidad_cuotas: planInfo.cuotas,
        fecha_formacion: form.fecha_formacion || null,
        estado: form.estado,
        sucursal: form.sucursal,
        observaciones: form.observaciones || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupos-ahorro'] })
      toast.success('Grupo creado')
      setShowModal(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const filtered = (grupos ?? []).filter(g => {
    if (!busqueda) return true
    const t = busqueda.toLowerCase()
    return g.numero_grupo.toLowerCase().includes(t) || g.modelo.toLowerCase().includes(t)
  })

  const activos = (grupos ?? []).filter(g => g.estado === 'activo').length
  const formando = (grupos ?? []).filter(g => g.estado === 'formando').length
  const totalIntegrantes = (grupos ?? [])
    .filter(g => g.estado === 'activo' || g.estado === 'formando')
    .reduce((s, g) => s + g.cantidad_integrantes, 0)

  if (isLoading) return <Skeleton className="h-64" />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-action" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">Planes de Ahorro — Grupos</h1>
            <p className="text-sm text-text-secondary">Gestión de grupos FIAT Plan (H: 84 cuotas / E: 50 cuotas)</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-action text-white rounded-lg text-sm font-medium hover:bg-action-hover transition-colors cursor-pointer">
          <Plus className="h-4 w-4" /> Nuevo grupo
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Grupos activos</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{activos}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">En formación</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{formando}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Total suscriptores</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{totalIntegrantes}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input type="text" placeholder="Buscar grupo o modelo..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-action" />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as EstadoGrupo | '')}
          className="px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary cursor-pointer">
          <option value="">Todos los estados</option>
          {(Object.entries(ESTADOS_GRUPO) as [EstadoGrupo, { label: string }][]).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-semibold">Sin grupos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(g => {
            const estadoInfo = ESTADOS_GRUPO[g.estado]
            const progreso = g.cantidad_cuotas > 0 ? Math.round((g.cuotas_acto / g.cantidad_cuotas) * 100) : 0
            return (
              <div key={g.id} onClick={() => setSelectedGrupo(g)}
                className="bg-bg-secondary border border-border rounded-xl p-4 cursor-pointer hover:border-action/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-text-primary">{g.numero_grupo}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">Plan {g.tipo_plan}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${estadoInfo.color}`}>{estadoInfo.label}</span>
                    </div>
                    <p className="text-sm text-text-secondary mt-0.5">{g.modelo}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-text-muted">
                      <span>{g.cantidad_integrantes} integrantes</span>
                      <span>{g.cantidad_cuotas} cuotas</span>
                      <span>{g.sucursal}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-text-primary">{formatMoney(g.valor_movil)}</p>
                    <p className="text-xs text-text-muted">Valor móvil</p>
                    <ChevronRight className="h-4 w-4 text-text-muted ml-auto mt-1" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex-1 bg-bg-tertiary rounded-full h-2">
                    <div className="bg-action rounded-full h-2 transition-all" style={{ width: `${Math.min(100, progreso)}%` }} />
                  </div>
                  <span className="text-xs text-text-muted">Acto {g.cuotas_acto}/{g.cantidad_cuotas}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detalle grupo */}
      {selectedGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedGrupo(null)} />
          <div className="relative bg-bg-secondary border border-border rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <button onClick={() => setSelectedGrupo(null)} className="absolute top-4 right-4 text-text-muted hover:text-text-primary cursor-pointer">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-text-primary mb-4">Grupo {selectedGrupo.numero_grupo}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-text-muted">Plan</p><p className="text-text-primary font-medium">Plan {selectedGrupo.tipo_plan} ({selectedGrupo.cantidad_cuotas} cuotas)</p></div>
              <div><p className="text-text-muted">Modelo</p><p className="text-text-primary font-medium">{selectedGrupo.modelo}</p></div>
              <div><p className="text-text-muted">Valor móvil</p><p className="text-text-primary font-medium">{formatMoney(selectedGrupo.valor_movil)}</p></div>
              <div><p className="text-text-muted">Integrantes</p><p className="text-text-primary font-medium">{selectedGrupo.cantidad_integrantes}</p></div>
              <div><p className="text-text-muted">Acto actual</p><p className="text-text-primary font-medium">{selectedGrupo.cuotas_acto} / {selectedGrupo.cantidad_cuotas}</p></div>
              <div><p className="text-text-muted">Sucursal</p><p className="text-text-primary font-medium">{selectedGrupo.sucursal}</p></div>
              {selectedGrupo.fecha_formacion && <div><p className="text-text-muted">Formación</p><p className="text-text-primary font-medium">{selectedGrupo.fecha_formacion}</p></div>}
              {selectedGrupo.observaciones && <div className="col-span-2"><p className="text-text-muted">Observaciones</p><p className="text-text-primary">{selectedGrupo.observaciones}</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* Modal crear grupo */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative bg-bg-secondary border border-border rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-text-muted hover:text-text-primary cursor-pointer"><X className="h-5 w-5" /></button>
            <h2 className="text-lg font-bold text-text-primary mb-4">Nuevo grupo de ahorro</h2>
            <form onSubmit={e => { e.preventDefault(); crearGrupo.mutate() }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Nro. Grupo *</label>
                  <input required value={form.numero_grupo}
                    onChange={e => setForm(f => ({ ...f, numero_grupo: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action" placeholder="G-1234" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Tipo de plan *</label>
                  <select value={form.tipo_plan}
                    onChange={e => setForm(f => ({ ...f, tipo_plan: e.target.value as TipoPlan }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary cursor-pointer">
                    {TIPOS_PLAN.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <p className="text-xs text-text-muted mt-0.5">{planInfo.integrantes} integrantes, {planInfo.cuotas} cuotas, cuota {planInfo.pct_cuota}%</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Modelo *</label>
                  <select required value={form.modelo}
                    onChange={e => {
                      const v = CATALOGO_VEHICULOS.find(v => v.modelo === e.target.value)
                      setForm(f => ({
                        ...f,
                        modelo: e.target.value,
                        valor_movil: v?.condiciones[0]?.precio_lista.toString() ?? f.valor_movil,
                      }))
                    }}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary cursor-pointer">
                    <option value="">Seleccionar...</option>
                    {CATALOGO_VEHICULOS.map(v => <option key={v.codigo} value={v.modelo}>{v.modelo}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Valor móvil ($)</label>
                  <input type="number" value={form.valor_movil}
                    onChange={e => setForm(f => ({ ...f, valor_movil: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Fecha formación</label>
                  <input type="date" value={form.fecha_formacion}
                    onChange={e => setForm(f => ({ ...f, fecha_formacion: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Sucursal</label>
                  <select value={form.sucursal}
                    onChange={e => setForm(f => ({ ...f, sucursal: e.target.value as 'Ushuaia' | 'Rio Grande' }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary cursor-pointer">
                    {SUCURSALES_SELECT.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Observaciones</label>
                <textarea value={form.observaciones}
                  onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action resize-none" />
              </div>
              <button type="submit" disabled={crearGrupo.isPending}
                className="w-full py-2.5 bg-action text-white rounded-lg text-sm font-medium hover:bg-action-hover transition-colors disabled:opacity-50 cursor-pointer">
                {crearGrupo.isPending ? 'Creando...' : 'Crear grupo'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
