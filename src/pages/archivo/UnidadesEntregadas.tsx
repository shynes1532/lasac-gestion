import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { SearchInput, Select, Card, CardSkeleton, EmptyState } from '../../components/ui'
import { formatDate } from '../../utils/formatters'
import { Archive, Calendar, MapPin, ChevronDown, ChevronRight, Car, User, FileText } from 'lucide-react'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const sucursalOptions = [
  { value: '', label: 'Ambas sucursales' },
  { value: 'Ushuaia', label: 'Ushuaia' },
  { value: 'Rio Grande', label: 'Rio Grande' },
]

const tipoOptions = [
  { value: '', label: 'Todos los tipos' },
  { value: '0KM', label: '0KM' },
  { value: 'Plan de Ahorro', label: 'Plan de Ahorro' },
  { value: 'Usado', label: 'Usado' },
]

interface EntregadaRow {
  id: string
  numero_operacion: string
  sucursal: string
  tipo_operacion: string
  cliente_nombre: string | null
  fecha_entrega_real: string | null
  created_at: string
  titular: { nombre_apellido: string }[]
  unidad: { modelo: string; color: string; vin_chasis: string }[]
}

export function UnidadesEntregadas() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [sucursalFiltro, setSucursalFiltro] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const { data: entregadas = [], isLoading } = useQuery<EntregadaRow[]>({
    queryKey: ['unidades_entregadas', sucursalFiltro, tipoFiltro],
    queryFn: async () => {
      let query = supabase
        .from('operaciones')
        .select(`
          id, numero_operacion, sucursal, tipo_operacion, cliente_nombre,
          fecha_entrega_real, created_at,
          titular:titulares(nombre_apellido),
          unidad:unidades(modelo, color, vin_chasis)
        `)
        .eq('estado_actual', 'entregado')
        .eq('unidad_entregada', true)
        .eq('entrega_con_incidente', false)
        .order('fecha_entrega_real', { ascending: false })

      if (sucursalFiltro) query = query.eq('sucursal', sucursalFiltro)
      if (tipoFiltro) query = query.eq('tipo_operacion', tipoFiltro)

      const { data, error } = await query
      if (error) throw error
      return (data || []) as EntregadaRow[]
    },
    enabled: !!perfil,
  })

  // Filter by search
  const filtered = useMemo(() => {
    if (!busqueda) return entregadas
    const q = busqueda.toLowerCase()
    return entregadas.filter(op => {
      const titular = op.titular?.[0]?.nombre_apellido || op.cliente_nombre || ''
      const modelo = op.unidad?.[0]?.modelo || ''
      const vin = op.unidad?.[0]?.vin_chasis || ''
      return [op.numero_operacion, titular, modelo, vin].join(' ').toLowerCase().includes(q)
    })
  }, [entregadas, busqueda])

  // Group by year > month
  const grouped = useMemo(() => {
    const map: Record<string, Record<string, EntregadaRow[]>> = {}
    for (const op of filtered) {
      const fecha = op.fecha_entrega_real || op.created_at
      const d = new Date(fecha)
      const year = d.getFullYear().toString()
      const month = d.getMonth()
      if (!map[year]) map[year] = {}
      if (!map[year][month]) map[year][month] = []
      map[year][month].push(op)
    }
    // Sort years descending
    const sorted: { year: string; months: { month: number; items: EntregadaRow[] }[] }[] = []
    for (const year of Object.keys(map).sort((a, b) => +b - +a)) {
      const months = Object.keys(map[year])
        .map(Number)
        .sort((a, b) => b - a)
        .map(m => ({ month: m, items: map[year][m] }))
      sorted.push({ year, months })
    }
    return sorted
  }, [filtered])

  const toggle = (key: string) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Unidades Entregadas</h1>
          <p className="text-sm text-text-secondary mt-1">{filtered.length} unidades entregadas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por nro, nombre, modelo, VIN..."
        />
        <Select options={tipoOptions} value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} />
        {perfil?.rol === 'director' && (
          <Select options={sucursalOptions} value={sucursalFiltro} onChange={e => setSucursalFiltro(e.target.value)} />
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Archive className="h-12 w-12" />}
          title="No hay unidades entregadas"
          description="Las operaciones completadas aparecen aca automaticamente"
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(({ year, months }) => (
            <div key={year}>
              {/* Year header */}
              <button
                onClick={() => toggle(year)}
                className="flex items-center gap-2 mb-3 cursor-pointer group"
              >
                {collapsed[year]
                  ? <ChevronRight className="h-5 w-5 text-text-muted" />
                  : <ChevronDown className="h-5 w-5 text-text-muted" />
                }
                <h2 className="text-lg font-bold text-text-primary group-hover:text-action transition-colors">{year}</h2>
                <span className="text-sm text-text-muted">
                  ({months.reduce((sum, m) => sum + m.items.length, 0)})
                </span>
              </button>

              {!collapsed[year] && (
                <div className="space-y-3 ml-2">
                  {months.map(({ month, items }) => {
                    const monthKey = `${year}-${month}`
                    return (
                      <div key={monthKey}>
                        {/* Month header */}
                        <button
                          onClick={() => toggle(monthKey)}
                          className="flex items-center gap-2 mb-2 cursor-pointer group"
                        >
                          {collapsed[monthKey]
                            ? <ChevronRight className="h-4 w-4 text-text-muted" />
                            : <ChevronDown className="h-4 w-4 text-text-muted" />
                          }
                          <h3 className="text-sm font-semibold text-text-secondary group-hover:text-action transition-colors">
                            {MESES[month]}
                          </h3>
                          <span className="text-xs text-text-muted">({items.length})</span>
                        </button>

                        {!collapsed[monthKey] && (
                          <div className="space-y-2 ml-4">
                            {items.map(op => {
                              const titular = op.titular?.[0]?.nombre_apellido || op.cliente_nombre || 'Sin titular'
                              const unidad = op.unidad?.[0]
                              return (
                                <Card
                                  key={op.id}
                                  hoverable
                                  onClick={() => navigate(`/operaciones/${op.id}`)}
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <FileText className="h-3.5 w-3.5 text-action" />
                                        <span className="text-sm font-mono font-medium text-action">{op.numero_operacion}</span>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                          Entregada
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-sm text-text-primary">
                                        <User className="h-3.5 w-3.5 text-text-muted" />
                                        <span className="truncate">{titular}</span>
                                      </div>
                                      {unidad && (
                                        <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                                          <Car className="h-3.5 w-3.5 text-text-muted" />
                                          <span className="truncate">{unidad.modelo} {unidad.color ? `— ${unidad.color}` : ''}</span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                                      <span className="flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5" />
                                        {op.sucursal}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {formatDate(op.fecha_entrega_real || op.created_at)}
                                      </span>
                                      <span className="px-2 py-0.5 rounded bg-bg-tertiary">
                                        {op.tipo_operacion}
                                      </span>
                                    </div>
                                  </div>
                                </Card>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
