import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck, Calendar, MessageCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Select, EstadoBadge, Card, EmptyState, CardSkeleton, Badge } from '../../components/ui'
import { formatDate } from '../../utils/formatters'

const estadoOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'programada', label: 'Programada' },
  { value: 'entregada', label: 'Entregada' },
  { value: 'cerrada', label: 'Cerrada' },
]

export function ListaEntregas() {
  const navigate = useNavigate()
  const [estadoFiltro, setEstadoFiltro] = useState('')

  const { data: entregas, isLoading } = useQuery({
    queryKey: ['entregas', estadoFiltro],
    queryFn: async () => {
      let query = supabase
        .from('entregas')
        .select(`
          *,
          operacion:operaciones(
            id, numero_operacion, sucursal, cliente_nombre,
            unidad:unidades(modelo, color, vin_chasis),
            titular:titulares(nombre_apellido, telefono)
          )
        `)
        .order('fecha_programada', { ascending: true })

      if (estadoFiltro) {
        if (estadoFiltro === 'entregada') {
          query = query.not('acto_entregado_at', 'is', null)
        } else if (estadoFiltro === 'programada') {
          query = query.not('fecha_programada', 'is', null).is('acto_entregado_at', null)
        } else if (estadoFiltro === 'pendiente') {
          query = query.is('acto_entregado_at', null)
        }
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })

  const getEstadoEntrega = (entrega: any): string => {
    if (entrega.acto_entregado_at) return 'entregada'
    if (entrega.fecha_programada) return 'programada'
    return 'pendiente'
  }

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0]
    return dateStr === today
  }

  const isTomorrow = (dateStr: string) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return dateStr === tomorrow.toISOString().split('T')[0]
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Entregas</h1>
          <p className="text-sm text-text-secondary mt-1">
            {entregas?.filter(e => !e.acto_entregado_at).length || 0} entregas pendientes
          </p>
        </div>
      </div>

      <div className="mb-6">
        <Select options={estadoOptions} value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="max-w-xs" />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : !entregas?.length ? (
        <EmptyState
          icon={<Truck className="h-12 w-12" />}
          title="No hay entregas"
          description="Las entregas se crean al aprobar el PDI"
        />
      ) : (
        <div className="space-y-3">
          {entregas.map((entrega: any) => {
            const op = entrega.operacion
            const unidad = op?.unidad?.[0]
            const titular = op?.titular?.[0]
            const estado = getEstadoEntrega(entrega)

            return (
              <Card
                key={entrega.id}
                hoverable
                onClick={() => navigate(`/entrega/${entrega.id}`)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-action">{op?.numero_operacion}</span>
                      <EstadoBadge estado={estado} tipo="entrega" />
                      {isToday(entrega.fecha_programada) && <Badge color="green" size="sm">Hoy</Badge>}
                      {isTomorrow(entrega.fecha_programada) && <Badge color="yellow" size="sm">Mañana</Badge>}
                    </div>
                    <p className="text-sm font-medium text-text-primary">
                      {titular?.nombre_apellido || op?.cliente_nombre || 'Sin titular'}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {unidad?.modelo || ''} — {unidad?.color || ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(entrega.fecha_programada)}
                      {entrega.hora_programada && ` ${entrega.hora_programada.slice(0, 5)}`}
                    </span>
                    {titular?.telefono && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const phone = titular.telefono.replace(/\D/g, '')
                          window.open(`https://wa.me/${phone}`, '_blank')
                        }}
                        className="p-2 rounded-lg bg-success/10 text-success hover:bg-success/20 cursor-pointer"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
