import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Calendar, MapPin } from 'lucide-react'
import { useOperaciones } from '../../hooks/useOperaciones'
import { useAuth } from '../../context/AuthContext'
import { Button, SearchInput, Select, EstadoBadge, Card, EmptyState, CardSkeleton } from '../../components/ui'
import { formatDate, diasEntre } from '../../utils/formatters'

const estadoOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'ingresado', label: 'Ingresado' },
  { value: 'en_tramite', label: 'En trámite' },
  { value: 'listo', label: 'Listo' },
  { value: 'egresado', label: 'Egresado' },
  { value: 'suspendido', label: 'Suspendido' },
]

const tipoOptions = [
  { value: '', label: 'Todos los tipos' },
  { value: '0KM', label: '0KM' },
  { value: 'Plan de Ahorro', label: 'Plan de Ahorro' },
  { value: 'Usado', label: 'Usado' },
]

const sucursalOptions = [
  { value: '', label: 'Ambas sucursales' },
  { value: 'Ushuaia', label: 'Ushuaia' },
  { value: 'Rio Grande', label: 'Río Grande' },
]

export function ListaOperaciones() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [sucursalFiltro, setSucursalFiltro] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useOperaciones({
    busqueda,
    estado_gestoria: estadoFiltro || undefined,
    tipo_operacion: tipoFiltro || undefined,
    sucursal: sucursalFiltro || undefined,
    page,
  })

  const operaciones = data?.data || []
  const total = data?.count || 0

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Gestoría</h1>
          <p className="text-sm text-text-secondary mt-1">{total} operaciones</p>
        </div>
        {(perfil?.rol === 'director' || perfil?.rol === 'gestor') && (
          <Button onClick={() => navigate('/gestoria/nueva')}>
            <Plus className="h-4 w-4" />
            Nueva operación
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por nro, nombre, DNI, VIN..."
        />
        <Select options={estadoOptions} value={estadoFiltro} onChange={(e) => { setEstadoFiltro(e.target.value); setPage(1) }} />
        <Select options={tipoOptions} value={tipoFiltro} onChange={(e) => { setTipoFiltro(e.target.value); setPage(1) }} />
        {perfil?.rol === 'director' && (
          <Select options={sucursalOptions} value={sucursalFiltro} onChange={(e) => { setSucursalFiltro(e.target.value); setPage(1) }} />
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : operaciones.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="No hay operaciones"
          description="Creá una nueva operación para comenzar"
          actionLabel="Nueva operación"
          onAction={() => navigate('/gestoria/nueva')}
        />
      ) : (
        <div className="space-y-3">
          {operaciones.map((op) => (
            <Card
              key={op.id}
              hoverable
              onClick={() => navigate(`/gestoria/${op.id}`)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono font-medium text-action">{op.numero_operacion}</span>
                    <EstadoBadge estado={op.estado_gestoria} tipo="gestoria" />
                  </div>
                  <p className="text-sm font-medium text-text-primary truncate">
                    {(op as any).titular?.[0]?.nombre_apellido || 'Sin titular'}
                  </p>
                  <p className="text-sm text-text-secondary truncate">
                    {(op as any).unidad?.[0]?.modelo || 'Sin unidad'} — {(op as any).unidad?.[0]?.color || ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {op.sucursal}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(op.created_at)}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-bg-tertiary">
                    {diasEntre(op.created_at)} días
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Paginación simple */}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span className="px-3 py-1.5 text-sm text-text-secondary">
            Página {page} de {Math.ceil(total / 20)}
          </span>
          <Button variant="ghost" size="sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>
            Siguiente
          </Button>
        </div>
      )}
    </div>
  )
}
