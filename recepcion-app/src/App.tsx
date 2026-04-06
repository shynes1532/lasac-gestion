import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type { VisitaRecepcion, TipoConsulta, EstadoVisita } from './types'
import { format } from 'date-fns'
import { Toaster, toast } from 'react-hot-toast'
import {
  Plus, Clock, UserCheck, CheckCircle2, Phone, Mail, Star,
  ClipboardList, User, Search, X, Car,
} from 'lucide-react'

// ─── Constants ──────────────────────────────────────────────────

const TIPOS_CONSULTA: { value: TipoConsulta; label: string }[] = [
  { value: 'administracion', label: 'Administracion' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'postventa', label: 'Postventa' },
  { value: 'repuestos', label: 'Repuestos' },
]

const ESTADO_LABEL: Record<EstadoVisita, string> = {
  en_espera: 'En espera',
  atendido: 'Atendido',
  finalizado: 'Finalizado',
}

const TIPO_BADGE_CLASSES: Record<TipoConsulta, string> = {
  administracion: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  ventas: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  postventa: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  repuestos: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
}

const ESTADO_BADGE_CLASSES: Record<EstadoVisita, string> = {
  en_espera: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  atendido: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  finalizado: 'bg-green-500/20 text-green-300 border-green-500/30',
}

const SUCURSAL = 'Ushuaia' // TODO: hacer configurable

// ─── Helpers ────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ─── App ────────────────────────────────────────────────────────

export default function App() {
  const [visitas, setVisitas] = useState<VisitaRecepcion[]>([])
  const [loading, setLoading] = useState(true)
  const [fecha, setFecha] = useState(todayStr())
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoConsulta | ''>('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoVisita | ''>('')

  // Modals
  const [showNueva, setShowNueva] = useState(false)
  const [showFinalizar, setShowFinalizar] = useState(false)
  const [visitaFinalizar, setVisitaFinalizar] = useState<VisitaRecepcion | null>(null)

  // ─── Fetch ──────────────────────────────────────────────────

  const fetchVisitas = useCallback(async () => {
    setLoading(true)
    const startOfDay = `${fecha}T00:00:00`
    const endOfDay = `${fecha}T23:59:59`

    const { data, error } = await supabase
      .from('visitas_recepcion')
      .select('*')
      .gte('fecha_hora_ingreso', startOfDay)
      .lte('fecha_hora_ingreso', endOfDay)
      .order('fecha_hora_ingreso', { ascending: false })

    if (error) {
      console.error(error)
      toast.error('Error al cargar visitas')
    } else {
      setVisitas(data || [])
    }
    setLoading(false)
  }, [fecha])

  useEffect(() => { fetchVisitas() }, [fetchVisitas])

  // ─── Filters ────────────────────────────────────────────────

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

  const contadores = useMemo(() => ({
    en_espera: visitas.filter(v => v.estado === 'en_espera').length,
    atendido: visitas.filter(v => v.estado === 'atendido').length,
    finalizado: visitas.filter(v => v.estado === 'finalizado').length,
    total: visitas.length,
  }), [visitas])

  // ─── Actions ──────────────────────────────────────────────

  const handleAtender = async (visita: VisitaRecepcion) => {
    const { error } = await supabase
      .from('visitas_recepcion')
      .update({ estado: 'atendido', fecha_hora_atencion: new Date().toISOString() })
      .eq('id', visita.id)
    if (error) { toast.error('Error'); return }
    toast.success(`${visita.visitante_nombre} marcado como atendido`)
    fetchVisitas()
  }

  const openFinalizar = (visita: VisitaRecepcion) => {
    setVisitaFinalizar(visita)
    setShowFinalizar(true)
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
      }} />

      {/* Header */}
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border)] sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--accent)] rounded-xl flex items-center justify-center">
              <Car className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">LASAC Recepcion</h1>
              <p className="text-xs text-[var(--text-muted)]">Liendo Automotores</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={() => setShowNueva(true)}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Nueva visita
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <CounterCard value={contadores.total} label="Total del dia" icon={<ClipboardList className="h-4 w-4" />} color="slate" />
          <CounterCard value={contadores.en_espera} label="En espera" icon={<Clock className="h-4 w-4" />} color="yellow" />
          <CounterCard value={contadores.atendido} label="Atendidos" icon={<UserCheck className="h-4 w-4" />} color="blue" />
          <CounterCard value={contadores.finalizado} label="Finalizados" icon={<CheckCircle2 className="h-4 w-4" />} color="green" />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, telefono o email..."
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg pl-10 pr-10 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value as TipoConsulta | '')}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">Todos los tipos</option>
            {TIPOS_CONSULTA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value as EstadoVisita | '')}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">Todos los estados</option>
            <option value="en_espera">En espera</option>
            <option value="atendido">Atendido</option>
            <option value="finalizado">Finalizado</option>
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-5 animate-pulse h-20" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-[var(--text-secondary)] text-lg">Sin visitas</p>
            <p className="text-[var(--text-muted)] text-sm mt-1">
              {search || filtroTipo || filtroEstado
                ? 'No hay visitas con esos filtros'
                : `No hay visitas registradas para el ${fecha}`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(visita => (
              <VisitaCard
                key={visita.id}
                visita={visita}
                onAtender={() => handleAtender(visita)}
                onFinalizar={() => openFinalizar(visita)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal Nueva */}
      {showNueva && (
        <NuevaVisitaModal
          onClose={() => setShowNueva(false)}
          onCreated={() => { setShowNueva(false); fetchVisitas() }}
        />
      )}

      {/* Modal Finalizar */}
      {showFinalizar && visitaFinalizar && (
        <FinalizarModal
          visita={visitaFinalizar}
          onClose={() => { setShowFinalizar(false); setVisitaFinalizar(null) }}
          onDone={() => { setShowFinalizar(false); setVisitaFinalizar(null); fetchVisitas() }}
        />
      )}
    </div>
  )
}

// ─── Counter Card ───────────────────────────────────────────────

function CounterCard({ value, label, icon, color }: { value: number; label: string; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    slate: 'border-slate-600/30 text-slate-300',
    yellow: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-300',
    blue: 'border-blue-500/30 bg-blue-500/5 text-blue-300',
    green: 'border-green-500/30 bg-green-500/5 text-green-300',
  }
  return (
    <div className={`rounded-xl border p-4 text-center ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-1 flex items-center justify-center gap-1 opacity-80">{icon} {label}</p>
    </div>
  )
}

// ─── Visita Card ────────────────────────────────────────────────

function VisitaCard({ visita, onAtender, onFinalizar }: {
  visita: VisitaRecepcion
  onAtender: () => void
  onFinalizar: () => void
}) {
  const tipoLabel = TIPOS_CONSULTA.find(t => t.value === visita.tipo_consulta)?.label || visita.tipo_consulta

  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-[var(--text-muted)]/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[var(--text-primary)]">{visita.visitante_nombre}</span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${TIPO_BADGE_CLASSES[visita.tipo_consulta]}`}>
            {tipoLabel}
          </span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${ESTADO_BADGE_CLASSES[visita.estado]}`}>
            {ESTADO_LABEL[visita.estado]}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-1.5 text-xs text-[var(--text-muted)] flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(visita.fecha_hora_ingreso), 'HH:mm')}
          </span>
          {visita.visitante_telefono && (
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{visita.visitante_telefono}</span>
          )}
          {visita.visitante_email && (
            <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{visita.visitante_email}</span>
          )}
          {visita.ventas_asesor_asignado && (
            <span className="flex items-center gap-1"><User className="h-3 w-3" />Asesor: {visita.ventas_asesor_asignado}</span>
          )}
        </div>
        {visita.observaciones && (
          <p className="text-xs text-[var(--text-muted)] mt-1 italic truncate">{visita.observaciones}</p>
        )}
        {visita.estado === 'finalizado' && visita.tipo_consulta === 'administracion' && (
          <p className="text-xs mt-1">
            {visita.admin_resuelto
              ? <span className="text-green-400">Resuelto</span>
              : <span className="text-red-400">No resuelto</span>}
            {visita.admin_observaciones && <span className="text-[var(--text-muted)] ml-2">— {visita.admin_observaciones}</span>}
          </p>
        )}
        {visita.estado === 'finalizado' && visita.tipo_consulta === 'ventas' && (
          <div className="flex items-center gap-3 text-xs mt-1 flex-wrap">
            {visita.ventas_consulta_resuelta
              ? <span className="text-green-400">Consulta resuelta</span>
              : <span className="text-red-400">No resuelta</span>}
            {visita.ventas_calificacion_atencion && (
              <span className="flex items-center gap-0.5 text-yellow-400">
                <Star className="h-3 w-3" />{visita.ventas_calificacion_atencion}/5
              </span>
            )}
            {visita.ventas_quiere_que_lo_llamen && (
              <span className="text-blue-400 flex items-center gap-0.5">
                <Phone className="h-3 w-3" />Quiere que lo llamen
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {visita.estado === 'en_espera' && (
          <button onClick={onAtender} className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer">
            <UserCheck className="h-3.5 w-3.5" />Atender
          </button>
        )}
        {(visita.estado === 'en_espera' || visita.estado === 'atendido') && (
          <button onClick={onFinalizar} className="bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer">
            <CheckCircle2 className="h-3.5 w-3.5" />Finalizar
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Modal: Nueva Visita ────────────────────────────────────────

function NuevaVisitaModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [tipo, setTipo] = useState<TipoConsulta | ''>('')
  const [adminMotivo, setAdminMotivo] = useState('')
  const [ventasAsesor, setVentasAsesor] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    if (!tipo) { toast.error('Selecciona el tipo de consulta'); return }

    setSaving(true)
    const { error } = await supabase.from('visitas_recepcion').insert({
      visitante_nombre: nombre.trim(),
      visitante_telefono: telefono.trim() || null,
      visitante_email: email.trim() || null,
      sucursal: SUCURSAL,
      tipo_consulta: tipo,
      admin_motivo: tipo === 'administracion' ? (adminMotivo.trim() || null) : null,
      ventas_asesor_asignado: tipo === 'ventas' ? (ventasAsesor.trim() || null) : null,
      observaciones: observaciones.trim() || null,
      created_by: null,
    })

    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Visita registrada')
    onCreated()
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-lg bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-semibold">Registrar visita</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <FieldInput label="Nombre del visitante *" value={nombre} onChange={setNombre} placeholder="Nombre y Apellido" />
          <div className="grid grid-cols-2 gap-3">
            <FieldInput label="Telefono" value={telefono} onChange={setTelefono} placeholder="+54 9 2964..." type="tel" />
            <FieldInput label="Email" value={email} onChange={setEmail} placeholder="email@ejemplo.com" type="email" />
          </div>
          <FieldSelect
            label="Tipo de consulta *"
            value={tipo}
            onChange={v => setTipo(v as TipoConsulta | '')}
            options={[{ value: '', label: 'Seleccionar...' }, ...TIPOS_CONSULTA.map(t => ({ value: t.value, label: t.label }))]}
          />
          {tipo === 'administracion' && (
            <FieldTextarea label="Motivo de la visita" value={adminMotivo} onChange={setAdminMotivo} placeholder="Ej: Vino a pagar una cuota..." />
          )}
          {tipo === 'ventas' && (
            <FieldInput label="Asesor asignado" value={ventasAsesor} onChange={setVentasAsesor} placeholder="Nombre del asesor" />
          )}
          <FieldTextarea label="Observaciones" value={observaciones} onChange={setObservaciones} placeholder="Notas adicionales..." />
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">Cancelar</button>
            <button type="submit" disabled={saving} className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer">
              <Plus className="h-4 w-4" />{saving ? 'Guardando...' : 'Registrar ingreso'}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

// ─── Modal: Finalizar Visita ────────────────────────────────────

function FinalizarModal({ visita, onClose, onDone }: { visita: VisitaRecepcion; onClose: () => void; onDone: () => void }) {
  const [adminResuelto, setAdminResuelto] = useState(false)
  const [adminObs, setAdminObs] = useState('')
  const [ventasAsesor, setVentasAsesor] = useState(visita.ventas_asesor_asignado || '')
  const [ventasResuelta, setVentasResuelta] = useState(false)
  const [ventasCalif, setVentasCalif] = useState<number | ''>('')
  const [ventasLlamar, setVentasLlamar] = useState(false)
  const [ventasTelCallback, setVentasTelCallback] = useState('')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const updates: Record<string, unknown> = {
      estado: 'finalizado',
      fecha_hora_finalizacion: new Date().toISOString(),
      observaciones: obs.trim() || visita.observaciones,
    }

    if (visita.tipo_consulta === 'administracion') {
      updates.admin_resuelto = adminResuelto
      updates.admin_observaciones = adminObs.trim() || null
    }
    if (visita.tipo_consulta === 'ventas') {
      updates.ventas_asesor_asignado = ventasAsesor.trim() || null
      updates.ventas_consulta_resuelta = ventasResuelta
      updates.ventas_calificacion_atencion = ventasCalif || null
      updates.ventas_quiere_que_lo_llamen = ventasLlamar
      updates.ventas_telefono_callback = ventasLlamar ? (ventasTelCallback.trim() || visita.visitante_telefono) : null
    }

    const { error } = await supabase.from('visitas_recepcion').update(updates).eq('id', visita.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Visita finalizada')
    onDone()
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-lg bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-semibold">Finalizar — {visita.visitante_nombre}</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Administracion */}
          {visita.tipo_consulta === 'administracion' && (
            <div className="space-y-3 bg-purple-500/5 rounded-lg border border-purple-500/20 p-4">
              <h4 className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Administracion</h4>
              {visita.admin_motivo && <p className="text-sm text-[var(--text-secondary)]"><span className="font-medium">Motivo:</span> {visita.admin_motivo}</p>}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={adminResuelto} onChange={e => setAdminResuelto(e.target.checked)} className="rounded" />
                <span className="text-sm">Se resolvio lo que vino a hacer</span>
              </label>
              <FieldTextarea label="Observaciones" value={adminObs} onChange={setAdminObs} placeholder="Detalles..." />
            </div>
          )}

          {/* Ventas */}
          {visita.tipo_consulta === 'ventas' && (
            <div className="space-y-3 bg-blue-500/5 rounded-lg border border-blue-500/20 p-4">
              <h4 className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Ventas</h4>
              <FieldInput label="Asesor que lo atendio" value={ventasAsesor} onChange={setVentasAsesor} placeholder="Nombre del asesor" />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={ventasResuelta} onChange={e => setVentasResuelta(e.target.checked)} className="rounded" />
                <span className="text-sm">El asesor resolvio su consulta</span>
              </label>
              <FieldSelect
                label="Calificacion de la atencion"
                value={String(ventasCalif)}
                onChange={v => setVentasCalif(v ? Number(v) : '')}
                options={[
                  { value: '', label: 'Seleccionar...' },
                  { value: '1', label: '1 - Muy mala' },
                  { value: '2', label: '2 - Mala' },
                  { value: '3', label: '3 - Regular' },
                  { value: '4', label: '4 - Buena' },
                  { value: '5', label: '5 - Excelente' },
                ]}
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={ventasLlamar} onChange={e => setVentasLlamar(e.target.checked)} className="rounded" />
                <span className="text-sm">Quiere que alguien mas lo llame</span>
              </label>
              {ventasLlamar && (
                <FieldInput label="Telefono para callback" value={ventasTelCallback} onChange={setVentasTelCallback} placeholder={visita.visitante_telefono || 'Telefono'} type="tel" />
              )}
            </div>
          )}

          {/* Postventa/Repuestos */}
          {(visita.tipo_consulta === 'postventa' || visita.tipo_consulta === 'repuestos') && (
            <div className="space-y-3 bg-orange-500/5 rounded-lg border border-orange-500/20 p-4">
              <h4 className="text-xs font-semibold text-orange-300 uppercase tracking-wider">
                {visita.tipo_consulta === 'postventa' ? 'Postventa' : 'Repuestos'}
              </h4>
            </div>
          )}

          <FieldTextarea label="Observaciones finales" value={obs} onChange={setObs} placeholder="Notas adicionales..." />

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">Cancelar</button>
            <button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer">
              <CheckCircle2 className="h-4 w-4" />{saving ? 'Guardando...' : 'Finalizar visita'}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

// ─── Shared UI ──────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {children}
    </div>
  )
}

function FieldInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-sm text-[var(--text-secondary)] mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
      />
    </div>
  )
}

function FieldSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-sm text-[var(--text-secondary)] mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function FieldTextarea({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm text-[var(--text-secondary)] mb-1">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
      />
    </div>
  )
}
