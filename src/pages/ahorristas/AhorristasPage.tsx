import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserCheck, Plus, Search, X, Phone, Award,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Ahorrista, EstadoAhorrista, GrupoAhorro, TipoAdjudicacion } from '../../lib/types'
import { ESTADOS_AHORRISTA, SUCURSALES_SELECT } from '../../lib/constants'
import { Skeleton } from '../../components/ui'
import toast from 'react-hot-toast'

export function AhorristasPage() {
  const queryClient = useQueryClient()
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoAhorrista | ''>('')
  const [showModal, setShowModal] = useState(false)

  const { data: ahorristas, isLoading } = useQuery({
    queryKey: ['ahorristas', filtroEstado],
    queryFn: async () => {
      let q = supabase
        .from('ahorristas')
        .select('*, grupo:grupos_ahorro(*)')
        .order('created_at', { ascending: false })

      if (filtroEstado) q = q.eq('estado', filtroEstado)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Ahorrista[]
    },
  })

  const { data: grupos } = useQuery({
    queryKey: ['grupos-ahorro-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grupos_ahorro')
        .select('id, numero_grupo, modelo')
        .in('estado', ['formando', 'activo'])
        .order('numero_grupo')
      if (error) throw error
      return (data ?? []) as Pick<GrupoAhorro, 'id' | 'numero_grupo' | 'modelo'>[]
    },
  })

  const [form, setForm] = useState({
    nombre_apellido: '',
    dni_cuil: '',
    telefono: '',
    email: '',
    grupo_id: '',
    numero_orden: '',
    fecha_suscripcion: '',
    estado: 'activo' as EstadoAhorrista,
    sucursal: 'Ushuaia' as 'Ushuaia' | 'Rio Grande',
    adjudicado: false,
    fecha_adjudicacion: '',
    tipo_adjudicacion: '' as TipoAdjudicacion | '',
    observaciones: '',
  })

  const crearAhorrista = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ahorristas').insert({
        nombre_apellido: form.nombre_apellido,
        dni_cuil: form.dni_cuil,
        telefono: form.telefono || null,
        email: form.email || null,
        grupo_id: form.grupo_id || null,
        numero_orden: form.numero_orden ? parseInt(form.numero_orden) : null,
        fecha_suscripcion: form.fecha_suscripcion || null,
        estado: form.estado,
        sucursal: form.sucursal,
        adjudicado: form.adjudicado,
        fecha_adjudicacion: form.fecha_adjudicacion || null,
        tipo_adjudicacion: form.tipo_adjudicacion || null,
        observaciones: form.observaciones || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ahorristas'] })
      toast.success('Ahorrista registrado')
      setShowModal(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const filtered = (ahorristas ?? []).filter(a => {
    if (!busqueda) return true
    const term = busqueda.toLowerCase()
    return a.nombre_apellido.toLowerCase().includes(term)
      || a.dni_cuil.includes(term)
      || (a.grupo?.numero_grupo ?? '').toLowerCase().includes(term)
  })

  // Metrics
  const total = (ahorristas ?? []).length
  const adjudicados = (ahorristas ?? []).filter(a => a.adjudicado).length
  const enMora = (ahorristas ?? []).filter(a => a.estado === 'activo' && !a.adjudicado).length

  if (isLoading) return <Skeleton className="h-64" />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserCheck className="h-6 w-6 text-action" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">Ahorristas</h1>
            <p className="text-sm text-text-secondary">Suscriptores de planes de ahorro</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-action text-white rounded-lg text-sm font-medium hover:bg-action-hover transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Nuevo ahorrista
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Total ahorristas</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{total}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Adjudicados</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{adjudicados}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Activos sin adjudicar</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{enMora}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por nombre, DNI o grupo..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-action"
          />
        </div>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value as EstadoAhorrista | '')}
          className="px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary cursor-pointer"
        >
          <option value="">Todos los estados</option>
          {(Object.entries(ESTADOS_AHORRISTA) as [EstadoAhorrista, { label: string }][]).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-semibold">Sin ahorristas</p>
          <p className="text-sm">Registra un suscriptor de plan de ahorro</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const estadoInfo = ESTADOS_AHORRISTA[a.estado]
            return (
              <div
                key={a.id}
                className="bg-bg-secondary border border-border rounded-xl p-4 hover:border-action/40 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-text-primary">{a.nombre_apellido}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${estadoInfo.color}`}>
                        {estadoInfo.label}
                      </span>
                      {a.adjudicado && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          <Award className="h-3 w-3" /> Adjudicado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-text-muted">
                      <span>DNI: {a.dni_cuil}</span>
                      {a.grupo && <span>Grupo: {a.grupo.numero_grupo}</span>}
                      {a.numero_orden && <span>Orden: {a.numero_orden}</span>}
                      <span>{a.sucursal}</span>
                    </div>
                    {a.fecha_adjudicacion && (
                      <p className="text-xs text-blue-400 mt-1">
                        Adjudicado: {a.fecha_adjudicacion}
                        {a.tipo_adjudicacion && ` (${a.tipo_adjudicacion})`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {a.telefono && (
                      <a
                        href={`https://wa.me/${a.telefono.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-green-500 hover:text-green-400 transition-colors"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative bg-bg-secondary border border-border rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-text-muted hover:text-text-primary cursor-pointer">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-text-primary mb-4">Nuevo ahorrista</h2>

            <form onSubmit={e => { e.preventDefault(); crearAhorrista.mutate() }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-text-muted mb-1">Nombre y apellido *</label>
                  <input
                    required value={form.nombre_apellido}
                    onChange={e => setForm(f => ({ ...f, nombre_apellido: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">DNI/CUIL *</label>
                  <input
                    required value={form.dni_cuil}
                    onChange={e => setForm(f => ({ ...f, dni_cuil: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Telefono</label>
                  <input
                    value={form.telefono}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Email</label>
                  <input
                    type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Grupo</label>
                  <select
                    value={form.grupo_id}
                    onChange={e => setForm(f => ({ ...f, grupo_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary cursor-pointer"
                  >
                    <option value="">Sin grupo</option>
                    {(grupos ?? []).map(g => (
                      <option key={g.id} value={g.id}>{g.numero_grupo} - {g.modelo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Nro. orden</label>
                  <input
                    type="number" value={form.numero_orden}
                    onChange={e => setForm(f => ({ ...f, numero_orden: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Fecha suscripcion</label>
                  <input
                    type="date" value={form.fecha_suscripcion}
                    onChange={e => setForm(f => ({ ...f, fecha_suscripcion: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Sucursal</label>
                  <select
                    value={form.sucursal}
                    onChange={e => setForm(f => ({ ...f, sucursal: e.target.value as 'Ushuaia' | 'Rio Grande' }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary cursor-pointer"
                  >
                    {SUCURSALES_SELECT.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Observaciones</label>
                <textarea
                  value={form.observaciones}
                  onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={crearAhorrista.isPending}
                className="w-full py-2.5 bg-action text-white rounded-lg text-sm font-medium hover:bg-action-hover transition-colors disabled:opacity-50 cursor-pointer"
              >
                {crearAhorrista.isPending ? 'Registrando...' : 'Registrar ahorrista'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
