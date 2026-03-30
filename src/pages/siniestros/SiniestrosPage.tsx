import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { notify } from '../../components/ui/Toast'
import {
  Plus, X, Search, ChevronDown, ChevronRight, ArrowLeft,
  Trash2, Edit2, Check, Clock, AlertTriangle, DollarSign,
  Wrench, Package, FileText, CheckCircle2,
  Users, Activity, Receipt, Hammer, Paintbrush,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────

interface SiniestroCliente {
  id: string
  nombre: string
  apellido: string
  dni: string
  telefono: string
  email: string
  direccion: string
  localidad: string
  marca: string
  modelo: string
  anio: number | null
  dominio: string
  vin: string
  color: string
  compania_seguro: string
  nro_poliza: string
  productor_seguro: string
  sucursal: string
  activo: boolean
  notas: string
}

interface SiniestroExpediente {
  id: string
  cliente_id: string
  nro_siniestro_interno: string
  nro_siniestro_compania: string
  nro_orden_trabajo: string
  sucursal: string
  canal_ingreso: string
  facturar_a: string
  compania_seguro: string
  nro_poliza: string
  gestor_nombre: string
  gestor_telefono: string
  estado_actual: string
  fecha_ingreso_vehiculo: string | null
  km_ingreso: number | null
  descripcion_siniestro: string
  fecha_siniestro: string | null
  tipo_danio: string
  inspector: string
  fecha_presupuesto: string | null
  monto_presupuesto_repuestos: number
  monto_presupuesto_mo_taller: number
  monto_presupuesto_chapista: number
  monto_presupuesto_pintura: number
  monto_presupuesto_otros: number
  fecha_envio_presupuesto: string | null
  fecha_aprobacion: string | null
  resultado_aprobacion: string
  monto_aprobado_repuestos: number
  monto_aprobado_mo: number
  monto_aprobado_chapista: number
  monto_aprobado_total: number
  orden_aprobacion_nro: string
  necesita_repuestos: boolean | null
  repuestos_estado_global: string
  trabajo_chapista_requerido: boolean | null
  trabajo_chapista_completo: boolean | null
  trabajo_chapista_fecha_inicio: string | null
  trabajo_chapista_fecha_fin: string | null
  trabajo_chapista_nombre: string
  trabajo_mo_taller_requerido: boolean | null
  trabajo_mo_taller_completo: boolean | null
  trabajo_mo_taller_fecha_inicio: string | null
  trabajo_mo_taller_fecha_fin: string | null
  trabajo_mo_taller_nombre: string
  trabajo_pintura_requerido: boolean | null
  trabajo_pintura_completo: boolean | null
  trabajo_pintura_fecha_inicio: string | null
  trabajo_pintura_fecha_fin: string | null
  trabajo_pintura_nombre: string
  reparacion_completa: boolean | null
  fecha_facturacion: string | null
  nro_factura: string
  monto_facturado: number
  facturado_a_nombre: string
  fecha_vencimiento_cobro: string | null
  fecha_cobro_efectivo: string | null
  monto_cobrado: number
  tiene_presupuesto_suplementario: boolean | null
  monto_suplementario: number
  suplementario_aprobado: boolean | null
  suplementario_detalle: string
  notas_internas: string
  created_at: string
  updated_at: string
  // joined
  siniestros_clientes?: SiniestroCliente
}

interface SiniestroRepuesto {
  id: string
  expediente_id: string
  nro_parte: string
  descripcion: string
  cantidad_solicitada: number
  cantidad_recibida: number
  aprobado_por_compania: boolean | null
  monto_aprobado: number
  estado: string
  fecha_pedido: string | null
  fecha_eta_estimada: string | null
  fecha_recepcion: string | null
  tipo_pedido: string
  nro_guia_tracking: string
  recibido_conforme: boolean | null
  detalle_incidencia: string
}

type View = 'list' | 'detail' | 'new' | 'clients'

// ─── Constants ───────────────────────────────────────────────────────

const SUCURSALES = [
  { value: 'Ushuaia', label: 'Ushuaia' },
  { value: 'Rio Grande', label: 'Rio Grande' },
]

const CANALES = [
  { value: 'cliente_directo', label: 'Cliente directo' },
  { value: 'gestor_seguro', label: 'Gestor de seguro' },
  { value: 'orion_licitacion', label: 'Orion / Licitacion' },
  { value: 'indemnizacion', label: 'Indemnizacion' },
]

const CANAL_COLORS: Record<string, string> = {
  cliente_directo: 'blue',
  gestor_seguro: 'orange',
  orion_licitacion: 'purple',
  indemnizacion: 'green',
}

const CANAL_LABELS: Record<string, string> = {
  cliente_directo: 'Cliente directo',
  gestor_seguro: 'Gestor seguro',
  orion_licitacion: 'Orion / Licitacion',
  indemnizacion: 'Indemnizacion',
}

const CANAL_DESCRIPTIONS: Record<string, string> = {
  cliente_directo: 'El cliente trae el vehiculo directamente al taller',
  gestor_seguro: 'Ingresa a traves de un gestor o productor de seguros',
  orion_licitacion: 'Trabajo asignado por Orion o licitacion de compania',
  indemnizacion: 'Pago directo al asegurado, sin reparacion en taller',
}

const ESTADOS = [
  'ingreso', 'inspeccion', 'presupuesto_elaborado', 'presupuesto_enviado',
  'esperando_aprobacion', 'aprobado', 'rechazado_compania', 'pedido_repuestos',
  'esperando_repuestos', 'repuestos_completos', 'en_reparacion', 'reparacion_completa',
  'facturado', 'cobrado', 'cerrado', 'cancelado',
]

const ESTADO_LABELS: Record<string, string> = {
  ingreso: 'Ingreso',
  inspeccion: 'Inspeccion',
  presupuesto_elaborado: 'Presupuesto elaborado',
  presupuesto_enviado: 'Presupuesto enviado',
  esperando_aprobacion: 'Esperando aprobacion',
  aprobado: 'Aprobado',
  rechazado_compania: 'Rechazado compania',
  pedido_repuestos: 'Pedido repuestos',
  esperando_repuestos: 'Esperando repuestos',
  repuestos_completos: 'Repuestos completos',
  en_reparacion: 'En reparacion',
  reparacion_completa: 'Reparacion completa',
  facturado: 'Facturado',
  cobrado: 'Cobrado',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
}

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  ...ESTADOS.map(e => ({ value: e, label: ESTADO_LABELS[e] || e })),
]

const CANAL_OPTIONS = [
  { value: '', label: 'Todos los canales' },
  ...CANALES,
]

const FACTURAR_OPTIONS = [
  { value: 'compania', label: 'Compania' },
  { value: 'cliente', label: 'Cliente' },
]

const REPUESTO_ESTADOS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'pedido_realizado', label: 'Pedido realizado' },
  { value: 'en_transito', label: 'En transito' },
  { value: 'recibido_parcial', label: 'Recibido parcial' },
  { value: 'recibido_completo', label: 'Recibido completo' },
  { value: 'no_disponible', label: 'No disponible' },
  { value: 'incidencia', label: 'Incidencia' },
]

const RESULTADO_APROBACION_OPTIONS = [
  { value: '', label: 'Sin definir' },
  { value: 'aprobado_total', label: 'Aprobado total' },
  { value: 'aprobado_parcial', label: 'Aprobado parcial' },
  { value: 'rechazado', label: 'Rechazado' },
]

const PHASES = [
  { key: 'ingreso', label: 'Ingreso', states: ['ingreso', 'inspeccion'] },
  { key: 'presupuesto', label: 'Presupuesto', states: ['presupuesto_elaborado', 'presupuesto_enviado', 'esperando_aprobacion'] },
  { key: 'aprobacion', label: 'Aprobacion', states: ['aprobado', 'rechazado_compania'] },
  { key: 'repuestos', label: 'Repuestos', states: ['pedido_repuestos', 'esperando_repuestos', 'repuestos_completos'] },
  { key: 'reparacion', label: 'Reparacion', states: ['en_reparacion', 'reparacion_completa'] },
  { key: 'facturacion', label: 'Facturacion', states: ['facturado', 'cobrado'] },
  { key: 'cierre', label: 'Cierre', states: ['cerrado', 'cancelado'] },
]

const fmtMoney = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const fmtDate = (d: string | null) => {
  if (!d) return '-'
  try {
    const iso = d.includes('T') ? d : d + 'T12:00:00'
    return new Date(iso).toLocaleDateString('es-AR')
  } catch { return d }
}
const toDateInput = (d: string | null) => {
  if (!d) return ''
  return d.includes('T') ? d.split('T')[0] : d
}

const daysBetween = (from: string | null, to?: string | null) => {
  if (!from) return 0
  const end = to ? new Date(to) : new Date()
  return Math.max(0, Math.floor((end.getTime() - new Date(from).getTime()) / 86400000))
}

// ─── Badge ───────────────────────────────────────────────────────────

function Badge({ text, color }: { text: string; color: string }) {
  const colors: Record<string, string> = {
    red: 'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    teal: 'bg-teal-100 text-teal-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    purple: 'bg-purple-100 text-purple-700',
    gray: 'bg-gray-100 text-gray-600',
    cyan: 'bg-cyan-100 text-cyan-700',
    rose: 'bg-rose-100 text-rose-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>
      {text}
    </span>
  )
}

function getEstadoColor(estado: string): string {
  if (['ingreso', 'inspeccion'].includes(estado)) return 'blue'
  if (['presupuesto_elaborado', 'presupuesto_enviado', 'esperando_aprobacion'].includes(estado)) return 'purple'
  if (estado === 'aprobado') return 'green'
  if (estado === 'rechazado_compania') return 'red'
  if (['pedido_repuestos', 'esperando_repuestos'].includes(estado)) return 'orange'
  if (estado === 'repuestos_completos') return 'teal'
  if (['en_reparacion', 'reparacion_completa'].includes(estado)) return 'cyan'
  if (estado === 'facturado') return 'yellow'
  if (estado === 'cobrado') return 'green'
  if (estado === 'cerrado') return 'green'
  if (estado === 'cancelado') return 'red'
  return 'gray'
}

function getRepuestoColor(estado: string): string {
  if (estado === 'incidencia' || estado === 'no_disponible') return 'red'
  if (['recibido_completo'].includes(estado)) return 'green'
  if (estado === 'recibido_parcial') return 'teal'
  if (['en_transito', 'pedido_realizado'].includes(estado)) return 'orange'
  return 'blue'
}

/** Semaforo de cobro: green <25d, yellow 25-30d, red >30d */
function getCobroSemaforo(fechaFacturacion: string | null, fechaCobro: string | null): { color: string; days: number } {
  if (!fechaFacturacion) return { color: 'gray', days: 0 }
  if (fechaCobro) return { color: 'green', days: 0 }
  const days = daysBetween(fechaFacturacion)
  if (days > 30) return { color: 'red', days }
  if (days >= 25) return { color: 'yellow', days }
  return { color: 'green', days }
}

// ─── Accordion ───────────────────────────────────────────────────────

function Accordion({ title, icon, defaultOpen, children }: {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-bg-secondary hover:bg-bg-tertiary transition-colors cursor-pointer"
      >
        {open ? <ChevronDown className="h-4 w-4 text-text-muted" /> : <ChevronRight className="h-4 w-4 text-text-muted" />}
        <span className="text-text-muted">{icon}</span>
        <span className="text-sm font-medium text-text-primary">{title}</span>
      </button>
      {open && <div className="p-4 border-t border-border space-y-4">{children}</div>}
    </div>
  )
}

// ─── Timeline ────────────────────────────────────────────────────────

function Timeline({ estadoActual }: { estadoActual: string }) {
  const currentPhaseIdx = PHASES.findIndex(p => p.states.includes(estadoActual))
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {PHASES.map((phase, idx) => {
        const isCurrent = idx === currentPhaseIdx
        const isPast = idx < currentPhaseIdx
        const isCancelled = estadoActual === 'cancelado' && phase.key === 'cierre'
        const isRejected = estadoActual === 'rechazado_compania' && phase.key === 'aprobacion'
        return (
          <div key={phase.key} className="flex items-center gap-1 flex-shrink-0">
            <div className={`
              px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap
              ${isCancelled || isRejected ? 'bg-red-600 text-white' : isCurrent ? 'bg-rose-600 text-white' : isPast ? 'bg-rose-100 text-rose-700' : 'bg-bg-tertiary text-text-muted'}
            `}>
              {phase.label}
            </div>
            {idx < PHASES.length - 1 && (
              <div className={`w-4 h-0.5 ${isPast ? 'bg-rose-400' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: React.ReactNode; color?: string
}) {
  return (
    <div className="bg-bg-secondary rounded-lg border border-border p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color || 'bg-rose-100 text-rose-600'}`}>{icon}</div>
      <div>
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-lg font-bold text-text-primary">{value}</p>
      </div>
    </div>
  )
}

// ─── Confirm Dialog ──────────────────────────────────────────────────

function ConfirmDialog({ open, title, message, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-bg-secondary rounded-lg border border-border p-6 max-w-sm w-full mx-4 space-y-4">
        <h3 className="text-lg font-bold text-text-primary">{title}</h3>
        <p className="text-sm text-text-secondary">{message}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>Confirmar</Button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export function SiniestrosPage() {
  const qc = useQueryClient()

  // ─── View state ──────────────────────────────────────────────────
  const [view, setView] = useState<View>('list')
  const [tab, setTab] = useState<'expedientes' | 'clientes' | 'dashboard'>('expedientes')
  const [selectedExpId, setSelectedExpId] = useState<string | null>(null)

  // ─── Filters ─────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [fSucursal, setFSucursal] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [fCanal, setFCanal] = useState('')

  // ─── Queries ─────────────────────────────────────────────────────
  const { data: expedientes = [], isLoading: loadingExp } = useQuery({
    queryKey: ['siniestros_expedientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('siniestros_expedientes')
        .select('*, siniestros_clientes(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as SiniestroExpediente[]
    },
  })

  const { data: clientes = [], isLoading: loadingCli } = useQuery({
    queryKey: ['siniestros_clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('siniestros_clientes')
        .select('*')
        .order('apellido')
      if (error) throw error
      return data as SiniestroCliente[]
    },
  })

  const { data: repuestos = [] } = useQuery({
    queryKey: ['siniestros_repuestos', selectedExpId],
    enabled: !!selectedExpId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('siniestros_repuestos')
        .select('*')
        .eq('expediente_id', selectedExpId!)
        .order('created_at')
      if (error) throw error
      return data as SiniestroRepuesto[]
    },
  })

  // Query todos los repuestos para dashboard
  const { data: allRepuestos = [] } = useQuery({
    queryKey: ['siniestros_repuestos_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('siniestros_repuestos')
        .select('*, siniestros_expedientes(nro_siniestro_interno, siniestros_clientes(nombre, apellido))')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  // ─── Filtered expedientes ────────────────────────────────────────
  const filtered = useMemo(() => {
    return expedientes.filter(e => {
      const cli = e.siniestros_clientes
      const q = search.toLowerCase()
      if (q) {
        const haystack = [
          e.nro_siniestro_interno, e.nro_siniestro_compania, e.nro_orden_trabajo,
          cli?.nombre, cli?.apellido, cli?.dominio, cli?.vin, cli?.modelo, e.compania_seguro,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (fSucursal && e.sucursal !== fSucursal) return false
      if (fEstado && e.estado_actual !== fEstado) return false
      if (fCanal && e.canal_ingreso !== fCanal) return false
      return true
    })
  }, [expedientes, search, fSucursal, fEstado, fCanal])

  // ─── KPI calculations ───────────────────────────────────────────
  const kpis = useMemo(() => {
    const activos = expedientes.filter(e => !['cerrado', 'cancelado'].includes(e.estado_actual)).length
    const esperandoAprobacion = expedientes.filter(e => e.estado_actual === 'esperando_aprobacion').length
    const esperandoRepuestos = expedientes.filter(e => ['esperando_repuestos', 'pedido_repuestos'].includes(e.estado_actual)).length

    const cobrosVencidos = expedientes.filter(e => {
      if (!e.fecha_facturacion || e.fecha_cobro_efectivo) return false
      return daysBetween(e.fecha_facturacion) > 30
    }).length

    const montoFacturadoPendiente = expedientes
      .filter(e => e.monto_facturado > 0 && !e.fecha_cobro_efectivo)
      .reduce((s, e) => s + e.monto_facturado, 0)

    const activosConFecha = expedientes.filter(e => !['cerrado', 'cancelado'].includes(e.estado_actual) && e.fecha_ingreso_vehiculo)
    const promDias = activosConFecha.length > 0
      ? Math.round(activosConFecha.reduce((s, e) => s + daysBetween(e.fecha_ingreso_vehiculo), 0) / activosConFecha.length)
      : 0

    const conAprobacion = expedientes.filter(e => e.resultado_aprobacion)
    const aprobados = conAprobacion.filter(e => ['aprobado_total', 'aprobado_parcial'].includes(e.resultado_aprobacion))
    const tasaAprob = conAprobacion.length > 0 ? Math.round((aprobados.length / conAprobacion.length) * 100) : 0

    const now = new Date()
    const mesActual = now.getMonth()
    const anioActual = now.getFullYear()
    const facturacionMes = expedientes
      .filter(e => {
        if (!e.fecha_facturacion) return false
        const d = new Date(e.fecha_facturacion)
        return d.getMonth() === mesActual && d.getFullYear() === anioActual
      })
      .reduce((s, e) => s + e.monto_facturado, 0)

    return { activos, esperandoAprobacion, esperandoRepuestos, cobrosVencidos, montoFacturadoPendiente, promDias, tasaAprob, facturacionMes }
  }, [expedientes])

  // ─── Selected expediente ─────────────────────────────────────────
  const selectedExp = expedientes.find(e => e.id === selectedExpId) || null

  // ─── Navigate helpers ────────────────────────────────────────────
  const openDetail = (id: string) => {
    setSelectedExpId(id)
    setView('detail')
  }

  const goToList = () => {
    setView('list')
    setSelectedExpId(null)
  }

  // ─── Render ──────────────────────────────────────────────────────
  if (view === 'detail' && selectedExp) {
    return <ExpedienteDetail exp={selectedExp} repuestos={repuestos} qc={qc} goBack={goToList} />
  }

  if (view === 'new') {
    return <NuevoExpedienteForm clientes={clientes} qc={qc} goBack={goToList} onCreated={openDetail} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Siniestros</h1>
          <p className="text-sm text-text-muted">Gestion de siniestros y reclamos de seguro</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === 'expedientes' ? 'primary' : 'secondary'}
            size="sm"
            className={tab === 'expedientes' ? 'bg-rose-600 hover:bg-rose-700' : ''}
            onClick={() => setTab('expedientes')}
          >
            <FileText className="h-4 w-4" /> Expedientes
          </Button>
          <Button
            variant={tab === 'clientes' ? 'primary' : 'secondary'}
            size="sm"
            className={tab === 'clientes' ? 'bg-rose-600 hover:bg-rose-700' : ''}
            onClick={() => setTab('clientes')}
          >
            <Users className="h-4 w-4" /> Clientes
          </Button>
          <Button
            variant={tab === 'dashboard' ? 'primary' : 'secondary'}
            size="sm"
            className={tab === 'dashboard' ? 'bg-rose-600 hover:bg-rose-700' : ''}
            onClick={() => setTab('dashboard')}
          >
            <Activity className="h-4 w-4" /> Dashboard
          </Button>
        </div>
      </div>

      {tab === 'clientes' ? (
        <ClientesList clientes={clientes} loading={loadingCli} qc={qc} />
      ) : tab === 'dashboard' ? (
        <SiniestrosDashboard expedientes={expedientes} allRepuestos={allRepuestos} openDetail={openDetail} />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Activos" value={kpis.activos} icon={<Activity className="h-5 w-5" />} />
            <KpiCard label="Esperando aprobacion" value={kpis.esperandoAprobacion} icon={<Clock className="h-5 w-5" />} color="bg-purple-100 text-purple-600" />
            <KpiCard label="Esperando repuestos" value={kpis.esperandoRepuestos} icon={<Package className="h-5 w-5" />} color="bg-orange-100 text-orange-600" />
            <KpiCard label="Cobros vencidos" value={kpis.cobrosVencidos} icon={<AlertTriangle className="h-5 w-5" />} color="bg-red-100 text-red-600" />
            <KpiCard label="Monto facturado pendiente" value={fmtMoney(kpis.montoFacturadoPendiente)} icon={<DollarSign className="h-5 w-5" />} color="bg-yellow-100 text-yellow-600" />
            <KpiCard label="Promedio dias" value={`${kpis.promDias}d`} icon={<Clock className="h-5 w-5" />} color="bg-blue-100 text-blue-600" />
            <KpiCard label="Tasa aprobacion" value={`${kpis.tasaAprob}%`} icon={<CheckCircle2 className="h-5 w-5" />} color="bg-green-100 text-green-600" />
            <KpiCard label="Facturacion del mes" value={fmtMoney(kpis.facturacionMes)} icon={<Receipt className="h-5 w-5" />} color="bg-teal-100 text-teal-600" />
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Buscar por siniestro, cliente, dominio, compania..."
                icon={<Search className="h-4 w-4" />}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select options={CANAL_OPTIONS} value={fCanal} onChange={e => setFCanal(e.target.value)} />
            <Select options={[{ value: '', label: 'Todas las sucursales' }, ...SUCURSALES]} value={fSucursal} onChange={e => setFSucursal(e.target.value)} />
            <Select options={ESTADO_OPTIONS} value={fEstado} onChange={e => setFEstado(e.target.value)} />
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => setView('new')}>
              <Plus className="h-4 w-4" /> Nuevo siniestro
            </Button>
          </div>

          {/* Table */}
          <div className="bg-bg-secondary rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="px-4 py-3 text-left font-medium">Nro Siniestro</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Vehiculo</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Canal</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Compania</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Repuestos</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Cobro</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Dias</th>
                </tr>
              </thead>
              <tbody>
                {loadingExp ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-text-muted">Cargando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-text-muted">No hay expedientes</td></tr>
                ) : filtered.map(e => {
                  const cli = e.siniestros_clientes
                  const semaforo = getCobroSemaforo(e.fecha_facturacion, e.fecha_cobro_efectivo)
                  const isVencido = semaforo.color === 'red'
                  return (
                    <tr
                      key={e.id}
                      onClick={() => openDetail(e.id)}
                      className={`border-b border-border cursor-pointer transition-colors
                        ${isVencido ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-bg-tertiary'}`}
                    >
                      <td className="px-4 py-3 font-medium text-text-primary">{e.nro_siniestro_interno || '-'}</td>
                      <td className="px-4 py-3 text-text-primary">{cli ? `${cli.apellido}, ${cli.nombre}` : '-'}</td>
                      <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                        {cli ? `${cli.marca} ${cli.modelo} - ${cli.dominio}` : '-'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <Badge text={CANAL_LABELS[e.canal_ingreso] || e.canal_ingreso || '-'} color={CANAL_COLORS[e.canal_ingreso] || 'gray'} />
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">{e.compania_seguro || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge text={ESTADO_LABELS[e.estado_actual] || e.estado_actual} color={getEstadoColor(e.estado_actual)} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {e.necesita_repuestos ? (
                          <Badge text={e.repuestos_estado_global || 'Pendiente'} color={e.repuestos_estado_global === 'completo' ? 'green' : 'orange'} />
                        ) : (
                          <span className="text-text-muted text-xs">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {e.fecha_facturacion ? (
                          <span className={`inline-flex h-3 w-3 rounded-full ${semaforo.color === 'green' ? 'bg-green-500' : semaforo.color === 'yellow' ? 'bg-yellow-500' : semaforo.color === 'red' ? 'bg-red-500' : 'bg-gray-300'}`} />
                        ) : (
                          <span className="text-text-muted text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">{daysBetween(e.fecha_ingreso_vehiculo)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// EXPEDIENTE DETAIL
// ═══════════════════════════════════════════════════════════════════════

function ExpedienteDetail({ exp, repuestos, qc, goBack }: {
  exp: SiniestroExpediente
  repuestos: SiniestroRepuesto[]
  qc: ReturnType<typeof useQueryClient>
  goBack: () => void
}) {
  const cli = exp.siniestros_clientes
  const [confirmDelete, setConfirmDelete] = useState(false)

  // ─── Update mutation ─────────────────────────────────────────────
  const updateExp = useMutation({
    mutationFn: async (updates: Partial<SiniestroExpediente>) => {
      const { error } = await supabase
        .from('siniestros_expedientes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', exp.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['siniestros_expedientes'] })
      notify.success('Expediente actualizado')
    },
    onError: () => notify.error('Error al actualizar'),
  })

  const deleteExp = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('siniestros_expedientes').delete().eq('id', exp.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['siniestros_expedientes'] })
      notify.success('Expediente eliminado')
      goBack()
    },
    onError: () => notify.error('Error al eliminar'),
  })

  // ─── Advance stage ──────────────────────────────────────────────
  const advanceStage = () => {
    const idx = ESTADOS.indexOf(exp.estado_actual)
    if (idx < 0 || idx >= ESTADOS.length - 1) return
    updateExp.mutate({ estado_actual: ESTADOS[idx + 1] })
  }

  // ─── Inline field update ─────────────────────────────────────────
  const saveField = (field: string, value: unknown) => {
    updateExp.mutate({ [field]: value } as Partial<SiniestroExpediente>)
  }

  function generarPDF() {
    const hoy = new Date()
    const fechaStr = hoy.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    const validez = new Date(hoy.getTime() + 15 * 86400000).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    const nroP = exp.nro_siniestro_interno ? `P-${exp.nro_siniestro_interno}` : `P-${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`
    const sucL = exp.sucursal === 'rio_grande' ? 'Río Grande' : 'Ushuaia'
    const repList = repuestos.filter(r => r.monto_aprobado && Number(r.monto_aprobado) > 0)
    const pItems: PresupuestoItem[] = Array.isArray((exp as any).presupuesto_items) ? (exp as any).presupuesto_items : []
    const tp = totalPresupuesto
    const catLabels: Record<string, string> = { repuestos: 'Repuestos originales FIAT', mo_taller: 'Mano de obra — Taller mecánico', chapista: 'Trabajos de chapa y carrocería', pintura: 'Pintura y acabado', otros: 'Otros conceptos' }
    const w = window.open('', '_blank')
    if (!w) { notify.error('Habilitá las ventanas emergentes para generar el PDF'); return }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Presupuesto ${nroP}</title>
<style>
@page{margin:20mm 15mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;font-size:12px;line-height:1.5}
.page{max-width:210mm;margin:0 auto}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:3px solid #1a3a5c;margin-bottom:24px}
.company h1{font-size:22px;color:#1a3a5c;letter-spacing:1px;margin-bottom:2px}
.company h2{font-size:13px;color:#c0392b;font-weight:600;margin-bottom:4px}
.company-info{font-size:10px;color:#666;line-height:1.6}
.doc-info{text-align:right}
.doc-title{font-size:18px;font-weight:700;color:#1a3a5c;margin-bottom:8px;text-transform:uppercase;letter-spacing:2px}
.doc-number{font-size:14px;font-weight:600;color:#c0392b;margin-bottom:4px}
.doc-date{font-size:11px;color:#666}
.section{margin-bottom:20px}
.section-title{font-size:11px;font-weight:700;color:#1a3a5c;text-transform:uppercase;letter-spacing:1.5px;padding-bottom:6px;border-bottom:1.5px solid #ddd;margin-bottom:10px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #ddd;border-radius:4px;overflow:hidden}
.info-item{padding:8px 12px;border-bottom:1px solid #eee}
.info-item:nth-child(odd){border-right:1px solid #eee}
.info-label{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.5px}
.info-value{font-size:12px;font-weight:500;color:#1a1a1a}
.desc-box{background:#f8f9fa;border:1px solid #e0e0e0;border-radius:4px;padding:12px;margin-top:10px;font-size:12px;color:#333}
table{width:100%;border-collapse:collapse;margin:12px 0}
thead th{background:#1a3a5c;color:#fff;padding:10px 12px;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:600}
thead th:first-child{text-align:left;border-radius:4px 0 0 0}thead th:last-child{text-align:right;border-radius:0 4px 0 0}
tbody td{padding:10px 12px;border-bottom:1px solid #eee;font-size:12px}
.text-right{text-align:right}.monto{font-family:'Courier New',monospace;font-weight:600}
.total-box{background:#1a3a5c;color:#fff;border-radius:6px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin:20px 0}
.total-label{font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.total-amount{font-size:24px;font-weight:700;font-family:'Courier New',monospace}
.conditions{background:#f8f9fa;border:1px solid #e0e0e0;border-radius:4px;padding:14px;margin:16px 0}
.conditions h4{font-size:10px;color:#1a3a5c;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:700}
.conditions ul{list-style:none;font-size:10px;color:#555;line-height:1.8}
.conditions ul li::before{content:"•";color:#c0392b;font-weight:bold;margin-right:6px}
.signatures{display:flex;justify-content:space-between;margin-top:60px}
.sig-block{text-align:center;width:200px}
.sig-line{border-top:1.5px solid #333;margin-bottom:6px;padding-top:60px}
.sig-name{font-size:11px;font-weight:600;color:#333}
.sig-role{font-size:9px;color:#888}
.footer{margin-top:30px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:9px;color:#999}
</style></head><body><div class="page">
<div class="header"><div class="company"><h1>LIENDO AUTOMOTORES S.A.</h1><h2>Concesionario Oficial FIAT</h2>
<div class="company-info">Sucursal ${sucL} — Tierra del Fuego, Argentina</div></div>
<div class="doc-info"><div class="doc-title">Presupuesto</div><div class="doc-number">${nroP}</div>
<div class="doc-date">Fecha: ${fechaStr}</div><div class="doc-date">Válido hasta: ${validez}</div></div></div>
<div class="section"><div class="section-title">Datos del cliente / asegurado</div><div class="info-grid">
<div class="info-item"><div class="info-label">Nombre y apellido</div><div class="info-value">${cli?.nombre||''} ${cli?.apellido||''}</div></div>
<div class="info-item"><div class="info-label">DNI / CUIL</div><div class="info-value">${cli?.dni||'—'}</div></div>
<div class="info-item"><div class="info-label">Teléfono</div><div class="info-value">${cli?.telefono||'—'}</div></div>
<div class="info-item"><div class="info-label">Email</div><div class="info-value">${cli?.email||'—'}</div></div>
<div class="info-item"><div class="info-label">Dirección</div><div class="info-value">${cli?.direccion||'—'}</div></div>
<div class="info-item"><div class="info-label">Localidad</div><div class="info-value">${cli?.localidad||sucL}</div></div></div></div>
<div class="section"><div class="section-title">Datos del vehículo</div><div class="info-grid">
<div class="info-item"><div class="info-label">Marca / Modelo</div><div class="info-value">${cli?.marca||'FIAT'} ${cli?.modelo||'—'}</div></div>
<div class="info-item"><div class="info-label">Año</div><div class="info-value">${cli?.anio||'—'}</div></div>
<div class="info-item"><div class="info-label">Dominio / Patente</div><div class="info-value">${cli?.dominio||'—'}</div></div>
<div class="info-item"><div class="info-label">VIN / Chasis</div><div class="info-value">${cli?.vin||'—'}</div></div>
<div class="info-item"><div class="info-label">Color</div><div class="info-value">${cli?.color||'—'}</div></div>
<div class="info-item"><div class="info-label">Km al ingreso</div><div class="info-value">${exp.km_ingreso?exp.km_ingreso.toLocaleString('es-AR')+' km':'—'}</div></div></div></div>
<div class="section"><div class="section-title">Datos del siniestro</div><div class="info-grid">
<div class="info-item"><div class="info-label">Nro. siniestro</div><div class="info-value">${exp.nro_siniestro_interno||'—'} ${exp.nro_siniestro_compania?'/ '+exp.nro_siniestro_compania:''}</div></div>
<div class="info-item"><div class="info-label">Compañía de seguros</div><div class="info-value">${exp.compania_seguro||'—'}</div></div>
<div class="info-item"><div class="info-label">Fecha del siniestro</div><div class="info-value">${exp.fecha_siniestro||'—'}</div></div>
<div class="info-item"><div class="info-label">Tipo de daño</div><div class="info-value">${(exp.tipo_danio||'—').replace(/_/g,' ')}</div></div></div>
${exp.descripcion_siniestro?`<div class="desc-box"><strong>Descripción:</strong><br>${exp.descripcion_siniestro}</div>`:''}</div>
<div class="section"><div class="section-title">Detalle del presupuesto</div>
${pItems.length > 0 ? (() => {
  const cats = ['repuestos','mo_taller','chapista','otros'] as const
  return cats.map(cat => {
    const ci = pItems.filter(i => i.categoria === cat)
    if (ci.length === 0) return ''
    const catTotal = ci.reduce((s,i) => s + (i.cantidad*i.precio_unitario), 0)
    return `<h3 style="font-size:12px;color:#1a3a5c;margin:16px 0 6px;text-transform:uppercase;letter-spacing:1px">${catLabels[cat]}</h3>
    <table><thead><tr><th style="width:15%">Código</th><th style="width:35%">Descripción</th><th class="text-right">Cant.</th><th class="text-right">Precio unit.</th><th class="text-right">Subtotal</th></tr></thead><tbody>
    ${ci.map(i => {
      const sub = i.cantidad*i.precio_unitario
      return `<tr><td style="font-family:monospace;font-size:11px">${i.codigo||'—'}</td><td>${i.descripcion}</td><td class="text-right">${i.cantidad}</td><td class="text-right monto">$ ${i.precio_unitario.toLocaleString('es-AR')}</td><td class="text-right monto">$ ${sub.toLocaleString('es-AR')}</td></tr>`
    }).join('')}
    <tr style="font-weight:600;background:#f8f8f8"><td>Subtotal ${catLabels[cat]}</td><td></td><td></td><td class="text-right monto">$ ${catTotal.toLocaleString('es-AR')}</td></tr>
    </tbody></table>`
  }).join('')
})() : `<table><thead><tr><th style="width:60%">Concepto</th><th class="text-right">Importe</th></tr></thead><tbody>
${n(exp.monto_presupuesto_repuestos)?`<tr><td>Repuestos originales FIAT</td><td class="text-right monto">$ ${n(exp.monto_presupuesto_repuestos).toLocaleString('es-AR')}</td></tr>`:''}
${n(exp.monto_presupuesto_mo_taller)?`<tr><td>Mano de obra — Taller mecánico</td><td class="text-right monto">$ ${n(exp.monto_presupuesto_mo_taller).toLocaleString('es-AR')}</td></tr>`:''}
${n(exp.monto_presupuesto_chapista)?`<tr><td>Trabajos de chapa y carrocería</td><td class="text-right monto">$ ${n(exp.monto_presupuesto_chapista).toLocaleString('es-AR')}</td></tr>`:''}
${n(exp.monto_presupuesto_otros)?`<tr><td>Otros conceptos</td><td class="text-right monto">$ ${n(exp.monto_presupuesto_otros).toLocaleString('es-AR')}</td></tr>`:''}
</tbody></table>`}
</div>
${repList.length>0?`<div class="section"><div class="section-title">Detalle de repuestos</div>
<table><thead><tr><th>Nro. Parte</th><th>Descripción</th><th class="text-right">Cant.</th><th class="text-right">Importe</th></tr></thead><tbody>
${repList.map(r=>`<tr><td>${r.nro_parte}</td><td>${r.descripcion}</td><td class="text-right">${r.cantidad_solicitada}</td><td class="text-right monto">$ ${Number(r.monto_aprobado||0).toLocaleString('es-AR')}</td></tr>`).join('')}
</tbody></table></div>`:''}
<div class="total-box"><div class="total-label">Total presupuesto</div><div class="total-amount">$ ${tp.toLocaleString('es-AR')}</div></div>
<div class="conditions"><h4>Condiciones generales</h4><ul>
<li>Presupuesto válido por 15 días corridos desde la fecha de emisión.</li>
<li>Precios incluyen IVA. Sujetos a modificación sin previo aviso por parte de la terminal.</li>
<li>Repuestos originales FIAT/Stellantis con garantía de fábrica.</li>
<li>Plazo de reparación sujeto a disponibilidad de repuestos.</li>
<li>Repuestos importados o en tránsito a Tierra del Fuego: 7 a 15 días hábiles.</li>
<li>Daños ocultos detectados durante la reparación se informarán mediante presupuesto suplementario.</li>
<li>Entrega del vehículo previa cancelación total o presentación de orden de pago de la aseguradora.</li></ul></div>
<div class="signatures"><div class="sig-block"><div class="sig-line"></div><div class="sig-name">${cli?.nombre||''} ${cli?.apellido||''}</div><div class="sig-role">Cliente / Asegurado</div></div>
<div class="sig-block"><div class="sig-line"></div><div class="sig-name">Liendo Automotores S.A.</div><div class="sig-role">Taller Oficial FIAT — ${sucL}</div></div></div>
<div class="footer"><span>LIENDO AUTOMOTORES S.A. — Concesionario Oficial FIAT — Tierra del Fuego</span><span>${fechaStr}</span></div>
</div></body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 300)
  }

  const currentStateIdx = ESTADOS.indexOf(exp.estado_actual)
  const canAdvance = currentStateIdx >= 0 && currentStateIdx < ESTADOS.length - 1
    && exp.estado_actual !== 'cancelado'

  // presupuesto total
  const n = (v: unknown) => Number(v) || 0
  const totalPresupuesto = n(exp.monto_presupuesto_repuestos) + n(exp.monto_presupuesto_mo_taller)
    + n(exp.monto_presupuesto_chapista) + n(exp.monto_presupuesto_pintura) + n(exp.monto_presupuesto_otros)

  // repuestos summary
  const repRecibidos = repuestos.filter(r => r.estado === 'recibido_completo').length
  const repTotal = repuestos.length

  // cobro semaforo
  const semaforo = getCobroSemaforo(exp.fecha_facturacion, exp.fecha_cobro_efectivo)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack}><ArrowLeft className="h-4 w-4" /> Volver</Button>
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              Siniestro {exp.nro_siniestro_interno || 'Sin numero'}
            </h1>
            <p className="text-sm text-text-muted">
              {cli ? `${cli.nombre} ${cli.apellido} - ${cli.marca} ${cli.modelo} (${cli.dominio})` : 'Sin cliente'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge text={CANAL_LABELS[exp.canal_ingreso] || exp.canal_ingreso} color={CANAL_COLORS[exp.canal_ingreso] || 'gray'} />
          <Badge text={ESTADO_LABELS[exp.estado_actual] || exp.estado_actual} color={getEstadoColor(exp.estado_actual)} />
          {exp.compania_seguro && (
            <span className="text-xs text-text-muted">Cia: {exp.compania_seguro}</span>
          )}
          <Badge text={`Facturar a: ${exp.facturar_a === 'compania' ? 'COMPANIA' : 'CLIENTE'}`} color={exp.facturar_a === 'compania' ? 'purple' : 'blue'} />
          <button
            onClick={() => generarPDF()}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-500 transition-colors cursor-pointer"
          >
            <Receipt className="h-3.5 w-3.5" /> Presupuesto PDF
          </button>
          {canAdvance && (
            <Button size="sm" className="bg-rose-600 hover:bg-rose-700" onClick={advanceStage} loading={updateExp.isPending}>
              Avanzar etapa
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <Timeline estadoActual={exp.estado_actual} />

      {/* Sections */}
      <div className="space-y-3">
        {/* 1. Ingreso e inspeccion */}
        <Accordion title="Ingreso e inspeccion" icon={<FileText className="h-4 w-4" />} defaultOpen>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField label="Fecha ingreso vehiculo" type="date" value={exp.fecha_ingreso_vehiculo || ''} onSave={v => saveField('fecha_ingreso_vehiculo', v || null)} />
            <EditableField label="KM ingreso" type="number" value={String(exp.km_ingreso || '')} onSave={v => saveField('km_ingreso', v ? Number(v) : null)} />
            <EditableField label="Fecha siniestro" type="date" value={exp.fecha_siniestro || ''} onSave={v => saveField('fecha_siniestro', v || null)} />
            <EditableField label="Tipo de danio" value={exp.tipo_danio || ''} onSave={v => saveField('tipo_danio', v)} />
            <EditableField label="Inspector" value={exp.inspector || ''} onSave={v => saveField('inspector', v)} />
            <EditableField label="Nro orden trabajo" value={exp.nro_orden_trabajo || ''} onSave={v => saveField('nro_orden_trabajo', v)} />
            <div className="md:col-span-2">
              <EditableField label="Descripcion del siniestro" type="textarea" value={exp.descripcion_siniestro || ''} onSave={v => saveField('descripcion_siniestro', v)} />
            </div>
          </div>
        </Accordion>

        {/* 2. Presupuesto */}
        <Accordion title="Presupuesto" icon={<Receipt className="h-4 w-4" />}>
          <PresupuestoDetalle exp={exp} saveField={saveField} totalPresupuesto={totalPresupuesto} />
        </Accordion>
        {/* 3. Aprobacion */}
        <Accordion title="Aprobacion" icon={<CheckCircle2 className="h-4 w-4" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField label="Fecha aprobacion" type="date" value={exp.fecha_aprobacion || ''} onSave={v => saveField('fecha_aprobacion', v || null)} />
            <div>
              <label className="block text-sm text-text-secondary mb-1">Resultado aprobacion</label>
              <select
                value={exp.resultado_aprobacion || ''}
                onChange={e => saveField('resultado_aprobacion', e.target.value)}
                className="w-full rounded-lg bg-bg-input border border-border px-3 py-2 text-sm text-text-primary cursor-pointer"
              >
                {RESULTADO_APROBACION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <EditableField label="Monto aprobado repuestos" type="number" value={String(exp.monto_aprobado_repuestos || '')} onSave={v => saveField('monto_aprobado_repuestos', v ? Number(v) : 0)} />
            <EditableField label="Monto aprobado MO" type="number" value={String(exp.monto_aprobado_mo || '')} onSave={v => saveField('monto_aprobado_mo', v ? Number(v) : 0)} />
            <EditableField label="Monto aprobado chapista" type="number" value={String(exp.monto_aprobado_chapista || '')} onSave={v => saveField('monto_aprobado_chapista', v ? Number(v) : 0)} />
            <div className="bg-bg-tertiary rounded-lg p-3">
              <p className="text-xs text-text-muted">Total aprobado</p>
              <p className="text-lg font-bold text-green-600">{fmtMoney(exp.monto_aprobado_total || 0)}</p>
            </div>
            <EditableField label="Orden aprobacion Nro" value={exp.orden_aprobacion_nro || ''} onSave={v => saveField('orden_aprobacion_nro', v)} />
          </div>
        </Accordion>

        {/* 4. Repuestos */}
        <Accordion title={`Repuestos ${repTotal > 0 ? `(${repRecibidos} de ${repTotal} recibidos)` : ''}`} icon={<Package className="h-4 w-4" />}>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-text-secondary">Necesita repuestos:</label>
            <button
              onClick={() => saveField('necesita_repuestos', !exp.necesita_repuestos)}
              className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${exp.necesita_repuestos ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}
            >
              {exp.necesita_repuestos ? 'Si' : 'No'}
            </button>
            {repTotal > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <div className="w-24 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${repTotal > 0 ? (repRecibidos / repTotal) * 100 : 0}%` }} />
                </div>
                <span className="text-xs text-text-muted">{repRecibidos}/{repTotal}</span>
              </div>
            )}
          </div>
          <RepuestosTable expedienteId={exp.id} repuestos={repuestos} qc={qc} />
        </Accordion>

        {/* 5. Reparacion */}
        <Accordion title="Reparacion" icon={<Wrench className="h-4 w-4" />}>
          <div className="space-y-4">
            {/* Chapista */}
            <div className="bg-bg-tertiary rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
                  <Hammer className="h-4 w-4" /> Chapista
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => saveField('trabajo_chapista_requerido', !exp.trabajo_chapista_requerido)}
                    className={`px-2 py-0.5 rounded text-xs cursor-pointer ${exp.trabajo_chapista_requerido ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {exp.trabajo_chapista_requerido ? 'Requerido' : 'No requerido'}
                  </button>
                  {exp.trabajo_chapista_requerido && (
                    <button
                      onClick={() => saveField('trabajo_chapista_completo', !exp.trabajo_chapista_completo)}
                      className={`px-2 py-0.5 rounded text-xs cursor-pointer ${exp.trabajo_chapista_completo ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
                    >
                      {exp.trabajo_chapista_completo ? 'Completo' : 'Pendiente'}
                    </button>
                  )}
                </div>
              </div>
              {exp.trabajo_chapista_requerido && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <EditableField label="Nombre" value={exp.trabajo_chapista_nombre || ''} onSave={v => saveField('trabajo_chapista_nombre', v)} />
                  <EditableField label="Fecha inicio" type="date" value={exp.trabajo_chapista_fecha_inicio || ''} onSave={v => saveField('trabajo_chapista_fecha_inicio', v || null)} />
                  <EditableField label="Fecha fin" type="date" value={exp.trabajo_chapista_fecha_fin || ''} onSave={v => saveField('trabajo_chapista_fecha_fin', v || null)} />
                </div>
              )}
            </div>

            {/* MO Taller */}
            <div className="bg-bg-tertiary rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
                  <Wrench className="h-4 w-4" /> MO Taller
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => saveField('trabajo_mo_taller_requerido', !exp.trabajo_mo_taller_requerido)}
                    className={`px-2 py-0.5 rounded text-xs cursor-pointer ${exp.trabajo_mo_taller_requerido ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {exp.trabajo_mo_taller_requerido ? 'Requerido' : 'No requerido'}
                  </button>
                  {exp.trabajo_mo_taller_requerido && (
                    <button
                      onClick={() => saveField('trabajo_mo_taller_completo', !exp.trabajo_mo_taller_completo)}
                      className={`px-2 py-0.5 rounded text-xs cursor-pointer ${exp.trabajo_mo_taller_completo ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
                    >
                      {exp.trabajo_mo_taller_completo ? 'Completo' : 'Pendiente'}
                    </button>
                  )}
                </div>
              </div>
              {exp.trabajo_mo_taller_requerido && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <EditableField label="Nombre" value={exp.trabajo_mo_taller_nombre || ''} onSave={v => saveField('trabajo_mo_taller_nombre', v)} />
                  <EditableField label="Fecha inicio" type="date" value={exp.trabajo_mo_taller_fecha_inicio || ''} onSave={v => saveField('trabajo_mo_taller_fecha_inicio', v || null)} />
                  <EditableField label="Fecha fin" type="date" value={exp.trabajo_mo_taller_fecha_fin || ''} onSave={v => saveField('trabajo_mo_taller_fecha_fin', v || null)} />
                </div>
              )}
            </div>

            {/* Pintura */}
            <div className="bg-bg-tertiary rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
                  <Paintbrush className="h-4 w-4" /> Pintura
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => saveField('trabajo_pintura_requerido', !exp.trabajo_pintura_requerido)}
                    className={`px-2 py-0.5 rounded text-xs cursor-pointer ${exp.trabajo_pintura_requerido ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {exp.trabajo_pintura_requerido ? 'Requerido' : 'No requerido'}
                  </button>
                  {exp.trabajo_pintura_requerido && (
                    <button
                      onClick={() => saveField('trabajo_pintura_completo', !exp.trabajo_pintura_completo)}
                      className={`px-2 py-0.5 rounded text-xs cursor-pointer ${exp.trabajo_pintura_completo ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
                    >
                      {exp.trabajo_pintura_completo ? 'Completo' : 'Pendiente'}
                    </button>
                  )}
                </div>
              </div>
              {exp.trabajo_pintura_requerido && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <EditableField label="Nombre" value={exp.trabajo_pintura_nombre || ''} onSave={v => saveField('trabajo_pintura_nombre', v)} />
                  <EditableField label="Fecha inicio" type="date" value={exp.trabajo_pintura_fecha_inicio || ''} onSave={v => saveField('trabajo_pintura_fecha_inicio', v || null)} />
                  <EditableField label="Fecha fin" type="date" value={exp.trabajo_pintura_fecha_fin || ''} onSave={v => saveField('trabajo_pintura_fecha_fin', v || null)} />
                </div>
              )}
            </div>

            {/* Marcar reparacion completa */}
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                className={exp.reparacion_completa ? 'bg-green-600 hover:bg-green-700' : 'bg-rose-600 hover:bg-rose-700'}
                onClick={() => saveField('reparacion_completa', !exp.reparacion_completa)}
              >
                <CheckCircle2 className="h-4 w-4" />
                {exp.reparacion_completa ? 'Reparacion completa' : 'Marcar reparacion completa'}
              </Button>
            </div>
          </div>
        </Accordion>

        {/* 6. Facturacion y cobro */}
        <Accordion title="Facturacion y cobro" icon={<DollarSign className="h-4 w-4" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField label="Nro factura" value={exp.nro_factura || ''} onSave={v => saveField('nro_factura', v)} />
            <EditableField label="Monto facturado" type="number" value={String(exp.monto_facturado || '')} onSave={v => saveField('monto_facturado', v ? Number(v) : 0)} />
            <EditableField label="Facturado a nombre" value={exp.facturado_a_nombre || ''} onSave={v => saveField('facturado_a_nombre', v)} />
            <EditableField label="Fecha facturacion" type="date" value={exp.fecha_facturacion || ''} onSave={v => {
              saveField('fecha_facturacion', v || null)
              // auto-set vencimiento +30d
              if (v) {
                const d = new Date(v)
                d.setDate(d.getDate() + 30)
                saveField('fecha_vencimiento_cobro', d.toISOString().slice(0, 10))
              }
            }} />
            <EditableField label="Fecha vencimiento cobro" type="date" value={exp.fecha_vencimiento_cobro || ''} onSave={v => saveField('fecha_vencimiento_cobro', v || null)} />
            <EditableField label="Fecha cobro efectivo" type="date" value={exp.fecha_cobro_efectivo || ''} onSave={v => saveField('fecha_cobro_efectivo', v || null)} />
            <EditableField label="Monto cobrado" type="number" value={String(exp.monto_cobrado || '')} onSave={v => saveField('monto_cobrado', v ? Number(v) : 0)} />
            <div className="bg-bg-tertiary rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-3 w-3 rounded-full ${semaforo.color === 'green' ? 'bg-green-500' : semaforo.color === 'yellow' ? 'bg-yellow-500' : semaforo.color === 'red' ? 'bg-red-500' : 'bg-gray-300'}`} />
                <p className="text-xs text-text-muted">
                  {exp.fecha_cobro_efectivo ? 'Cobrado' : semaforo.days > 0 ? `${semaforo.days} dias desde facturacion` : 'Sin facturar'}
                </p>
              </div>
              <p className="text-xs text-text-muted">Diferencia</p>
              <p className={`text-lg font-bold ${((exp.monto_facturado || 0) - (exp.monto_cobrado || 0)) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {fmtMoney((exp.monto_facturado || 0) - (exp.monto_cobrado || 0))}
              </p>
            </div>
          </div>
        </Accordion>

        {/* 7. Suplementario */}
        <Accordion title="Presupuesto suplementario" icon={<FileText className="h-4 w-4" />}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-text-secondary">Tiene presupuesto suplementario:</label>
              <button
                onClick={() => saveField('tiene_presupuesto_suplementario', !exp.tiene_presupuesto_suplementario)}
                className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${exp.tiene_presupuesto_suplementario ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}
              >
                {exp.tiene_presupuesto_suplementario ? 'Si' : 'No'}
              </button>
            </div>
            {exp.tiene_presupuesto_suplementario && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EditableField label="Monto suplementario" type="number" value={String(exp.monto_suplementario || '')} onSave={v => saveField('monto_suplementario', v ? Number(v) : 0)} />
                <div className="flex items-center gap-3">
                  <label className="text-sm text-text-secondary">Aprobado:</label>
                  <button
                    onClick={() => saveField('suplementario_aprobado', !exp.suplementario_aprobado)}
                    className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${exp.suplementario_aprobado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {exp.suplementario_aprobado ? 'Aprobado' : 'Pendiente'}
                  </button>
                </div>
                <div className="md:col-span-2">
                  <EditableField label="Detalle suplementario" type="textarea" value={exp.suplementario_detalle || ''} onSave={v => saveField('suplementario_detalle', v)} />
                </div>
              </div>
            )}
          </div>
        </Accordion>

        {/* Notas internas */}
        <Accordion title="Notas internas" icon={<FileText className="h-4 w-4" />}>
          <EditableField label="" type="textarea" value={exp.notas_internas || ''} onSave={v => saveField('notas_internas', v)} />
        </Accordion>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar expediente"
        message={`Vas a eliminar el expediente de siniestro ${exp.nro_siniestro_interno}. Esta accion no se puede deshacer.`}
        onConfirm={() => deleteExp.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

// ─── Editable Field ──────────────────────────────────────────────────

function EditableField({ label, value, type = 'text', onSave }: {
  label: string; value: string; type?: 'text' | 'textarea' | 'date' | 'number'; onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const handleSave = () => {
    if (draft !== value) onSave(draft)
    setEditing(false)
  }

  const handleCancel = () => {
    setDraft(value)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div
        className="group cursor-pointer"
        onClick={() => { setDraft(type === 'date' ? toDateInput(value) : value); setEditing(true) }}
      >
        {label && <p className="text-xs text-text-muted mb-0.5">{label}</p>}
        <div className="flex items-center gap-1">
          <p className="text-sm text-text-primary min-h-[20px]">
            {type === 'date' ? fmtDate(value || null) : type === 'number' && value ? Number(value).toLocaleString('es-AR') : value || '-'}
          </p>
          <Edit2 className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    )
  }

  return (
    <div>
      {label && <p className="text-xs text-text-muted mb-0.5">{label}</p>}
      <div className="flex items-start gap-1">
        {type === 'textarea' ? (
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') handleCancel() }}
            className="flex-1 rounded-lg bg-bg-input border border-border px-2 py-1.5 text-sm text-text-primary min-h-[60px] focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
        ) : (
          <input
            autoFocus
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
            className="flex-1 rounded-lg bg-bg-input border border-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
        )}
        <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-50 rounded cursor-pointer"><Check className="h-4 w-4" /></button>
        <button onClick={handleCancel} className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"><X className="h-4 w-4" /></button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// REPUESTOS TABLE
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// DASHBOARD: REPUESTOS + FACTURACION/COBRO
// ═══════════════════════════════════════════════════════════════

function SiniestrosDashboard({ expedientes, allRepuestos, openDetail }: {
  expedientes: SiniestroExpediente[]
  allRepuestos: any[]
  openDetail: (id: string) => void
}) {
  const activos = expedientes.filter(e => !['cerrado', 'cancelado', 'cobrado'].includes(e.estado_actual))

  const repPendientes = allRepuestos.filter((r: any) => r.estado === 'pendiente')
  const repPedidos = allRepuestos.filter((r: any) => r.estado === 'pedido_realizado')
  const repTransito = allRepuestos.filter((r: any) => r.estado === 'en_transito')
  const repRecibidos = allRepuestos.filter((r: any) => ['recibido_completo', 'recibido_parcial'].includes(r.estado))
  const repIncidencia = allRepuestos.filter((r: any) => r.estado === 'incidencia')
  const repSinMovimiento = allRepuestos.filter((r: any) => {
    if (!r.fecha_pedido || ['recibido_completo', 'incidencia'].includes(r.estado)) return false
    return daysBetween(r.fecha_pedido) > 5
  })

  const facturados = activos.filter(e => e.estado_actual === 'facturado' && Number(e.monto_facturado) > 0)
  const cobrados = expedientes.filter(e => e.estado_actual === 'cobrado' || e.fecha_cobro_efectivo)
  const porVencer = facturados.filter(e => { const d = daysBetween(e.fecha_facturacion); return d >= 25 && d <= 30 })
  const vencidos = facturados.filter(e => daysBetween(e.fecha_facturacion) > 30)
  const enPlazo = facturados.filter(e => daysBetween(e.fecha_facturacion) < 25)
  const montoTotalFacturado = facturados.reduce((s, e) => s + Number(e.monto_facturado || 0), 0)

  const porCompania: Record<string, { facturado: number; cobrado: number; expedientes: number; vencidos: number }> = {}
  facturados.forEach(e => {
    const cia = e.compania_seguro || 'Sin compañía'
    if (!porCompania[cia]) porCompania[cia] = { facturado: 0, cobrado: 0, expedientes: 0, vencidos: 0 }
    porCompania[cia].facturado += Number(e.monto_facturado || 0)
    porCompania[cia].expedientes++
    if (daysBetween(e.fecha_facturacion) > 30) porCompania[cia].vencidos++
  })
  cobrados.forEach(e => {
    const cia = e.compania_seguro || 'Sin compañía'
    if (!porCompania[cia]) porCompania[cia] = { facturado: 0, cobrado: 0, expedientes: 0, vencidos: 0 }
    porCompania[cia].cobrado += Number(e.monto_cobrado || 0)
  })

  return (
    <div className="space-y-6">
      {/* REPUESTOS */}
      <div className="bg-bg-secondary rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-orange-400" />
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">Estado de repuestos</h2>
          <span className="text-xs text-text-muted">({allRepuestos.length} total)</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-2xl font-bold text-gray-600">{repPendientes.length}</p>
            <p className="text-xs text-gray-500 font-medium">Sin pedir</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-2xl font-bold text-yellow-600">{repPedidos.length}</p>
            <p className="text-xs text-yellow-500 font-medium">Pedidos</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-2xl font-bold text-blue-600">{repTransito.length}</p>
            <p className="text-xs text-blue-500 font-medium">En tránsito</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-2xl font-bold text-green-600">{repRecibidos.length}</p>
            <p className="text-xs text-green-500 font-medium">Recibidos</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-2xl font-bold text-red-600">{repIncidencia.length}</p>
            <p className="text-xs text-red-500 font-medium">Incidencia</p>
          </div>
        </div>

        {repSinMovimiento.length > 0 && (
          <div className="bg-yellow-900/20 border border-yellow-600/40 rounded-lg p-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-300">{repSinMovimiento.length} repuesto{repSinMovimiento.length > 1 ? 's' : ''} sin movimiento hace +5 días</p>
          </div>
        )}

        {[...repPendientes, ...repPedidos, ...repTransito].length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-bg-tertiary text-text-muted">
                  <th className="text-left px-3 py-2 font-medium">Nro parte</th>
                  <th className="text-left px-3 py-2 font-medium">Descripción</th>
                  <th className="text-left px-3 py-2 font-medium">Siniestro</th>
                  <th className="text-left px-3 py-2 font-medium">Estado</th>
                  <th className="text-left px-3 py-2 font-medium">ETA</th>
                  <th className="text-right px-3 py-2 font-medium">Días</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...repPendientes, ...repPedidos, ...repTransito].map((r: any) => {
                  const exp = r.siniestros_expedientes
                  const cli = exp?.siniestros_clientes
                  const dias = r.fecha_pedido ? daysBetween(r.fecha_pedido) : null
                  const demorado = dias !== null && dias > 5
                  return (
                    <tr key={r.id} className={`hover:bg-bg-secondary/50 cursor-pointer ${demorado ? 'bg-yellow-900/10' : ''}`}
                      onClick={() => r.expediente_id && openDetail(r.expediente_id)}>
                      <td className="px-3 py-2 font-mono text-text-primary">{r.nro_parte}</td>
                      <td className="px-3 py-2 text-text-secondary">{r.descripcion}</td>
                      <td className="px-3 py-2 text-text-muted">{exp?.nro_siniestro_interno || '—'} {cli ? `(${cli.apellido})` : ''}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getRepuestoColor(r.estado)}`}>
                          {REPUESTO_ESTADOS.find((o: any) => o.value === r.estado)?.label || r.estado}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-text-muted">{r.fecha_eta_estimada ? fmtDate(r.fecha_eta_estimada) : '—'}</td>
                      <td className={`px-3 py-2 text-right font-medium ${demorado ? 'text-yellow-400' : 'text-text-secondary'}`}>{dias !== null ? `${dias}d` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FACTURACION Y COBRO */}
      <div className="bg-bg-secondary rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-green-400" />
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">Facturación y cobro</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="text-center p-3 bg-bg-tertiary rounded-lg">
            <p className="text-xl font-bold text-text-primary">{fmtMoney(montoTotalFacturado)}</p>
            <p className="text-xs text-text-muted font-medium">Facturado pendiente</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-2xl font-bold text-green-600">{enPlazo.length}</p>
            <p className="text-xs text-green-500 font-medium">En plazo (&lt;25d)</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-2xl font-bold text-yellow-600">{porVencer.length}</p>
            <p className="text-xs text-yellow-500 font-medium">Por vencer (25-30d)</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-2xl font-bold text-red-600">{vencidos.length}</p>
            <p className="text-xs text-red-500 font-medium">Vencidos (&gt;30d)</p>
          </div>
        </div>

        {facturados.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Facturas pendientes de cobro</p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-bg-tertiary text-text-muted">
                    <th className="text-left px-3 py-2 font-medium">Nro factura</th>
                    <th className="text-left px-3 py-2 font-medium">Siniestro</th>
                    <th className="text-left px-3 py-2 font-medium">Cliente</th>
                    <th className="text-left px-3 py-2 font-medium">Compañía</th>
                    <th className="text-right px-3 py-2 font-medium">Monto</th>
                    <th className="text-center px-3 py-2 font-medium">Semáforo</th>
                    <th className="text-right px-3 py-2 font-medium">Días</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {facturados.sort((a, b) => daysBetween(b.fecha_facturacion) - daysBetween(a.fecha_facturacion)).map(e => {
                    const cli = e.siniestros_clientes
                    const dias = daysBetween(e.fecha_facturacion)
                    const semColor = dias > 30 ? 'bg-red-500' : dias >= 25 ? 'bg-yellow-500' : 'bg-green-500'
                    return (
                      <tr key={e.id} className={`hover:bg-bg-secondary/50 cursor-pointer ${dias > 30 ? 'bg-red-900/10' : ''}`}
                        onClick={() => openDetail(e.id)}>
                        <td className="px-3 py-2 font-mono text-text-primary">{e.nro_factura || '—'}</td>
                        <td className="px-3 py-2 text-text-muted">{e.nro_siniestro_interno || '—'}</td>
                        <td className="px-3 py-2 text-text-primary">{cli ? `${cli.nombre} ${cli.apellido}` : '—'}</td>
                        <td className="px-3 py-2 text-text-secondary">{e.compania_seguro || '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold font-mono">{fmtMoney(Number(e.monto_facturado))}</td>
                        <td className="px-3 py-2 text-center"><span className={`inline-block w-3 h-3 rounded-full ${semColor}`} /></td>
                        <td className={`px-3 py-2 text-right font-medium ${dias > 30 ? 'text-red-400' : dias >= 25 ? 'text-yellow-400' : 'text-green-400'}`}>{dias}d</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {Object.keys(porCompania).length > 0 && (
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Desglose por compañía de seguros</p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-bg-tertiary text-text-muted">
                    <th className="text-left px-3 py-2 font-medium">Compañía</th>
                    <th className="text-right px-3 py-2 font-medium">Exp.</th>
                    <th className="text-right px-3 py-2 font-medium">Facturado</th>
                    <th className="text-right px-3 py-2 font-medium">Cobrado</th>
                    <th className="text-right px-3 py-2 font-medium">Pendiente</th>
                    <th className="text-right px-3 py-2 font-medium">Vencidos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(porCompania).sort((a, b) => b[1].facturado - a[1].facturado).map(([cia, d]) => (
                    <tr key={cia}>
                      <td className="px-3 py-2 text-text-primary font-medium">{cia}</td>
                      <td className="px-3 py-2 text-right text-text-secondary">{d.expedientes}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtMoney(d.facturado)}</td>
                      <td className="px-3 py-2 text-right font-mono text-green-400">{fmtMoney(d.cobrado)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{fmtMoney(d.facturado - d.cobrado)}</td>
                      <td className="px-3 py-2 text-right">{d.vencidos > 0 ? <span className="text-red-400 font-semibold">{d.vencidos}</span> : '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {facturados.length === 0 && cobrados.length === 0 && (
          <p className="text-sm text-text-muted text-center py-8">No hay facturas emitidas todavía</p>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PRESUPUESTO CON ITEMS DETALLADOS
// ═══════════════════════════════════════════════════════════════

interface PresupuestoItem {
  id: string
  codigo?: string
  categoria: 'repuestos' | 'mo_taller' | 'chapista' | 'otros'
  descripcion: string
  cantidad: number
  precio_unitario: number
  panos?: number
}

const CATEGORIAS_PRESUPUESTO = [
  { key: 'repuestos' as const, label: 'Repuestos', color: 'border-l-blue-500', bg: 'bg-blue-950/10' },
  { key: 'mo_taller' as const, label: 'Mano de obra taller', color: 'border-l-green-500', bg: 'bg-green-950/10' },
  { key: 'chapista' as const, label: 'Chapista', color: 'border-l-orange-500', bg: 'bg-orange-950/10' },
  { key: 'otros' as const, label: 'Otros', color: 'border-l-gray-500', bg: 'bg-gray-950/10' },
]

function PresupuestoDetalle({ exp, saveField, totalPresupuesto }: {
  exp: SiniestroExpediente; saveField: (field: string, value: unknown) => void
  totalPresupuesto: number
}) {
  const items: PresupuestoItem[] = Array.isArray((exp as any).presupuesto_items) ? (exp as any).presupuesto_items : []
  const [addCat, setAddCat] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [desc, setDesc] = useState('')
  const [cant, setCant] = useState('1')
  const [precio, setPrecio] = useState('')
  const [saving, setSaving] = useState(false)

  async function saveItems(updated: PresupuestoItem[]) {
    setSaving(true)
    const sumCat = (cat: string) => updated.filter(i => i.categoria === cat).reduce((s, i) => s + (i.cantidad * i.precio_unitario), 0)
    const { error } = await supabase.from('siniestros_expedientes').update({
      presupuesto_items: updated,
      monto_presupuesto_repuestos: sumCat('repuestos'),
      monto_presupuesto_mo_taller: sumCat('mo_taller'),
      monto_presupuesto_chapista: sumCat('chapista'),
      monto_presupuesto_pintura: sumCat('pintura'),
      monto_presupuesto_otros: sumCat('otros'),
    }).eq('id', exp.id)
    setSaving(false)
    if (error) { notify.error(error.message); return }
    // Force re-fetch
    ;(exp as any).presupuesto_items = updated
    ;(exp as any).monto_presupuesto_repuestos = sumCat('repuestos')
    ;(exp as any).monto_presupuesto_mo_taller = sumCat('mo_taller')
    ;(exp as any).monto_presupuesto_chapista = sumCat('chapista')
    ;(exp as any).monto_presupuesto_pintura = sumCat('pintura')
    ;(exp as any).monto_presupuesto_otros = sumCat('otros')
  }

  function handleAdd(cat: PresupuestoItem['categoria']) {
    if (!desc.trim()) { notify.error('Ingresá una descripción'); return }
    const precioNum = parseFloat(precio) || 0
    if (precioNum <= 0) { notify.error('Ingresá un precio mayor a 0'); return }
    const item: PresupuestoItem = {
      id: Date.now().toString(),
      codigo: codigo.trim() || undefined,
      categoria: cat,
      descripcion: desc.trim(),
      cantidad: parseInt(cant) || 1,
      precio_unitario: precioNum,
    }
    saveItems([...items, item])
    setCodigo(''); setDesc(''); setCant('1'); setPrecio('');    setAddCat(null)
    notify.success('Ítem agregado')
  }

  function handleRemove(id: string) {
    saveItems(items.filter(i => i.id !== id))
    notify.success('Ítem eliminado')
  }

  const grandTotal = items.reduce((s, i) => s + (i.cantidad * i.precio_unitario), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EditableField label="Fecha presupuesto" type="date" value={exp.fecha_presupuesto || ''} onSave={v => saveField('fecha_presupuesto', v || null)} />
        <EditableField label="Fecha envio presupuesto" type="date" value={exp.fecha_envio_presupuesto || ''} onSave={v => saveField('fecha_envio_presupuesto', v || null)} />
      </div>

      {saving && <p className="text-xs text-action animate-pulse">Guardando...</p>}

      {CATEGORIAS_PRESUPUESTO.map(cat => {
        const catItems = items.filter(i => i.categoria === cat.key)
        const catTotal = catItems.reduce((s, i) => s + (i.cantidad * i.precio_unitario), 0)

        return (
          <div key={cat.key} className={`border-l-4 ${cat.color} rounded-lg ${cat.bg} p-4`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-text-primary uppercase tracking-wider">{cat.label}</p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-text-primary font-mono">{fmtMoney(catTotal)}</span>
                <button onClick={() => { setAddCat(addCat === cat.key ? null : cat.key); setCodigo(''); setDesc(''); setPrecio(''); setCant('1') }}
                  className="flex items-center gap-1 px-2 py-1 bg-rose-600 text-white rounded text-xs font-medium hover:bg-rose-500 cursor-pointer">
                  <Plus className="h-3 w-3" /> Agregar
                </button>
              </div>
            </div>

            {catItems.length > 0 && (
              <div className="space-y-2 mb-3">
                {catItems.map(item => {
                  const sub = item.cantidad * item.precio_unitario
                  return (
                    <div key={item.id} className="flex items-center justify-between bg-bg-secondary rounded-lg px-3 py-2">
                      <div className="flex-1">
                        <p className="text-sm text-text-primary font-medium">
                          {item.codigo && <span className="font-mono text-text-muted mr-2">[{item.codigo}]</span>}
                          {item.descripcion}
                        </p>
                        <p className="text-xs text-text-muted">
                          {`${item.cantidad} × ${fmtMoney(item.precio_unitario)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-bold text-text-primary font-mono">{fmtMoney(sub)}</p>
                        <button onClick={() => handleRemove(item.id)} className="p-1 text-text-muted hover:text-red-500 cursor-pointer">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {catItems.length === 0 && addCat !== cat.key && (
              <p className="text-xs text-text-muted italic mb-1">Sin ítems — hacé click en "Agregar"</p>
            )}

            {addCat === cat.key && (
              <div className="bg-bg-secondary rounded-lg p-3 mt-2 space-y-3 border border-border">
                <p className="text-xs font-semibold text-rose-400 uppercase">Nuevo ítem — {cat.label}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Código artículo</label>
                    <input value={codigo} onChange={e => setCodigo(e.target.value)}
                      placeholder="Ej: 51987654"
                      className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary font-mono" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-text-muted block mb-1">Descripción *</label>
                    <input value={desc} onChange={e => setDesc(e.target.value)} autoFocus
                      placeholder={cat.key === 'repuestos' ? 'Ej: Paragolpe delantero' : cat.key === 'mo_taller' ? 'Ej: Desarme y armado' : cat.key === 'chapista' ? 'Ej: Reparación guardabarro' : 'Ej: Acarreo'}
                      className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Cantidad *</label>
                    <input type="number" min="1"
                      value={cant}
                      onChange={e => setCant(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary text-center" />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Precio unitario *</label>
                    <input type="number" min="1" value={precio} onChange={e => setPrecio(e.target.value)}
                      placeholder="$ 0"
                      className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Subtotal</label>
                    <p className="px-3 py-2 text-sm font-bold text-text-primary font-mono">
                      {fmtMoney((parseFloat(precio) || 0) * (parseInt(cant) || 1))}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAddCat(null)} className="px-4 py-2 bg-bg-tertiary text-text-secondary rounded-lg text-xs font-medium hover:bg-bg-input cursor-pointer">Cancelar</button>
                  <button onClick={() => handleAdd(cat.key)} className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-500 cursor-pointer">
                    Agregar ítem
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <div className="bg-rose-900/30 border border-rose-500/40 rounded-lg p-4 flex justify-between items-center">
        <p className="text-sm font-bold text-text-primary uppercase tracking-wider">Total presupuesto</p>
        <p className="text-2xl font-bold text-rose-400 font-mono">{fmtMoney(grandTotal || totalPresupuesto)}</p>
      </div>
    </div>
  )
}

function RepuestosTable({ expedienteId, repuestos, qc }: {
  expedienteId: string; repuestos: SiniestroRepuesto[]; qc: ReturnType<typeof useQueryClient>
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    nro_parte: '', descripcion: '', cantidad_solicitada: 1, estado: 'pendiente',
    tipo_pedido: '', nro_guia_tracking: '', monto_aprobado: '',
    fecha_pedido: '', fecha_eta_estimada: '', fecha_recepcion: '',
  })

  const addRepuesto = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('siniestros_repuestos').insert({
        expediente_id: expedienteId,
        nro_parte: form.nro_parte,
        descripcion: form.descripcion,
        cantidad_solicitada: form.cantidad_solicitada,
        estado: form.estado,
        tipo_pedido: form.tipo_pedido,
        nro_guia_tracking: form.nro_guia_tracking,
        monto_aprobado: form.monto_aprobado ? Number(form.monto_aprobado) : 0,
        fecha_pedido: form.fecha_pedido || null,
        fecha_eta_estimada: form.fecha_eta_estimada || null,
        fecha_recepcion: form.fecha_recepcion || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['siniestros_repuestos', expedienteId] })
      setShowAdd(false)
      setForm({ nro_parte: '', descripcion: '', cantidad_solicitada: 1, estado: 'pendiente', tipo_pedido: '', nro_guia_tracking: '', monto_aprobado: '', fecha_pedido: '', fecha_eta_estimada: '', fecha_recepcion: '' })
      notify.success('Repuesto agregado')
    },
    onError: () => notify.error('Error al agregar repuesto'),
  })

  const updateRepuesto = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from('siniestros_repuestos').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['siniestros_repuestos', expedienteId] })
      setEditingId(null)
      notify.success('Repuesto actualizado')
    },
    onError: () => notify.error('Error al actualizar'),
  })

  const deleteRepuesto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('siniestros_repuestos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['siniestros_repuestos', expedienteId] })
      notify.success('Repuesto eliminado')
    },
    onError: () => notify.error('Error al eliminar'),
  })

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" className="bg-rose-600 hover:bg-rose-700" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Agregar repuesto
        </Button>
      </div>

      {showAdd && (
        <div className="bg-bg-tertiary rounded-lg p-4 space-y-3 border border-border">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Nro parte" value={form.nro_parte} onChange={e => setForm({ ...form, nro_parte: e.target.value })} />
            <Input label="Descripcion" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
            <Input label="Cantidad" type="number" value={String(form.cantidad_solicitada)} onChange={e => setForm({ ...form, cantidad_solicitada: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select label="Estado" options={REPUESTO_ESTADOS} value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} />
            <Input label="Tipo pedido" value={form.tipo_pedido} onChange={e => setForm({ ...form, tipo_pedido: e.target.value })} placeholder="normal / urgente / importado" />
            <Input label="Monto aprobado" type="number" value={form.monto_aprobado} onChange={e => setForm({ ...form, monto_aprobado: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Input label="Fecha pedido" type="date" value={form.fecha_pedido} onChange={e => setForm({ ...form, fecha_pedido: e.target.value })} />
            <Input label="ETA estimada" type="date" value={form.fecha_eta_estimada} onChange={e => setForm({ ...form, fecha_eta_estimada: e.target.value })} />
            <Input label="Fecha recepción" type="date" value={form.fecha_recepcion} onChange={e => setForm({ ...form, fecha_recepcion: e.target.value })} />
            <Input label="Nro guía/tracking" value={form.nro_guia_tracking} onChange={e => setForm({ ...form, nro_guia_tracking: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button size="sm" className="bg-rose-600 hover:bg-rose-700" onClick={() => addRepuesto.mutate()} loading={addRepuesto.isPending}>Guardar</Button>
          </div>
        </div>
      )}

      {repuestos.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-4">No hay repuestos cargados</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="px-3 py-2 text-left font-medium">Nro Parte</th>
                <th className="px-3 py-2 text-left font-medium">Descripcion</th>
                <th className="px-3 py-2 text-left font-medium">Solicitado</th>
                <th className="px-3 py-2 text-left font-medium">Recibido</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-left font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {repuestos.map(r => (
                <tr key={r.id} className="border-b border-border">
                  <td className="px-3 py-2 text-text-primary">{r.nro_parte}</td>
                  <td className="px-3 py-2 text-text-secondary">{r.descripcion}</td>
                  <td className="px-3 py-2 text-text-secondary">{r.cantidad_solicitada}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {editingId === r.id ? (
                      <input
                        type="number"
                        defaultValue={r.cantidad_recibida}
                        className="w-16 rounded bg-bg-input border border-border px-2 py-1 text-xs text-text-primary"
                        onBlur={e => updateRepuesto.mutate({ id: r.id, updates: { cantidad_recibida: Number(e.target.value) } })}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      />
                    ) : (
                      <span className={r.cantidad_recibida >= r.cantidad_solicitada ? 'text-green-600 font-medium' : ''}>
                        {r.cantidad_recibida || 0}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === r.id ? (
                      <select
                        autoFocus
                        defaultValue={r.estado}
                        onChange={e => updateRepuesto.mutate({ id: r.id, updates: { estado: e.target.value } })}
                        className="rounded bg-bg-input border border-border px-2 py-1 text-xs text-text-primary"
                      >
                        {REPUESTO_ESTADOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <Badge
                        text={REPUESTO_ESTADOS.find(o => o.value === r.estado)?.label || r.estado}
                        color={getRepuestoColor(r.estado)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 flex gap-1">
                    <button onClick={() => setEditingId(editingId === r.id ? null : r.id)} className="p-1 text-text-muted hover:text-rose-600 cursor-pointer"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button onClick={() => deleteRepuesto.mutate(r.id)} className="p-1 text-text-muted hover:text-red-600 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// NUEVO EXPEDIENTE FORM
// ═══════════════════════════════════════════════════════════════════════

function NuevoExpedienteForm({ clientes, qc, goBack, onCreated }: {
  clientes: SiniestroCliente[]
  qc: ReturnType<typeof useQueryClient>
  goBack: () => void
  onCreated: (id: string) => void
}) {
  const [clienteId, setClienteId] = useState('')
  const [clienteSearch, setClienteSearch] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)
  const [canal, setCanal] = useState('')
  const [newClient, setNewClient] = useState({
    nombre: '', apellido: '', dni: '', telefono: '', email: '', direccion: '', localidad: '',
    marca: 'FIAT', modelo: '', anio: '', dominio: '', vin: '', color: '',
    compania_seguro: '', nro_poliza: '', productor_seguro: '', sucursal: 'Ushuaia', notas: '',
  })
  const [form, setForm] = useState({
    nro_siniestro_interno: '', nro_siniestro_compania: '', sucursal: 'Ushuaia',
    fecha_ingreso_vehiculo: new Date().toISOString().slice(0, 10),
    km_ingreso: '', descripcion_siniestro: '', compania_seguro: '', nro_poliza: '',
    facturar_a: 'compania', gestor_nombre: '', gestor_telefono: '',
  })

  const clientesFiltered = useMemo(() => {
    if (!clienteSearch) return clientes.filter(c => c.activo)
    const q = clienteSearch.toLowerCase()
    return clientes.filter(c => c.activo && [c.nombre, c.apellido, c.dominio, c.vin, c.dni].join(' ').toLowerCase().includes(q))
  }, [clientes, clienteSearch])

  const createClient = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('siniestros_clientes').insert({
        ...newClient,
        anio: newClient.anio ? Number(newClient.anio) : null,
        activo: true,
      }).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['siniestros_clientes'] })
      setClienteId(id)
      setShowNewClient(false)
      notify.success('Cliente creado')
    },
    onError: () => notify.error('Error al crear cliente'),
  })

  const createExp = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('siniestros_expedientes').insert({
        cliente_id: clienteId,
        nro_siniestro_interno: form.nro_siniestro_interno,
        nro_siniestro_compania: form.nro_siniestro_compania,
        sucursal: form.sucursal,
        canal_ingreso: canal,
        facturar_a: form.facturar_a,
        compania_seguro: form.compania_seguro,
        nro_poliza: form.nro_poliza,
        gestor_nombre: form.gestor_nombre,
        gestor_telefono: form.gestor_telefono,
        fecha_ingreso_vehiculo: form.fecha_ingreso_vehiculo || null,
        km_ingreso: form.km_ingreso ? Number(form.km_ingreso) : null,
        descripcion_siniestro: form.descripcion_siniestro,
        estado_actual: 'ingreso',
      }).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['siniestros_expedientes'] })
      notify.success('Expediente creado')
      onCreated(id)
    },
    onError: () => notify.error('Error al crear expediente'),
  })

  const selectedClient = clientes.find(c => c.id === clienteId)

  // Auto-rellenar compañía y póliza del cliente seleccionado
  const handleSelectCliente = (id: string) => {
    setClienteId(id)
    const cli = clientes.find(c => c.id === id)
    if (cli) {
      setForm(f => ({
        ...f,
        compania_seguro: cli.compania_seguro || f.compania_seguro,
        nro_poliza: cli.nro_poliza || f.nro_poliza,
      }))
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={goBack}><ArrowLeft className="h-4 w-4" /> Volver</Button>
        <h1 className="text-xl font-bold text-text-primary">Nuevo siniestro</h1>
      </div>

      {/* Canal selector */}
      <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-4">
        <h2 className="text-sm font-medium text-text-primary">Canal de ingreso</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CANALES.map(c => (
            <button
              key={c.value}
              onClick={() => setCanal(c.value)}
              className={`p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                canal === c.value
                  ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-500/20'
                  : 'border-border hover:bg-bg-tertiary'
              }`}
            >
              <div className="flex items-center gap-2">
                <Badge text={c.label} color={CANAL_COLORS[c.value]} />
              </div>
              <p className="text-xs text-text-muted mt-1">{CANAL_DESCRIPTIONS[c.value]}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Client selector */}
      {canal && (
        <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-4">
          <h2 className="text-sm font-medium text-text-primary">Seleccionar cliente</h2>

          {selectedClient ? (
            <div className="flex items-center justify-between bg-rose-50 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium text-rose-800">{selectedClient.nombre} {selectedClient.apellido}</p>
                <p className="text-xs text-rose-600">{selectedClient.marca} {selectedClient.modelo} - {selectedClient.dominio}</p>
              </div>
              <button onClick={() => setClienteId('')} className="text-rose-600 hover:text-rose-800 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Buscar por nombre, dominio, VIN, DNI..."
                icon={<Search className="h-4 w-4" />}
                value={clienteSearch}
                onChange={e => setClienteSearch(e.target.value)}
              />
              {clienteSearch && (
                <div className="max-h-40 overflow-y-auto border border-border rounded-lg">
                  {clientesFiltered.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-text-muted">Sin resultados</p>
                  ) : clientesFiltered.slice(0, 10).map(c => (
                    <button
                      key={c.id}
                      onClick={() => { handleSelectCliente(c.id); setClienteSearch('') }}
                      className="w-full text-left px-3 py-2 hover:bg-bg-tertiary text-sm cursor-pointer border-b border-border last:border-0"
                    >
                      <span className="text-text-primary font-medium">{c.apellido}, {c.nombre}</span>
                      <span className="text-text-muted ml-2">{c.dominio} - {c.marca} {c.modelo}</span>
                    </button>
                  ))}
                </div>
              )}
              <Button variant="secondary" size="sm" onClick={() => setShowNewClient(true)}>
                <Plus className="h-4 w-4" /> Crear cliente nuevo
              </Button>
            </>
          )}

          {showNewClient && (
            <div className="bg-bg-tertiary rounded-lg p-4 space-y-3 border border-border">
              <h3 className="text-sm font-medium text-text-primary">Nuevo cliente</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Nombre" value={newClient.nombre} onChange={e => setNewClient({ ...newClient, nombre: e.target.value })} />
                <Input label="Apellido" value={newClient.apellido} onChange={e => setNewClient({ ...newClient, apellido: e.target.value })} />
                <Input label="DNI" value={newClient.dni} onChange={e => setNewClient({ ...newClient, dni: e.target.value })} />
                <Input label="Telefono" value={newClient.telefono} onChange={e => setNewClient({ ...newClient, telefono: e.target.value })} />
                <Input label="Email" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} />
                <Input label="Direccion" value={newClient.direccion} onChange={e => setNewClient({ ...newClient, direccion: e.target.value })} />
                <Input label="Localidad" value={newClient.localidad} onChange={e => setNewClient({ ...newClient, localidad: e.target.value })} />
                <Input label="Marca" value={newClient.marca} onChange={e => setNewClient({ ...newClient, marca: e.target.value })} />
                <Input label="Modelo" value={newClient.modelo} onChange={e => setNewClient({ ...newClient, modelo: e.target.value })} />
                <Input label="Anio" type="number" value={newClient.anio} onChange={e => setNewClient({ ...newClient, anio: e.target.value })} />
                <Input label="Dominio" value={newClient.dominio} onChange={e => setNewClient({ ...newClient, dominio: e.target.value })} />
                <Input label="VIN" value={newClient.vin} onChange={e => setNewClient({ ...newClient, vin: e.target.value })} />
                <Input label="Color" value={newClient.color} onChange={e => setNewClient({ ...newClient, color: e.target.value })} />
                <Input label="Compania seguro" value={newClient.compania_seguro} onChange={e => setNewClient({ ...newClient, compania_seguro: e.target.value })} />
                <Input label="Nro poliza" value={newClient.nro_poliza} onChange={e => setNewClient({ ...newClient, nro_poliza: e.target.value })} />
                <Input label="Productor seguro" value={newClient.productor_seguro} onChange={e => setNewClient({ ...newClient, productor_seguro: e.target.value })} />
                <Select label="Sucursal" options={SUCURSALES} value={newClient.sucursal} onChange={e => setNewClient({ ...newClient, sucursal: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" size="sm" onClick={() => setShowNewClient(false)}>Cancelar</Button>
                <Button size="sm" className="bg-rose-600 hover:bg-rose-700" onClick={() => createClient.mutate()} loading={createClient.isPending}>
                  Crear cliente
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expediente fields */}
      {canal && clienteId && (
        <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-4">
          <h2 className="text-sm font-medium text-text-primary">Datos del siniestro</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Nro siniestro interno" value={form.nro_siniestro_interno} onChange={e => setForm({ ...form, nro_siniestro_interno: e.target.value })} />
            <Input label="Nro siniestro compania" value={form.nro_siniestro_compania} onChange={e => setForm({ ...form, nro_siniestro_compania: e.target.value })} />
            <Select label="Sucursal" options={SUCURSALES} value={form.sucursal} onChange={e => setForm({ ...form, sucursal: e.target.value })} />
            <Select label="Facturar a" options={FACTURAR_OPTIONS} value={form.facturar_a} onChange={e => setForm({ ...form, facturar_a: e.target.value })} />
            <Input label="Compania seguro" value={form.compania_seguro} onChange={e => setForm({ ...form, compania_seguro: e.target.value })} />
            <Input label="Nro poliza" value={form.nro_poliza} onChange={e => setForm({ ...form, nro_poliza: e.target.value })} />
            <Input label="Fecha ingreso" type="date" value={form.fecha_ingreso_vehiculo} onChange={e => setForm({ ...form, fecha_ingreso_vehiculo: e.target.value })} />
            <Input label="KM ingreso" type="number" value={form.km_ingreso} onChange={e => setForm({ ...form, km_ingreso: e.target.value })} />
          </div>

          {/* Gestor fields - only for gestor_seguro canal */}
          {canal === 'gestor_seguro' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border pt-3">
              <Input label="Nombre del gestor" value={form.gestor_nombre} onChange={e => setForm({ ...form, gestor_nombre: e.target.value })} />
              <Input label="Telefono del gestor" value={form.gestor_telefono} onChange={e => setForm({ ...form, gestor_telefono: e.target.value })} />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Descripcion del siniestro</label>
            <textarea
              value={form.descripcion_siniestro}
              onChange={e => setForm({ ...form, descripcion_siniestro: e.target.value })}
              className="w-full rounded-lg bg-bg-input border border-border px-3 py-2.5 text-text-primary text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              placeholder="Describir el siniestro..."
            />
          </div>
        </div>
      )}

      {canal && clienteId && (
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={goBack}>Cancelar</Button>
          <Button
            className="bg-rose-600 hover:bg-rose-700"
            disabled={!clienteId || !canal}
            onClick={() => createExp.mutate()}
            loading={createExp.isPending}
          >
            Crear siniestro
          </Button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// CLIENTS LIST
// ═══════════════════════════════════════════════════════════════════════

function ClientesList({ clientes, loading, qc }: {
  clientes: SiniestroCliente[]; loading: boolean; qc: ReturnType<typeof useQueryClient>
}) {
  const [search, setSearch] = useState('')
  const [editingClient, setEditingClient] = useState<SiniestroCliente | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre: '', apellido: '', dni: '', telefono: '', email: '', direccion: '', localidad: '',
    marca: 'FIAT', modelo: '', anio: '', dominio: '', vin: '', color: '',
    compania_seguro: '', nro_poliza: '', productor_seguro: '', sucursal: 'Ushuaia', notas: '',
  })

  const filtered = useMemo(() => {
    const activos = clientes.filter(c => c.activo)
    if (!search) return activos
    const q = search.toLowerCase()
    return activos.filter(c => [c.nombre, c.apellido, c.dominio, c.modelo, c.dni, c.compania_seguro].join(' ').toLowerCase().includes(q))
  }, [clientes, search])

  const openNew = () => {
    setEditingClient(null)
    setForm({
      nombre: '', apellido: '', dni: '', telefono: '', email: '', direccion: '', localidad: '',
      marca: 'FIAT', modelo: '', anio: '', dominio: '', vin: '', color: '',
      compania_seguro: '', nro_poliza: '', productor_seguro: '', sucursal: 'Ushuaia', notas: '',
    })
    setShowModal(true)
  }

  const openEdit = (c: SiniestroCliente) => {
    setEditingClient(c)
    setForm({
      nombre: c.nombre || '', apellido: c.apellido || '', dni: c.dni || '', telefono: c.telefono || '',
      email: c.email || '', direccion: c.direccion || '', localidad: c.localidad || '', marca: c.marca || 'FIAT',
      modelo: c.modelo || '', anio: c.anio ? String(c.anio) : '', dominio: c.dominio || '', vin: c.vin || '',
      color: c.color || '', compania_seguro: c.compania_seguro || '', nro_poliza: c.nro_poliza || '',
      productor_seguro: c.productor_seguro || '', sucursal: c.sucursal || 'Ushuaia', notas: c.notas || '',
    })
    setShowModal(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        anio: form.anio ? Number(form.anio) : null,
        activo: true,
      }
      if (editingClient) {
        const { error } = await supabase.from('siniestros_clientes').update(payload).eq('id', editingClient.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('siniestros_clientes').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['siniestros_clientes'] })
      setShowModal(false)
      notify.success(editingClient ? 'Cliente actualizado' : 'Cliente creado')
    },
    onError: () => notify.error('Error al guardar cliente'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('siniestros_clientes').update({ activo: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['siniestros_clientes'] })
      setConfirmDelete(null)
      notify.success('Cliente eliminado')
    },
    onError: () => notify.error('Error al eliminar'),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input placeholder="Buscar cliente..." icon={<Search className="h-4 w-4" />} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button className="bg-rose-600 hover:bg-rose-700" onClick={openNew}>
          <Plus className="h-4 w-4" /> Nuevo cliente
        </Button>
      </div>

      <div className="bg-bg-secondary rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium">Apellido</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">DNI</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Telefono</th>
              <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Vehiculo</th>
              <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Compania seguro</th>
              <th className="px-4 py-3 text-left font-medium hidden xl:table-cell">Sucursal</th>
              <th className="px-4 py-3 text-left font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-text-muted">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-text-muted">No hay clientes</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-b border-border hover:bg-bg-tertiary">
                <td className="px-4 py-3 text-text-primary">{c.nombre}</td>
                <td className="px-4 py-3 text-text-primary">{c.apellido}</td>
                <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{c.dni || '-'}</td>
                <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{c.telefono || '-'}</td>
                <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">
                  {c.marca && c.modelo ? `${c.marca} ${c.modelo} - ${c.dominio}` : c.dominio || '-'}
                </td>
                <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">{c.compania_seguro || '-'}</td>
                <td className="px-4 py-3 text-text-secondary hidden xl:table-cell">{c.sucursal || '-'}</td>
                <td className="px-4 py-3 flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1 text-text-muted hover:text-rose-600 cursor-pointer"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => setConfirmDelete(c.id)} className="p-1 text-text-muted hover:text-red-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal create/edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative bg-bg-secondary rounded-lg border border-border p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">{editingClient ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              <button onClick={() => setShowModal(false)} className="text-text-muted hover:text-text-primary cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              <Input label="Apellido" value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} />
              <Input label="DNI" value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} />
              <Input label="Telefono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
              <Input label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <Input label="Direccion" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
              <Input label="Localidad" value={form.localidad} onChange={e => setForm({ ...form, localidad: e.target.value })} />
              <Input label="Marca" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} />
              <Input label="Modelo" value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} />
              <Input label="Anio" type="number" value={form.anio} onChange={e => setForm({ ...form, anio: e.target.value })} />
              <Input label="Dominio" value={form.dominio} onChange={e => setForm({ ...form, dominio: e.target.value })} />
              <Input label="VIN" value={form.vin} onChange={e => setForm({ ...form, vin: e.target.value })} />
              <Input label="Color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
              <Input label="Compania seguro" value={form.compania_seguro} onChange={e => setForm({ ...form, compania_seguro: e.target.value })} />
              <Input label="Nro poliza" value={form.nro_poliza} onChange={e => setForm({ ...form, nro_poliza: e.target.value })} />
              <Input label="Productor seguro" value={form.productor_seguro} onChange={e => setForm({ ...form, productor_seguro: e.target.value })} />
              <Select label="Sucursal" options={SUCURSALES} value={form.sucursal} onChange={e => setForm({ ...form, sucursal: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Notas</label>
              <textarea
                value={form.notas}
                onChange={e => setForm({ ...form, notas: e.target.value })}
                className="w-full rounded-lg bg-bg-input border border-border px-3 py-2.5 text-text-primary text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
                {editingClient ? 'Guardar cambios' : 'Crear cliente'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar cliente"
        message="El cliente se marcara como inactivo. Podes reactivarlo despues."
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
