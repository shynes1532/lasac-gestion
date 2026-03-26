import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserCheck, Plus, Search, X, Phone, Mail, Award, AlertTriangle, ChevronDown, ChevronUp, Link,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Ahorrista, EstadoAhorrista, GrupoAhorro, TipoPlan, CodigoPlan, VehiculoCodigo } from '../../lib/types'
import {
  ESTADOS_AHORRISTA, SUCURSALES_SELECT, TIPOS_PLAN, CODIGOS_PLAN,
  CATALOGO_VEHICULOS, REGLAS_FIAT_PLAN,
} from '../../lib/constants'
import { Skeleton } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

function formatMoney(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

export function AhorristasPage() {
  const queryClient = useQueryClient()
  const { perfil } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoAhorrista | ''>('')
  const [showAlta, setShowAlta] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [asignarGrupo, setAsignarGrupo] = useState<Ahorrista | null>(null)
  const [formGrupo, setFormGrupo] = useState({ grupo_id: '', numero_orden: '' })

  const { data: ahorristas, isLoading } = useQuery({
    queryKey: ['ahorristas', filtroEstado],
    queryFn: async () => {
      let q = supabase
        .from('ahorristas')
        .select('*, grupo:grupos_ahorro(numero_grupo, modelo, tipo_plan)')
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
        .select('id, numero_grupo, modelo, tipo_plan')
        .in('estado', ['formando', 'activo'])
        .order('numero_grupo')
      if (error) throw error
      return (data ?? []) as Pick<GrupoAhorro, 'id' | 'numero_grupo' | 'modelo' | 'tipo_plan'>[]
    },
  })

  // --- Formulario de Alta ---
  const [form, setForm] = useState({
    numero_solicitud: '',
    nombre_apellido: '',
    dni_cuil: '',
    domicilio: '',
    localidad: '',
    telefono: '',
    email: '',
    tipo_plan: 'H' as TipoPlan,
    codigo_plan: '' as CodigoPlan | '',
    vehiculo_codigo: '' as VehiculoCodigo | '',
    valor_movil: '',
    cuota_pura: '',
    fecha_arranque: '',
    nro_recibo_c1: '',
    es_subite: false,
    sucursal: 'Ushuaia' as 'Ushuaia' | 'Rio Grande',
    observaciones: '',
  })

  // Auto-fill cuando selecciona vehiculo + condicion
  const vehiculoSeleccionado = CATALOGO_VEHICULOS.find(v => v.codigo === form.vehiculo_codigo)
  const condicionesDisponibles = vehiculoSeleccionado?.condiciones ?? []
  const condicionSeleccionada = condicionesDisponibles.find(c => c.codigo_plan === form.codigo_plan)

  const handleVehiculoChange = (codigo: VehiculoCodigo | '') => {
    const veh = CATALOGO_VEHICULOS.find(v => v.codigo === codigo)
    setForm(f => ({
      ...f,
      vehiculo_codigo: codigo,
      codigo_plan: '' as CodigoPlan | '',
      valor_movil: '',
      cuota_pura: '',
    }))
    if (veh && veh.condiciones.length === 1) {
      const c = veh.condiciones[0]
      setForm(f => ({
        ...f,
        codigo_plan: c.codigo_plan,
        valor_movil: c.precio_lista.toString(),
        cuota_pura: c.cuota2_sellado_tdf.toString(),
      }))
    }
  }

  const handleCondicionChange = (codigo: CodigoPlan | '') => {
    const cond = condicionesDisponibles.find(c => c.codigo_plan === codigo)
    setForm(f => ({
      ...f,
      codigo_plan: codigo as CodigoPlan | '',
      valor_movil: cond ? cond.precio_lista.toString() : f.valor_movil,
      cuota_pura: cond ? cond.cuota2_sellado_tdf.toString() : f.cuota_pura,
    }))
  }

  const crearAhorrista = useMutation({
    mutationFn: async () => {
      const veh = CATALOGO_VEHICULOS.find(v => v.codigo === form.vehiculo_codigo)
      const valorMovil = parseFloat(form.valor_movil) || 0
      const { error } = await supabase.from('ahorristas').insert({
        numero_solicitud: form.numero_solicitud,
        nombre_apellido: form.nombre_apellido,
        dni_cuil: form.dni_cuil,
        domicilio: form.domicilio || null,
        localidad: form.localidad || null,
        telefono: form.telefono || null,
        email: form.email || null,
        tipo_plan: form.tipo_plan,
        codigo_plan: form.codigo_plan,
        vehiculo_codigo: form.vehiculo_codigo,
        vehiculo_modelo: veh?.modelo ?? '',
        valor_movil: valorMovil,
        cuota_pura: parseFloat(form.cuota_pura) || 0,
        fecha_arranque: form.fecha_arranque,
        nro_recibo_c1: form.nro_recibo_c1 || null,
        es_subite: form.es_subite,
        vendedor_id: perfil?.id ?? null,
        vendedor_nombre: perfil?.nombre_completo ?? null,
        sucursal: form.sucursal,
        cuotas_pagas: 1,
        derecho_admision: valorMovil * REGLAS_FIAT_PLAN.DERECHO_ADMISION_PCT / 100,
        observaciones: form.observaciones || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ahorristas'] })
      toast.success('Alta registrada correctamente')
      setShowAlta(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const guardarGrupo = useMutation({
    mutationFn: async (ahorrista: Ahorrista) => {
      const { error } = await supabase.from('ahorristas')
        .update({
          grupo_id: formGrupo.grupo_id || null,
          numero_orden: formGrupo.numero_orden ? parseInt(formGrupo.numero_orden) : null,
        })
        .eq('id', ahorrista.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ahorristas'] })
      toast.success('Grupo y orden asignados')
      setAsignarGrupo(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const filtered = (ahorristas ?? []).filter(a => {
    if (!busqueda) return true
    const t = busqueda.toLowerCase()
    return a.nombre_apellido.toLowerCase().includes(t)
      || a.dni_cuil.includes(t)
      || a.numero_solicitud.toLowerCase().includes(t)
      || (a.vehiculo_modelo ?? '').toLowerCase().includes(t)
      || (a.vendedor_nombre ?? '').toLowerCase().includes(t)
  })

  // KPIs
  const all = ahorristas ?? []
  const activos = all.filter(a => a.estado === 'activo').length
  const adjudicados = all.filter(a => a.adjudicado).length
  const enRiesgo = all.filter(a => a.en_riesgo_rescision).length
  const adjSinIntegrar = all.filter(a => a.adjudicado && !a.integracion_completa && a.tipo_plan === 'H').length

  if (isLoading) return <Skeleton className="h-64" />

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserCheck className="h-6 w-6 text-action" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">Ahorristas — FIAT Plan</h1>
            <p className="text-sm text-text-secondary">Suscriptores de planes de ahorro</p>
          </div>
        </div>
        <button
          onClick={() => setShowAlta(true)}
          className="flex items-center gap-2 px-4 py-2 bg-action text-white rounded-lg text-sm font-medium hover:bg-action-hover transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Alta de cliente
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Activos</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{activos}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Adjudicados</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{adjudicados}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Adj. sin integrar (H)</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{adjSinIntegrar}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-red-400" /> Riesgo rescisión
          </p>
          <p className="text-2xl font-bold text-red-400 mt-1">{enRiesgo}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por nombre, DNI, solicitud, modelo o vendedor..."
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

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-semibold">Sin ahorristas</p>
          <p className="text-sm">Registrá un cliente con el botón "Alta de cliente"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const estadoInfo = ESTADOS_AHORRISTA[a.estado]
            const isExpanded = expandido === a.id
            return (
              <div key={a.id} className={`bg-bg-secondary border rounded-xl transition-colors ${
                a.en_riesgo_rescision ? 'border-red-500/50' : 'border-border hover:border-action/40'
              }`}>
                {/* Fila principal */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandido(isExpanded ? null : a.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-text-primary">{a.nombre_apellido}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${estadoInfo.color}`}>{estadoInfo.label}</span>
                        {a.adjudicado && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            <Award className="h-3 w-3" /> Adjudicado
                          </span>
                        )}
                        {a.en_riesgo_rescision && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                            <AlertTriangle className="h-3 w-3" /> 3 cuotas
                          </span>
                        )}
                        {a.es_subite && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">Subite</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-text-muted flex-wrap">
                        <span>Sol: {a.numero_solicitud}</span>
                        <span>{a.vehiculo_modelo}</span>
                        <span>Plan {a.tipo_plan} ({a.codigo_plan})</span>
                        <span>{a.cuotas_pagas} cuotas pagas</span>
                        <span>{a.sucursal}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-text-muted">
                        <span>Vendedor: <span className="text-text-secondary font-medium">{a.vendedor_nombre || '—'}</span></span>
                        <span>Cuota: <span className="text-text-secondary font-medium">{formatMoney(a.cuota_pura)}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {/* Botones contacto rápido */}
                      {a.telefono && (
                        <a
                          href={`https://wa.me/${a.telefono.replace(/\D/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-2 text-green-500 hover:text-green-400 transition-colors"
                          title="WhatsApp"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                      {a.email && (
                        <a
                          href={`mailto:${a.email}`}
                          onClick={e => e.stopPropagation()}
                          className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                          title="Email"
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
                    </div>
                  </div>
                </div>

                {/* Detalle expandido */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border pt-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-text-muted text-xs">DNI/CUIL</p>
                        <p className="text-text-primary font-medium">{a.dni_cuil}</p>
                      </div>
                      <div>
                        <p className="text-text-muted text-xs">Valor móvil</p>
                        <p className="text-text-primary font-medium">{formatMoney(a.valor_movil)}</p>
                      </div>
                      <div>
                        <p className="text-text-muted text-xs">Fecha arranque</p>
                        <p className="text-text-primary font-medium">{a.fecha_arranque}</p>
                      </div>
                      <div>
                        <p className="text-text-muted text-xs">Recibo C1</p>
                        <p className="text-text-primary font-medium">{a.nro_recibo_c1 || '—'}</p>
                      </div>
                      {a.derecho_admision && (
                        <div>
                          <p className="text-text-muted text-xs">Derecho admisión (2,5%)</p>
                          <p className="text-text-primary font-medium">{formatMoney(a.derecho_admision)}</p>
                        </div>
                      )}
                      {a.adjudicado && (
                        <>
                          <div>
                            <p className="text-text-muted text-xs">Tipo adjudicación</p>
                            <p className="text-text-primary font-medium capitalize">{a.tipo_adjudicacion || '—'}</p>
                          </div>
                          <div>
                            <p className="text-text-muted text-xs">Fecha adjudicación</p>
                            <p className="text-text-primary font-medium">{a.fecha_adjudicacion || '—'}</p>
                          </div>
                          {a.tipo_plan === 'H' && (
                            <div>
                              <p className="text-text-muted text-xs">Integración (24 cuotas)</p>
                              <p className={`font-medium ${a.integracion_completa ? 'text-green-400' : 'text-yellow-400'}`}>
                                {a.cuotas_integradas}/24 {a.integracion_completa ? '— Completa' : '— Pendiente'}
                              </p>
                            </div>
                          )}
                          {a.derecho_adjudicacion && (
                            <div>
                              <p className="text-text-muted text-xs">Derecho adj. (2%+IVA)</p>
                              <p className="text-text-primary font-medium">{formatMoney(a.derecho_adjudicacion)}</p>
                            </div>
                          )}
                        </>
                      )}
                      {a.cuotas_impagas_total > 0 && (
                        <div>
                          <p className="text-text-muted text-xs">Cuotas impagas</p>
                          <p className={`font-medium ${a.cuotas_impagas_total >= 3 ? 'text-red-400' : a.cuotas_impagas_total >= 2 ? 'text-orange-400' : 'text-yellow-400'}`}>
                            {a.cuotas_impagas_total} ({a.cuotas_impagas_consecutivas} consecutivas)
                          </p>
                        </div>
                      )}
                      {/* Grupo y orden (asignados por la terminal) */}
                      <div>
                        <p className="text-text-muted text-xs">Grupo</p>
                        <p className="text-text-primary font-medium">
                          {a.grupo ? a.grupo.numero_grupo : <span className="text-yellow-400">Pendiente terminal</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-muted text-xs">Orden</p>
                        <p className="text-text-primary font-medium">
                          {a.numero_orden ?? <span className="text-yellow-400">Pendiente</span>}
                        </p>
                      </div>
                      {a.domicilio && (
                        <div className="col-span-2">
                          <p className="text-text-muted text-xs">Domicilio</p>
                          <p className="text-text-primary">{a.domicilio}{a.localidad ? `, ${a.localidad}` : ''}</p>
                        </div>
                      )}
                      {a.observaciones && (
                        <div className="col-span-2 sm:col-span-4">
                          <p className="text-text-muted text-xs">Observaciones</p>
                          <p className="text-text-primary">{a.observaciones}</p>
                        </div>
                      )}
                    </div>
                    {/* Botón asignar grupo (cuando la terminal ya procesó) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setAsignarGrupo(a); setFormGrupo({ grupo_id: a.grupo_id ?? '', numero_orden: a.numero_orden?.toString() ?? '' }) }}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-500/20 transition-colors cursor-pointer"
                    >
                      <Link className="h-3.5 w-3.5" />
                      {a.grupo_id ? 'Cambiar grupo/orden' : 'Asignar grupo y orden (procesado por terminal)'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Alta de Cliente */}
      {showAlta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAlta(false)} />
          <div className="relative bg-bg-secondary border border-border rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowAlta(false)} className="absolute top-4 right-4 text-text-muted hover:text-text-primary cursor-pointer">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-text-primary mb-1">Alta de cliente — FIAT Plan</h2>
            <p className="text-sm text-text-secondary mb-4">Etapa 1: Suscripción</p>

            <form onSubmit={e => { e.preventDefault(); crearAhorrista.mutate() }} className="space-y-4">
              {/* Solicitud */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Nro. Solicitud *</label>
                  <input required value={form.numero_solicitud}
                    onChange={e => setForm(f => ({ ...f, numero_solicitud: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                    placeholder="SOL-00001"
                  />
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

              {/* Datos del cliente */}
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider pt-2">Datos del cliente</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-text-muted mb-1">Nombre y apellido *</label>
                  <input required value={form.nombre_apellido}
                    onChange={e => setForm(f => ({ ...f, nombre_apellido: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">DNI/CUIL *</label>
                  <input required value={form.dni_cuil}
                    onChange={e => setForm(f => ({ ...f, dni_cuil: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Teléfono</label>
                  <input value={form.telefono}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                    placeholder="+54 9 2901..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Email *</label>
                  <input required type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Domicilio</label>
                  <input value={form.domicilio}
                    onChange={e => setForm(f => ({ ...f, domicilio: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Localidad</label>
                  <input value={form.localidad}
                    onChange={e => setForm(f => ({ ...f, localidad: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  />
                </div>
              </div>

              {/* Plan y vehículo */}
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider pt-2">Plan y vehículo</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Tipo de plan *</label>
                  <select required value={form.tipo_plan}
                    onChange={e => setForm(f => ({ ...f, tipo_plan: e.target.value as TipoPlan }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary cursor-pointer">
                    {TIPOS_PLAN.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Vehículo *</label>
                  <select required value={form.vehiculo_codigo}
                    onChange={e => handleVehiculoChange(e.target.value as VehiculoCodigo | '')}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary cursor-pointer">
                    <option value="">Seleccionar...</option>
                    {CATALOGO_VEHICULOS.map(v => (
                      <option key={v.codigo} value={v.codigo}>{v.codigo} — {v.modelo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Condición del plan *</label>
                  <select required value={form.codigo_plan}
                    onChange={e => handleCondicionChange(e.target.value as CodigoPlan | '')}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary cursor-pointer">
                    <option value="">Seleccionar...</option>
                    {condicionesDisponibles.map(c => (
                      <option key={c.codigo_plan} value={c.codigo_plan}>{c.codigo_plan} — {c.plan}</option>
                    ))}
                    {condicionesDisponibles.length === 0 && form.vehiculo_codigo && (
                      CODIGOS_PLAN.map(c => <option key={c.value} value={c.value}>{c.label}</option>)
                    )}
                  </select>
                </div>
              </div>

              {/* Valores */}
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider pt-2">Valores y pago</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Valor móvil ($) *</label>
                  <input required type="number" value={form.valor_movil}
                    onChange={e => setForm(f => ({ ...f, valor_movil: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  />
                  {condicionSeleccionada && (
                    <p className="text-xs text-text-muted mt-0.5">Precio lista: {formatMoney(condicionSeleccionada.precio_lista)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Cuota cobrada ($) *</label>
                  <input required type="number" value={form.cuota_pura}
                    onChange={e => setForm(f => ({ ...f, cuota_pura: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  />
                  {condicionSeleccionada && (
                    <p className="text-xs text-text-muted mt-0.5">
                      C1: {formatMoney(condicionSeleccionada.cuota1_susc)} | C2+sellado: {formatMoney(condicionSeleccionada.cuota2_sellado_tdf)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Fecha de arranque *</label>
                  <input required type="date" value={form.fecha_arranque}
                    onChange={e => setForm(f => ({ ...f, fecha_arranque: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Nro. recibo C1</label>
                  <input value={form.nro_recibo_c1}
                    onChange={e => setForm(f => ({ ...f, nro_recibo_c1: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  />
                </div>
                <div className="flex items-center gap-3 pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.es_subite}
                      onChange={e => setForm(f => ({ ...f, es_subite: e.target.checked }))}
                      className="rounded border-border"
                    />
                    <span className="text-sm text-text-primary">Es Subite</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Observaciones</label>
                <textarea value={form.observaciones}
                  onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action resize-none"
                />
              </div>

              {/* Resumen automático */}
              {form.valor_movil && (
                <div className="bg-bg-tertiary rounded-lg p-3 text-xs text-text-secondary space-y-1">
                  <p className="font-semibold text-text-primary">Resumen del alta:</p>
                  <p>Derecho de admisión (2,5%): <span className="text-text-primary font-medium">{formatMoney(parseFloat(form.valor_movil) * 0.025)}</span></p>
                  <p>Vendedor: <span className="text-text-primary font-medium">{perfil?.nombre_completo || '—'}</span></p>
                  {form.tipo_plan === 'H' && <p className="text-yellow-400">Plan H: necesita 24 cuotas integradas para retirar la unidad</p>}
                </div>
              )}

              <button type="submit" disabled={crearAhorrista.isPending}
                className="w-full py-2.5 bg-action text-white rounded-lg text-sm font-medium hover:bg-action-hover transition-colors disabled:opacity-50 cursor-pointer">
                {crearAhorrista.isPending ? 'Registrando...' : 'Registrar alta'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Asignar Grupo y Orden (después de procesar en terminal) */}
      {asignarGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAsignarGrupo(null)} />
          <div className="relative bg-bg-secondary border border-border rounded-2xl p-6 w-full max-w-md mx-4">
            <button onClick={() => setAsignarGrupo(null)} className="absolute top-4 right-4 text-text-muted hover:text-text-primary cursor-pointer">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-text-primary mb-1">Asignar grupo y orden</h2>
            <p className="text-sm text-text-secondary mb-1">{asignarGrupo.nombre_apellido}</p>
            <p className="text-xs text-text-muted mb-4">Sol: {asignarGrupo.numero_solicitud} — Procesado por la terminal</p>

            <form onSubmit={e => { e.preventDefault(); guardarGrupo.mutate(asignarGrupo) }} className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Grupo asignado por terminal</label>
                <select value={formGrupo.grupo_id}
                  onChange={e => setFormGrupo(f => ({ ...f, grupo_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary cursor-pointer">
                  <option value="">Seleccionar grupo...</option>
                  {(grupos ?? []).map(g => <option key={g.id} value={g.id}>{g.numero_grupo} — {g.modelo} (Plan {g.tipo_plan})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Nro. de orden en el grupo</label>
                <input type="number" value={formGrupo.numero_orden}
                  onChange={e => setFormGrupo(f => ({ ...f, numero_orden: e.target.value }))}
                  className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                  placeholder="Ej: 45"
                />
              </div>
              <button type="submit" disabled={guardarGrupo.isPending}
                className="w-full py-2.5 bg-action text-white rounded-lg text-sm font-medium hover:bg-action-hover transition-colors disabled:opacity-50 cursor-pointer">
                {guardarGrupo.isPending ? 'Guardando...' : 'Guardar grupo y orden'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
