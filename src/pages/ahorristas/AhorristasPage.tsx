import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserCheck, Plus, Search, X, Phone, Mail, Award, AlertTriangle, ChevronDown, ChevronUp, Trash2, Pencil, Users, Trophy, MessageCircle, FileCheck,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Ahorrista, EstadoAhorrista, TipoPlan, CodigoPlan, VehiculoCodigo } from '../../lib/types'
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
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [agrupandoId, setAgrupandoId] = useState<string | null>(null)
  const [grupoInput, setGrupoInput] = useState('')
  const [ordenInput, setOrdenInput] = useState('')
  const [adjudicandoId, setAdjudicandoId] = useState<string | null>(null)
  const [adjTipo, setAdjTipo] = useState<'sorteo' | 'licitacion'>('sorteo')
  const [adjFecha, setAdjFecha] = useState(new Date().toISOString().split('T')[0])
  const [adjMontoLic, setAdjMontoLic] = useState('')
  const [moraId, setMoraId] = useState<string | null>(null)
  const [moraCuotas, setMoraCuotas] = useState('1')
  const [vendedores, setVendedores] = useState<{ id: string; nombre: string }[]>([])
  const [vendedorId, setVendedorId] = useState('')

  // Cargar vendedores
  useState(() => {
    supabase.from('usuarios').select('id, nombre_completo').eq('activo', true).order('nombre_completo').then(({ data }) => {
      if (data) setVendedores(data.map(u => ({ id: u.id, nombre: u.nombre_completo })))
    })
  })

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
        vendedor_id: vendedorId || perfil?.id || null,
        vendedor_nombre: vendedorId ? (vendedores.find(v => v.id === vendedorId)?.nombre ?? null) : (perfil?.nombre_completo ?? null),
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
      { setShowAlta(false); setEditandoId(null) }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const actualizarAhorrista = useMutation({
    mutationFn: async () => {
      if (!editandoId) throw new Error('Sin ID')
      const veh = CATALOGO_VEHICULOS.find(v => v.codigo === form.vehiculo_codigo)
      const valorMovil = parseFloat(form.valor_movil) || 0
      const { error } = await supabase.from('ahorristas').update({
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
        vendedor_id: vendedorId || perfil?.id || null,
        vendedor_nombre: vendedorId ? (vendedores.find(v => v.id === vendedorId)?.nombre ?? null) : (perfil?.nombre_completo ?? null),
        sucursal: form.sucursal,
        observaciones: form.observaciones || null,
      }).eq('id', editandoId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ahorristas'] })
      toast.success('Cliente actualizado')
      { setShowAlta(false); setEditandoId(null) }
      setEditandoId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function abrirEdicion(a: Ahorrista) {
    setForm({
      numero_solicitud: a.numero_solicitud,
      nombre_apellido: a.nombre_apellido,
      dni_cuil: a.dni_cuil,
      domicilio: a.domicilio || '',
      localidad: a.localidad || '',
      telefono: a.telefono || '',
      email: a.email || '',
      tipo_plan: a.tipo_plan as TipoPlan,
      codigo_plan: a.codigo_plan as CodigoPlan | '',
      vehiculo_codigo: a.vehiculo_codigo as VehiculoCodigo | '',
      valor_movil: String(a.valor_movil || ''),
      cuota_pura: String(a.cuota_pura || ''),
      fecha_arranque: a.fecha_arranque || '',
      nro_recibo_c1: a.nro_recibo_c1 || '',
      es_subite: a.es_subite || false,
      sucursal: a.sucursal as 'Ushuaia' | 'Rio Grande',
      observaciones: a.observaciones || '',
    })
    setVendedorId(a.vendedor_id || '')
    setEditandoId(a.id)
    setShowAlta(true)
  }

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
  const mesActual = new Date().getMonth()
  const anioActual = new Date().getFullYear()
  const agrupadosMes = all.filter(a => a.estado === 'agrupado' && a.updated_at && new Date(a.updated_at).getMonth() === mesActual && new Date(a.updated_at).getFullYear() === anioActual).length

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
          onClick={() => {
            setEditandoId(null)
            setVendedorId('')
            setForm({ numero_solicitud: '', nombre_apellido: '', dni_cuil: '', domicilio: '', localidad: '', telefono: '', email: '', tipo_plan: 'H' as TipoPlan, codigo_plan: '' as CodigoPlan | '', vehiculo_codigo: '' as VehiculoCodigo | '', valor_movil: '', cuota_pura: '', fecha_arranque: '', nro_recibo_c1: '', es_subite: false, sucursal: 'Ushuaia', observaciones: '' })
            setShowAlta(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-action text-white rounded-lg text-sm font-medium hover:bg-action-hover transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Alta de cliente
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Activos</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{activos}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Agrupados del mes</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1">{agrupadosMes}</p>
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
                        {a.adjudicado && (a as any).etapa_adjudicacion && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            (a as any).etapa_adjudicacion === 'aprobado' ? 'bg-green-100 text-green-800' :
                            (a as any).etapa_adjudicacion === 'facturado' ? 'bg-blue-100 text-blue-800' :
                            (a as any).etapa_adjudicacion === 'esperando_unidad' ? 'bg-yellow-100 text-yellow-800' :
                            (a as any).etapa_adjudicacion === 'papeles_listos' ? 'bg-purple-100 text-purple-800' :
                            (a as any).etapa_adjudicacion === 'certificado_listo' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {(a as any).etapa_adjudicacion === 'aprobado' ? 'Aprobado' :
                             (a as any).etapa_adjudicacion === 'facturado' ? 'Facturado' :
                             (a as any).etapa_adjudicacion === 'esperando_unidad' ? 'Esperando unidad' :
                             (a as any).etapa_adjudicacion === 'papeles_listos' ? 'Papeles listos' :
                             (a as any).etapa_adjudicacion === 'certificado_listo' ? 'Certificado listo' : ''}
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
                        {a.numero_orden && <span className="text-cyan-400 font-medium">Grupo: {(a as any).grupo?.numero_grupo || '—'} · Orden: {a.numero_orden}</span>}
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
                      {a.estado === 'activo' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setAgrupandoId(agrupandoId === a.id ? null : a.id)
                            setAdjudicandoId(null); setMoraId(null)
                            setGrupoInput('')
                            setOrdenInput('')
                          }}
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            agrupandoId === a.id ? 'bg-cyan-600 text-white' : 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10'
                          }`}
                          title="Agrupar"
                        >
                          <Users className="h-4 w-4" />
                        </button>
                      )}
                      {a.estado === 'agrupado' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setAdjudicandoId(adjudicandoId === a.id ? null : a.id)
                            setAgrupandoId(null); setMoraId(null)
                            setAdjFecha(new Date().toISOString().split('T')[0])
                            setAdjTipo('sorteo')
                            setAdjMontoLic('')
                          }}
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            adjudicandoId === a.id ? 'bg-blue-600 text-white' : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
                          }`}
                          title="Adjudicar"
                        >
                          <Trophy className="h-4 w-4" />
                        </button>
                      )}
                      {['activo', 'agrupado', 'adjudicado'].includes(a.estado) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMoraId(moraId === a.id ? null : a.id)
                            setAgrupandoId(null); setAdjudicandoId(null)
                            setMoraCuotas(String(a.cuotas_impagas_consecutivas || 1))
                          }}
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            moraId === a.id ? 'bg-orange-600 text-white' : 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/10'
                          }`}
                          title="Gestionar mora"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          abrirEdicion(a)
                        }}
                        className="p-2 text-text-muted hover:text-action hover:bg-action/10 rounded-lg transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (eliminando === a.id) {
                            const { error } = await supabase.from('ahorristas').delete().eq('id', a.id)
                            if (error) { toast.error(error.message); setEliminando(null); return }
                            toast.success('Cliente eliminado')
                            setEliminando(null)
                            queryClient.invalidateQueries({ queryKey: ['ahorristas'] })
                          } else {
                            setEliminando(a.id)
                            setTimeout(() => setEliminando(null), 3000)
                          }
                        }}
                        className={`p-2 rounded-lg transition-colors cursor-pointer ${
                          eliminando === a.id ? 'bg-red-600 text-white' : 'text-text-muted hover:text-red-400 hover:bg-red-500/10'
                        }`}
                        title={eliminando === a.id ? 'Click para confirmar' : 'Eliminar'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
                    </div>
                  </div>
                </div>

                {/* Mini-form agrupar */}
                {agrupandoId === a.id && (
                  <div className="px-4 pb-3 border-t border-cyan-500/30 bg-cyan-950/20">
                    <div className="flex items-end gap-3 pt-3">
                      <div className="flex-1">
                        <label className="block text-xs text-cyan-400 mb-1 font-medium">N° Grupo *</label>
                        <input
                          type="text"
                          value={grupoInput}
                          onChange={e => setGrupoInput(e.target.value)}
                          placeholder="Ej: G-001"
                          onClick={e => e.stopPropagation()}
                          className="w-full px-3 py-2 bg-bg-input border border-cyan-500/40 rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-cyan-400 mb-1 font-medium">N° Orden *</label>
                        <input
                          type="number"
                          value={ordenInput}
                          onChange={e => setOrdenInput(e.target.value)}
                          placeholder="Ej: 15"
                          onClick={e => e.stopPropagation()}
                          className="w-full px-3 py-2 bg-bg-input border border-cyan-500/40 rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!grupoInput.trim()) { toast.error('Ingresá el número de grupo'); return }
                          if (!ordenInput.trim()) { toast.error('Ingresá el número de orden'); return }
                          const { error } = await supabase.from('ahorristas').update({
                            estado: 'agrupado',
                            numero_orden: parseInt(ordenInput),
                          }).eq('id', a.id)
                          if (error) { toast.error(error.message); return }
                          // Buscar o crear grupo
                          const { data: grupoExistente } = await supabase
                            .from('grupos_ahorro')
                            .select('id')
                            .eq('numero_grupo', grupoInput.trim())
                            .maybeSingle()
                          if (grupoExistente) {
                            await supabase.from('ahorristas').update({ grupo_id: grupoExistente.id }).eq('id', a.id)
                          } else {
                            const { data: nuevoGrupo } = await supabase.from('grupos_ahorro').insert({
                              numero_grupo: grupoInput.trim(),
                              tipo_plan: a.tipo_plan,
                              modelo: a.vehiculo_modelo,
                              sucursal: a.sucursal,
                            }).select('id').single()
                            if (nuevoGrupo) {
                              await supabase.from('ahorristas').update({ grupo_id: nuevoGrupo.id }).eq('id', a.id)
                            }
                          }
                          toast.success(`${a.nombre_apellido} agrupado en ${grupoInput} orden ${ordenInput}`)
                          setAgrupandoId(null)
                          queryClient.invalidateQueries({ queryKey: ['ahorristas'] })
                        }}
                        className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-500 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Agrupar
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setAgrupandoId(null) }}
                        className="p-2 text-text-muted hover:text-text-primary cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Mini-form adjudicar */}
                {adjudicandoId === a.id && (
                  <div className="px-4 pb-3 border-t border-blue-500/30 bg-blue-950/20">
                    <div className="flex items-end gap-3 pt-3 flex-wrap">
                      <div>
                        <label className="block text-xs text-blue-400 mb-1 font-medium">Tipo *</label>
                        <select value={adjTipo} onChange={e => setAdjTipo(e.target.value as any)}
                          onClick={e => e.stopPropagation()}
                          className="px-3 py-2 bg-bg-input border border-blue-500/40 rounded-lg text-sm text-text-primary cursor-pointer">
                          <option value="sorteo">Sorteo</option>
                          <option value="licitacion">Licitación</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-blue-400 mb-1 font-medium">Fecha *</label>
                        <input type="date" value={adjFecha} onChange={e => setAdjFecha(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="px-3 py-2 bg-bg-input border border-blue-500/40 rounded-lg text-sm text-text-primary" />
                      </div>
                      {adjTipo === 'licitacion' && (
                        <div>
                          <label className="block text-xs text-blue-400 mb-1 font-medium">Monto licitación</label>
                          <input type="number" value={adjMontoLic} onChange={e => setAdjMontoLic(e.target.value)}
                            onClick={e => e.stopPropagation()} placeholder="$"
                            className="px-3 py-2 bg-bg-input border border-blue-500/40 rounded-lg text-sm text-text-primary w-32" />
                        </div>
                      )}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          const derAdj = a.valor_movil * 0.02 * 1.21
                          const { error } = await supabase.from('ahorristas').update({
                            estado: 'adjudicado',
                            adjudicado: true,
                            tipo_adjudicacion: adjTipo,
                            fecha_adjudicacion: adjFecha,
                            monto_licitacion: adjTipo === 'licitacion' && adjMontoLic ? parseFloat(adjMontoLic) : null,
                            derecho_adjudicacion: derAdj,
                          }).eq('id', a.id)
                          if (error) { toast.error(error.message); return }
                          toast.success(`${a.nombre_apellido} adjudicado por ${adjTipo}`)
                          setAdjudicandoId(null)
                          queryClient.invalidateQueries({ queryKey: ['ahorristas'] })
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Adjudicar
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setAdjudicandoId(null) }}
                        className="p-2 text-text-muted hover:text-text-primary cursor-pointer">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Mini-form mora */}
                {moraId === a.id && (
                  <div className="px-4 pb-3 border-t border-orange-500/30 bg-orange-950/20">
                    <div className="flex items-end gap-3 pt-3 flex-wrap">
                      <div>
                        <label className="block text-xs text-orange-400 mb-1 font-medium">Cuotas impagas consecutivas</label>
                        <input type="number" value={moraCuotas} onChange={e => setMoraCuotas(e.target.value)}
                          onClick={e => e.stopPropagation()} min="0" max="84"
                          className="px-3 py-2 bg-bg-input border border-orange-500/40 rounded-lg text-sm text-text-primary w-24" />
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          const cuotas = parseInt(moraCuotas) || 0
                          const { error } = await supabase.from('ahorristas').update({
                            cuotas_impagas_consecutivas: cuotas,
                            cuotas_impagas_total: Math.max(a.cuotas_impagas_total, cuotas),
                            en_riesgo_rescision: cuotas >= 3,
                          }).eq('id', a.id)
                          if (error) { toast.error(error.message); return }
                          toast.success(cuotas >= 3 ? `⚠️ ${a.nombre_apellido} en riesgo de rescisión (${cuotas} cuotas)` : `Mora actualizada: ${cuotas} cuotas`)
                          setMoraId(null)
                          queryClient.invalidateQueries({ queryKey: ['ahorristas'] })
                        }}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-500 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Actualizar mora
                      </button>
                      {a.telefono && (
                        <a
                          href={`https://wa.me/${a.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Hola ${a.nombre_apellido.split(' ')[0]}, nos comunicamos de Liendo Automotores. Detectamos que tenés ${moraCuotas} cuota/s impaga/s en tu plan FIAT (${a.vehiculo_modelo}). ¿Podemos coordinar la regularización?`
                          )}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 transition-colors whitespace-nowrap"
                        >
                          <MessageCircle className="h-4 w-4" /> WhatsApp mora
                        </a>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setMoraId(null) }}
                        className="p-2 text-text-muted hover:text-text-primary cursor-pointer">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {parseInt(moraCuotas) >= 3 && (
                      <p className="text-xs text-red-400 mt-2 font-medium">⚠️ Con 3+ cuotas consecutivas impagas se activa riesgo de rescisión</p>
                    )}
                  </div>
                )}

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

                    {/* Checklist carpeta + documentación para adjudicados */}
                    {a.adjudicado && (
                      <div className="mt-4 border-t border-border pt-3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <FileCheck className="h-4 w-4 text-blue-400" />
                            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Carpeta de adjudicación</p>
                          </div>
                          <button
                            onClick={async () => {
                              if (!confirm(`¿Desadjudicar a ${a.nombre_apellido}? Vuelve a estado "agrupado".`)) return
                              const { error } = await supabase.from('ahorristas').update({
                                estado: 'desadjudicado',
                                adjudicado: false,
                                acepto_adjudicacion: false,
                              }).eq('id', a.id)
                              if (error) toast.error(error.message)
                              else {
                                toast.success(`${a.nombre_apellido} desadjudicado — no completó la carpeta`)
                                queryClient.invalidateQueries({ queryKey: ['ahorristas'] })
                              }
                            }}
                            className="text-xs px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors cursor-pointer"
                          >
                            Desadjudicar
                          </button>
                        </div>

                        {/* Etapa adjudicación */}
                        <div className="mb-3">
                          <label className="block text-xs text-blue-400 font-medium mb-1.5">Etapa de adjudicación:</label>
                          <div className="flex gap-1.5 flex-wrap">
                            {[
                              { val: 'aprobado', label: 'Aprobado', color: 'bg-green-600' },
                              { val: 'facturado', label: 'Facturado', color: 'bg-blue-600' },
                              { val: 'esperando_unidad', label: 'Esperando unidad', color: 'bg-yellow-600' },
                              { val: 'papeles_listos', label: 'Papeles listos', color: 'bg-purple-600' },
                              { val: 'certificado_listo', label: 'Certificado listo', color: 'bg-emerald-600' },
                            ].map(etapa => (
                              <button key={etapa.val}
                                onClick={async () => {
                                  const { error } = await supabase.from('ahorristas')
                                    .update({ etapa_adjudicacion: etapa.val })
                                    .eq('id', a.id)
                                  if (error) toast.error(error.message)
                                  else {
                                    toast.success(`Etapa: ${etapa.label}`)
                                    queryClient.invalidateQueries({ queryKey: ['ahorristas'] })
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                                  (a as any).etapa_adjudicacion === etapa.val
                                    ? `${etapa.color} text-white`
                                    : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                                }`}
                              >
                                {etapa.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Checklist carpeta */}
                        <p className="text-xs text-blue-400 font-medium mb-2">Documentación requerida:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                          {[
                            { key: 'acepto_adjudicacion', label: 'Aceptó adjudicación' },
                            { key: 'doc_dni', label: 'DNI frente y dorso' },
                            { key: 'doc_domicilio', label: 'Comprobante de domicilio' },
                            { key: 'doc_ingresos', label: 'Comprobante de ingresos' },
                            { key: 'doc_cbu', label: 'CBU / Cuenta bancaria' },
                            { key: 'doc_veraz', label: 'Veraz apto' },
                            { key: 'doc_garante', label: 'Garante presentado' },
                            { key: 'integracion_completa', label: a.tipo_plan === 'H' ? 'Integración 24 cuotas' : 'Integración completa' },
                            { key: 'cambio_modelo', label: 'Cambio de modelo (si aplica)' },
                          ].map(doc => (
                            <label key={doc.key} className="flex items-center gap-2 text-xs cursor-pointer bg-bg-tertiary rounded-lg px-3 py-2 hover:bg-bg-tertiary/80">
                              <input
                                type="checkbox"
                                checked={!!(a as any)[doc.key]}
                                onChange={async (e) => {
                                  const { error } = await supabase.from('ahorristas')
                                    .update({ [doc.key]: e.target.checked })
                                    .eq('id', a.id)
                                  if (error) toast.error(error.message)
                                  else queryClient.invalidateQueries({ queryKey: ['ahorristas'] })
                                }}
                                className="rounded cursor-pointer"
                              />
                              <span className={`${(a as any)[doc.key] ? 'text-green-400' : 'text-text-secondary'}`}>{doc.label}</span>
                            </label>
                          ))}
                        </div>

                        {/* Integración Plan H */}
                        {a.tipo_plan === 'H' && !a.integracion_completa && (
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-xs text-text-muted">Cuotas integradas:</label>
                            <input type="number" min="0" max="24" value={a.cuotas_integradas || 0}
                              onChange={async (e) => {
                                const val = parseInt(e.target.value) || 0
                                const { error } = await supabase.from('ahorristas').update({
                                  cuotas_integradas: val,
                                  integracion_completa: val >= 24,
                                }).eq('id', a.id)
                                if (error) toast.error(error.message)
                                else queryClient.invalidateQueries({ queryKey: ['ahorristas'] })
                              }}
                              className="w-16 px-2 py-1 bg-bg-input border border-border rounded text-sm text-text-primary text-center"
                            />
                            <span className="text-xs text-text-muted">/ 24</span>
                            <div className="flex-1 bg-bg-tertiary rounded-full h-2">
                              <div className="bg-yellow-500 rounded-full h-2 transition-all" style={{ width: `${Math.min(100, ((a.cuotas_integradas || 0) / 24) * 100)}%` }} />
                            </div>
                          </div>
                        )}

                        {/* Alerta carpeta incompleta */}
                        {a.fecha_limite_aceptacion && !a.acepto_adjudicacion && (
                          <p className="text-xs text-red-400 mt-2 font-medium">
                            Fecha límite para aceptar: {a.fecha_limite_aceptacion} — Si no completa la carpeta, se desadjudica.
                          </p>
                        )}
                      </div>
                    )}

                    {/* WhatsApp rápido */}
                    {a.telefono && (
                      <div className="mt-3 flex gap-2 flex-wrap">
                        <a href={`https://wa.me/${a.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Hola ${a.nombre_apellido.split(' ')[0]}, nos comunicamos de Liendo Automotores respecto a tu plan FIAT ${a.vehiculo_modelo}. ¿Tenés un momento?`
                        )}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-500 transition-colors">
                          <MessageCircle className="h-3 w-3" /> WhatsApp
                        </a>
                        {a.adjudicado && !a.acepto_adjudicacion && (
                          <a href={`https://wa.me/${a.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Hola ${a.nombre_apellido.split(' ')[0]}! Te informamos que fuiste adjudicado/a en tu plan FIAT ${a.vehiculo_modelo} por ${a.tipo_adjudicacion || 'sorteo'} el ${a.fecha_adjudicacion || 'día de hoy'}. Necesitamos que te acerques a la sucursal para aceptar la adjudicación y presentar la documentación. ¿Podemos coordinar?`
                          )}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-500 transition-colors">
                            <MessageCircle className="h-3 w-3" /> WA: Notificar adjudicación
                          </a>
                        )}
                        {a.cuotas_impagas_consecutivas > 0 && (
                          <a href={`https://wa.me/${a.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Hola ${a.nombre_apellido.split(' ')[0]}, nos comunicamos de Liendo Automotores. Detectamos que tenés ${a.cuotas_impagas_consecutivas} cuota/s impaga/s en tu plan FIAT (${a.vehiculo_modelo}). ¿Podemos coordinar la regularización?`
                          )}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-500 transition-colors">
                            <MessageCircle className="h-3 w-3" /> WA: Gestión mora
                          </a>
                        )}
                      </div>
                    )}
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
          <div className="absolute inset-0 bg-black/60" onClick={() => { setShowAlta(false); setEditandoId(null) }} />
          <div className="relative bg-bg-secondary border border-border rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setShowAlta(false); setEditandoId(null) }} className="absolute top-4 right-4 text-text-muted hover:text-text-primary cursor-pointer">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-text-primary mb-1">{editandoId ? 'Editar cliente — FIAT Plan' : 'Alta de cliente — FIAT Plan'}</h2>
            <p className="text-sm text-text-secondary mb-4">{editandoId ? 'Modificar datos del suscriptor' : 'Etapa 1: Suscripción'}</p>

            <form onSubmit={e => { e.preventDefault(); editandoId ? actualizarAhorrista.mutate() : crearAhorrista.mutate() }} className="space-y-4">
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

              {/* Vendedor */}
              <div>
                <label className="block text-xs text-text-muted mb-1">Vendedor *</label>
                <select value={vendedorId} onChange={e => setVendedorId(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action">
                  <option value="">Seleccionar vendedor...</option>
                  {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                </select>
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
                  <p>Vendedor: <span className="text-text-primary font-medium">{vendedorId ? vendedores.find(v => v.id === vendedorId)?.nombre : perfil?.nombre_completo || '—'}</span></p>
                  {form.tipo_plan === 'H' && <p className="text-yellow-400">Plan H: necesita 24 cuotas integradas para retirar la unidad</p>}
                </div>
              )}

              <button type="submit" disabled={crearAhorrista.isPending || actualizarAhorrista.isPending}
                className="w-full py-2.5 bg-action text-white rounded-lg text-sm font-medium hover:bg-action-hover transition-colors disabled:opacity-50 cursor-pointer">
                {editandoId
                  ? (actualizarAhorrista.isPending ? 'Guardando...' : 'Guardar cambios')
                  : (crearAhorrista.isPending ? 'Registrando...' : 'Registrar alta')
                }
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
