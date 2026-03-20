import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, MessageCircle, CheckCircle, ClipboardCheck } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, supabaseAnon } from '../../lib/supabase'
import { Button, Card, EstadoBadge, Tabs, Textarea, ConfirmDialog, notify, Skeleton } from '../../components/ui'
import { formatDate } from '../../utils/formatters'

export function DetalleEntrega() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('info')
  const [confirmEntrega, setConfirmEntrega] = useState(false)
  const [csi, setCSI] = useState({ p1: 5, p2: 5, p3: 5, p4: 5, p5: 10, comentarios: '' })

  const { data: entrega, isLoading } = useQuery({
    queryKey: ['entrega', id],
    queryFn: async () => {
      const { data, error } = await supabaseAnon
        .from('entregas')
        .select(`
          *,
          operacion:operaciones(
            id, numero_operacion, sucursal, tipo_operacion,
            unidad:unidades(*),
            titular:titulares(*),
            alistamiento:alistamiento_pdi(aprobado, no_conformidades),
            encuesta:encuestas_csi(*)
          )
        `)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const confirmarEntrega = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('entregas')
        .update({ acto_entregado_at: new Date().toISOString() })
        .eq('id', id!)
      if (error) throw error

      if (entrega?.operacion) {
        await supabase
          .from('operaciones')
          .update({ estado_entrega: 'entregada' })
          .eq('id', (entrega.operacion as any).id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entrega', id] })
      notify.success('Entrega confirmada')
      setConfirmEntrega(false)
    },
  })

  const enviarCSI = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('encuestas_csi')
        .insert({
          operacion_id: (entrega?.operacion as any)?.id,
          fecha_envio: new Date().toISOString(),
          fecha_respuesta: new Date().toISOString(),
          p1_proceso_entrega: csi.p1,
          p2_atencion_asesor: csi.p2,
          p3_estado_unidad: csi.p3,
          p4_tiempo_espera: csi.p4,
          p5_nps: csi.p5,
          comentarios: csi.comentarios || null,
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entrega', id] })
      notify.success('Encuesta CSI registrada')
      // reset done
    },
  })

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>
  }

  if (!entrega) return <p className="text-text-secondary">Entrega no encontrada</p>

  const op = entrega.operacion as any
  const unidad = op?.unidad?.[0]
  const titular = op?.titular?.[0]
  const encuesta = op?.encuesta?.[0]
  const entregado = !!entrega.acto_entregado_at

  const tabs = [
    { id: 'info', label: 'Información' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'csi', label: 'Encuesta CSI' },
  ]

  const waTemplates = [
    {
      label: 'Confirmación de entrega',
      msg: `Hola ${titular?.nombre_apellido}! 👋 Te confirmamos la entrega de tu ${unidad?.modelo} ${unidad?.color} para el día ${formatDate(entrega.fecha_programada)} a las ${entrega.hora_programada?.slice(0,5) || ''} en nuestra sucursal de ${op?.sucursal}. Por favor traé: DNI original, comprobante de seguro vigente. ¡Te esperamos! 🚗 - Liendo Automotores`,
    },
    {
      label: 'Recordatorio 24hs',
      msg: `Hola ${titular?.nombre_apellido}! Te recordamos que mañana ${formatDate(entrega.fecha_programada)} a las ${entrega.hora_programada?.slice(0,5) || ''} es la entrega de tu ${unidad?.modelo}. Recordá traer: ✅ DNI original ✅ Comprobante de seguro vigente ✅ Forma de pago del saldo (si aplica). ¡Nos vemos! - Liendo Automotores ${op?.sucursal}`,
    },
    {
      label: 'Bienvenida post-entrega',
      msg: `¡Felicitaciones ${titular?.nombre_apellido}! 🎉 Ya sos parte de la familia FIAT. Tu ${unidad?.modelo} ${unidad?.color} ya es tuyo. ¡Disfrutá tu FIAT! 🚗 - Liendo Automotores`,
    },
    {
      label: 'Encuesta de satisfacción',
      msg: `Hola ${titular?.nombre_apellido}! Queremos saber cómo fue tu experiencia con la entrega de tu ${unidad?.modelo}. ¿Podés completar esta breve encuesta? Nos ayuda mucho a mejorar: https://docs.google.com/forms/d/e/1FAIpQLSdW-MGx5YdZ7yPYG28YSM0RB92URIc_4pZo_LBNVg-DFM5qTg/viewform ¡Muchas gracias! - Liendo Automotores`,
    },
    {
      label: 'Seguimiento T+7',
      msg: `Hola ${titular?.nombre_apellido}! Ya pasó una semana con tu ${unidad?.modelo}. ¿Cómo viene todo? ¿Alguna consulta sobre el vehículo? Estamos para ayudarte. - Liendo Automotores ${op?.sucursal}`,
    },
  ]

  const openWA = (msg: string) => {
    const phone = (titular?.telefono || '').replace(/\D/g, '')
    const finalPhone = phone.startsWith('549') ? phone : `549${phone}`
    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/entrega')} className="text-text-muted hover:text-text-primary cursor-pointer">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">{op?.numero_operacion}</h1>
            <EstadoBadge estado={entregado ? 'entregada' : 'programada'} tipo="entrega" size="md" />
          </div>
          <p className="text-sm text-text-secondary">
            {titular?.nombre_apellido} — {unidad?.modelo} {unidad?.color}
          </p>
        </div>
      </div>

      {/* Quick info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-text-muted" />
            <div>
              <p className="text-xs text-text-muted">Fecha</p>
              <p className="text-sm font-medium text-text-primary">{formatDate(entrega.fecha_programada)}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-text-muted" />
            <div>
              <p className="text-xs text-text-muted">Hora</p>
              <p className="text-sm font-medium text-text-primary">{entrega.hora_programada?.slice(0,5) || 'Sin definir'}</p>
            </div>
          </div>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Sucursal</p>
          <p className="text-sm font-medium text-text-primary">{op?.sucursal}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Tipo</p>
          <p className="text-sm font-medium text-text-primary">{op?.tipo_operacion}</p>
        </Card>
      </div>

      {!entregado && (
        <Button fullWidth size="lg" className="mb-6" onClick={() => setConfirmEntrega(true)}>
          <CheckCircle className="h-5 w-5" />
          Confirmar entrega realizada
        </Button>
      )}

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

      {activeTab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Titular</h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-text-muted">Nombre:</span> <span className="text-text-primary">{titular?.nombre_apellido}</span></p>
              <p><span className="text-text-muted">DNI:</span> <span className="text-text-primary">{titular?.dni_cuil}</span></p>
              <p><span className="text-text-muted">Teléfono:</span> <span className="text-text-primary">{titular?.telefono}</span></p>
              <p><span className="text-text-muted">Email:</span> <span className="text-text-primary">{titular?.email || '—'}</span></p>
              <p><span className="text-text-muted">Domicilio:</span> <span className="text-text-primary">{titular?.domicilio || '—'}</span></p>
            </div>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Unidad</h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-text-muted">Modelo:</span> <span className="text-text-primary">{unidad?.modelo}</span></p>
              <p><span className="text-text-muted">Color:</span> <span className="text-text-primary">{unidad?.color}</span></p>
              <p><span className="text-text-muted">VIN:</span> <span className="text-text-primary font-mono">{unidad?.vin_chasis}</span></p>
              <p><span className="text-text-muted">Patente:</span> <span className="text-text-primary">{unidad?.patente_nueva || unidad?.patente_actual || '—'}</span></p>
              <p><span className="text-text-muted">Año:</span> <span className="text-text-primary">{unidad?.anio || '—'}</span></p>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'whatsapp' && (
        <div className="space-y-3">
          {waTemplates.map((tpl, i) => (
            <Card key={i}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{tpl.label}</p>
                  <p className="text-xs text-text-muted mt-1 line-clamp-2">{tpl.msg}</p>
                </div>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => openWA(tpl.msg)}
                  className="ml-3 shrink-0"
                >
                  <MessageCircle className="h-4 w-4" />
                  Enviar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'csi' && (
        <div>
          {encuesta ? (
            <Card>
              <h3 className="text-sm font-semibold text-text-primary mb-3">Encuesta completada</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <p><span className="text-text-muted">Proceso entrega:</span> <span className="font-medium text-text-primary">{encuesta.p1_proceso_entrega}/5</span></p>
                <p><span className="text-text-muted">Atención asesor:</span> <span className="font-medium text-text-primary">{encuesta.p2_atencion_asesor}/5</span></p>
                <p><span className="text-text-muted">Estado unidad:</span> <span className="font-medium text-text-primary">{encuesta.p3_estado_unidad}/5</span></p>
                <p><span className="text-text-muted">Tiempo espera:</span> <span className="font-medium text-text-primary">{encuesta.p4_tiempo_espera}/5</span></p>
                <p><span className="text-text-muted">NPS:</span> <span className="font-medium text-text-primary">{encuesta.p5_nps}/10</span></p>
                <p><span className="text-text-muted">Promedio:</span> <span className={`font-bold ${encuesta.promedio >= 4 ? 'text-success' : 'text-danger'}`}>{encuesta.promedio?.toFixed(1)}</span></p>
              </div>
              {encuesta.comentarios && <p className="mt-3 text-sm text-text-secondary">"{encuesta.comentarios}"</p>}
            </Card>
          ) : (
            <Card>
              <h3 className="text-sm font-semibold text-text-primary mb-4">Registrar encuesta CSI</h3>
              <div className="space-y-4">
                {[
                  { key: 'p1', label: 'Proceso de entrega', max: 5 },
                  { key: 'p2', label: 'Atención del asesor', max: 5 },
                  { key: 'p3', label: 'Estado de la unidad', max: 5 },
                  { key: 'p4', label: 'Tiempo de espera', max: 5 },
                  { key: 'p5', label: 'NPS (recomendación)', max: 10 },
                ].map(({ key, label, max }) => (
                  <div key={key}>
                    <div className="flex justify-between mb-1">
                      <label className="text-sm text-text-secondary">{label}</label>
                      <span className="text-sm font-medium text-text-primary">{(csi as any)[key]}/{max}</span>
                    </div>
                    <input
                      type="range"
                      min={key === 'p5' ? 0 : 1}
                      max={max}
                      value={(csi as any)[key]}
                      onChange={(e) => setCSI({ ...csi, [key]: parseInt(e.target.value) })}
                      className="w-full accent-action"
                    />
                  </div>
                ))}
                <Textarea
                  label="Comentarios"
                  value={csi.comentarios}
                  onChange={(e) => setCSI({ ...csi, comentarios: e.target.value })}
                  placeholder="Comentarios adicionales del cliente..."
                />
                <Button fullWidth onClick={() => enviarCSI.mutate()} loading={enviarCSI.isPending}>
                  <ClipboardCheck className="h-4 w-4" />
                  Guardar encuesta
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmEntrega}
        onClose={() => setConfirmEntrega(false)}
        onConfirm={() => confirmarEntrega.mutate()}
        title="Confirmar entrega"
        message={`¿Confirmar que ${titular?.nombre_apellido} recibió su ${unidad?.modelo} ${unidad?.color}?`}
        confirmText="Confirmar entrega"
        loading={confirmarEntrega.isPending}
      />
    </div>
  )
}
