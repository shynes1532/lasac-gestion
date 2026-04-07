import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X, Minus, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Button, Card, EstadoBadge, Badge, Tabs, ProgressBar, Textarea, ConfirmDialog, notify, Skeleton } from '../../components/ui'
import type { ChecklistPDIItem, NoConformidad } from '../../lib/types'

export function DetallePDI() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('checklist')
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [confirmReject, setConfirmReject] = useState(false)
  const [ncForm, setNcForm] = useState<{ itemId: number; show: boolean }>({ itemId: 0, show: false })
  const [ncDesc, setNcDesc] = useState('')
  const [ncSeveridad, setNcSeveridad] = useState<'critica' | 'mayor' | 'menor'>('menor')

  const { data: pdi, isLoading } = useQuery({
    queryKey: ['pdi', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alistamiento_pdi')
        .select(`
          *,
          operacion:operaciones(
            id, numero_operacion, sucursal, cliente_nombre,
            unidad:unidades(*),
            titular:titulares(nombre_apellido, telefono)
          )
        `)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const updateChecklist = useMutation({
    mutationFn: async (updatedItems: ChecklistPDIItem[]) => {
      const { error } = await supabase
        .from('alistamiento_pdi')
        .update({
          checklist_pdi: { items: updatedItems },
          ...(pdi && !pdi.fecha_inicio ? { fecha_inicio: new Date().toISOString(), preparador_id: user!.id } : {}),
        })
        .eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pdi', id] }),
  })

  const aprobarPDI = useMutation({
    mutationFn: async (aprobado: boolean) => {
      const { error } = await supabase
        .from('alistamiento_pdi')
        .update({
          aprobado,
          aprobado_por: user!.id,
          fecha_fin: new Date().toISOString(),
        })
        .eq('id', id!)
      if (error) throw error

      if (aprobado && pdi?.operacion) {
        await supabase
          .from('operaciones')
          .update({ estado_alistamiento: 'aprobado', estado_actual: 'entrega' })
          .eq('id', pdi.operacion.id)
      } else if (!aprobado && pdi?.operacion) {
        await supabase
          .from('operaciones')
          .update({ estado_alistamiento: 'rechazado' })
          .eq('id', pdi.operacion.id)
      }
    },
    onSuccess: (_, aprobado) => {
      queryClient.invalidateQueries({ queryKey: ['pdi', id] })
      notify.success(aprobado ? 'PDI aprobado — unidad lista para entrega' : 'PDI rechazado')
      setConfirmApprove(false)
      setConfirmReject(false)
    },
  })

  const handleItemChange = useCallback((itemId: number, estado: 'OK' | 'No OK' | 'NA') => {
    const items: ChecklistPDIItem[] = pdi?.checklist_pdi?.items || []
    const updated = items.map((item) =>
      item.id === itemId
        ? { ...item, estado, validado_por: user!.id, validado_at: new Date().toISOString() }
        : item
    )
    updateChecklist.mutate(updated)

    if (estado === 'No OK') {
      setNcForm({ itemId, show: true })
    }
  }, [pdi, user, updateChecklist])

  const handleAddNC = useCallback(() => {
    if (!ncDesc.trim()) return
    const ncs: NoConformidad[] = pdi?.no_conformidades || []
    const newNC: NoConformidad = {
      id: ncs.length + 1,
      item_id: ncForm.itemId,
      descripcion: ncDesc,
      severidad: ncSeveridad,
      estado: 'abierta',
      foto_url: null,
      accion_requerida: '',
      responsable_id: null,
      fecha_limite: null,
      fecha_cierre: null,
      evidencia_cierre: null,
    }

    supabase
      .from('alistamiento_pdi')
      .update({ no_conformidades: [...ncs, newNC] })
      .eq('id', id!)
      .then(({ error }) => {
        if (error) { notify.error('Error al guardar NC'); return }
        queryClient.invalidateQueries({ queryKey: ['pdi', id] })
        notify.warning(`NC ${ncSeveridad} registrada`)
        setNcForm({ itemId: 0, show: false })
        setNcDesc('')
      })
  }, [pdi, ncForm, ncDesc, ncSeveridad, id, queryClient])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!pdi) return <p className="text-text-secondary">PDI no encontrado</p>

  const items: ChecklistPDIItem[] = pdi.checklist_pdi?.items || []
  const ncs: NoConformidad[] = pdi.no_conformidades || []
  const op = pdi.operacion as any
  const unidad = op?.unidad?.[0]
  const titular = op?.titular?.[0]
  const completados = items.filter((i) => i.estado !== null).length
  const okCount = items.filter((i) => i.estado === 'OK').length
  const noOkCount = items.filter((i) => i.estado === 'No OK').length
  const ncCriticas = ncs.filter((nc) => nc.severidad === 'critica' && nc.estado !== 'cerrada')
  const ncMayores = ncs.filter((nc) => nc.severidad === 'mayor' && nc.estado !== 'cerrada')

  const secciones = [...new Set(items.map((i) => i.seccion))]
  const estadoPDI = pdi.aprobado === true ? 'aprobado' : pdi.aprobado === false ? 'rechazado' : pdi.fecha_inicio ? 'en_proceso' : 'pendiente'

  const tabs = [
    { id: 'checklist', label: 'Checklist', count: items.length },
    { id: 'nc', label: 'No Conformidades', count: ncs.length },
    { id: 'resumen', label: 'Resumen' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/alistamiento')} className="text-text-muted hover:text-text-primary cursor-pointer">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">{unidad?.modelo || 'PDI'}</h1>
            <EstadoBadge estado={estadoPDI} tipo="alistamiento" size="md" />
          </div>
          <p className="text-sm text-text-secondary">
            VIN: {unidad?.vin_chasis || 'N/A'} | {unidad?.color} | {titular?.nombre_apellido || op?.cliente_nombre || 'Sin titular'}
          </p>
        </div>
      </div>

      {/* Botón rápido de aprobación — siempre disponible si el PDI no está aprobado */}
      {pdi.aprobado === null && (
        <button
          onClick={() => setConfirmApprove(true)}
          className="w-full mb-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-5 rounded-xl shadow-lg flex items-center justify-center gap-3 text-lg cursor-pointer transition-all active:scale-[0.98]"
        >
          <CheckCircle className="h-7 w-7" />
          PDI APROBADO — PASAR A ENTREGA
        </button>
      )}

      {/* Progress */}
      <ProgressBar value={completados} max={items.length} label="Progreso del PDI" className="mb-6" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-success/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-success">{okCount}</p>
          <p className="text-xs text-text-muted">OK</p>
        </div>
        <div className="bg-danger/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-danger">{noOkCount}</p>
          <p className="text-xs text-text-muted">No OK</p>
        </div>
        <div className="bg-bg-tertiary rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-text-primary">{items.length - completados}</p>
          <p className="text-xs text-text-muted">Pendientes</p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

      {/* Checklist Tab */}
      {activeTab === 'checklist' && (
        <div className="space-y-6">
          {secciones.map((seccion) => {
            const seccionItems = items.filter((i) => i.seccion === seccion)
            const seccionOK = seccionItems.filter((i) => i.estado === 'OK').length
            return (
              <Card key={seccion}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text-primary">{seccion}</h3>
                  <span className="text-xs text-text-muted">{seccionOK}/{seccionItems.length}</span>
                </div>
                <div className="space-y-2">
                  {seccionItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-text-primary">{item.item}</span>
                          {item.es_critico && <Badge color="red" size="sm">Crítico</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleItemChange(item.id, 'OK')}
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            item.estado === 'OK' ? 'bg-success text-white' : 'bg-bg-tertiary text-text-muted hover:bg-success/20'
                          }`}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleItemChange(item.id, 'No OK')}
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            item.estado === 'No OK' ? 'bg-danger text-white' : 'bg-bg-tertiary text-text-muted hover:bg-danger/20'
                          }`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleItemChange(item.id, 'NA')}
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            item.estado === 'NA' ? 'bg-blue-600 text-white' : 'bg-bg-tertiary text-text-muted hover:bg-blue-600/20'
                          }`}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* NC Tab */}
      {activeTab === 'nc' && (
        <div className="space-y-3">
          {ncs.length === 0 ? (
            <p className="text-center text-text-muted py-8">No hay no conformidades registradas</p>
          ) : (
            ncs.map((nc) => (
              <Card key={nc.id}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-lg ${
                    nc.severidad === 'critica' ? 'bg-danger/10' : nc.severidad === 'mayor' ? 'bg-warning/10' : 'bg-blue-600/10'
                  }`}>
                    <AlertTriangle className={`h-4 w-4 ${
                      nc.severidad === 'critica' ? 'text-danger' : nc.severidad === 'mayor' ? 'text-warning' : 'text-blue-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge color={nc.severidad === 'critica' ? 'red' : nc.severidad === 'mayor' ? 'yellow' : 'blue'}>
                        {nc.severidad}
                      </Badge>
                      <Badge color={nc.estado === 'cerrada' ? 'green' : nc.estado === 'en_proceso' ? 'yellow' : 'gray'}>
                        {nc.estado}
                      </Badge>
                    </div>
                    <p className="text-sm text-text-primary">{nc.descripcion}</p>
                    {nc.accion_requerida && (
                      <p className="text-xs text-text-muted mt-1">Acción: {nc.accion_requerida}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Resumen Tab */}
      {activeTab === 'resumen' && (
        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-text-primary mb-4">Resumen del PDI</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-text-muted">Total items:</span> <span className="text-text-primary font-medium">{items.length}</span></div>
              <div><span className="text-text-muted">Completados:</span> <span className="text-text-primary font-medium">{completados}</span></div>
              <div><span className="text-text-muted">OK:</span> <span className="text-success font-medium">{okCount}</span></div>
              <div><span className="text-text-muted">No OK:</span> <span className="text-danger font-medium">{noOkCount}</span></div>
              <div><span className="text-text-muted">N/A:</span> <span className="text-text-primary font-medium">{items.filter(i => i.estado === 'NA').length}</span></div>
              <div><span className="text-text-muted">NC abiertas:</span> <span className="text-warning font-medium">{ncs.filter(n => n.estado !== 'cerrada').length}</span></div>
            </div>
          </Card>

          {ncCriticas.length > 0 && (
            <div className="bg-danger/10 border border-danger/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-danger" />
                <span className="text-sm font-semibold text-danger">NC Críticas abiertas: {ncCriticas.length}</span>
              </div>
              <p className="text-sm text-text-secondary">Resolverlas antes de aprobar el PDI</p>
            </div>
          )}

          {ncMayores.length > 0 && ncCriticas.length === 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <span className="text-sm font-semibold text-warning">NC Mayores abiertas: {ncMayores.length}</span>
              </div>
              <p className="text-sm text-text-secondary">Se puede aprobar pero se pedirá confirmación</p>
            </div>
          )}

          {/* Botones de aprobación */}
          {pdi.aprobado === null && (
            <div className="flex gap-3">
              <Button
                variant="success"
                fullWidth
                onClick={() => setConfirmApprove(true)}
              >
                <CheckCircle className="h-4 w-4" />
                Aprobar PDI
              </Button>
              <Button
                variant="danger"
                fullWidth
                onClick={() => setConfirmReject(true)}
              >
                <XCircle className="h-4 w-4" />
                Rechazar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* NC Form inline */}
      {ncForm.show && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
          <Card className="w-full max-w-md">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Registrar No Conformidad</h3>
            <div className="space-y-3">
              <Textarea
                label="Descripción del problema"
                value={ncDesc}
                onChange={(e) => setNcDesc(e.target.value)}
                placeholder="Describí el problema encontrado..."
                required
              />
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Severidad</label>
                <div className="flex gap-2">
                  {(['menor', 'mayor', 'critica'] as const).map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setNcSeveridad(sev)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        ncSeveridad === sev
                          ? sev === 'critica' ? 'bg-danger text-white' : sev === 'mayor' ? 'bg-warning text-white' : 'bg-blue-600 text-white'
                          : 'bg-bg-tertiary text-text-secondary'
                      }`}
                    >
                      {sev.charAt(0).toUpperCase() + sev.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" fullWidth onClick={() => setNcForm({ itemId: 0, show: false })}>Cancelar</Button>
                <Button fullWidth onClick={handleAddNC} disabled={!ncDesc.trim()}>Registrar NC</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirmApprove}
        onClose={() => setConfirmApprove(false)}
        onConfirm={() => aprobarPDI.mutate(true)}
        title="Aprobar PDI"
        message="¿Confirmar aprobación del PDI? La unidad pasará inmediatamente al estado de Entrega."
        confirmText="Aprobar"
        loading={aprobarPDI.isPending}
      />

      <ConfirmDialog
        open={confirmReject}
        onClose={() => setConfirmReject(false)}
        onConfirm={() => aprobarPDI.mutate(false)}
        title="Rechazar PDI"
        message="¿Confirmar rechazo? Se notificará al director y gestor."
        confirmText="Rechazar"
        variant="danger"
        loading={aprobarPDI.isPending}
      />
    </div>
  )
}
