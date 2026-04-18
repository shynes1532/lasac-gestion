import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Clock, AlertTriangle, Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button, Select, EstadoBadge, Card, EmptyState, CardSkeleton, Badge } from '../../components/ui'
import { COLORES_TIPO, TIPO_LABEL } from '../../lib/constants'
import type { TipoOperacion } from '../../lib/types'
import { diasEntre } from '../../utils/formatters'

const estadoOptions = [
  { value: 'en_cola', label: 'En cola (pendientes + en proceso)' },
  { value: 'pendiente', label: 'Solo pendientes' },
  { value: 'en_proceso', label: 'Solo en proceso' },
  { value: 'aprobado', label: 'Aprobados' },
  { value: 'rechazado', label: 'Rechazados' },
  { value: '', label: 'Todos (incluye aprobados y rechazados)' },
]

export function ColaPDI() {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  // Por defecto: solo lo que está en cola (no muestra aprobados ni rechazados)
  const [estadoFiltro, setEstadoFiltro] = useState('en_cola')

  const { data: alistamientos, isLoading } = useQuery({
    queryKey: ['alistamiento', estadoFiltro],
    queryFn: async () => {
      let query = supabase
        .from('alistamiento_pdi')
        .select(`
          *,
          operacion:operaciones(
            id, numero_operacion, sucursal, tipo_operacion, cliente_nombre, dominio_patente,
            unidad:unidades(*),
            titular:titulares(nombre_apellido)
          )
        `)
        .order('created_at', { ascending: true })

      if (estadoFiltro === 'en_cola') {
        // Pendientes + en proceso (excluye aprobados y rechazados)
        query = query.is('aprobado', null)
      } else if (estadoFiltro === 'pendiente') {
        query = query.is('fecha_inicio', null).is('aprobado', null)
      } else if (estadoFiltro === 'en_proceso') {
        query = query.not('fecha_inicio', 'is', null).is('aprobado', null)
      } else if (estadoFiltro === 'aprobado') {
        query = query.eq('aprobado', true)
      } else if (estadoFiltro === 'rechazado') {
        query = query.eq('aprobado', false)
      }
      // Si estadoFiltro === '' → no filtra, trae todos

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })

  // Filtrar por búsqueda (nombre, apellido, dominio, chasis, modelo)
  const filtrados = useMemo(() => {
    if (!alistamientos) return []
    if (!busqueda.trim()) return alistamientos
    const b = busqueda.toLowerCase()
    return alistamientos.filter((item: any) => {
      const op = item.operacion
      const unidad = op?.unidad?.[0]
      const titular = op?.titular?.[0]
      return [
        op?.cliente_nombre,
        titular?.nombre_apellido,
        unidad?.modelo,
        unidad?.vin_chasis,
        unidad?.patente_actual,
        op?.dominio_patente,
        op?.numero_operacion,
      ].filter(Boolean).join(' ').toLowerCase().includes(b)
    })
  }, [alistamientos, busqueda])

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

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por nombre, patente, chasis, modelo..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-action/30"
          />
        </div>
        <Select
          options={estadoOptions}
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          className="max-w-[200px]"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : !filtrados.length ? (
        <EmptyState
          icon={<Wrench className="h-12 w-12" />}
          title="No hay unidades en cola"
          description="Las unidades aparecen acá cuando Gestoría las marca como listas"
        />
      ) : (
        <div className="space-y-3">
          {filtrados.map((item: any) => {
            const op = item.operacion
            const unidad = op?.unidad?.[0]
            const titular = op?.titular?.[0]
            const estado = getEstadoPDI(item)
            const urgencia = getUrgencia(item.created_at)
            const tipo = (op?.tipo_operacion || '0km') as TipoOperacion
            const colores = COLORES_TIPO[tipo] || COLORES_TIPO['0km']

            return (
              <Card
                key={item.id}
                hoverable
                onClick={() => navigate(`/alistamiento/${item.id}`)}
                className={`border-l-4 ${
                  urgencia === 'red' ? 'border-l-red-500'
                  : urgencia === 'yellow' ? 'border-l-yellow-400'
                  : 'border-l-green-500'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ backgroundColor: colores.bg, color: colores.text, border: `1px solid ${colores.border}` }}
                      >
                        {TIPO_LABEL[tipo]}
                      </span>
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
                      VIN: ...{unidad?.vin_chasis?.slice(-6) || 'N/A'} | {titular?.nombre_apellido || op?.cliente_nombre || 'Sin titular'}
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
