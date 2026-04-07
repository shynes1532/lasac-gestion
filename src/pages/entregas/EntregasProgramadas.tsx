import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Truck, ExternalLink, MessageCircle, CheckCircle2, Pencil, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { COLORES_TIPO, TIPO_LABEL, SUCURSALES_SELECT, waConfirmacion2dRG, waConfirmacion2dUSH } from '../../lib/constants'
import type { TipoOperacion } from '../../lib/types'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'
import { notify } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'

interface EditableOp {
  id: string
  cliente_nombre: string | null
  cliente_telefono: string | null
  fecha_entrega_confirmada?: string
}

export function EntregasProgramadas() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filtroSucursal, setFiltroSucursal] = useState('todas')
  const [editingOp, setEditingOp] = useState<EditableOp | null>(null)
  const [confirmEntregada, setConfirmEntregada] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['entregas-programadas', filtroSucursal],
    queryFn: async () => {
      let q = supabase
        .from('operaciones')
        .select(`
          id, numero_operacion, cliente_nombre, cliente_telefono,
          sucursal, tipo_operacion, estado_actual, forma_pago,
          unidades (modelo),
          contactos_calidad (fecha_entrega_confirmada, estado_calidad)
        `)
        .in('estado_actual', ['calidad', 'entrega'])
        .order('created_at', { ascending: false })

      if (filtroSucursal !== 'todas') q = q.eq('sucursal', filtroSucursal)

      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  // Marcar como entregada (sin mandar WhatsApp)
  const marcarEntregada = useMutation({
    mutationFn: async (operacionId: string) => {
      const { error } = await supabase
        .from('operaciones')
        .update({
          estado_actual: 'entregado',
          unidad_entregada: true,
          fecha_entrega_real: new Date().toISOString().slice(0, 10),
        })
        .eq('id', operacionId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas-programadas'] })
      queryClient.invalidateQueries({ queryKey: ['operaciones'] })
      queryClient.invalidateQueries({ queryKey: ['operaciones-counts'] })
      notify.success('Operación marcada como entregada')
      setConfirmEntregada(null)
    },
    onError: (err: any) => {
      notify.error(err?.message || 'Error al marcar como entregada')
      setConfirmEntregada(null)
    },
  })

  // Guardar edición
  const guardarEdicion = useMutation({
    mutationFn: async (op: EditableOp) => {
      const { error } = await supabase
        .from('operaciones')
        .update({
          cliente_nombre: op.cliente_nombre,
          cliente_telefono: op.cliente_telefono,
        })
        .eq('id', op.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas-programadas'] })
      notify.success('Datos actualizados')
      setEditingOp(null)
    },
    onError: (err: any) => {
      notify.error(err?.message || 'Error al guardar cambios')
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Truck className="h-5 w-5" /> Entregas pendientes
          </h1>
          <p className="text-sm text-text-secondary">Operaciones con PDI aprobado, listas para coordinar la entrega al cliente</p>
        </div>
        <div className="flex gap-2">
          <select value={filtroSucursal} onChange={e => setFiltroSucursal(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-bg-secondary text-text-secondary focus:outline-none">
            <option value="todas">Todas las sucursales</option>
            {SUCURSALES_SELECT.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <LoadingSkeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : !data?.length ? (
        <EmptyState icon={<Truck className="h-12 w-12" />} title="Sin entregas programadas" description="No hay operaciones en Paso 5 o 6 actualmente" />
      ) : (
        <div className="space-y-3">
          {data.map(op => {
            const tipo = op.tipo_operacion as TipoOperacion
            const colores = COLORES_TIPO[tipo] || COLORES_TIPO['0km']
            const modelo = (op.unidades as any)?.[0]?.modelo || '—'
            const asesor = '—'
            const calidad = (op.contactos_calidad as any)?.[0]
            const fechaEntrega = calidad?.fecha_entrega_confirmada

            const waMsg = op.sucursal === 'Rio Grande'
              ? waConfirmacion2dRG(op.cliente_nombre || '', modelo, fechaEntrega || '—', '—', asesor)
              : waConfirmacion2dUSH(op.cliente_nombre || '', modelo, fechaEntrega || '—', '—', asesor)

            const waLink = `https://wa.me/${(op.cliente_telefono || '').replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}`

            return (
              <div key={op.id}
                className="bg-bg-secondary rounded-xl border border-border p-4 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex gap-3 min-w-0">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 h-fit mt-0.5"
                      style={{ backgroundColor: colores.bg, color: colores.text, border: `1px solid ${colores.border}` }}>
                      {TIPO_LABEL[tipo]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary">{op.cliente_nombre}</p>
                      <p className="text-sm text-text-secondary">{modelo}</p>
                      <p className="text-xs text-text-muted">{op.numero_operacion} · {op.sucursal} · {asesor}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {fechaEntrega ? (
                      <span className="text-sm font-semibold text-text-primary">{fechaEntrega}</span>
                    ) : (
                      <span className="text-xs text-text-muted">Sin fecha confirmada</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      op.estado_actual === 'entrega' ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {op.estado_actual === 'entrega' ? 'Paso 6' : 'Paso 5'}
                    </span>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {op.cliente_telefono && (
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          title="Mandar WhatsApp de confirmación"
                          className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors">
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingOp({
                            id: op.id,
                            cliente_nombre: op.cliente_nombre,
                            cliente_telefono: op.cliente_telefono,
                          })
                        }}
                        title="Editar datos"
                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmEntregada(op.id)
                        }}
                        title="Marcar como entregada"
                        className="px-2 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Entregada
                      </button>
                      <button onClick={() => navigate(`/operaciones/${op.id}`)}
                        title="Ver detalle completo"
                        className="p-1.5 text-text-muted hover:text-action transition-colors cursor-pointer">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de edición */}
      {editingOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-bg-secondary rounded-xl border border-border p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-text-primary">Editar datos del cliente</h3>
              <button
                onClick={() => setEditingOp(null)}
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Nombre del cliente</label>
                <input
                  type="text"
                  value={editingOp.cliente_nombre || ''}
                  onChange={e => setEditingOp({ ...editingOp, cliente_nombre: e.target.value })}
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/30"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Teléfono</label>
                <input
                  type="text"
                  value={editingOp.cliente_telefono || ''}
                  onChange={e => setEditingOp({ ...editingOp, cliente_telefono: e.target.value })}
                  placeholder="+54 9 ..."
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/30"
                />
              </div>
              <p className="text-xs text-text-muted pt-2">
                Para editar más datos (modelo, fecha, asesor, etc.) usá el detalle completo de la operación.
              </p>
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <Button variant="ghost" onClick={() => setEditingOp(null)}>Cancelar</Button>
              <Button
                onClick={() => guardarEdicion.mutate(editingOp)}
                loading={guardarEdicion.isPending}
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm marcar entregada */}
      {confirmEntregada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-bg-secondary rounded-xl border border-border p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-text-primary mb-2">¿Marcar como entregada?</h3>
            <p className="text-sm text-text-secondary mb-6">
              La operación pasará al estado <strong>Entregado</strong> y aparecerá en el Archivo de entregadas.
              No se enviará ningún mensaje al cliente.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setConfirmEntregada(null)}>Cancelar</Button>
              <Button
                onClick={() => marcarEntregada.mutate(confirmEntregada)}
                loading={marcarEntregada.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirmar entrega
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
