import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Textarea } from '../../components/ui/Textarea'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { SearchInput } from '../../components/ui/SearchInput'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/LoadingSkeleton'
import { notify } from '../../components/ui/Toast'
import {
  TIPOS_CONSULTA, ESTADOS_VISITA,
  CALIFICACIONES_ATENCION, SUCURSALES_SELECT,
} from '../../lib/constants'
import type { VisitaRecepcion, TipoConsulta, EstadoVisita, Sucursal } from '../../lib/types'
import {
  Plus, Clock, UserCheck, CheckCircle2, Phone, Mail, Star,
  ClipboardList, User,
} from 'lucide-react'
import { format } from 'date-fns'

// ─── Helpers ────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function badgeColor(tipo: TipoConsulta): 'purple' | 'blue' | 'orange' | 'gray' {
  const map: Record<TipoConsulta, 'purple' | 'blue' | 'orange' | 'gray'> = {
    administracion: 'purple',
    ventas: 'blue',
    postventa: 'orange',
    repuestos: 'gray',
  }
  return map[tipo]
}

function estadoBadgeColor(estado: EstadoVisita): 'yellow' | 'blue' | 'green' {
  const map: Record<EstadoVisita, 'yellow' | 'blue' | 'green'> = {
    en_espera: 'yellow',
    atendido: 'blue',
    finalizado: 'green',
  }
  return map[estado]
}

// ─── Form interfaces ────────────────────────────────────────────────

interface NuevaVisitaForm {
  visitante_nombre: string
  visitante_telefono: string
  visitante_email: string
  sucursal: Sucursal | ''
  tipo_consulta: TipoConsulta | ''
  admin_motivo: string
  ventas_asesor_asignado: string
  observaciones: string
}

const INITIAL_NUEVA: NuevaVisitaForm = {
  visitante_nombre: '',
  visitante_telefono: '',
  visitante_email: '',
  sucursal: '',
  tipo_consulta: '',
  admin_motivo: '',
  ventas_asesor_asignado: '',
  observaciones: '',
}

interface FinalizarForm {
  admin_resuelto: boolean
  admin_observaciones: string
  ventas_asesor_asignado: string
  ventas_consulta_resuelta: boolean
  ventas_calificacion_atencion: number | ''
  ventas_quiere_que_lo_llamen: boolean
  ventas_telefono_callback: string
  observaciones: string
}

const INITIAL_FINALIZAR: FinalizarForm = {
  admin_resuelto: false,
  admin_observaciones: '',
  ventas_asesor_asignado: '',
  ventas_consulta_resuelta: false,
  ventas_calificacion_atencion: '',
  ventas_quiere_que_lo_llamen: false,
  ventas_telefono_callback: '',
  observaciones: '',
}

// ─── Component ──────────────────────────────────────────────────────

export function RecepcionPage() {
  const { perfil } = useAuth()
  const queryClient = useQueryClient()

  // State
  const [fecha, setFecha] = useState(todayStr())
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoConsulta | ''>('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoVisita | ''>('')

  const [showNueva, setShowNueva] = useState(false)
  const [nuevaForm, setNuevaForm] = useState<NuevaVisitaForm>({
    ...INITIAL_NUEVA,
    sucursal: perfil?.sucursal === 'Ushuaia' ? 'Ushuaia'
              : perfil?.sucursal === 'Rio Grande' ? 'Rio Grande'
              : '',
  })
  const [creando, setCreando] = useState(false)

  const [showFinalizar, setShowFinalizar] = useState(false)
  const [visitaFinalizar, setVisitaFinalizar] = useState<VisitaRecepcion | null>(null)
  const [finForm, setFinForm] = useState<FinalizarForm>(INITIAL_FINALIZAR)
  const [finalizando, setFinalizando] = useState(false)

  // Derived sucursal for query
  const sucursalQuery = perfil?.sucursal === 'Ambas' ? null : perfil?.sucursal

  // ─── Query ──────────────────────────────────────────────────────

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ['visitas-recepcion', fecha, sucursalQuery],
    queryFn: async () => {
      const startOfDay = `${fecha}T00:00:00`
      const endOfDay = `${fecha}T23:59:59`

      let q = supabase
        .from('visitas_recepcion')
        .select('*')
        .gte('fecha_hora_ingreso', startOfDay)
        .lte('fecha_hora_ingreso', endOfDay)
        .order('fecha_hora_ingreso', { ascending: false })

      if (sucursalQuery) {
        q = q.eq('sucursal', sucursalQuery)
      }

      const { data, error } = await q
      if (error) throw error
      return (data || []) as VisitaRecepcion[]
    },
  })

  // ─── Filtered list ──────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = visitas
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(v =>
        v.visitante_nombre.toLowerCase().includes(s) ||
        v.visitante_telefono?.toLowerCase().includes(s) ||
        v.visitante_email?.toLowerCase().includes(s)
      )
    }
    if (filtroTipo) list = list.filter(v => v.tipo_consulta === filtroTipo)
    if (filtroEstado) list = list.filter(v => v.estado === filtroEstado)
    return list
  }, [visitas, search, filtroTipo, filtroEstado])

  // ─── Counters ─────────────────────────────────────────────────

  const contadores = useMemo(() => ({
    en_espera: visitas.filter(v => v.estado === 'en_espera').length,
    atendido: visitas.filter(v => v.estado === 'atendido').length,
    finalizado: visitas.filter(v => v.estado === 'finalizado').length,
    total: visitas.length,
  }), [visitas])

  // ─── Mutations ────────────────────────────────────────────────

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['visitas-recepcion'] })

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevaForm.visitante_nombre.trim()) return notify.error('El nombre es obligatorio')
    if (!nuevaForm.sucursal) return notify.error('Selecciona la sucursal')
    if (!nuevaForm.tipo_consulta) return notify.error('Selecciona el tipo de consulta')

    setCreando(true)
    try {
      const { error } = await supabase.from('visitas_recepcion').insert({
        visitante_nombre: nuevaForm.visitante_nombre.trim(),
        visitante_telefono: nuevaForm.visitante_telefono.trim() || null,
        visitante_email: nuevaForm.visitante_email.trim() || null,
        sucursal: nuevaForm.sucursal,
        tipo_consulta: nuevaForm.tipo_consulta,
        admin_motivo: nuevaForm.tipo_consulta === 'administracion' ? (nuevaForm.admin_motivo.trim() || null) : null,
        ventas_asesor_asignado: nuevaForm.tipo_consulta === 'ventas' ? (nuevaForm.ventas_asesor_asignado.trim() || null) : null,
        observaciones: nuevaForm.observaciones.trim() || null,
        created_by: perfil?.id,
      })
      if (error) throw error
      notify.success('Visita registrada')
      invalidate()
      setShowNueva(false)
      setNuevaForm({
        ...INITIAL_NUEVA,
        sucursal: perfil?.sucursal === 'Ushuaia' ? 'Ushuaia'
                  : perfil?.sucursal === 'Rio Grande' ? 'Rio Grande'
                  : '',
      })
    } catch (err: any) {
      notify.error(err?.message || 'Error al registrar visita')
    } finally {
      setCreando(false)
    }
  }

  const handleAtender = async (visita: VisitaRecepcion) => {
    const { error } = await supabase
      .from('visitas_recepcion')
      .update({
        estado: 'atendido',
        fecha_hora_atencion: new Date().toISOString(),
      })
      .eq('id', visita.id)
    if (error) {
      notify.error('Error al marcar como atendido')
      return
    }
    notify.success(`${visita.visitante_nombre} marcado como atendido`)
    invalidate()
  }

  const openFinalizar = (visita: VisitaRecepcion) => {
    setVisitaFinalizar(visita)
    setFinForm({
      ...INITIAL_FINALIZAR,
      ventas_asesor_asignado: visita.ventas_asesor_asignado || '',
    })
    setShowFinalizar(true)
  }

  const handleFinalizar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!visitaFinalizar) return

    setFinalizando(true)
    try {
      const updates: Record<string, unknown> = {
        estado: 'finalizado',
        fecha_hora_finalizacion: new Date().toISOString(),
        observaciones: finForm.observaciones.trim() || visitaFinalizar.observaciones,
      }

      if (visitaFinalizar.tipo_consulta === 'administracion') {
        updates.admin_resuelto = finForm.admin_resuelto
        updates.admin_observaciones = finForm.admin_observaciones.trim() || null
      }

      if (visitaFinalizar.tipo_consulta === 'ventas') {
        updates.ventas_asesor_asignado = finForm.ventas_asesor_asignado.trim() || null
        updates.ventas_consulta_resuelta = finForm.ventas_consulta_resuelta
        updates.ventas_calificacion_atencion = finForm.ventas_calificacion_atencion || null
        updates.ventas_quiere_que_lo_llamen = finForm.ventas_quiere_que_lo_llamen
        updates.ventas_telefono_callback = finForm.ventas_quiere_que_lo_llamen
          ? (finForm.ventas_telefono_callback.trim() || visitaFinalizar.visitante_telefono)
          : null
      }

      const { error } = await supabase
        .from('visitas_recepcion')
        .update(updates)
        .eq('id', visitaFinalizar.id)

      if (error) throw error
      notify.success('Visita finalizada')
      invalidate()
      setShowFinalizar(false)
      setVisitaFinalizar(null)
    } catch (err: any) {
      notify.error(err?.message || 'Error al finalizar visita')
    } finally {
      setFinalizando(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            Recepcion
          </h1>
          <p className="text-sm text-text-secondary">Registro de visitas al concesionario</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
          />
          <Button onClick={() => setShowNueva(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva visita
          </Button>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-bg-secondary rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-text-primary">{contadores.total}</p>
          <p className="text-xs text-text-muted">Total del dia</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-700">{contadores.en_espera}</p>
          <p className="text-xs text-yellow-600 flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" /> En espera
          </p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{contadores.atendido}</p>
          <p className="text-xs text-blue-600 flex items-center justify-center gap-1">
            <UserCheck className="h-3 w-3" /> Atendidos
          </p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{contadores.finalizado}</p>
          <p className="text-xs text-green-600 flex items-center justify-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Finalizados
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, telefono o email..."
          className="flex-1"
        />
        <Select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value as TipoConsulta | '')}
          options={[
            { value: '', label: 'Todos los tipos' },
            ...TIPOS_CONSULTA.map(t => ({ value: t.value, label: t.label })),
          ]}
        />
        <Select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value as EstadoVisita | '')}
          options={[
            { value: '', label: 'Todos los estados' },
            { value: 'en_espera', label: 'En espera' },
            { value: 'atendido', label: 'Atendido' },
            { value: 'finalizado', label: 'Finalizado' },
          ]}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Sin visitas"
          description={search || filtroTipo || filtroEstado
            ? 'No hay visitas con esos filtros'
            : `No hay visitas registradas para el ${fecha}`}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(visita => (
            <div
              key={visita.id}
              className="bg-bg-secondary rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text-primary">{visita.visitante_nombre}</span>
                  <Badge color={badgeColor(visita.tipo_consulta)} size="sm">
                    {TIPOS_CONSULTA.find(t => t.value === visita.tipo_consulta)?.label || visita.tipo_consulta}
                  </Badge>
                  <Badge color={estadoBadgeColor(visita.estado)} size="sm">
                    {ESTADOS_VISITA[visita.estado].label}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-text-muted flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(visita.fecha_hora_ingreso), 'HH:mm')}
                  </span>
                  {visita.visitante_telefono && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {visita.visitante_telefono}
                    </span>
                  )}
                  {visita.visitante_email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {visita.visitante_email}
                    </span>
                  )}
                  {visita.ventas_asesor_asignado && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Asesor: {visita.ventas_asesor_asignado}
                    </span>
                  )}
                  {visita.sucursal && perfil?.sucursal === 'Ambas' && (
                    <span>{visita.sucursal}</span>
                  )}
                </div>
                {visita.observaciones && (
                  <p className="text-xs text-text-muted mt-1 italic truncate">{visita.observaciones}</p>
                )}
                {visita.estado === 'finalizado' && visita.tipo_consulta === 'administracion' && (
                  <p className="text-xs mt-1">
                    {visita.admin_resuelto
                      ? <span className="text-green-600">Resuelto</span>
                      : <span className="text-red-600">No resuelto</span>}
                    {visita.admin_observaciones && <span className="text-text-muted ml-2">— {visita.admin_observaciones}</span>}
                  </p>
                )}
                {visita.estado === 'finalizado' && visita.tipo_consulta === 'ventas' && (
                  <div className="flex items-center gap-3 text-xs mt-1 flex-wrap">
                    {visita.ventas_consulta_resuelta
                      ? <span className="text-green-600">Consulta resuelta</span>
                      : <span className="text-red-600">Consulta no resuelta</span>}
                    {visita.ventas_calificacion_atencion && (
                      <span className="flex items-center gap-0.5 text-yellow-600">
                        <Star className="h-3 w-3" />
                        {visita.ventas_calificacion_atencion}/5
                      </span>
                    )}
                    {visita.ventas_quiere_que_lo_llamen && (
                      <span className="text-blue-600 flex items-center gap-0.5">
                        <Phone className="h-3 w-3" />
                        Quiere que lo llamen
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {visita.estado === 'en_espera' && (
                  <Button size="sm" variant="secondary" onClick={() => handleAtender(visita)}>
                    <UserCheck className="h-3.5 w-3.5 mr-1" />
                    Atender
                  </Button>
                )}
                {(visita.estado === 'en_espera' || visita.estado === 'atendido') && (
                  <Button size="sm" onClick={() => openFinalizar(visita)}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Finalizar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Modal: Nueva Visita ──────────────────────────────────── */}
      <Modal open={showNueva} onClose={() => setShowNueva(false)} title="Registrar visita" size="md">
        <form onSubmit={handleCrear} className="space-y-4">
          <Input
            label="Nombre del visitante *"
            value={nuevaForm.visitante_nombre}
            onChange={e => setNuevaForm(f => ({ ...f, visitante_nombre: e.target.value }))}
            placeholder="Nombre y Apellido"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Telefono"
              type="tel"
              value={nuevaForm.visitante_telefono}
              onChange={e => setNuevaForm(f => ({ ...f, visitante_telefono: e.target.value }))}
              placeholder="+54 9 2964 000000"
            />
            <Input
              label="Email"
              type="email"
              value={nuevaForm.visitante_email}
              onChange={e => setNuevaForm(f => ({ ...f, visitante_email: e.target.value }))}
              placeholder="email@ejemplo.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {perfil?.sucursal === 'Ambas' && (
              <Select
                label="Sucursal *"
                value={nuevaForm.sucursal}
                onChange={e => setNuevaForm(f => ({ ...f, sucursal: e.target.value as Sucursal }))}
                options={[{ value: '', label: 'Seleccionar...' }, ...SUCURSALES_SELECT]}
              />
            )}
            <Select
              label="Tipo de consulta *"
              value={nuevaForm.tipo_consulta}
              onChange={e => setNuevaForm(f => ({ ...f, tipo_consulta: e.target.value as TipoConsulta }))}
              options={[{ value: '', label: 'Seleccionar...' }, ...TIPOS_CONSULTA.map(t => ({ value: t.value, label: t.label }))]}
            />
          </div>

          {nuevaForm.tipo_consulta === 'administracion' && (
            <Textarea
              label="Motivo de la visita"
              value={nuevaForm.admin_motivo}
              onChange={e => setNuevaForm(f => ({ ...f, admin_motivo: e.target.value }))}
              placeholder="Ej: Vino a pagar una cuota, retirar documentacion..."
              rows={2}
            />
          )}

          {nuevaForm.tipo_consulta === 'ventas' && (
            <Input
              label="Asesor asignado"
              value={nuevaForm.ventas_asesor_asignado}
              onChange={e => setNuevaForm(f => ({ ...f, ventas_asesor_asignado: e.target.value }))}
              placeholder="Nombre del asesor que lo atiende"
            />
          )}

          <Textarea
            label="Observaciones"
            value={nuevaForm.observaciones}
            onChange={e => setNuevaForm(f => ({ ...f, observaciones: e.target.value }))}
            placeholder="Notas adicionales..."
            rows={2}
          />

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowNueva(false)}>Cancelar</Button>
            <Button type="submit" loading={creando}>
              <Plus className="h-4 w-4 mr-1" />
              Registrar ingreso
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Modal: Finalizar Visita ─────────────────────────────── */}
      <Modal
        open={showFinalizar}
        onClose={() => { setShowFinalizar(false); setVisitaFinalizar(null) }}
        title={`Finalizar visita — ${visitaFinalizar?.visitante_nombre || ''}`}
        size="md"
      >
        {visitaFinalizar && (
          <form onSubmit={handleFinalizar} className="space-y-4">
            {/* Administracion */}
            {visitaFinalizar.tipo_consulta === 'administracion' && (
              <div className="space-y-3 bg-purple-50 rounded-lg border border-purple-200 p-4">
                <h3 className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Administracion</h3>
                {visitaFinalizar.admin_motivo && (
                  <p className="text-sm text-text-secondary">
                    <span className="font-medium">Motivo:</span> {visitaFinalizar.admin_motivo}
                  </p>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={finForm.admin_resuelto}
                    onChange={e => setFinForm(f => ({ ...f, admin_resuelto: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-text-primary">Se resolvio lo que vino a hacer</span>
                </label>
                <Textarea
                  label="Observaciones"
                  value={finForm.admin_observaciones}
                  onChange={e => setFinForm(f => ({ ...f, admin_observaciones: e.target.value }))}
                  placeholder="Detalles sobre la visita..."
                  rows={2}
                />
              </div>
            )}

            {/* Ventas */}
            {visitaFinalizar.tipo_consulta === 'ventas' && (
              <div className="space-y-3 bg-blue-50 rounded-lg border border-blue-200 p-4">
                <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Ventas</h3>
                <Input
                  label="Asesor que lo atendio"
                  value={finForm.ventas_asesor_asignado}
                  onChange={e => setFinForm(f => ({ ...f, ventas_asesor_asignado: e.target.value }))}
                  placeholder="Nombre del asesor"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={finForm.ventas_consulta_resuelta}
                    onChange={e => setFinForm(f => ({ ...f, ventas_consulta_resuelta: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-text-primary">El asesor resolvio su consulta</span>
                </label>
                <Select
                  label="Calificacion de la atencion"
                  value={String(finForm.ventas_calificacion_atencion)}
                  onChange={e => setFinForm(f => ({
                    ...f,
                    ventas_calificacion_atencion: e.target.value ? Number(e.target.value) : '',
                  }))}
                  options={[
                    { value: '', label: 'Seleccionar...' },
                    ...CALIFICACIONES_ATENCION.map(c => ({ value: String(c.value), label: c.label })),
                  ]}
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={finForm.ventas_quiere_que_lo_llamen}
                    onChange={e => setFinForm(f => ({ ...f, ventas_quiere_que_lo_llamen: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-text-primary">Quiere que alguien mas lo llame</span>
                </label>
                {finForm.ventas_quiere_que_lo_llamen && (
                  <Input
                    label="Telefono para callback"
                    type="tel"
                    value={finForm.ventas_telefono_callback}
                    onChange={e => setFinForm(f => ({ ...f, ventas_telefono_callback: e.target.value }))}
                    placeholder={visitaFinalizar.visitante_telefono || 'Telefono'}
                  />
                )}
              </div>
            )}

            {/* Postventa / Repuestos */}
            {(visitaFinalizar.tipo_consulta === 'postventa' || visitaFinalizar.tipo_consulta === 'repuestos') && (
              <div className="space-y-3 bg-orange-50 rounded-lg border border-orange-200 p-4">
                <h3 className="text-xs font-semibold text-orange-700 uppercase tracking-wider">
                  {visitaFinalizar.tipo_consulta === 'postventa' ? 'Postventa' : 'Repuestos'}
                </h3>
              </div>
            )}

            {/* Observaciones generales */}
            <Textarea
              label="Observaciones finales"
              value={finForm.observaciones}
              onChange={e => setFinForm(f => ({ ...f, observaciones: e.target.value }))}
              placeholder="Notas adicionales..."
              rows={2}
            />

            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="ghost" onClick={() => { setShowFinalizar(false); setVisitaFinalizar(null) }}>
                Cancelar
              </Button>
              <Button type="submit" loading={finalizando}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Finalizar visita
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
