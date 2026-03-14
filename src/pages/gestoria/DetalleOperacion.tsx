import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Save, X, MessageCircle,
  FileCheck, Clock, User, Car, AlertTriangle,
} from 'lucide-react'
import { useOperacion, useActualizarEstadoGestoria } from '../../hooks/useOperaciones'
import {
  Button, Input, Textarea, Card, EstadoBadge, Badge,
  Tabs, ConfirmDialog, ProgressBar, Checkbox, notify, Skeleton,
} from '../../components/ui'
import { formatDate, formatDateTime } from '../../utils/formatters'
import { generateWhatsAppLink } from '../../utils/whatsapp'
import { supabase } from '../../lib/supabase'
import type { ChecklistDocItem, HistorialEstado, Titular, Unidad, GestoriaTramite } from '../../lib/types'

// ============================================================
// DetalleOperacion - Página de detalle de operación de Gestoría
// ============================================================

const tabs = [
  { id: 'datos', label: 'Datos' },
  { id: 'documentacion', label: 'Documentación' },
  { id: 'historial', label: 'Historial' },
  { id: 'acciones', label: 'Acciones' },
]

const estadoLabels: Record<string, string> = {
  ingresado: 'Ingresado',
  en_tramite: 'En trámite',
  listo: 'Listo',
  egresado: 'Egresado',
  suspendido: 'Suspendido',
}

export function DetalleOperacion() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: operacion, isLoading, refetch } = useOperacion(id)
  const actualizarEstado = useActualizarEstadoGestoria()

  const [activeTab, setActiveTab] = useState('datos')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // --- Editing state ---
  const [editTitular, setEditTitular] = useState<Partial<Titular>>({})
  const [editUnidad, setEditUnidad] = useState<Partial<Unidad>>({})
  const [editGestoria, setEditGestoria] = useState<Partial<GestoriaTramite>>({})

  // --- Documentacion state ---
  const [checklistDoc, setChecklistDoc] = useState<ChecklistDocItem[]>([])
  const [checklistInited, setChecklistInited] = useState(false)
  const [savingChecklist, setSavingChecklist] = useState(false)

  // --- Acciones modals ---
  const [confirmAction, setConfirmAction] = useState<{
    open: boolean
    title: string
    message: string
    nuevoEstado: string
    variant: 'danger' | 'primary'
    requireMotivo: boolean
  }>({
    open: false, title: '', message: '', nuevoEstado: '', variant: 'primary', requireMotivo: false,
  })
  const [motivoInput, setMotivoInput] = useState('')
  const [warningDocModal, setWarningDocModal] = useState(false)

  // --- Derived data ---
  const titular = operacion?.titular as Titular | null
  const unidad = operacion?.unidad as Unidad | null
  const gestoria = operacion?.gestoria as GestoriaTramite | null
  const estadoActual = operacion?.estado_gestoria || 'ingresado'

  // Init checklist when gestoria data arrives
  if (gestoria && !checklistInited) {
    const items = Array.isArray(gestoria.checklist_doc) ? gestoria.checklist_doc : []
    setChecklistDoc(items)
    setChecklistInited(true)
  }

  // --- Handlers ---

  function startEditing() {
    setEditTitular({
      nombre_apellido: titular?.nombre_apellido || '',
      dni_cuil: titular?.dni_cuil || '',
      telefono: titular?.telefono || '',
      email: titular?.email || '',
      domicilio: titular?.domicilio || '',
      localidad: titular?.localidad || '',
      es_empresa: titular?.es_empresa || false,
      razon_social: titular?.razon_social || '',
      cuit_empresa: titular?.cuit_empresa || '',
    })
    setEditUnidad({
      marca: unidad?.marca || '',
      modelo: unidad?.modelo || '',
      version: unidad?.version || '',
      color: unidad?.color || '',
      vin_chasis: unidad?.vin_chasis || '',
      patente_actual: unidad?.patente_actual || '',
      patente_nueva: unidad?.patente_nueva || '',
      anio: unidad?.anio || undefined,
      kilometraje: unidad?.kilometraje || undefined,
    })
    setEditGestoria({
      fecha_ingreso: gestoria?.fecha_ingreso || '',
      fecha_egreso_estimada: gestoria?.fecha_egreso_estimada || '',
      fecha_egreso_real: gestoria?.fecha_egreso_real || '',
      gestor_responsable: gestoria?.gestor_responsable || '',
      observaciones: gestoria?.observaciones || '',
    })
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
  }

  async function saveEditing() {
    if (!operacion || !titular || !unidad || !gestoria) return
    setSaving(true)

    try {
      const [titularRes, unidadRes, gestoriaRes] = await Promise.all([
        supabase.from('titulares').update(editTitular).eq('id', titular.id),
        supabase.from('unidades').update(editUnidad).eq('id', unidad.id),
        supabase.from('gestoria_tramites').update({
          fecha_egreso_estimada: editGestoria.fecha_egreso_estimada || null,
          fecha_egreso_real: editGestoria.fecha_egreso_real || null,
          observaciones: editGestoria.observaciones || null,
        }).eq('id', gestoria.id),
      ])

      if (titularRes.error) throw titularRes.error
      if (unidadRes.error) throw unidadRes.error
      if (gestoriaRes.error) throw gestoriaRes.error

      notify.success('Datos actualizados correctamente')
      setEditing(false)
      refetch()
    } catch (err: any) {
      notify.error(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function saveChecklist() {
    if (!gestoria) return
    setSavingChecklist(true)

    try {
      const completados = checklistDoc.filter((d) => d.completado).length
      const docCompleta = checklistDoc.length > 0 && completados === checklistDoc.length

      const { error } = await supabase
        .from('gestoria_tramites')
        .update({
          checklist_doc: checklistDoc,
          documentacion_completa: docCompleta,
        })
        .eq('id', gestoria.id)

      if (error) throw error
      notify.success('Checklist actualizado')
      refetch()
    } catch (err: any) {
      notify.error(err.message || 'Error al guardar checklist')
    } finally {
      setSavingChecklist(false)
    }
  }

  function handleTransition(nuevoEstado: string) {
    // Si va a "listo" y no tiene documentacion completa → warning
    if (nuevoEstado === 'listo' && !gestoria?.documentacion_completa) {
      setWarningDocModal(true)
      return
    }

    if (nuevoEstado === 'suspendido') {
      setConfirmAction({
        open: true,
        title: 'Suspender trámite',
        message: 'Ingresá el motivo de la suspensión:',
        nuevoEstado: 'suspendido',
        variant: 'danger',
        requireMotivo: true,
      })
      setMotivoInput('')
      return
    }

    const labels: Record<string, { title: string; message: string }> = {
      en_tramite: { title: 'Iniciar trámite', message: '¿Confirmar inicio del trámite de gestoría?' },
      listo: { title: 'Marcar listo', message: '¿Confirmar que el trámite está listo para alistar?' },
    }

    const label = labels[nuevoEstado] || { title: 'Confirmar', message: '¿Confirmar cambio de estado?' }
    setConfirmAction({
      open: true,
      title: label.title,
      message: label.message,
      nuevoEstado,
      variant: 'primary',
      requireMotivo: false,
    })
  }

  async function executeTransition(nuevoEstado: string, motivo?: string) {
    try {
      await actualizarEstado.mutateAsync({ id: operacion!.id, nuevoEstado, motivo })
      notify.success(`Estado actualizado a "${estadoLabels[nuevoEstado] || nuevoEstado}"`)
      setConfirmAction((prev) => ({ ...prev, open: false }))
      setWarningDocModal(false)
      refetch()
    } catch (err: any) {
      notify.error(err.message || 'Error al cambiar estado')
    }
  }

  function openWhatsApp() {
    if (!titular?.telefono) {
      notify.error('El titular no tiene teléfono cargado')
      return
    }
    const link = generateWhatsAppLink(
      titular.telefono,
      'Hola! Te escribimos de Liendo Automotores respecto a tu trámite.'
    )
    window.open(link, '_blank')
  }

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!operacion) {
    return (
      <div className="text-center py-12">
        <p className="text-text-secondary">Operación no encontrada.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/gestoria')}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
      </div>
    )
  }

  // --- Checklist helpers ---
  const completados = checklistDoc.filter((d) => d.completado).length
  const totalDocs = checklistDoc.length

  // --- Historial ---
  const historial: HistorialEstado[] = Array.isArray(gestoria?.historial_estados)
    ? gestoria!.historial_estados
    : []

  // --- Render helpers ---

  function renderField(label: string, value: string | number | null | undefined) {
    return (
      <div className="py-1.5">
        <dt className="text-xs text-text-muted">{label}</dt>
        <dd className="text-sm text-text-primary mt-0.5">{value || '-'}</dd>
      </div>
    )
  }

  function renderEditField(
    label: string,
    value: string | number | undefined,
    onChange: (val: string) => void,
    type: string = 'text',
  ) {
    return (
      <Input
        label={label}
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen">
      {/* ---- HEADER ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate('/gestoria')}
            className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-text-primary font-mono">
            {operacion.numero_operacion}
          </h1>
          <EstadoBadge estado={estadoActual} tipo="gestoria" size="md" />
          <Badge color="blue" size="sm">{operacion.sucursal}</Badge>
          <Badge color="purple" size="sm">{operacion.tipo_operacion}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="success"
            size="sm"
            onClick={openWhatsApp}
            className="bg-green-600 hover:bg-green-700"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
          {!editing ? (
            <Button variant="secondary" size="sm" onClick={startEditing}>
              <Edit2 className="h-4 w-4" />
              Editar
            </Button>
          ) : (
            <>
              <Button variant="primary" size="sm" onClick={saveEditing} loading={saving}>
                <Save className="h-4 w-4" />
                Guardar
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelEditing}>
                <X className="h-4 w-4" />
                Cancelar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ---- TABS ---- */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

      {/* ---- TAB: DATOS ---- */}
      {activeTab === 'datos' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card Titular */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <User className="h-4 w-4 text-action" />
              <h3 className="text-sm font-semibold text-text-primary">Titular</h3>
            </div>
            {!editing ? (
              <dl className="space-y-1">
                {renderField('Nombre / Apellido', titular?.nombre_apellido)}
                {renderField('DNI / CUIL', titular?.dni_cuil)}
                {renderField('Teléfono', titular?.telefono)}
                {renderField('Email', titular?.email)}
                {renderField('Domicilio', titular?.domicilio)}
                {renderField('Localidad', titular?.localidad)}
                {titular?.es_empresa && (
                  <>
                    {renderField('Razón Social', titular?.razon_social)}
                    {renderField('CUIT Empresa', titular?.cuit_empresa)}
                  </>
                )}
              </dl>
            ) : (
              <div className="space-y-3">
                {renderEditField('Nombre / Apellido', editTitular.nombre_apellido, (v) =>
                  setEditTitular((prev) => ({ ...prev, nombre_apellido: v }))
                )}
                {renderEditField('DNI / CUIL', editTitular.dni_cuil, (v) =>
                  setEditTitular((prev) => ({ ...prev, dni_cuil: v }))
                )}
                {renderEditField('Teléfono', editTitular.telefono, (v) =>
                  setEditTitular((prev) => ({ ...prev, telefono: v }))
                )}
                {renderEditField('Email', editTitular.email || '', (v) =>
                  setEditTitular((prev) => ({ ...prev, email: v }))
                , 'email')}
                {renderEditField('Domicilio', editTitular.domicilio || '', (v) =>
                  setEditTitular((prev) => ({ ...prev, domicilio: v }))
                )}
                {renderEditField('Localidad', editTitular.localidad || '', (v) =>
                  setEditTitular((prev) => ({ ...prev, localidad: v }))
                )}
                <Checkbox
                  label="Es empresa"
                  checked={editTitular.es_empresa || false}
                  onChange={(e) =>
                    setEditTitular((prev) => ({ ...prev, es_empresa: (e.target as HTMLInputElement).checked }))
                  }
                />
                {editTitular.es_empresa && (
                  <>
                    {renderEditField('Razón Social', editTitular.razon_social || '', (v) =>
                      setEditTitular((prev) => ({ ...prev, razon_social: v }))
                    )}
                    {renderEditField('CUIT Empresa', editTitular.cuit_empresa || '', (v) =>
                      setEditTitular((prev) => ({ ...prev, cuit_empresa: v }))
                    )}
                  </>
                )}
              </div>
            )}
          </Card>

          {/* Card Unidad */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Car className="h-4 w-4 text-action" />
              <h3 className="text-sm font-semibold text-text-primary">Unidad</h3>
            </div>
            {!editing ? (
              <dl className="space-y-1">
                {renderField('Marca', unidad?.marca)}
                {renderField('Modelo', unidad?.modelo)}
                {renderField('Versión', unidad?.version)}
                {renderField('Color', unidad?.color)}
                {renderField('VIN / Chasis', unidad?.vin_chasis)}
                {renderField('Patente actual', unidad?.patente_actual)}
                {renderField('Patente nueva', unidad?.patente_nueva)}
                {renderField('Año', unidad?.anio)}
                {renderField('Kilometraje', unidad?.kilometraje != null ? `${unidad.kilometraje} km` : null)}
              </dl>
            ) : (
              <div className="space-y-3">
                {renderEditField('Marca', editUnidad.marca, (v) =>
                  setEditUnidad((prev) => ({ ...prev, marca: v }))
                )}
                {renderEditField('Modelo', editUnidad.modelo, (v) =>
                  setEditUnidad((prev) => ({ ...prev, modelo: v }))
                )}
                {renderEditField('Versión', editUnidad.version || '', (v) =>
                  setEditUnidad((prev) => ({ ...prev, version: v }))
                )}
                {renderEditField('Color', editUnidad.color || '', (v) =>
                  setEditUnidad((prev) => ({ ...prev, color: v }))
                )}
                {renderEditField('VIN / Chasis', editUnidad.vin_chasis, (v) =>
                  setEditUnidad((prev) => ({ ...prev, vin_chasis: v }))
                )}
                {renderEditField('Patente actual', editUnidad.patente_actual || '', (v) =>
                  setEditUnidad((prev) => ({ ...prev, patente_actual: v }))
                )}
                {renderEditField('Patente nueva', editUnidad.patente_nueva || '', (v) =>
                  setEditUnidad((prev) => ({ ...prev, patente_nueva: v }))
                )}
                {renderEditField('Año', editUnidad.anio as any, (v) =>
                  setEditUnidad((prev) => ({ ...prev, anio: v ? Number(v) : undefined }))
                , 'number')}
                {renderEditField('Kilometraje', editUnidad.kilometraje as any, (v) =>
                  setEditUnidad((prev) => ({ ...prev, kilometraje: v ? Number(v) : undefined }))
                , 'number')}
              </div>
            )}
          </Card>

          {/* Card Trámite */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <FileCheck className="h-4 w-4 text-action" />
              <h3 className="text-sm font-semibold text-text-primary">Trámite</h3>
            </div>
            {!editing ? (
              <dl className="space-y-1">
                {renderField('Fecha ingreso', gestoria?.fecha_ingreso ? formatDate(gestoria.fecha_ingreso) : null)}
                {renderField('Egreso estimado', gestoria?.fecha_egreso_estimada ? formatDate(gestoria.fecha_egreso_estimada) : null)}
                {renderField('Egreso real', gestoria?.fecha_egreso_real ? formatDate(gestoria.fecha_egreso_real) : null)}
                {renderField('Gestor responsable', gestoria?.gestor_responsable)}
                {renderField('Observaciones', gestoria?.observaciones)}
              </dl>
            ) : (
              <div className="space-y-3">
                <Input
                  label="Fecha ingreso"
                  type="date"
                  value={editGestoria.fecha_ingreso || ''}
                  disabled
                />
                <Input
                  label="Egreso estimado"
                  type="date"
                  value={editGestoria.fecha_egreso_estimada || ''}
                  onChange={(e) =>
                    setEditGestoria((prev) => ({ ...prev, fecha_egreso_estimada: e.target.value }))
                  }
                />
                <Input
                  label="Egreso real"
                  type="date"
                  value={editGestoria.fecha_egreso_real || ''}
                  onChange={(e) =>
                    setEditGestoria((prev) => ({ ...prev, fecha_egreso_real: e.target.value }))
                  }
                />
                <Textarea
                  label="Observaciones"
                  value={editGestoria.observaciones || ''}
                  onChange={(e) =>
                    setEditGestoria((prev) => ({ ...prev, observaciones: e.target.value }))
                  }
                  rows={3}
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ---- TAB: DOCUMENTACION ---- */}
      {activeTab === 'documentacion' && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-action" />
                <h3 className="text-sm font-semibold text-text-primary">Checklist de documentación</h3>
              </div>
              {gestoria?.documentacion_completa && (
                <Badge color="green" size="sm">Completa</Badge>
              )}
            </div>

            <ProgressBar
              value={completados}
              max={totalDocs}
              label="Progreso"
              className="mb-5"
            />

            {totalDocs === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">
                No hay documentos en el checklist.
              </p>
            ) : (
              <div className="space-y-3">
                {checklistDoc.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-bg-primary border border-border"
                  >
                    <Checkbox
                      checked={item.completado}
                      onChange={(e) => {
                        const updated = [...checklistDoc]
                        updated[index] = {
                          ...updated[index],
                          completado: (e.target as HTMLInputElement).checked,
                        }
                        setChecklistDoc(updated)
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${item.completado ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                        {item.nombre}
                      </p>
                      <Input
                        placeholder="Observación..."
                        value={item.observacion || ''}
                        onChange={(e) => {
                          const updated = [...checklistDoc]
                          updated[index] = {
                            ...updated[index],
                            observacion: e.target.value,
                          }
                          setChecklistDoc(updated)
                        }}
                        className="mt-2 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalDocs > 0 && (
              <div className="flex justify-end mt-4">
                <Button onClick={saveChecklist} loading={savingChecklist} size="sm">
                  <Save className="h-4 w-4" />
                  Guardar checklist
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ---- TAB: HISTORIAL ---- */}
      {activeTab === 'historial' && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-action" />
            <h3 className="text-sm font-semibold text-text-primary">Historial de estados</h3>
          </div>

          {historial.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">
              No hay cambios de estado registrados.
            </p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

              <div className="space-y-4">
                {[...historial].reverse().map((item, index) => (
                  <div key={index} className="flex gap-4 relative">
                    {/* Dot */}
                    <div className="relative z-10 mt-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-action border-2 border-bg-card" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <EstadoBadge estado={item.estado_anterior} tipo="gestoria" size="sm" />
                        <span className="text-text-muted text-xs">&rarr;</span>
                        <EstadoBadge estado={item.estado_nuevo} tipo="gestoria" size="sm" />
                      </div>
                      <p className="text-xs text-text-muted mt-1">
                        {formatDateTime(item.fecha)}
                      </p>
                      {item.motivo && (
                        <p className="text-xs text-text-secondary mt-1 italic">
                          Motivo: {item.motivo}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ---- TAB: ACCIONES ---- */}
      {activeTab === 'acciones' && (
        <Card>
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="h-4 w-4 text-action" />
            <h3 className="text-sm font-semibold text-text-primary">Acciones disponibles</h3>
          </div>

          <div className="mb-6">
            <p className="text-xs text-text-muted mb-1">Estado actual</p>
            <EstadoBadge estado={estadoActual} tipo="gestoria" size="md" />
          </div>

          <div className="space-y-3">
            {/* ingresado → en_tramite */}
            {estadoActual === 'ingresado' && (
              <Button
                onClick={() => handleTransition('en_tramite')}
                loading={actualizarEstado.isPending}
                fullWidth
              >
                <Clock className="h-4 w-4" />
                Iniciar trámite
              </Button>
            )}

            {/* en_tramite → listo */}
            {estadoActual === 'en_tramite' && (
              <>
                <Button
                  variant="success"
                  onClick={() => handleTransition('listo')}
                  loading={actualizarEstado.isPending}
                  fullWidth
                >
                  <FileCheck className="h-4 w-4" />
                  Marcar listo para alistar
                </Button>

                <Button
                  variant="danger"
                  onClick={() => handleTransition('suspendido')}
                  loading={actualizarEstado.isPending}
                  fullWidth
                >
                  <AlertTriangle className="h-4 w-4" />
                  Suspender
                </Button>
              </>
            )}

            {/* suspendido → en_tramite */}
            {estadoActual === 'suspendido' && (
              <Button
                onClick={() => handleTransition('en_tramite')}
                loading={actualizarEstado.isPending}
                fullWidth
              >
                <Clock className="h-4 w-4" />
                Reactivar
              </Button>
            )}

            {/* listo / egresado → no actions */}
            {(estadoActual === 'listo' || estadoActual === 'egresado') && (
              <p className="text-sm text-text-muted text-center py-4">
                No hay acciones disponibles para el estado actual.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* ---- MODALS ---- */}

      {/* Confirm action (genérico) */}
      {confirmAction.requireMotivo ? (
        // Modal con motivo (para suspender)
        <ConfirmDialog
          open={confirmAction.open}
          onClose={() => setConfirmAction((prev) => ({ ...prev, open: false }))}
          onConfirm={() => executeTransition(confirmAction.nuevoEstado, motivoInput)}
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText="Confirmar"
          variant={confirmAction.variant}
          loading={actualizarEstado.isPending}
        />
      ) : (
        <ConfirmDialog
          open={confirmAction.open}
          onClose={() => setConfirmAction((prev) => ({ ...prev, open: false }))}
          onConfirm={() => executeTransition(confirmAction.nuevoEstado)}
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText="Confirmar"
          variant={confirmAction.variant}
          loading={actualizarEstado.isPending}
        />
      )}

      {/* Warning: documentación incompleta */}
      <ConfirmDialog
        open={warningDocModal}
        onClose={() => setWarningDocModal(false)}
        onConfirm={() => executeTransition('listo')}
        title="Documentación incompleta"
        message="Faltan documentos en el checklist. ¿Confirmar igualmente que el trámite está listo?"
        confirmText="Confirmar igualmente"
        variant="danger"
        loading={actualizarEstado.isPending}
      />
    </div>
  )
}
