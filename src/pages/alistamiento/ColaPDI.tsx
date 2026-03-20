import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Clock, AlertTriangle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabaseAnon } from '../../lib/supabase'
import { Button, Select, EstadoBadge, Card, EmptyState, CardSkeleton, Badge } from '../../components/ui'
import { diasEntre } from '../../utils/formatters'

const estadoOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'observado', label: 'Observado' },
  { value: 'aprobado', label: 'Aprobado' },
  { value: 'rechazado', label: 'Rechazado' },
]

export function ColaPDI() {
  const navigate = useNavigate()
  const [estadoFiltro, setEstadoFiltro] = useState('')

  const { data: alistamientos, isLoading } = useQuery({
    queryKey: ['alistamiento', estadoFiltro],
    queryFn: async () => {
      let query = supabaseAnon
        .from('alistamiento_pdi')
        .select(`
          *,
          operacion:operaciones(
            id, numero_operacion, sucursal, tipo_operacion,
            unidad:unidades(*),
            titular:titulares(nombre_apellido)
          )
        `)
        .order('created_at', { ascending: true })

      if (estadoFiltro) {
        const aprobadoMap: Record<string, any> = {
          aprobado: true,
          rechazado: false,
        }
        if (estadoFiltro === 'aprobado' || estadoFiltro === 'rechazado') {
          query = query.eq('aprobado', aprobadoMap[estadoFiltro])
        } else if (estadoFiltro === 'pendiente') {
          query = query.is('fecha_inicio', null).is('aprobado', null)
        } else if (estadoFiltro === 'en_proceso') {
          query = query.not('fecha_inicio', 'is', null).is('aprobado', null)
        }
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })

  const getUrgencia = (createdAt: string) => {
    const dias = diasEntre(createdAt)
    if (dias > 5) return 'red'
    if (dias > 3) return 'yellow'
    return 'green'
  }

  const getEstadoPDI = (item: any): string => {
    if (item.aprobado === true) return 'aprobado'
    if (item.aprobado === false) return 'rechazado'
    if (item.fecha_inicio) return 'en_proceso'
    return 'pendiente'
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Alistamiento PDI</h1>
          <p className="text-sm text-text-secondary mt-1">
            {alistamientos?.filter(a => !a.aprobado && a.aprobado !== false).length || 0} unidades en cola
          </p>
        </div>
      </div>

      <div className="mb-6">
        <Select
          options={estadoOptions}
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : !alistamientos?.length ? (
        <EmptyState
          icon={<Wrench className="h-12 w-12" />}
          title="No hay unidades en cola"
          description="Las unidades aparecen acá cuando Gestoría las marca como listas"
        />
      ) : (
        <div className="space-y-3">
          {alistamientos.map((item: any) => {
            const op = item.operacion
            const unidad = op?.unidad?.[0]
            const titular = op?.titular?.[0]
            const estado = getEstadoPDI(item)
            const urgencia = getUrgencia(item.created_at)

            return (
              <Card
                key={item.id}
                hoverable
                onClick={() => navigate(`/alistamiento/${item.id}`)}
                className={urgencia === 'red' ? 'border-l-4 border-l-danger' : urgencia === 'yellow' ? 'border-l-4 border-l-warning' : ''}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-action">{op?.numero_operacion}</span>
                      <EstadoBadge estado={estado} tipo="alistamiento" />
                      {urgencia === 'red' && (
                        <Badge color="red" size="sm">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Urgente
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-text-primary">
                      {unidad?.modelo || 'Sin modelo'} — {unidad?.color || ''}
                    </p>
                    <p className="text-xs text-text-secondary">
                      VIN: ...{unidad?.vin_chasis?.slice(-6) || 'N/A'} | {titular?.nombre_apellido || 'Sin titular'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {diasEntre(item.created_at)} días en cola
                    </span>
                    {estado === 'pendiente' && (
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/alistamiento/${item.id}`) }}>
                        Iniciar PDI
                      </Button>
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
