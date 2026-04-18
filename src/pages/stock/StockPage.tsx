import { useState, useMemo, useEffect } from 'react'
import { Car, Plus, Search, X, ArrowRightLeft, Pencil, Trash2, ChevronDown, ChevronUp, AlertTriangle, Clock, CheckCircle, ArrowRight } from 'lucide-react'
import { useStock, useCrearStock, useActualizarStock, useTransferirStock, useEliminarStock } from '../../hooks/useStock'
import { supabase } from '../../lib/supabase'
import { Button, Card, EmptyState, CardSkeleton, Badge, Modal, ConfirmDialog, notify } from '../../components/ui'
import { diasEntre } from '../../utils/formatters'
import type { TipoStock, EstadoStock, Sucursal, StockVehiculo } from '../../lib/types'

const TIPO_COLORES: Record<TipoStock, { bg: string; text: string; label: string }> = {
  '0km':         { bg: '#dbeafe', text: '#1d4ed8', label: '0KM' },
  'plan_ahorro': { bg: '#fef3c7', text: '#92400e', label: 'Plan Ahorro' },
  'usado':       { bg: '#e0e7ff', text: '#4338ca', label: 'Usado' },
}

const ESTADO_COLORES: Record<EstadoStock, { color: 'green' | 'yellow' | 'red' | 'blue' | 'gray'; label: string }> = {
  'disponible':  { color: 'green',  label: 'Disponible' },
  'reservado':   { color: 'yellow', label: 'Reservado' },
  'vendido':     { color: 'gray',   label: 'Vendido' },
  'en_transito': { color: 'blue',   label: 'En tránsito' },
  'batea':       { color: 'yellow', label: 'Batea' },
}

const SUCURSALES: Sucursal[] = ['Ushuaia', 'Rio Grande', 'Austral']

const COLORES_FIAT = [
  'Blanco Alaska',
  'Blanco Banchisa',
  'Blanco Gelato',
  'Negro Vulcano',
  'Negro Cinema',
  'Gris Silverstone',
  'Gris Colosseo',
  'Gris Scandium',
  'Gris Strato',
  'Plata Bari',
  'Plata Minimal',
  'Rojo Montecarlo',
  'Rojo Passione',
  'Rojo Solidale',
  'Azul Portofino',
  'Azul Italia',
  'Azul Venezia',
  'Azul Provenza',
  'Verde Toscana',
  'Verde Technogreen',
  'Bronce Magnetico',
  'Marrón Castoro',
  'Amarillo Modena',
  'Naranja Sicilia',
  'Beige Cappuccino',
]

function getColorAntiguedad(dias: number): 'green' | 'yellow' | 'red' {
  if (dias > 30) return 'red'
  if (dias > 15) return 'yellow'
  return 'green'
}

const BORDER_ANTIGUEDAD = {
  green: 'border-l-green-500',
  yellow: 'border-l-yellow-400',
  red: 'border-l-red-500',
}

export function StockPage() {
  const [busqueda, setBusqueda] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<TipoStock | ''>('')
  const [sucursalFiltro, setSucursalFiltro] = useState<Sucursal | 'todas'>('todas')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoStock | ''>('disponible')
  const [showBateaForm, setShowBateaForm] = useState(false)
  const [showStockForm, setShowStockForm] = useState(false)
  const [editando, setEditando] = useState<StockVehiculo | null>(null)
  const [pasarAStock, setPasarAStock] = useState<StockVehiculo | null>(null)
  const [showTransferir, setShowTransferir] = useState<StockVehiculo | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)

  const eliminarMut = useEliminarStock()
  const actualizarMut = useActualizarStock()

  // Batea — siempre se carga independiente
  const { data: batea, isLoading: loadingBatea } = useStock({ estado: 'batea', sucursal: sucursalFiltro })

  // Stock — excluye batea
  const { data: stock, isLoading: loadingStock } = useStock({
    busqueda: busqueda.trim(),
    tipo: tipoFiltro,
    sucursal: sucursalFiltro,
    estado: estadoFiltro || undefined,
    excluirBatea: true,
  })

  // KPIs del stock (sin batea)
  const kpis = useMemo(() => {
    if (!stock) return { total: 0, ushuaia: 0, rioGrande: 0, austral: 0, conIncidente: 0 }
    return {
      total: stock.length,
      ushuaia: stock.filter(s => s.sucursal === 'Ushuaia').length,
      rioGrande: stock.filter(s => s.sucursal === 'Rio Grande').length,
      austral: stock.filter(s => s.sucursal === 'Austral').length,
      conIncidente: stock.filter(s => !!s.incidente).length,
    }
  }, [stock])

  return (
    <div className="space-y-8">

      {/* ════════════════════════════════════════════════════════════
          SECCIÓN 1: BATEA — Descarga de unidades
          ════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            <div>
              <h2 className="text-xl font-bold text-text-primary">Batea</h2>
              <p className="text-xs text-text-muted">Unidades descargadas pendientes de control</p>
            </div>
            {batea && batea.length > 0 && (
              <Badge color="yellow" size="sm">{batea.length}</Badge>
            )}
          </div>
          <Button onClick={() => { setEditando(null); setShowBateaForm(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Ingresar a Batea
          </Button>
        </div>

        {loadingBatea ? (
          <div className="space-y-2">
            {[1, 2].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : !batea?.length ? (
          <div className="border-2 border-dashed border-amber-500/30 rounded-xl p-6 text-center bg-amber-500/5">
            <Car className="h-10 w-10 text-amber-500/50 mx-auto mb-2" />
            <p className="text-sm text-text-muted">No hay unidades en batea</p>
            <p className="text-xs text-text-muted mt-1">Ingresá una unidad cuando llegue la batea</p>
          </div>
        ) : (
          <div className="space-y-2 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
            {batea.map(v => {
              const tipoCfg = TIPO_COLORES[v.tipo]
              const dias = diasEntre(v.created_at)
              const tieneIncidente = !!v.incidente
              return (
                <div
                  key={v.id}
                  className={`p-3 rounded-lg border transition-all ${
                    tieneIncidente
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-bg-primary border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ backgroundColor: tipoCfg.bg, color: tipoCfg.text }}
                        >
                          {tipoCfg.label}
                        </span>
                        <span className="text-[10px] text-text-muted">{v.sucursal}</span>
                        {tieneIncidente && (
                          <Badge color="red" size="sm">
                            <AlertTriangle className="h-3 w-3 mr-1" />Incidente
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-bold text-text-primary">
                        {v.marca} {v.modelo} {v.color ? `· ${v.color}` : ''}
                      </p>
                      <p className="text-xs text-text-muted">
                        VIN: ...{v.vin.slice(-6)}
                        {v.patente ? ` · ${v.patente}` : ''}
                        {v.titular_plan ? ` · ${v.titular_plan}` : ''}
                      </p>
                      {tieneIncidente && (
                        <p className="text-xs text-red-500 font-medium mt-0.5">{v.incidente}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs font-bold ${dias > 3 ? 'text-red-500' : dias > 1 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {dias}d
                      </span>
                      <p className="text-[10px] text-text-muted">en batea</p>
                    </div>
                  </div>
                  {/* Acciones batea */}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Button size="sm" variant="success" onClick={() => setPasarAStock(v)}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Pasar a Stock
                    </Button>
                    {tieneIncidente && (
                      <Button size="sm" variant="danger" onClick={() => {
                        // Enviar a Calibre: marcar incidente y cambiar estado
                        actualizarMut.mutate({ id: v.id, estado: 'disponible' as EstadoStock, observaciones: `[CALIBRE] ${v.incidente}${v.observaciones ? ' | ' + v.observaciones : ''}` }, {
                          onSuccess: () => notify.success('Enviado a Calibre con el incidente registrado'),
                          onError: (e: any) => notify.error(e.message),
                        })
                      }}>
                        <AlertTriangle className="h-3 w-3 mr-1" /> Enviar a Calibre
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => { setEditando(v); setShowBateaForm(true) }}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setConfirmarEliminar(v.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Separador */}
      <hr className="border-border" />

      {/* ════════════════════════════════════════════════════════════
          SECCIÓN 2: STOCK — Unidades controladas
          ════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Stock</h2>
            <p className="text-sm text-text-secondary mt-1">
              {kpis.total} vehículos en stock
              {kpis.conIncidente > 0 && (
                <span className="text-red-500 font-semibold ml-2">· {kpis.conIncidente} con incidente</span>
              )}
            </p>
          </div>
          <Button onClick={() => { setEditando(null); setShowStockForm(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Agregar directo
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Total', value: kpis.total, emoji: '🚗' },
            { label: 'Ushuaia', value: kpis.ushuaia, emoji: '🏔️' },
            { label: 'Río Grande', value: kpis.rioGrande, emoji: '🏭' },
            { label: 'Austral', value: kpis.austral, emoji: '🏢' },
          ].map(k => (
            <Card key={k.label} className="p-3 text-center">
              <span className="text-lg">{k.emoji}</span>
              <p className="text-xl font-bold text-text-primary">{k.value}</p>
              <p className="text-[10px] text-text-muted">{k.label}</p>
            </Card>
          ))}
        </div>

        {/* Filtros */}
        <div className="space-y-3 mb-6">
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: '' as const, label: 'Todos' },
              { value: '0km' as const, label: '0KM' },
              { value: 'plan_ahorro' as const, label: 'Plan' },
              { value: 'usado' as const, label: 'Usados' },
            ].map(t => (
              <button
                key={t.value}
                onClick={() => setTipoFiltro(t.value)}
                className={`py-2 rounded-xl text-center cursor-pointer transition-all text-sm ${
                  tipoFiltro === t.value
                    ? 'bg-action text-white font-bold'
                    : 'bg-bg-secondary border border-border text-text-secondary hover:border-action/30'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { value: 'todas' as const, label: 'Todas', emoji: '📋' },
              { value: 'Ushuaia' as const, label: 'Ushuaia', emoji: '🏔️' },
              { value: 'Rio Grande' as const, label: 'Río Grande', emoji: '🏭' },
              { value: 'Austral' as const, label: 'Austral', emoji: '🏢' },
            ].map(s => (
              <button
                key={s.value}
                onClick={() => setSucursalFiltro(s.value)}
                className={`py-2 rounded-xl text-center cursor-pointer transition-all text-sm ${
                  sucursalFiltro === s.value
                    ? 'bg-action text-white font-bold'
                    : 'bg-bg-secondary border border-border text-text-secondary hover:border-action/30'
                }`}
              >
                <span>{s.emoji}</span>
                <p className="text-xs mt-0.5">{s.label}</p>
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar por VIN, modelo, patente, titular..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-3 py-3 text-base bg-bg-primary border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-action/30"
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <select
            value={estadoFiltro}
            onChange={e => setEstadoFiltro(e.target.value as EstadoStock | '')}
            className="w-full py-2 px-3 bg-bg-primary border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/30"
          >
            <option value="">Todos los estados</option>
            <option value="disponible">Disponible</option>
            <option value="reservado">Reservado</option>
            <option value="en_transito">En tránsito</option>
            <option value="vendido">Vendido</option>
          </select>
        </div>

        {/* Lista stock */}
        {loadingStock ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : !stock?.length ? (
          <EmptyState
            icon={<Car className="h-12 w-12" />}
            title="Sin vehículos en stock"
            description="Los vehículos pasan acá cuando se controlan en la batea"
          />
        ) : (
          <div className="space-y-3">
            {stock.map(v => {
              const tipoCfg = TIPO_COLORES[v.tipo]
              const estadoCfg = ESTADO_COLORES[v.estado] || ESTADO_COLORES.disponible
              const isExpanded = expandido === v.id
              const dias = diasEntre(v.created_at)
              const colorDias = getColorAntiguedad(dias)
              const tieneIncidente = !!v.incidente

              return (
                <Card
                  key={v.id}
                  className={`overflow-hidden border-l-4 ${
                    tieneIncidente ? 'border-l-red-500 bg-red-500/5' : BORDER_ANTIGUEDAD[colorDias]
                  }`}
                >
                  <button
                    onClick={() => setExpandido(isExpanded ? null : v.id)}
                    className="w-full text-left p-4 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ backgroundColor: tipoCfg.bg, color: tipoCfg.text }}
                          >
                            {tipoCfg.label}
                          </span>
                          <Badge color={estadoCfg.color} size="sm">{estadoCfg.label}</Badge>
                          <span className="text-[10px] text-text-muted">{v.sucursal}</span>
                          {tieneIncidente && (
                            <Badge color="red" size="sm">
                              <AlertTriangle className="h-3 w-3 mr-1" />Incidente
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-bold text-text-primary">
                          {v.marca} {v.modelo} {v.version || ''} {v.anio ? `(${v.anio})` : ''}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {v.color ? `${v.color} · ` : ''}VIN: ...{v.vin.slice(-6)}
                          {v.patente ? ` · ${v.patente}` : ''}
                        </p>
                        {tieneIncidente && (
                          <p className="text-xs text-red-500 font-medium mt-0.5">{v.incidente}</p>
                        )}
                        {v.titular_plan && (
                          <p className="text-xs text-text-muted mt-0.5">
                            Titular: {v.titular_plan} {v.grupo_orden ? `· G/O: ${v.grupo_orden}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`flex items-center gap-1 text-xs font-medium ${
                          colorDias === 'red' ? 'text-red-500' : colorDias === 'yellow' ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          <Clock className="h-3 w-3" />{dias}d
                        </span>
                        {v.precio && (
                          <span className="text-xs font-mono text-text-secondary">${v.precio.toLocaleString('es-AR')}</span>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-border space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                        <div><span className="text-text-muted">VIN:</span> <span className="font-mono text-text-primary">{v.vin}</span></div>
                        <div><span className="text-text-muted">Sucursal:</span> <span className="text-text-primary">{v.sucursal}</span></div>
                        <div><span className="text-text-muted">Antigüedad:</span> <span className="text-text-primary">{dias} días</span></div>
                        {v.kilometraje != null && (
                          <div><span className="text-text-muted">Km:</span> <span className="text-text-primary">{v.kilometraje.toLocaleString('es-AR')}</span></div>
                        )}
                        {v.patente && (
                          <div><span className="text-text-muted">Patente:</span> <span className="text-text-primary">{v.patente}</span></div>
                        )}
                        {v.operacion_id && (
                          <div className="col-span-2"><span className="text-text-muted">Operación:</span> <span className="text-action font-mono">{(v as any).operacion?.numero_operacion || v.operacion_id.slice(0, 8)}</span></div>
                        )}
                        {v.incidente && (
                          <div className="col-span-2 bg-red-500/10 rounded-lg p-2">
                            <span className="text-red-500 font-semibold">Incidente:</span> <span className="text-red-400">{v.incidente}</span>
                          </div>
                        )}
                        {v.observaciones && (
                          <div className="col-span-2"><span className="text-text-muted">Obs:</span> <span className="text-text-primary">{v.observaciones}</span></div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="secondary" onClick={() => { setEditando(v); setShowStockForm(true) }}>
                          <Pencil className="h-3 w-3 mr-1" /> Editar
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setShowTransferir(v)}>
                          <ArrowRightLeft className="h-3 w-3 mr-1" /> Transferir
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setConfirmarEliminar(v.id)}>
                          <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Modales ─── */}

      {/* Form BATEA (ingreso rápido) */}
      {showBateaForm && (
        <BateaForm
          vehiculo={editando}
          onClose={() => { setShowBateaForm(false); setEditando(null) }}
        />
      )}

      {/* Form STOCK (completo) */}
      {showStockForm && (
        <StockForm
          vehiculo={editando}
          onClose={() => { setShowStockForm(false); setEditando(null) }}
        />
      )}

      {/* Modal pasar de batea a stock */}
      {pasarAStock && (
        <PasarAStockModal
          vehiculo={pasarAStock}
          onClose={() => setPasarAStock(null)}
        />
      )}

      {/* Modal transferir */}
      {showTransferir && (
        <TransferirModal
          vehiculo={showTransferir}
          onClose={() => setShowTransferir(null)}
        />
      )}

      {/* Confirmar eliminar */}
      <ConfirmDialog
        open={!!confirmarEliminar}
        title="Eliminar vehículo"
        message="¿Estás seguro? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
        loading={eliminarMut.isPending}
        onConfirm={() => {
          if (confirmarEliminar) {
            eliminarMut.mutate(confirmarEliminar, {
              onSuccess: () => { notify.success('Eliminado'); setConfirmarEliminar(null) },
              onError: (e: any) => notify.error(e.message),
            })
          }
        }}
        onClose={() => setConfirmarEliminar(null)}
      />
    </div>
  )
}

// ─── Form BATEA (ingreso rápido — pocos campos) ──────────────

function BateaForm({ vehiculo, onClose }: { vehiculo: StockVehiculo | null; onClose: () => void }) {
  const crear = useCrearStock()
  const actualizar = useActualizarStock()
  const isEdit = !!vehiculo
  const [modelos, setModelos] = useState<string[]>([])

  useEffect(() => {
    supabase.from('modelos_fiat').select('nombre').eq('activo', true).order('nombre').then(({ data }) => {
      if (data) setModelos(data.map(m => m.nombre))
    })
  }, [])

  const [form, setForm] = useState({
    vin: vehiculo?.vin || '',
    marca: vehiculo?.marca || 'FIAT',
    modelo: vehiculo?.modelo || '',
    color: vehiculo?.color || '',
    tipo: vehiculo?.tipo || '0km' as TipoStock,
    sucursal: vehiculo?.sucursal || 'Ushuaia' as Sucursal,
    titular_plan: vehiculo?.titular_plan || '',
    incidente: vehiculo?.incidente || '',
    observaciones: vehiculo?.observaciones || '',
  })

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.vin.trim() || !form.modelo.trim()) {
      notify.error('VIN y Modelo son obligatorios')
      return
    }

    const payload = {
      vin: form.vin.trim(),
      marca: form.marca.trim() || 'FIAT',
      modelo: form.modelo.trim(),
      color: form.color.trim() || undefined,
      tipo: form.tipo as TipoStock,
      estado: 'batea' as EstadoStock,
      sucursal: form.sucursal as Sucursal,
      titular_plan: form.titular_plan.trim() || undefined,
      incidente: form.incidente.trim() || null,
      observaciones: form.observaciones.trim() || undefined,
    }

    if (isEdit) {
      actualizar.mutate({ id: vehiculo!.id, ...payload } as any, {
        onSuccess: () => { notify.success('Actualizado'); onClose() },
        onError: (e: any) => notify.error(e.message),
      })
    } else {
      crear.mutate(payload, {
        onSuccess: () => { notify.success('Ingresado a batea'); onClose() },
        onError: (e: any) => notify.error(e.message),
      })
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Editar unidad en batea' : 'Ingresar a Batea'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-text-muted">VIN / Chasis *</label>
            <input value={form.vin} onChange={e => set('vin', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none font-mono" placeholder="8AP195A23PT123456" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Marca</label>
            <input value={form.marca} onChange={e => set('marca', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Modelo *</label>
            <input list="modelos-batea" value={form.modelo} onChange={e => set('modelo', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" placeholder="Seleccioná o escribí..." />
            <datalist id="modelos-batea">
              {modelos.map(m => <option key={m} value={m} />)}
            </datalist>
          </div>
          <div>
            <label className="text-xs text-text-muted">Color</label>
            <input list="colores-fiat-list" value={form.color} onChange={e => set('color', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" placeholder="Seleccioná o escribí..." />
            <datalist id="colores-fiat-list">{COLORES_FIAT.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="text-xs text-text-muted">Tipo</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none">
              <option value="0km">0KM</option>
              <option value="plan_ahorro">Plan de Ahorro</option>
              <option value="usado">Usado</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted">Sucursal</label>
            <select value={form.sucursal} onChange={e => set('sucursal', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none">
              {SUCURSALES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Titular — siempre visible, útil para plan ahorro */}
          <div>
            <label className="text-xs text-text-muted">Apellido y Nombre (titular)</label>
            <input value={form.titular_plan} onChange={e => set('titular_plan', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" placeholder="Ej: González Juan" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-text-muted">Incidente / Daño</label>
            <input value={form.incidente} onChange={e => set('incidente', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" placeholder="Ej: rayón puerta trasera..." />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-text-muted">Observaciones</label>
            <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none resize-none" />
          </div>
        </div>
        <Button type="submit" fullWidth loading={crear.isPending || actualizar.isPending}>
          {isEdit ? 'Guardar' : 'Ingresar a Batea'}
        </Button>
      </form>
    </Modal>
  )
}

// ─── Modal "Pasar a Stock" — desde batea ─────────────────────

function PasarAStockModal({ vehiculo, onClose }: { vehiculo: StockVehiculo; onClose: () => void }) {
  const actualizar = useActualizarStock()
  const [tipo, setTipo] = useState<TipoStock>(vehiculo.tipo)
  const [estado, setEstado] = useState<EstadoStock>('disponible')

  const handleConfirm = () => {
    actualizar.mutate(
      { id: vehiculo.id, estado, tipo },
      {
        onSuccess: () => { notify.success(`Pasado a stock como ${TIPO_COLORES[tipo].label}`); onClose() },
        onError: (e: any) => notify.error(e.message),
      },
    )
  }

  return (
    <Modal open onClose={onClose} title="Pasar a Stock">
      <div className="space-y-4">
        <div className="bg-bg-secondary rounded-lg p-3 text-sm">
          <p className="font-bold text-text-primary">{vehiculo.marca} {vehiculo.modelo} {vehiculo.color ? `· ${vehiculo.color}` : ''}</p>
          <p className="text-xs text-text-muted">VIN: {vehiculo.vin}</p>
          {vehiculo.titular_plan && <p className="text-xs text-text-muted">Titular: {vehiculo.titular_plan}</p>}
          {vehiculo.incidente && <p className="text-xs text-red-500 mt-1">Incidente: {vehiculo.incidente}</p>}
        </div>

        <div>
          <label className="text-xs text-text-muted">Tipo de stock</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoStock)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none">
            <option value="0km">0KM</option>
            <option value="plan_ahorro">Plan de Ahorro</option>
            <option value="usado">Usado</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-text-muted">Estado inicial</label>
          <select value={estado} onChange={e => setEstado(e.target.value as EstadoStock)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none">
            <option value="disponible">Disponible</option>
            <option value="reservado">Reservado</option>
          </select>
        </div>

        <Button fullWidth loading={actualizar.isPending} onClick={handleConfirm}>
          <ArrowRight className="h-4 w-4 mr-1" /> Confirmar — Pasar a Stock
        </Button>
      </div>
    </Modal>
  )
}

// ─── Form STOCK completo ─────────────────────────────────────

function StockForm({ vehiculo, onClose }: { vehiculo: StockVehiculo | null; onClose: () => void }) {
  const crear = useCrearStock()
  const actualizar = useActualizarStock()
  const isEdit = !!vehiculo
  const [modelos, setModelos] = useState<string[]>([])

  useEffect(() => {
    supabase.from('modelos_fiat').select('nombre').eq('activo', true).order('nombre').then(({ data }) => {
      if (data) setModelos(data.map(m => m.nombre))
    })
  }, [])

  const [form, setForm] = useState({
    vin: vehiculo?.vin || '',
    marca: vehiculo?.marca || 'FIAT',
    modelo: vehiculo?.modelo || '',
    version: vehiculo?.version || '',
    color: vehiculo?.color || '',
    anio: vehiculo?.anio?.toString() || '',
    tipo: vehiculo?.tipo || '0km' as TipoStock,
    estado: vehiculo?.estado || 'disponible' as EstadoStock,
    sucursal: vehiculo?.sucursal || 'Ushuaia' as Sucursal,
    precio: vehiculo?.precio?.toString() || '',
    kilometraje: vehiculo?.kilometraje?.toString() || '',
    grupo_orden: vehiculo?.grupo_orden || '',
    titular_plan: vehiculo?.titular_plan || '',
    patente: vehiculo?.patente || '',
    incidente: vehiculo?.incidente || '',
    observaciones: vehiculo?.observaciones || '',
  })

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.vin.trim() || !form.modelo.trim()) {
      notify.error('VIN y Modelo son obligatorios')
      return
    }
    const payload = {
      vin: form.vin.trim(),
      marca: form.marca.trim() || 'FIAT',
      modelo: form.modelo.trim(),
      version: form.version.trim() || undefined,
      color: form.color.trim() || undefined,
      anio: form.anio ? parseInt(form.anio) : undefined,
      tipo: form.tipo as TipoStock,
      estado: form.estado as EstadoStock,
      sucursal: form.sucursal as Sucursal,
      precio: form.precio ? parseFloat(form.precio) : undefined,
      kilometraje: form.kilometraje ? parseInt(form.kilometraje) : undefined,
      grupo_orden: form.grupo_orden.trim() || undefined,
      titular_plan: form.titular_plan.trim() || undefined,
      patente: form.patente.trim() || undefined,
      incidente: form.incidente.trim() || null,
      observaciones: form.observaciones.trim() || undefined,
    }
    if (isEdit) {
      actualizar.mutate({ id: vehiculo!.id, ...payload } as any, {
        onSuccess: () => { notify.success('Actualizado'); onClose() },
        onError: (e: any) => notify.error(e.message),
      })
    } else {
      crear.mutate(payload, {
        onSuccess: () => { notify.success('Agregado al stock'); onClose() },
        onError: (e: any) => notify.error(e.message),
      })
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Editar vehículo' : 'Agregar a Stock'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-text-muted">VIN / Chasis *</label>
            <input value={form.vin} onChange={e => set('vin', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none font-mono" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Marca</label>
            <input value={form.marca} onChange={e => set('marca', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Modelo *</label>
            <input list="modelos-stock" value={form.modelo} onChange={e => set('modelo', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" />
            <datalist id="modelos-stock">{modelos.map(m => <option key={m} value={m} />)}</datalist>
          </div>
          <div>
            <label className="text-xs text-text-muted">Versión</label>
            <input value={form.version} onChange={e => set('version', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Color</label>
            <input list="colores-fiat-list" value={form.color} onChange={e => set('color', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" placeholder="Seleccioná o escribí..." />
            <datalist id="colores-fiat-list">{COLORES_FIAT.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="text-xs text-text-muted">Año</label>
            <input type="number" value={form.anio} onChange={e => set('anio', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Precio</label>
            <input type="number" value={form.precio} onChange={e => set('precio', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Tipo</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none">
              <option value="0km">0KM</option>
              <option value="plan_ahorro">Plan de Ahorro</option>
              <option value="usado">Usado</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted">Sucursal</label>
            <select value={form.sucursal} onChange={e => set('sucursal', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none">
              {SUCURSALES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted">Estado</label>
            <select value={form.estado} onChange={e => set('estado', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none">
              <option value="disponible">Disponible</option>
              <option value="reservado">Reservado</option>
              <option value="en_transito">En tránsito</option>
              <option value="vendido">Vendido</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted">Kilometraje</label>
            <input type="number" value={form.kilometraje} onChange={e => set('kilometraje', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Patente</label>
            <input value={form.patente} onChange={e => set('patente', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-text-muted">Apellido y Nombre (titular)</label>
            <input value={form.titular_plan} onChange={e => set('titular_plan', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" placeholder="Ej: González Juan" />
          </div>
          {form.tipo === 'plan_ahorro' && (
            <div className="col-span-2">
              <label className="text-xs text-text-muted">Grupo / Orden</label>
              <input value={form.grupo_orden} onChange={e => set('grupo_orden', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" />
            </div>
          )}
          <div className="col-span-2">
            <label className="text-xs text-text-muted">Incidente / Daño</label>
            <input value={form.incidente} onChange={e => set('incidente', e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" placeholder="Ej: rayón puerta trasera..." />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-text-muted">Observaciones</label>
            <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none resize-none" />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="submit" fullWidth loading={crear.isPending || actualizar.isPending}>
            {isEdit ? 'Guardar' : 'Agregar a Stock'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal transferir ────────────────────────────────────────

function TransferirModal({ vehiculo, onClose }: { vehiculo: StockVehiculo; onClose: () => void }) {
  const transferir = useTransferirStock()
  const [destino, setDestino] = useState<Sucursal>(vehiculo.sucursal === 'Ushuaia' ? 'Rio Grande' : 'Ushuaia')
  const [motivo, setMotivo] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (destino === vehiculo.sucursal) { notify.error('Destino debe ser distinto'); return }
    transferir.mutate(
      { stockId: vehiculo.id, sucursalDestino: destino, motivo: motivo.trim() || undefined },
      {
        onSuccess: () => { notify.success(`Transferido a ${destino}`); onClose() },
        onError: (e: any) => notify.error(e.message),
      },
    )
  }

  return (
    <Modal open onClose={onClose} title="Transferir vehículo">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-bg-secondary rounded-lg p-3 text-sm">
          <p className="font-bold text-text-primary">{vehiculo.marca} {vehiculo.modelo}</p>
          <p className="text-xs text-text-muted">VIN: {vehiculo.vin} · Actualmente en: <strong>{vehiculo.sucursal}</strong></p>
        </div>
        <div>
          <label className="text-xs text-text-muted">Sucursal destino</label>
          <select value={destino} onChange={e => setDestino(e.target.value as Sucursal)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none">
            {SUCURSALES.filter(s => s !== vehiculo.sucursal).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-muted">Motivo (opcional)</label>
          <input value={motivo} onChange={e => setMotivo(e.target.value)} className="w-full mt-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-action/30 focus:outline-none" />
        </div>
        <Button type="submit" fullWidth loading={transferir.isPending}>
          <ArrowRightLeft className="h-4 w-4 mr-1" /> Transferir
        </Button>
      </form>
    </Modal>
  )
}

export { StockPage as default }
