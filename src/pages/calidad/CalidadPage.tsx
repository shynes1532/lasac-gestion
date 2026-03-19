import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'

export function CalidadPage() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['calidad-lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operaciones')
        .select(`
          id, numero_operacion, cliente_nombre, sucursal, tipo_operacion,
          fecha_compromiso, estado_actual,
          unidades (modelo),
          contactos_calidad (
            estado_calidad, contacto_2d_antes, cliente_confirmo,
            fecha_entrega_confirmada, carta_enviada, satisfaccion, alerta_gpv
          )
        `)
        .eq('estado_actual', 'calidad')
        .order('fecha_compromiso', { ascending: true })
      if (error) throw error
      return data || []
    },
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Calidad y Contacto
        </h1>
        <p className="text-sm text-text-secondary">Operaciones en Paso 5 — seguimiento SOS Stellantis</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <LoadingSkeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : !data?.length ? (
        <EmptyState icon={<ShieldCheck className="h-12 w-12" />} title="Sin operaciones en calidad" description="No hay operaciones en Paso 5 actualmente" />
      ) : (
        <div className="space-y-3">
          {data.map(op => {
            const calidad = (op.contactos_calidad as any)?.[0]
            const modelo = (op.unidades as any)?.[0]?.modelo || '—'
            const estadoCal = calidad?.estado_calidad || 'citar_2d'
            const alerta = calidad?.alerta_gpv

            return (
              <div key={op.id}
                className={`bg-bg-secondary rounded-xl border p-4 cursor-pointer hover:shadow-sm transition-all ${alerta ? 'border-red-400' : 'border-border'}`}
                onClick={() => navigate(`/operaciones/${op.id}`)}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">{op.numero_operacion}</span>
                      {alerta && <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-medium">⚠️ GPV</span>}
                    </div>
                    <p className="text-sm text-text-secondary">{op.cliente_nombre} — {modelo}</p>
                    <p className="text-xs text-text-muted">{op.sucursal}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                      {estadoCal === 'citar_2d' ? '📞 Citar 2d' :
                       estadoCal === 'confirmar_1h' ? '⏰ Confirmar 1h' :
                       estadoCal === 'entregado' ? '📬 Carta' :
                       estadoCal === 'post_2d' ? '📋 Post 2d' : '✅ Cerrado'}
                    </span>
                    {calidad?.fecha_entrega_confirmada && (
                      <span className="text-xs text-text-muted">Entrega: {calidad.fecha_entrega_confirmada}</span>
                    )}
                    {calidad?.satisfaccion === 'insatisfecho' && (
                      <span className="text-xs text-red-600 font-medium">😞 Insatisfecho</span>
                    )}
                    <ExternalLink className="h-3.5 w-3.5 text-text-muted mt-1" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
