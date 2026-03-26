import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { notify } from '../../components/ui/Toast'
import {
  Plus, X, AlertTriangle, Search, Check, XCircle,
  FileWarning, Clock, DollarSign, TrendingUp
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────

interface CalibreDano {
  id: string
  created_at: string
  vin: string
  modelo: string
  sucursal: string
  fecha_deteccion: string
  descripcion: string
  gravedad: number
  zona: string
  origen: string
  atribuible_transporte: boolean
  // Trámite Calibre
  registro_epod: boolean
  chofer_valido: boolean
  fecha_epod: string | null
  abrio_elog: boolean
  nro_siniestro: string | null
  fecha_elog: string | null
  monto_reclamo: number
  docs_completos: boolean
  estado_reclamo: string
  motivo_rechazo: string | null
  // Reparación
  chapista: string | null
  estado_reparacion: string
  presupuesto: number
  costo_real: number
  fecha_inicio_reparacion: string | null
  fecha_fin_reparacion: string | null
  observaciones: string | null
  // Pagos
  estado_pago_chapista: string
  monto_pagado_chapista: number
  monto_recuperado: number
  fecha_cobro_stellantis: string | null
}

type NuevoDanoForm = Omit<CalibreDano, 'id' | 'created_at'>

const MODELOS = [
  { value: 'Cronos', label: 'Cronos' },
  { value: 'Argo', label: 'Argo' },
  { value: 'Pulse', label: 'Pulse' },
  { value: 'Strada', label: 'Strada' },
  { value: 'Toro', label: 'Toro' },
  { value: 'Mobi', label: 'Mobi' },
  { value: 'Titano', label: 'Titano' },
  { value: 'Fiorino', label: 'Fiorino' },
  { value: 'Ducato', label: 'Ducato' },
  { value: 'Fastback', label: 'Fastback' },
]

const SUCURSALES = [
  { value: 'Ushuaia', label: 'Ushuaia' },
  { value: 'Rio Grande', label: 'Río Grande' },
]

const GRAVEDADES = [
  { value: '1', label: '1 - Leve' },
  { value: '2', label: '2 - Medio' },
  { value: '3', label: '3 - Grave' },
]

const ZONAS = [
  { value: 'Exterior', label: 'Exterior' },
  { value: 'Interior', label: 'Interior' },
  { value: 'Mecánica', label: 'Mecánica' },
  { value: 'Vidrios', label: 'Vidrios' },
]

const ORIGENES = [
  { value: 'Transporte', label: 'Transporte' },
  { value: 'Stock', label: 'Stock' },
  { value: 'Showroom', label: 'Showroom' },
  { value: 'Test Drive', label: 'Test Drive' },
  { value: 'Otro', label: 'Otro' },
]

const ESTADOS_RECLAMO = [
  { value: 'Sin iniciar', label: 'Sin iniciar' },
  { value: 'Documentación', label: 'Documentación' },
  { value: 'Enviado', label: 'Enviado' },
  { value: 'En análisis', label: 'En análisis' },
  { value: 'Aprobado', label: 'Aprobado' },
  { value: 'Rechazado', label: 'Rechazado' },
  { value: 'Cobrado', label: 'Cobrado' },
]

const ESTADOS_REPARACION = [
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'En reparación', label: 'En reparación' },
  { value: 'Terminado', label: 'Terminado' },
]

const ESTADOS_PAGO_CHAPISTA = [
  { value: 'Sin Factura', label: 'Sin Factura' },
  { value: 'Factura Recibida', label: 'Factura Recibida' },
  { value: 'Pagado', label: 'Pagado' },
]

const ESTADOS_FILTRO = [
  { value: '', label: 'Todos' },
  { value: 'Sin gestionar', label: 'Sin gestionar' },
  { value: 'En trámite', label: 'En trámite' },
  { value: 'Aprobado', label: 'Aprobado' },
  { value: 'Rechazado', label: 'Rechazado' },
  { value: 'Cobrado', label: 'Cobrado' },
]

const fmtMoney = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const daysSince = (dateStr: string | null) => {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function getEstadoGeneral(d: CalibreDano): string {
  if (d.estado_reclamo === 'Cobrado') return 'Cobrado'
  if (d.estado_reclamo === 'Aprobado') return 'Aprobado'
  if (d.estado_reclamo === 'Rechazado') return 'Rechazado'
  if (
    d.atribuible_transporte &&
    (d.registro_epod || d.abrio_elog || d.estado_reclamo !== 'Sin iniciar')
  )
    return 'En trámite'
  if (!d.atribuible_transporte && d.estado_reparacion !== 'Pendiente') return 'En trámite'
  return 'Sin gestionar'
}

function getAlertas(d: CalibreDano): string[] {
  const alertas: string[] = []
  if (d.atribuible_transporte && !d.registro_epod) alertas.push('FALTA ePOD')
  if (d.atribuible_transporte && !d.chofer_valido) alertas.push('CHOFER NO VALIDÓ')
  if (d.atribuible_transporte && d.registro_epod && !d.abrio_elog && daysSince(d.fecha_deteccion) > 3)
    alertas.push('ABRIR e-LOG YA')
  if (d.abrio_elog && !d.docs_completos) alertas.push('FALTAN DOCS')
  if (d.estado_reclamo === 'Aprobado' && d.monto_recuperado === 0)
    alertas.push('COBRAR A STELLANTIS')
  if (d.estado_reparacion === 'Terminado' && d.estado_pago_chapista === 'Sin Factura')
    alertas.push('PEDIR FACTURA')
  return alertas
}

const emptyForm: NuevoDanoForm = {
  vin: '',
  modelo: '',
  sucursal: 'Ushuaia',
  fecha_deteccion: new Date().toISOString().slice(0, 10),
  descripcion: '',
  gravedad: 1,
  zona: 'Exterior',
  origen: 'Transporte',
  atribuible_transporte: false,
  registro_epod: false,
  chofer_valido: false,
  fecha_epod: null,
  abrio_elog: false,
  nro_siniestro: null,
  fecha_elog: null,
  monto_reclamo: 0,
  docs_completos: false,
  estado_reclamo: 'Sin iniciar',
  motivo_rechazo: null,
  chapista: null,
  estado_reparacion: 'Pendiente',
  presupuesto: 0,
  costo_real: 0,
  fecha_inicio_reparacion: null,
  fecha_fin_reparacion: null,
  observaciones: null,
  estado_pago_chapista: 'Sin Factura',
  monto_pagado_chapista: 0,
  monto_recuperado: 0,
  fecha_cobro_stellantis: null,
}

// ─── Badge component ─────────────────────────────────────────────────

function Badge({ text, color }: { text: string; color: string }) {
  const colors: Record<string, string> = {
    red: 'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>
      {text}
    </span>
  )
}

function estadoBadgeColor(estado: string): string {
  switch (estado) {
    case 'Sin gestionar': return 'red'
    case 'En trámite': return 'orange'
    case 'Aprobado': return 'green'
    case 'Rechazado': return 'red'
    case 'Cobrado': return 'blue'
    default: return 'gray'
  }
}

// ─── Modal wrapper ───────────────────────────────────────────────────

function Modal({ open, onClose, title, children, wide }: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4 pb-8 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative bg-bg-secondary rounded-xl shadow-xl border border-border w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} my-4`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-4 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

// ─── NuevoDano Modal ─────────────────────────────────────────────────

function NuevoDanoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<NuevoDanoForm>({ ...emptyForm })

  const set = <K extends keyof NuevoDanoForm>(key: K, value: NuevoDanoForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const mutation = useMutation({
    mutationFn: async (data: NuevoDanoForm) => {
      const { error } = await supabase.from('calibre_danos').insert(data)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibre_danos'] })
      notify.success('Daño registrado correctamente')
      setForm({ ...emptyForm })
      onClose()
    },
    onError: (err: any) => {
      notify.error(err.message || 'Error al guardar')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.vin || !form.modelo || !form.descripcion) {
      notify.error('Completá VIN, Modelo y Descripción')
      return
    }
    mutation.mutate(form)
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Daño">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Vehículo */}
        <section>
          <h3 className="text-sm font-semibold text-orange-600 uppercase tracking-wide mb-3">Vehículo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="VIN" value={form.vin} onChange={e => set('vin', e.target.value)} placeholder="Ej: 9BD35..." />
            <Select label="Modelo" options={MODELOS} value={form.modelo} onChange={e => set('modelo', e.target.value)} placeholder="Seleccionar" />
            <Select label="Sucursal" options={SUCURSALES} value={form.sucursal} onChange={e => set('sucursal', e.target.value)} />
            <Input label="Fecha detección" type="date" value={form.fecha_deteccion} onChange={e => set('fecha_deteccion', e.target.value)} />
          </div>
        </section>

        {/* Daño */}
        <section>
          <h3 className="text-sm font-semibold text-orange-600 uppercase tracking-wide mb-3">Daño</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={e => set('descripcion', e.target.value)}
                rows={3}
                className="w-full rounded-lg bg-bg-input border border-border px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-action/50 focus:border-action transition-colors duration-200"
                placeholder="Describí el daño detectado..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select label="Gravedad" options={GRAVEDADES} value={String(form.gravedad)} onChange={e => set('gravedad', Number(e.target.value))} />
              <Select label="Zona" options={ZONAS} value={form.zona} onChange={e => set('zona', e.target.value)} />
              <Select label="Origen" options={ORIGENES} value={form.origen} onChange={e => set('origen', e.target.value)} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.atribuible_transporte}
                onChange={e => set('atribuible_transporte', e.target.checked)}
                className="rounded border-border text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-text-primary">Atribuible a transporte</span>
            </label>
          </div>
        </section>

        {/* Trámite Calibre - solo si atribuible */}
        {form.atribuible_transporte && (
          <section className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <h3 className="text-sm font-semibold text-orange-700 uppercase tracking-wide mb-3">Trámite Calibre</h3>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.registro_epod} onChange={e => set('registro_epod', e.target.checked)} className="rounded border-border text-orange-600 focus:ring-orange-500" />
                  <span className="text-sm text-text-primary">ePOD registrado</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.chofer_valido} onChange={e => set('chofer_valido', e.target.checked)} className="rounded border-border text-orange-600 focus:ring-orange-500" />
                  <span className="text-sm text-text-primary">Chofer validó</span>
                </label>
              </div>
              <Input label="Fecha ePOD" type="date" value={form.fecha_epod || ''} onChange={e => set('fecha_epod', e.target.value || null)} />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.abrio_elog} onChange={e => set('abrio_elog', e.target.checked)} className="rounded border-border text-orange-600 focus:ring-orange-500" />
                <span className="text-sm text-text-primary">Abrió e-LOG</span>
              </label>
              {form.abrio_elog && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-4 border-l-2 border-orange-300">
                  <Input label="N° Siniestro" value={form.nro_siniestro || ''} onChange={e => set('nro_siniestro', e.target.value || null)} />
                  <Input label="Fecha e-LOG" type="date" value={form.fecha_elog || ''} onChange={e => set('fecha_elog', e.target.value || null)} />
                  <Input label="Monto reclamo" type="number" value={form.monto_reclamo || ''} onChange={e => set('monto_reclamo', Number(e.target.value))} />
                  <label className="flex items-center gap-2 cursor-pointer self-end pb-2">
                    <input type="checkbox" checked={form.docs_completos} onChange={e => set('docs_completos', e.target.checked)} className="rounded border-border text-orange-600 focus:ring-orange-500" />
                    <span className="text-sm text-text-primary">Documentación completa</span>
                  </label>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Reparación */}
        <section>
          <h3 className="text-sm font-semibold text-orange-600 uppercase tracking-wide mb-3">Reparación</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Chapista" value={form.chapista || ''} onChange={e => set('chapista', e.target.value || null)} placeholder="Nombre del chapista" />
            <Input label="Presupuesto" type="number" value={form.presupuesto || ''} onChange={e => set('presupuesto', Number(e.target.value))} />
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Observaciones</label>
            <textarea
              value={form.observaciones || ''}
              onChange={e => set('observaciones', e.target.value || null)}
              rows={2}
              className="w-full rounded-lg bg-bg-input border border-border px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-action/50 focus:border-action transition-colors duration-200"
            />
          </div>
        </section>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={mutation.isPending} className="bg-orange-600 hover:bg-orange-700 text-white">
            Guardar daño
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── DetalleDano Modal ───────────────────────────────────────────────

function DetalleDanoModal({ dano, onClose }: { dano: CalibreDano | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'tramite' | 'reparacion' | 'pagos'>('tramite')
  const [form, setForm] = useState<CalibreDano | null>(null)

  // Sync form when dano changes
  useState(() => { if (dano) setForm({ ...dano }) })
  if (!dano) return null
  if (!form) { setForm({ ...dano }); return null }

  const set = <K extends keyof CalibreDano>(key: K, value: CalibreDano[K]) =>
    setForm(prev => prev ? { ...prev, [key]: value } : prev)

  const mutation = useMutation({
    mutationFn: async (data: Partial<CalibreDano>) => {
      const { id, created_at, ...rest } = data as CalibreDano
      const { error } = await supabase.from('calibre_danos').update(rest).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibre_danos'] })
      notify.success('Daño actualizado')
      onClose()
    },
    onError: (err: any) => {
      notify.error(err.message || 'Error al actualizar')
    },
  })

  const handleSave = () => {
    if (form) mutation.mutate(form)
  }

  const alertas = getAlertas(form)
  const tabs = [
    { key: 'tramite' as const, label: 'Trámite' },
    { key: 'reparacion' as const, label: 'Reparación' },
    { key: 'pagos' as const, label: 'Pagos' },
  ]

  return (
    <Modal open={!!dano} onClose={onClose} title={`${form.modelo} — VIN ...${form.vin.slice(-4)}`} wide>
      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {alertas.map(a => (
            <span key={a} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              <AlertTriangle className="h-3 w-3" /> {a}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              tab === t.key
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Trámite */}
      {tab === 'tramite' && (
        <div className="space-y-6">
          {/* ePOD */}
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <h4 className="text-sm font-semibold text-orange-700 mb-3">ePOD</h4>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.registro_epod} onChange={e => set('registro_epod', e.target.checked)} className="rounded border-border text-orange-600 focus:ring-orange-500" />
                  <span className="text-sm text-text-primary">ePOD registrado</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.chofer_valido} onChange={e => set('chofer_valido', e.target.checked)} className="rounded border-border text-orange-600 focus:ring-orange-500" />
                  <span className="text-sm text-text-primary">Chofer validó</span>
                </label>
              </div>
              <Input label="Fecha ePOD" type="date" value={form.fecha_epod || ''} onChange={e => set('fecha_epod', e.target.value || null)} />
            </div>
          </div>

          {/* e-LOG */}
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <h4 className="text-sm font-semibold text-orange-700 mb-3">e-LOG</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.abrio_elog} onChange={e => set('abrio_elog', e.target.checked)} className="rounded border-border text-orange-600 focus:ring-orange-500" />
                <span className="text-sm text-text-primary">Abrió e-LOG</span>
              </label>
              {form.abrio_elog && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="N° Siniestro" value={form.nro_siniestro || ''} onChange={e => set('nro_siniestro', e.target.value || null)} />
                  <Input label="Fecha e-LOG" type="date" value={form.fecha_elog || ''} onChange={e => set('fecha_elog', e.target.value || null)} />
                  <Input label="Monto reclamo" type="number" value={form.monto_reclamo || ''} onChange={e => set('monto_reclamo', Number(e.target.value))} />
                  <label className="flex items-center gap-2 cursor-pointer self-end pb-2">
                    <input type="checkbox" checked={form.docs_completos} onChange={e => set('docs_completos', e.target.checked)} className="rounded border-border text-orange-600 focus:ring-orange-500" />
                    <span className="text-sm text-text-primary">Documentación completa</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Estado Reclamo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Estado reclamo" options={ESTADOS_RECLAMO} value={form.estado_reclamo} onChange={e => set('estado_reclamo', e.target.value)} />
            {form.estado_reclamo === 'Rechazado' && (
              <Input label="Motivo rechazo" value={form.motivo_rechazo || ''} onChange={e => set('motivo_rechazo', e.target.value || null)} />
            )}
          </div>
        </div>
      )}

      {/* Tab: Reparación */}
      {tab === 'reparacion' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Chapista" value={form.chapista || ''} onChange={e => set('chapista', e.target.value || null)} />
            <Select label="Estado reparación" options={ESTADOS_REPARACION} value={form.estado_reparacion} onChange={e => set('estado_reparacion', e.target.value)} />
            <Input label="Presupuesto" type="number" value={form.presupuesto || ''} onChange={e => set('presupuesto', Number(e.target.value))} />
            <Input label="Costo real" type="number" value={form.costo_real || ''} onChange={e => set('costo_real', Number(e.target.value))} />
            <Input label="Fecha inicio reparación" type="date" value={form.fecha_inicio_reparacion || ''} onChange={e => set('fecha_inicio_reparacion', e.target.value || null)} />
            <Input label="Fecha fin reparación" type="date" value={form.fecha_fin_reparacion || ''} onChange={e => set('fecha_fin_reparacion', e.target.value || null)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Observaciones</label>
            <textarea
              value={form.observaciones || ''}
              onChange={e => set('observaciones', e.target.value || null)}
              rows={3}
              className="w-full rounded-lg bg-bg-input border border-border px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-action/50 focus:border-action transition-colors duration-200"
            />
          </div>
        </div>
      )}

      {/* Tab: Pagos */}
      {tab === 'pagos' && (
        <div className="space-y-6">
          {/* Summary card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-bg-tertiary rounded-lg p-3 text-center">
              <p className="text-xs text-text-muted">Costo reparación</p>
              <p className="text-lg font-bold text-text-primary">{fmtMoney(form.costo_real || form.presupuesto)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-green-700">Recuperado</p>
              <p className="text-lg font-bold text-green-700">{fmtMoney(form.monto_recuperado)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-xs text-red-700">Pagado chapista</p>
              <p className="text-lg font-bold text-red-700">{fmtMoney(form.monto_pagado_chapista)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-blue-700">Neto</p>
              <p className="text-lg font-bold text-blue-700">{fmtMoney(form.monto_recuperado - form.monto_pagado_chapista)}</p>
            </div>
          </div>

          {/* Pago chapista */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-3">Pago chapista</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Estado pago" options={ESTADOS_PAGO_CHAPISTA} value={form.estado_pago_chapista} onChange={e => set('estado_pago_chapista', e.target.value)} />
              <Input label="Monto pagado" type="number" value={form.monto_pagado_chapista || ''} onChange={e => set('monto_pagado_chapista', Number(e.target.value))} />
            </div>
          </div>

          {/* Recupero Stellantis */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-3">Recupero Stellantis</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Monto recuperado" type="number" value={form.monto_recuperado || ''} onChange={e => set('monto_recuperado', Number(e.target.value))} />
              <Input label="Fecha cobro" type="date" value={form.fecha_cobro_stellantis || ''} onChange={e => set('fecha_cobro_stellantis', e.target.value || null)} />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-border">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="button" loading={mutation.isPending} onClick={handleSave} className="bg-orange-600 hover:bg-orange-700 text-white">
          Guardar cambios
        </Button>
      </div>
    </Modal>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────

export function CalibrePage() {
  const [showNuevo, setShowNuevo] = useState(false)
  const [selectedDano, setSelectedDano] = useState<CalibreDano | null>(null)
  const [search, setSearch] = useState('')
  const [filterSucursal, setFilterSucursal] = useState('')
  const [filterEstado, setFilterEstado] = useState('')

  const { data: danos = [], isLoading } = useQuery<CalibreDano[]>({
    queryKey: ['calibre_danos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calibre_danos')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as CalibreDano[]
    },
  })

  // Filtered data
  const filtered = useMemo(() => {
    return danos.filter(d => {
      if (filterSucursal && d.sucursal !== filterSucursal) return false
      if (filterEstado) {
        const estado = getEstadoGeneral(d)
        if (estado !== filterEstado) return false
      }
      if (search) {
        const q = search.toLowerCase()
        const match =
          d.vin.toLowerCase().includes(q) ||
          d.modelo.toLowerCase().includes(q) ||
          d.descripcion.toLowerCase().includes(q) ||
          (d.chapista || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [danos, filterSucursal, filterEstado, search])

  // KPIs
  const kpis = useMemo(() => {
    const sinGestionar = danos.filter(d => getEstadoGeneral(d) === 'Sin gestionar').length
    const enTramite = danos.filter(d => getEstadoGeneral(d) === 'En trámite').length
    const recuperado = danos.reduce((sum, d) => sum + (d.monto_recuperado || 0), 0)
    const reclamosResueltos = danos.filter(d => ['Aprobado', 'Cobrado'].includes(d.estado_reclamo)).length
    const reclamosTotales = danos.filter(d => d.atribuible_transporte && d.estado_reclamo !== 'Sin iniciar').length
    const aprobacion = reclamosTotales > 0 ? Math.round((reclamosResueltos / reclamosTotales) * 100) : 0
    return { sinGestionar, enTramite, recuperado, aprobacion }
  }, [danos])

  // Global alerts
  const alertaGlobal = useMemo(() => {
    const sinElog = danos.filter(d =>
      d.atribuible_transporte && d.registro_epod && !d.abrio_elog && daysSince(d.fecha_deteccion) > 3
    ).length
    const sinActualizar = danos.filter(d =>
      d.atribuible_transporte && d.abrio_elog && d.estado_reclamo !== 'Cobrado' && d.estado_reclamo !== 'Rechazado' && daysSince(d.fecha_elog) > 15
    ).length
    const sinCobrar = danos.filter(d =>
      d.estado_reclamo === 'Aprobado' && d.monto_recuperado === 0
    ).length
    return { sinElog, sinActualizar, sinCobrar }
  }, [danos])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Calibre</h1>
          <p className="text-sm text-text-muted">Control de Daños y Reclamos</p>
        </div>
        <Button onClick={() => setShowNuevo(true)} className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="h-4 w-4" /> Nuevo daño
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-red-100"><FileWarning className="h-4 w-4 text-red-600" /></div>
            <span className="text-xs text-text-muted">Sin gestionar</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{kpis.sinGestionar}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-orange-100"><Clock className="h-4 w-4 text-orange-600" /></div>
            <span className="text-xs text-text-muted">En trámite</span>
          </div>
          <p className="text-2xl font-bold text-orange-600">{kpis.enTramite}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-green-100"><DollarSign className="h-4 w-4 text-green-600" /></div>
            <span className="text-xs text-text-muted">Recuperado $</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{fmtMoney(kpis.recuperado)}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-purple-100"><TrendingUp className="h-4 w-4 text-purple-600" /></div>
            <span className="text-xs text-text-muted">% Aprobación</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{kpis.aprobacion}%</p>
        </div>
      </div>

      {/* Alert cards */}
      {(alertaGlobal.sinElog > 0 || alertaGlobal.sinActualizar > 0 || alertaGlobal.sinCobrar > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {alertaGlobal.sinElog > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">{alertaGlobal.sinElog} daño(s) sin e-LOG</p>
                <p className="text-xs text-red-600">Más de 3 días sin abrir e-LOG</p>
              </div>
            </div>
          )}
          {alertaGlobal.sinActualizar > 0 && (
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-700">{alertaGlobal.sinActualizar} reclamo(s) sin actualizar</p>
                <p className="text-xs text-orange-600">Más de 15 días sin movimiento</p>
              </div>
            </div>
          )}
          {alertaGlobal.sinCobrar > 0 && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
              <DollarSign className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-700">{alertaGlobal.sinCobrar} aprobado(s) sin cobrar</p>
                <p className="text-xs text-green-600">Falta cobrar a Stellantis</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Buscar por VIN, modelo, daño, chapista..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            options={[{ value: '', label: 'Todas' }, ...SUCURSALES]}
            value={filterSucursal}
            onChange={e => setFilterSucursal(e.target.value)}
            placeholder="Sucursal"
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            options={ESTADOS_FILTRO}
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
            placeholder="Estado"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-tertiary">
                <th className="text-left px-4 py-3 font-medium text-text-muted">VIN</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Modelo</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Daño</th>
                <th className="text-center px-4 py-3 font-medium text-text-muted">ePOD</th>
                <th className="text-center px-4 py-3 font-medium text-text-muted">e-LOG</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Estado</th>
                <th className="text-right px-4 py-3 font-medium text-text-muted">Monto</th>
                <th className="text-right px-4 py-3 font-medium text-text-muted">Días</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-muted">Cargando...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-muted">No se encontraron daños</td>
                </tr>
              ) : (
                filtered.map(d => {
                  const estado = getEstadoGeneral(d)
                  const alertas = getAlertas(d)
                  return (
                    <tr
                      key={d.id}
                      onClick={() => setSelectedDano(d)}
                      className="border-b border-border hover:bg-bg-tertiary cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-text-primary">...{d.vin.slice(-4)}</td>
                      <td className="px-4 py-3 text-text-primary">{d.modelo}</td>
                      <td className="px-4 py-3 text-text-secondary max-w-[200px] truncate">
                        {d.descripcion}
                        {alertas.length > 0 && (
                          <span className="ml-2 inline-flex items-center text-red-500" title={alertas.join(', ')}>
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.registro_epod
                          ? <Check className="h-4 w-4 text-green-500 inline" />
                          : <XCircle className="h-4 w-4 text-red-400 inline" />}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.abrio_elog
                          ? <Check className="h-4 w-4 text-green-500 inline" />
                          : <XCircle className="h-4 w-4 text-red-400 inline" />}
                      </td>
                      <td className="px-4 py-3"><Badge text={estado} color={estadoBadgeColor(estado)} /></td>
                      <td className="px-4 py-3 text-right text-text-primary">{fmtMoney(d.monto_reclamo || d.presupuesto)}</td>
                      <td className="px-4 py-3 text-right text-text-muted">{daysSince(d.fecha_deteccion)}d</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <NuevoDanoModal open={showNuevo} onClose={() => setShowNuevo(false)} />
      <DetalleDanoModal dano={selectedDano} onClose={() => setSelectedDano(null)} />
    </div>
  )
}
