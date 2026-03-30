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
  Wrench, ShieldCheck, Package, FileText, Truck, CheckCircle2,
  Users, Activity,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────

interface GarantiaCliente {
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
  km_ingreso: number | null
  color: string
  sucursal: string
  activo: boolean
  notas: string
  created_at: string
  updated_at: string
}

interface GarantiaExpediente {
  id: string
  cliente_id: string
  nro_os: string
  nro_reclamo_garantia: string
  sucursal: string
  estado_actual: string
  fecha_ingreso_vehiculo: string | null
  km_ingreso: number | null
  sintomas_cliente: string
  diagnostico_tecnico: string
  tecnico_diagnostico: string
  fecha_diagnostico: string | null
  es_garantia: boolean | null
  tipo_falla: string
  garantista_verificador: string
  repuesto_en_stock: boolean | null
  fecha_inicio_reparacion: string | null
  fecha_fin_reparacion: string | null
  tecnico_reparacion: string
  descripcion_reparacion: string
  qc_aprobado: boolean | null
  fecha_control_calidad: string | null
  fecha_cierre_os: string | null
  factura_garantia_nro: string
  fecha_entrega_cliente: string | null
  fecha_transmision_stellantis: string | null
  estado_stellantis: string
  motivo_estado_24: string
  accion_correctiva_24: string
  monto_aprobado: number
  fecha_facturacion_cap: string | null
  nro_factura_cap: string
  fecha_cobro_efectivo: string | null
  monto_cobrado: number
  notas_internas: string
  created_at: string
  updated_at: string
  // joined
  garantias_clientes?: GarantiaCliente
}

interface GarantiaRepuesto {
  id: string
  expediente_id: string
  nro_parte: string
  descripcion: string
  cantidad: number
  estado: string
  fecha_pedido: string | null
  fecha_eta_estimada: string | null
  fecha_recepcion_efectiva: string | null
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

const ESTADOS = [
  'recepcion', 'diagnostico', 'verificacion_cobertura', 'esperando_repuesto',
  'repuesto_recibido', 'en_reparacion', 'control_calidad', 'qc_aprobado',
  'cierre_os', 'facturacion_garantia', 'entrega_cliente', 'transmision_stellantis',
  'estado_21', 'estado_24', 'cobro_cap', 'cerrado',
]

const ESTADO_LABELS: Record<string, string> = {
  recepcion: 'Recepcion',
  diagnostico: 'Diagnostico',
  verificacion_cobertura: 'Verificacion Cobertura',
  esperando_repuesto: 'Esperando Repuesto',
  repuesto_recibido: 'Repuesto Recibido',
  en_reparacion: 'En Reparacion',
  control_calidad: 'Control de Calidad',
  qc_aprobado: 'Calidad Aprobada',
  cierre_os: 'Cierre OS',
  facturacion_garantia: 'Facturacion Garantia',
  entrega_cliente: 'Entrega Cliente',
  transmision_stellantis: 'Transmision Stellantis',
  estado_21: 'Estado 21',
  estado_24: 'Estado 24',
  cobro_cap: 'Cobro CAP',
  cerrado: 'Cerrado',
}

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  ...ESTADOS.map(e => ({ value: e, label: ESTADO_LABELS[e] || e })),
]

const STELLANTIS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: '21_transmitido', label: '21 - Transmitido' },
  { value: '24_problema', label: '24 - Problema' },
  { value: 'aprobado', label: 'Aprobado' },
  { value: 'rechazado', label: 'Rechazado' },
  { value: 'parcial', label: 'Parcial' },
]

const REPUESTO_ESTADOS = [
  { value: 'verificando_stock', label: 'Verificando stock' },
  { value: 'en_stock_local', label: 'En stock local' },
  { value: 'pedido_realizado', label: 'Pedido realizado' },
  { value: 'confirmado_despacho', label: 'Confirmado despacho' },
  { value: 'en_transito', label: 'En transito' },
  { value: 'en_aduana_tdf', label: 'En aduana TDF' },
  { value: 'recibido', label: 'Recibido' },
  { value: 'asignado_os', label: 'Asignado OS' },
  { value: 'incidencia', label: 'Incidencia' },
]

const PHASES = [
  { key: 'ingreso', label: 'Ingreso', states: ['recepcion', 'diagnostico'] },
  { key: 'cobertura', label: 'Cobertura', states: ['verificacion_cobertura'] },
  { key: 'repuestos', label: 'Repuestos', states: ['esperando_repuesto', 'repuesto_recibido'] },
  { key: 'reparacion', label: 'Reparación y Calidad', states: ['en_reparacion', 'control_calidad', 'qc_aprobado'] },
  { key: 'cierre', label: 'Cierre', states: ['cierre_os', 'facturacion_garantia', 'entrega_cliente'] },
  { key: 'stellantis', label: 'Stellantis', states: ['transmision_stellantis', 'estado_21', 'estado_24'] },
  { key: 'cobro', label: 'Cobro', states: ['cobro_cap', 'cerrado'] },
]

const fmtMoney = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const fmtDate = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-AR') : '-'

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
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>
      {text}
    </span>
  )
}

function getEstadoColor(estado: string): string {
  if (['recepcion', 'diagnostico'].includes(estado)) return 'blue'
  if (estado === 'verificacion_cobertura') return 'purple'
  if (['esperando_repuesto', 'repuesto_recibido'].includes(estado)) return 'orange'
  if (['en_reparacion', 'control_calidad', 'qc_aprobado'].includes(estado)) return 'teal'
  if (['cierre_os', 'facturacion_garantia', 'entrega_cliente'].includes(estado)) return 'cyan'
  if (estado === 'estado_24') return 'red'
  if (['transmision_stellantis', 'estado_21'].includes(estado)) return 'yellow'
  if (['cobro_cap', 'cerrado'].includes(estado)) return 'green'
  return 'gray'
}

function getStellantisColor(est: string): string {
  if (est === '21_transmitido') return 'yellow'
  if (est === '24_problema') return 'red'
  if (est === 'aprobado') return 'green'
  if (est === 'rechazado') return 'red'
  if (est === 'parcial') return 'orange'
  return 'gray'
}

function getStellantisLabel(est: string): string {
  const map: Record<string, string> = {
    '21_transmitido': '21 - Transmitido',
    '24_problema': '24 - Problema',
    aprobado: 'Aprobado',
    rechazado: 'Rechazado',
    parcial: 'Parcial',
  }
  return map[est] || est || '-'
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
        const isEst24 = estadoActual === 'estado_24' && phase.key === 'stellantis'
        return (
          <div key={phase.key} className="flex items-center gap-1 flex-shrink-0">
            <div className={`
              px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap
              ${isEst24 ? 'bg-red-600 text-white' : isCurrent ? 'bg-teal-600 text-white' : isPast ? 'bg-teal-100 text-teal-700' : 'bg-bg-tertiary text-text-muted'}
            `}>
              {phase.label}
            </div>
            {idx < PHASES.length - 1 && (
              <div className={`w-4 h-0.5 ${isPast ? 'bg-teal-400' : 'bg-border'}`} />
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
      <div className={`p-2 rounded-lg ${color || 'bg-teal-100 text-teal-600'}`}>{icon}</div>
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

export function GarantiasPage() {
  const qc = useQueryClient()

  // ─── View state ──────────────────────────────────────────────────
  const [view, setView] = useState<View>('list')
  const [tab, setTab] = useState<'expedientes' | 'clientes'>('expedientes')
  const [selectedExpId, setSelectedExpId] = useState<string | null>(null)

  // ─── Filters ─────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [fSucursal, setFSucursal] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [fStellantis, setFStellantis] = useState('')

  // ─── Queries ─────────────────────────────────────────────────────
  const { data: expedientes = [], isLoading: loadingExp } = useQuery({
    queryKey: ['garantias_expedientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('garantias_expedientes')
        .select('*, garantias_clientes(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as GarantiaExpediente[]
    },
  })

  const { data: clientes = [], isLoading: loadingCli } = useQuery({
    queryKey: ['garantias_clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('garantias_clientes')
        .select('*')
        .order('apellido')
      if (error) throw error
      return data as GarantiaCliente[]
    },
  })

  const { data: repuestos = [] } = useQuery({
    queryKey: ['garantias_repuestos', selectedExpId],
    enabled: !!selectedExpId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('garantias_repuestos')
        .select('*')
        .eq('expediente_id', selectedExpId!)
        .order('created_at')
      if (error) throw error
      return data as GarantiaRepuesto[]
    },
  })

  // ─── Filtered expedientes ────────────────────────────────────────
  const filtered = useMemo(() => {
    return expedientes.filter(e => {
      const cli = e.garantias_clientes
      const q = search.toLowerCase()
      if (q) {
        const haystack = [
          e.nro_os, cli?.nombre, cli?.apellido, cli?.dominio, cli?.vin, cli?.modelo,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (fSucursal && e.sucursal !== fSucursal) return false
      if (fEstado && e.estado_actual !== fEstado) return false
      if (fStellantis && e.estado_stellantis !== fStellantis) return false
      return true
    })
  }, [expedientes, search, fSucursal, fEstado, fStellantis])

  // ─── KPI calculations ───────────────────────────────────────────
  const kpis = useMemo(() => {
    const activos = expedientes.filter(e => e.estado_actual !== 'cerrado').length
    const en24 = expedientes.filter(e => e.estado_actual === 'estado_24' || e.estado_stellantis === '24_problema').length
    const esperandoRep = expedientes.filter(e => e.estado_actual === 'esperando_repuesto').length
    const enReparacion = expedientes.filter(e => e.estado_actual === 'en_reparacion').length

    const activosConFecha = expedientes.filter(e => e.estado_actual !== 'cerrado' && e.fecha_ingreso_vehiculo)
    const promDias = activosConFecha.length > 0
      ? Math.round(activosConFecha.reduce((s, e) => s + daysBetween(e.fecha_ingreso_vehiculo), 0) / activosConFecha.length)
      : 0

    const cerrados = expedientes.filter(e => e.estado_actual === 'cerrado')
    const aprobados = cerrados.filter(e => ['aprobado', 'parcial'].includes(e.estado_stellantis))
    const tasaAprob = cerrados.length > 0 ? Math.round((aprobados.length / cerrados.length) * 100) : 0

    const pendienteCobro = expedientes
      .filter(e => e.monto_aprobado > 0 && e.monto_cobrado === 0)
      .reduce((s, e) => s + e.monto_aprobado, 0)

    const now = new Date()
    const mesActual = now.getMonth()
    const anioActual = now.getFullYear()
    const cobradosMes = expedientes
      .filter(e => {
        if (!e.fecha_cobro_efectivo) return false
        const d = new Date(e.fecha_cobro_efectivo)
        return d.getMonth() === mesActual && d.getFullYear() === anioActual
      })
      .reduce((s, e) => s + e.monto_cobrado, 0)

    return { activos, en24, esperandoRep, promDias, tasaAprob, pendienteCobro, enReparacion, cobradosMes }
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
          <h1 className="text-2xl font-bold text-text-primary">Garantias</h1>
          <p className="text-sm text-text-muted">Gestion de reclamos de garantia</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === 'expedientes' ? 'primary' : 'secondary'}
            size="sm"
            className={tab === 'expedientes' ? 'bg-teal-600 hover:bg-teal-700' : ''}
            onClick={() => setTab('expedientes')}
          >
            <FileText className="h-4 w-4" /> Expedientes
          </Button>
          <Button
            variant={tab === 'clientes' ? 'primary' : 'secondary'}
            size="sm"
            className={tab === 'clientes' ? 'bg-teal-600 hover:bg-teal-700' : ''}
            onClick={() => setTab('clientes')}
          >
            <Users className="h-4 w-4" /> Clientes
          </Button>
        </div>
      </div>

      {tab === 'clientes' ? (
        <ClientesList clientes={clientes} loading={loadingCli} qc={qc} />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Activos" value={kpis.activos} icon={<Activity className="h-5 w-5" />} />
            <KpiCard label="En estado 24" value={kpis.en24} icon={<AlertTriangle className="h-5 w-5" />} color="bg-red-100 text-red-600" />
            <KpiCard label="Esperando repuesto" value={kpis.esperandoRep} icon={<Package className="h-5 w-5" />} color="bg-orange-100 text-orange-600" />
            <KpiCard label="Promedio dias" value={`${kpis.promDias}d`} icon={<Clock className="h-5 w-5" />} color="bg-blue-100 text-blue-600" />
            <KpiCard label="Tasa aprobacion" value={`${kpis.tasaAprob}%`} icon={<CheckCircle2 className="h-5 w-5" />} color="bg-green-100 text-green-600" />
            <KpiCard label="Pendiente cobro" value={fmtMoney(kpis.pendienteCobro)} icon={<DollarSign className="h-5 w-5" />} color="bg-yellow-100 text-yellow-600" />
            <KpiCard label="En reparacion" value={kpis.enReparacion} icon={<Wrench className="h-5 w-5" />} color="bg-teal-100 text-teal-600" />
            <KpiCard label="Cobrados del mes" value={fmtMoney(kpis.cobradosMes)} icon={<DollarSign className="h-5 w-5" />} color="bg-green-100 text-green-600" />
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Buscar por OS, cliente, dominio, VIN..."
                icon={<Search className="h-4 w-4" />}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select options={[{ value: '', label: 'Todas las sucursales' }, ...SUCURSALES]} value={fSucursal} onChange={e => setFSucursal(e.target.value)} />
            <Select options={ESTADO_OPTIONS} value={fEstado} onChange={e => setFEstado(e.target.value)} />
            <Select options={STELLANTIS_OPTIONS} value={fStellantis} onChange={e => setFStellantis(e.target.value)} />
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setView('new')}>
              <Plus className="h-4 w-4" /> Nuevo expediente
            </Button>
          </div>

          {/* Table */}
          <div className="bg-bg-secondary rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="px-4 py-3 text-left font-medium">Nro OS</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Vehiculo</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Ingreso</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Stellantis</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Dias</th>
                  <th className="px-4 py-3 text-left font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loadingExp ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-text-muted">Cargando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-text-muted">No hay expedientes</td></tr>
                ) : filtered.map(e => {
                  const cli = e.garantias_clientes
                  const is24 = e.estado_actual === 'estado_24' || e.estado_stellantis === '24_problema'
                  return (
                    <tr
                      key={e.id}
                      onClick={() => openDetail(e.id)}
                      className={`border-b border-border cursor-pointer transition-colors
                        ${is24 ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-bg-tertiary'}`}
                    >
                      <td className="px-4 py-3 font-medium text-text-primary">{e.nro_os || '-'}</td>
                      <td className="px-4 py-3 text-text-primary">{cli ? `${cli.apellido}, ${cli.nombre}` : '-'}</td>
                      <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                        {cli ? `${cli.marca} ${cli.modelo} - ${cli.dominio}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">{fmtDate(e.fecha_ingreso_vehiculo)}</td>
                      <td className="px-4 py-3">
                        <Badge text={ESTADO_LABELS[e.estado_actual] || e.estado_actual} color={getEstadoColor(e.estado_actual)} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {e.estado_stellantis ? <Badge text={getStellantisLabel(e.estado_stellantis)} color={getStellantisColor(e.estado_stellantis)} /> : '-'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">{daysBetween(e.fecha_ingreso_vehiculo)}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={(ev) => { ev.stopPropagation(); openDetail(e.id) }}>
                          Ver
                        </Button>
                      </td>
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
  exp: GarantiaExpediente
  repuestos: GarantiaRepuesto[]
  qc: ReturnType<typeof useQueryClient>
  goBack: () => void
}) {
  const cli = exp.garantias_clientes
  const [confirmDelete, setConfirmDelete] = useState(false)

  // ─── Update mutation ─────────────────────────────────────────────
  const updateExp = useMutation({
    mutationFn: async (updates: Partial<GarantiaExpediente>) => {
      const { error } = await supabase
        .from('garantias_expedientes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', exp.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garantias_expedientes'] })
      notify.success('Expediente actualizado')
    },
    onError: () => notify.error('Error al actualizar'),
  })

  const deleteExp = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('garantias_expedientes').delete().eq('id', exp.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garantias_expedientes'] })
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
    updateExp.mutate({ [field]: value } as Partial<GarantiaExpediente>)
  }

  const currentStateIdx = ESTADOS.indexOf(exp.estado_actual)
  const canAdvance = currentStateIdx >= 0 && currentStateIdx < ESTADOS.length - 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack}><ArrowLeft className="h-4 w-4" /> Volver</Button>
          <div>
            <h1 className="text-xl font-bold text-text-primary">OS {exp.nro_os || 'Sin numero'}</h1>
            <p className="text-sm text-text-muted">
              {cli ? `${cli.nombre} ${cli.apellido} - ${cli.marca} ${cli.modelo} (${cli.dominio})` : 'Sin cliente'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge text={ESTADO_LABELS[exp.estado_actual] || exp.estado_actual} color={getEstadoColor(exp.estado_actual)} />
          {exp.estado_stellantis && (
            <Badge text={getStellantisLabel(exp.estado_stellantis)} color={getStellantisColor(exp.estado_stellantis)} />
          )}
          {canAdvance && (
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={advanceStage} loading={updateExp.isPending}>
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
        {/* 1. Ingreso y diagnostico */}
        <Accordion title="Ingreso y diagnostico" icon={<FileText className="h-4 w-4" />} defaultOpen>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField label="Fecha ingreso" type="date" value={exp.fecha_ingreso_vehiculo || ''} onSave={v => saveField('fecha_ingreso_vehiculo', v || null)} />
            <EditableField label="KM ingreso" type="number" value={String(exp.km_ingreso || '')} onSave={v => saveField('km_ingreso', v ? Number(v) : null)} />
            <EditableField label="Sintomas del cliente" type="textarea" value={exp.sintomas_cliente || ''} onSave={v => saveField('sintomas_cliente', v)} />
            <EditableField label="Diagnostico tecnico" type="textarea" value={exp.diagnostico_tecnico || ''} onSave={v => saveField('diagnostico_tecnico', v)} />
            <EditableField label="Tecnico diagnostico" value={exp.tecnico_diagnostico || ''} onSave={v => saveField('tecnico_diagnostico', v)} />
            <EditableField label="Fecha diagnostico" type="date" value={exp.fecha_diagnostico || ''} onSave={v => saveField('fecha_diagnostico', v || null)} />
          </div>
        </Accordion>

        {/* 2. Verificacion cobertura */}
        <Accordion title="Verificacion de cobertura" icon={<ShieldCheck className="h-4 w-4" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-text-secondary">Es garantia:</label>
              <button
                onClick={() => saveField('es_garantia', exp.es_garantia === true ? false : true)}
                className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${exp.es_garantia ? 'bg-green-100 text-green-700' : exp.es_garantia === false ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}
              >
                {exp.es_garantia === true ? 'Si' : exp.es_garantia === false ? 'No' : 'Sin definir'}
              </button>
            </div>
            <EditableField label="Tipo de falla" value={exp.tipo_falla || ''} onSave={v => saveField('tipo_falla', v)} />
            <EditableField label="Garantista verificador" value={exp.garantista_verificador || ''} onSave={v => saveField('garantista_verificador', v)} />
            <EditableField label="Nro reclamo garantia" value={exp.nro_reclamo_garantia || ''} onSave={v => saveField('nro_reclamo_garantia', v)} />
          </div>
        </Accordion>

        {/* 3. Repuestos */}
        <Accordion title="Repuestos" icon={<Package className="h-4 w-4" />}>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-text-secondary">Repuesto en stock:</label>
            <button
              onClick={() => saveField('repuesto_en_stock', !exp.repuesto_en_stock)}
              className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${exp.repuesto_en_stock ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}
            >
              {exp.repuesto_en_stock ? 'Si' : 'No'}
            </button>
          </div>
          <RepuestosTable expedienteId={exp.id} repuestos={repuestos} qc={qc} />
        </Accordion>

        {/* 4. Reparación y Control de Calidad */}
        <Accordion title="Reparación y Control de Calidad" icon={<Wrench className="h-4 w-4" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField label="Fecha inicio reparación" type="date" value={exp.fecha_inicio_reparacion || ''} onSave={v => saveField('fecha_inicio_reparacion', v || null)} />
            <EditableField label="Fecha fin reparación" type="date" value={exp.fecha_fin_reparacion || ''} onSave={v => saveField('fecha_fin_reparacion', v || null)} />
            <EditableField label="Técnico reparación" value={exp.tecnico_reparacion || ''} onSave={v => saveField('tecnico_reparacion', v)} />
            <EditableField label="Descripción reparación" type="textarea" value={exp.descripcion_reparacion || ''} onSave={v => saveField('descripcion_reparacion', v)} />
            <div className="flex items-center gap-3">
              <label className="text-sm text-text-secondary">Control de calidad:</label>
              <button
                onClick={() => saveField('qc_aprobado', !exp.qc_aprobado)}
                className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${exp.qc_aprobado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
              >
                {exp.qc_aprobado ? 'Aprobado' : 'Pendiente'}
              </button>
            </div>
            <EditableField label="Fecha control de calidad" type="date" value={exp.fecha_control_calidad || ''} onSave={v => saveField('fecha_control_calidad', v || null)} />
          </div>
        </Accordion>

        {/* 5. Cierre y entrega */}
        <Accordion title="Cierre y entrega" icon={<Truck className="h-4 w-4" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField label="Fecha cierre OS" type="date" value={exp.fecha_cierre_os || ''} onSave={v => saveField('fecha_cierre_os', v || null)} />
            <EditableField label="Factura garantia Nro" value={exp.factura_garantia_nro || ''} onSave={v => saveField('factura_garantia_nro', v)} />
            <EditableField label="Fecha entrega cliente" type="date" value={exp.fecha_entrega_cliente || ''} onSave={v => saveField('fecha_entrega_cliente', v || null)} />
          </div>
        </Accordion>

        {/* 6. Transmision Stellantis */}
        <Accordion title="Transmision Stellantis" icon={<Activity className="h-4 w-4" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField label="Fecha transmision" type="date" value={exp.fecha_transmision_stellantis || ''} onSave={v => saveField('fecha_transmision_stellantis', v || null)} />
            <div>
              <label className="block text-sm text-text-secondary mb-1">Estado Stellantis</label>
              <select
                value={exp.estado_stellantis || ''}
                onChange={e => saveField('estado_stellantis', e.target.value)}
                className="w-full rounded-lg bg-bg-input border border-border px-3 py-2 text-sm text-text-primary cursor-pointer"
              >
                <option value="">Sin estado</option>
                <option value="21_transmitido">21 - Transmitido</option>
                <option value="24_problema">24 - Problema</option>
                <option value="aprobado">Aprobado</option>
                <option value="rechazado">Rechazado</option>
                <option value="parcial">Parcial</option>
              </select>
            </div>
            <EditableField label="Motivo estado 24" type="textarea" value={exp.motivo_estado_24 || ''} onSave={v => saveField('motivo_estado_24', v)} />
            <EditableField label="Accion correctiva 24" type="textarea" value={exp.accion_correctiva_24 || ''} onSave={v => saveField('accion_correctiva_24', v)} />
          </div>
        </Accordion>

        {/* 7. Cobro */}
        <Accordion title="Cobro" icon={<DollarSign className="h-4 w-4" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField label="Monto aprobado" type="number" value={String(exp.monto_aprobado || '')} onSave={v => saveField('monto_aprobado', v ? Number(v) : 0)} />
            <EditableField label="Fecha facturacion CAP" type="date" value={exp.fecha_facturacion_cap || ''} onSave={v => saveField('fecha_facturacion_cap', v || null)} />
            <EditableField label="Nro factura CAP" value={exp.nro_factura_cap || ''} onSave={v => saveField('nro_factura_cap', v)} />
            <EditableField label="Fecha cobro efectivo" type="date" value={exp.fecha_cobro_efectivo || ''} onSave={v => saveField('fecha_cobro_efectivo', v || null)} />
            <EditableField label="Monto cobrado" type="number" value={String(exp.monto_cobrado || '')} onSave={v => saveField('monto_cobrado', v ? Number(v) : 0)} />
            <div className="bg-bg-tertiary rounded-lg p-3">
              <p className="text-xs text-text-muted">Diferencia</p>
              <p className={`text-lg font-bold ${(exp.monto_aprobado - exp.monto_cobrado) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {fmtMoney(exp.monto_aprobado - exp.monto_cobrado)}
              </p>
            </div>
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
        message={`Vas a eliminar el expediente OS ${exp.nro_os}. Esta accion no se puede deshacer.`}
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
        onClick={() => { setDraft(value); setEditing(true) }}
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
            className="flex-1 rounded-lg bg-bg-input border border-border px-2 py-1.5 text-sm text-text-primary min-h-[60px] focus:outline-none focus:ring-2 focus:ring-teal-500/50"
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
            className="flex-1 rounded-lg bg-bg-input border border-border px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/50"
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

function RepuestosTable({ expedienteId, repuestos, qc }: {
  expedienteId: string; repuestos: GarantiaRepuesto[]; qc: ReturnType<typeof useQueryClient>
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ nro_parte: '', descripcion: '', cantidad: 1, estado: 'verificando_stock', tipo_pedido: '', nro_guia_tracking: '' })

  const addRepuesto = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('garantias_repuestos').insert({
        expediente_id: expedienteId,
        ...form,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garantias_repuestos', expedienteId] })
      setShowAdd(false)
      setForm({ nro_parte: '', descripcion: '', cantidad: 1, estado: 'verificando_stock', tipo_pedido: '', nro_guia_tracking: '' })
      notify.success('Repuesto agregado')
    },
    onError: () => notify.error('Error al agregar repuesto'),
  })

  const updateRepuesto = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => {
      const { error } = await supabase.from('garantias_repuestos').update({ estado }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garantias_repuestos', expedienteId] })
      setEditingId(null)
      notify.success('Estado actualizado')
    },
    onError: () => notify.error('Error al actualizar'),
  })

  const deleteRepuesto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('garantias_repuestos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garantias_repuestos', expedienteId] })
      notify.success('Repuesto eliminado')
    },
    onError: () => notify.error('Error al eliminar'),
  })

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Agregar repuesto
        </Button>
      </div>

      {showAdd && (
        <div className="bg-bg-tertiary rounded-lg p-4 space-y-3 border border-border">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Nro parte" value={form.nro_parte} onChange={e => setForm({ ...form, nro_parte: e.target.value })} />
            <Input label="Descripcion" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
            <Input label="Cantidad" type="number" value={String(form.cantidad)} onChange={e => setForm({ ...form, cantidad: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select label="Estado" options={REPUESTO_ESTADOS} value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} />
            <Input label="Tipo pedido" value={form.tipo_pedido} onChange={e => setForm({ ...form, tipo_pedido: e.target.value })} />
            <Input label="Nro guia/tracking" value={form.nro_guia_tracking} onChange={e => setForm({ ...form, nro_guia_tracking: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => addRepuesto.mutate()} loading={addRepuesto.isPending}>Guardar</Button>
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
                <th className="px-3 py-2 text-left font-medium">Cant</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-left font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {repuestos.map(r => (
                <tr key={r.id} className="border-b border-border">
                  <td className="px-3 py-2 text-text-primary">{r.nro_parte}</td>
                  <td className="px-3 py-2 text-text-secondary">{r.descripcion}</td>
                  <td className="px-3 py-2 text-text-secondary">{r.cantidad}</td>
                  <td className="px-3 py-2">
                    {editingId === r.id ? (
                      <select
                        autoFocus
                        defaultValue={r.estado}
                        onChange={e => updateRepuesto.mutate({ id: r.id, estado: e.target.value })}
                        onBlur={() => setEditingId(null)}
                        className="rounded bg-bg-input border border-border px-2 py-1 text-xs text-text-primary"
                      >
                        {REPUESTO_ESTADOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <Badge
                        text={REPUESTO_ESTADOS.find(o => o.value === r.estado)?.label || r.estado}
                        color={r.estado === 'incidencia' ? 'red' : r.estado === 'recibido' || r.estado === 'asignado_os' ? 'green' : 'blue'}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 flex gap-1">
                    <button onClick={() => setEditingId(r.id)} className="p-1 text-text-muted hover:text-teal-600 cursor-pointer"><Edit2 className="h-3.5 w-3.5" /></button>
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
  clientes: GarantiaCliente[]
  qc: ReturnType<typeof useQueryClient>
  goBack: () => void
  onCreated: (id: string) => void
}) {
  const [clienteId, setClienteId] = useState('')
  const [clienteSearch, setClienteSearch] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClient, setNewClient] = useState({
    nombre: '', apellido: '', dni: '', telefono: '', email: '', direccion: '', localidad: '',
    marca: 'FIAT', modelo: '', anio: '', dominio: '', vin: '', km_ingreso: '', color: '', sucursal: 'Ushuaia', notas: '',
  })
  const [form, setForm] = useState({
    nro_os: '', sucursal: 'Ushuaia', fecha_ingreso_vehiculo: new Date().toISOString().slice(0, 10),
    km_ingreso: '', sintomas_cliente: '',
  })

  const clientesFiltered = useMemo(() => {
    if (!clienteSearch) return clientes.filter(c => c.activo)
    const q = clienteSearch.toLowerCase()
    return clientes.filter(c => c.activo && [c.nombre, c.apellido, c.dominio, c.vin].join(' ').toLowerCase().includes(q))
  }, [clientes, clienteSearch])

  const createClient = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('garantias_clientes').insert({
        ...newClient,
        anio: newClient.anio ? Number(newClient.anio) : null,
        km_ingreso: newClient.km_ingreso ? Number(newClient.km_ingreso) : null,
        activo: true,
      }).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['garantias_clientes'] })
      setClienteId(id)
      setShowNewClient(false)
      notify.success('Cliente creado')
    },
    onError: () => notify.error('Error al crear cliente'),
  })

  const createExp = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('garantias_expedientes').insert({
        cliente_id: clienteId,
        nro_os: form.nro_os,
        sucursal: form.sucursal,
        fecha_ingreso_vehiculo: form.fecha_ingreso_vehiculo || null,
        km_ingreso: form.km_ingreso ? Number(form.km_ingreso) : null,
        sintomas_cliente: form.sintomas_cliente,
        estado_actual: 'recepcion',
      }).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['garantias_expedientes'] })
      notify.success('Expediente creado')
      onCreated(id)
    },
    onError: () => notify.error('Error al crear expediente'),
  })

  const selectedClient = clientes.find(c => c.id === clienteId)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={goBack}><ArrowLeft className="h-4 w-4" /> Volver</Button>
        <h1 className="text-xl font-bold text-text-primary">Nuevo expediente</h1>
      </div>

      {/* Client selector */}
      <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-4">
        <h2 className="text-sm font-medium text-text-primary">Seleccionar cliente</h2>

        {selectedClient ? (
          <div className="flex items-center justify-between bg-teal-50 rounded-lg p-3">
            <div>
              <p className="text-sm font-medium text-teal-800">{selectedClient.nombre} {selectedClient.apellido}</p>
              <p className="text-xs text-teal-600">{selectedClient.marca} {selectedClient.modelo} - {selectedClient.dominio}</p>
            </div>
            <button onClick={() => setClienteId('')} className="text-teal-600 hover:text-teal-800 cursor-pointer"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <>
            <Input
              placeholder="Buscar por nombre, dominio, VIN..."
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
                    onClick={() => { setClienteId(c.id); setClienteSearch('') }}
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
              <Input label="KM" type="number" value={newClient.km_ingreso} onChange={e => setNewClient({ ...newClient, km_ingreso: e.target.value })} />
              <Input label="Color" value={newClient.color} onChange={e => setNewClient({ ...newClient, color: e.target.value })} />
              <Select label="Sucursal" options={SUCURSALES} value={newClient.sucursal} onChange={e => setNewClient({ ...newClient, sucursal: e.target.value })} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setShowNewClient(false)}>Cancelar</Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => createClient.mutate()} loading={createClient.isPending}>
                Crear cliente
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Expediente fields */}
      <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-4">
        <h2 className="text-sm font-medium text-text-primary">Datos del expediente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Nro OS" value={form.nro_os} onChange={e => setForm({ ...form, nro_os: e.target.value })} />
          <Select label="Sucursal" options={SUCURSALES} value={form.sucursal} onChange={e => setForm({ ...form, sucursal: e.target.value })} />
          <Input label="Fecha ingreso" type="date" value={form.fecha_ingreso_vehiculo} onChange={e => setForm({ ...form, fecha_ingreso_vehiculo: e.target.value })} />
          <Input label="KM ingreso" type="number" value={form.km_ingreso} onChange={e => setForm({ ...form, km_ingreso: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Sintomas del cliente</label>
          <textarea
            value={form.sintomas_cliente}
            onChange={e => setForm({ ...form, sintomas_cliente: e.target.value })}
            className="w-full rounded-lg bg-bg-input border border-border px-3 py-2.5 text-text-primary text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            placeholder="Describir los sintomas reportados por el cliente..."
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={goBack}>Cancelar</Button>
        <Button
          className="bg-teal-600 hover:bg-teal-700"
          disabled={!clienteId || !form.nro_os}
          onClick={() => createExp.mutate()}
          loading={createExp.isPending}
        >
          Crear expediente
        </Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// CLIENTS LIST
// ═══════════════════════════════════════════════════════════════════════

function ClientesList({ clientes, loading, qc }: {
  clientes: GarantiaCliente[]; loading: boolean; qc: ReturnType<typeof useQueryClient>
}) {
  const [search, setSearch] = useState('')
  const [editingClient, setEditingClient] = useState<GarantiaCliente | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre: '', apellido: '', dni: '', telefono: '', email: '', direccion: '', localidad: '',
    marca: 'FIAT', modelo: '', anio: '', dominio: '', vin: '', km_ingreso: '', color: '', sucursal: 'Ushuaia', notas: '',
  })

  const filtered = useMemo(() => {
    const activos = clientes.filter(c => c.activo)
    if (!search) return activos
    const q = search.toLowerCase()
    return activos.filter(c => [c.nombre, c.apellido, c.dominio, c.modelo, c.dni].join(' ').toLowerCase().includes(q))
  }, [clientes, search])

  const openNew = () => {
    setEditingClient(null)
    setForm({ nombre: '', apellido: '', dni: '', telefono: '', email: '', direccion: '', localidad: '', marca: 'FIAT', modelo: '', anio: '', dominio: '', vin: '', km_ingreso: '', color: '', sucursal: 'Ushuaia', notas: '' })
    setShowModal(true)
  }

  const openEdit = (c: GarantiaCliente) => {
    setEditingClient(c)
    setForm({
      nombre: c.nombre || '', apellido: c.apellido || '', dni: c.dni || '', telefono: c.telefono || '',
      email: c.email || '', direccion: c.direccion || '', localidad: c.localidad || '', marca: c.marca || 'FIAT',
      modelo: c.modelo || '', anio: c.anio ? String(c.anio) : '', dominio: c.dominio || '', vin: c.vin || '',
      km_ingreso: c.km_ingreso ? String(c.km_ingreso) : '', color: c.color || '', sucursal: c.sucursal || 'Ushuaia', notas: c.notas || '',
    })
    setShowModal(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        anio: form.anio ? Number(form.anio) : null,
        km_ingreso: form.km_ingreso ? Number(form.km_ingreso) : null,
        activo: true,
        updated_at: new Date().toISOString(),
      }
      if (editingClient) {
        const { error } = await supabase.from('garantias_clientes').update(payload).eq('id', editingClient.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('garantias_clientes').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garantias_clientes'] })
      setShowModal(false)
      notify.success(editingClient ? 'Cliente actualizado' : 'Cliente creado')
    },
    onError: () => notify.error('Error al guardar cliente'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('garantias_clientes').update({ activo: false, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garantias_clientes'] })
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
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={openNew}>
          <Plus className="h-4 w-4" /> Nuevo cliente
        </Button>
      </div>

      <div className="bg-bg-secondary rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium">Apellido</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Dominio</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Modelo</th>
              <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Sucursal</th>
              <th className="px-4 py-3 text-left font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">No hay clientes</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-b border-border hover:bg-bg-tertiary">
                <td className="px-4 py-3 text-text-primary">{c.nombre}</td>
                <td className="px-4 py-3 text-text-primary">{c.apellido}</td>
                <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{c.dominio || '-'}</td>
                <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{c.modelo || '-'}</td>
                <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">{c.sucursal || '-'}</td>
                <td className="px-4 py-3 flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1 text-text-muted hover:text-teal-600 cursor-pointer"><Edit2 className="h-4 w-4" /></button>
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
              <Input label="KM" type="number" value={form.km_ingreso} onChange={e => setForm({ ...form, km_ingreso: e.target.value })} />
              <Input label="Color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
              <Select label="Sucursal" options={SUCURSALES} value={form.sucursal} onChange={e => setForm({ ...form, sucursal: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Notas</label>
              <textarea
                value={form.notas}
                onChange={e => setForm({ ...form, notas: e.target.value })}
                className="w-full rounded-lg bg-bg-input border border-border px-3 py-2.5 text-text-primary text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
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
