// ============================================================
// Sección "Pedidos" del módulo Repuestos.
// Lista pedidos abiertos/entregados/cancelados con filtros por flag y sucursal.
// Modal para crear pedido nuevo (cliente + múltiples items).
// Modal para ver/editar/entregar/cancelar un pedido existente.
// ============================================================

import { useState, useMemo } from 'react'
import { Plus, X, Search, Trash2, Check, AlertTriangle } from 'lucide-react'
import { Button, EmptyState, notify } from '../../components/ui'
import {
  usePedidos,
  useCrearPedido,
  useActualizarFlagsPedido,
  useRecibirItem,
  useEntregarPedido,
  useCancelarPedido,
} from '../../hooks/usePedidos'
import { useClientes, CLIENTE_MOSTRADOR_ID } from '../../hooks/useClientes'
import { useRepuestos } from '../../hooks/useRepuestos'
import {
  FLAGS_PEDIDO,
  flagsActivos,
  type FlagPedido,
  type PedidoRepuestoConItems,
} from '../../types/pedidos'
import type { SucursalRepuestos } from '../../types/pricing'
import type { Repuesto } from '../../lib/types'
import { formatARS } from '../../lib/pricing'

interface PedidosSectionProps {
  sucursal: SucursalRepuestos | 'Todas'
}

// ============================================================
// Componente principal
// ============================================================

export function PedidosSection({ sucursal }: PedidosSectionProps) {
  const [estado, setEstado] = useState<'abiertos' | 'entregados' | 'cancelados'>('abiertos')
  const [flagFiltro, setFlagFiltro] = useState<FlagPedido | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [showNuevo, setShowNuevo] = useState(false)
  const [pedidoSel, setPedidoSel] = useState<PedidoRepuestoConItems | null>(null)

  const { data: pedidos = [], isLoading } = usePedidos({
    sucursal,
    estado,
    flag: flagFiltro ?? undefined,
    busqueda: busqueda || undefined,
  })

  // Conteos por flag (sobre el filtro de estado + sucursal, sin flagFiltro)
  const { data: pedidosTodos = [] } = usePedidos({ sucursal, estado })
  const conteosFlag = useMemo(() => {
    const acc: Record<FlagPedido, number> = {
      esperando_repuesto: 0,
      esperando_garantia: 0,
      esperando_siniestro: 0,
      esperando_cliente: 0,
      recibo_emitido: 0,
    }
    pedidosTodos.forEach(p => {
      FLAGS_PEDIDO.forEach(f => { if (p[f.id]) acc[f.id]++ })
    })
    return acc
  }, [pedidosTodos])

  return (
    <div className="space-y-3">
      {/* Header con botón nuevo pedido */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs text-text-muted">
          {pedidosTodos.length} pedido{pedidosTodos.length !== 1 ? 's' : ''} {estado}
        </div>
        <Button
          size="sm"
          onClick={() => setShowNuevo(true)}
          disabled={sucursal === 'Todas'}
          title={sucursal === 'Todas' ? 'Elegí una sucursal específica para crear pedido' : ''}
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo pedido
        </Button>
      </div>

      {/* Chips de filtro por flag */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFlagFiltro(null)}
          className={`text-[11px] px-2 py-1 rounded border cursor-pointer transition-colors
            ${flagFiltro === null ? 'bg-action text-white border-action' : 'bg-bg-tertiary text-text-secondary border-border'}`}
        >
          Todos ({pedidosTodos.length})
        </button>
        {FLAGS_PEDIDO.map(f => (
          <button
            key={f.id}
            onClick={() => setFlagFiltro(flagFiltro === f.id ? null : f.id)}
            className={`text-[11px] px-2 py-1 rounded border cursor-pointer transition-colors
              ${flagFiltro === f.id ? 'bg-action text-white border-action' : 'bg-bg-tertiary text-text-secondary border-border'}`}
          >
            {f.emoji} {f.label} ({conteosFlag[f.id]})
          </button>
        ))}
      </div>

      {/* Tabs estado */}
      <div className="flex gap-1 border-b border-border">
        {(['abiertos', 'entregados', 'cancelados'] as const).map(e => (
          <button
            key={e}
            onClick={() => setEstado(e)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px cursor-pointer
              ${estado === e ? 'border-action text-action' : 'border-transparent text-text-muted hover:text-text-primary'}`}
          >
            {e[0].toUpperCase() + e.slice(1)}
          </button>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por N° pedido o N° recibo..."
          className="w-full bg-bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/30"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-bg-tertiary rounded-xl animate-pulse" />
          ))}
        </div>
      ) : pedidos.length === 0 ? (
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          title="Sin pedidos"
          description={busqueda || flagFiltro ? 'Ningún pedido coincide con el filtro' : 'Cargá el primer pedido con "Nuevo pedido"'}
        />
      ) : (
        <div className="space-y-2">
          {pedidos.map(p => (
            <PedidoCard key={p.id} pedido={p} onClick={() => setPedidoSel(p)} />
          ))}
        </div>
      )}

      {showNuevo && sucursal !== 'Todas' && (
        <NuevoPedidoModal
          sucursal={sucursal}
          onClose={() => setShowNuevo(false)}
        />
      )}

      {pedidoSel && (
        <DetallePedidoModal
          pedido={pedidoSel}
          onClose={() => setPedidoSel(null)}
        />
      )}
    </div>
  )
}

// ============================================================
// Card de un pedido
// ============================================================
function PedidoCard({ pedido, onClick }: { pedido: PedidoRepuestoConItems; onClick: () => void }) {
  const flags = flagsActivos(pedido)
  const totalItems = pedido.pedidos_repuestos_items?.length ?? 0
  const recibidos = pedido.pedidos_repuestos_items?.filter(i => i.recibido).length ?? 0
  const entregados = pedido.pedidos_repuestos_items?.filter(i => i.entregado).length ?? 0
  const cliente = pedido.cliente?.nombre ?? 'Sin cliente'

  const badgeColors: Record<string, string> = {
    yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    green:  'bg-green-500/20 text-green-300 border-green-500/40',
    orange: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    blue:   'bg-blue-500/20 text-blue-300 border-blue-500/40',
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-bg-secondary rounded-xl border border-border p-3 hover:border-action/40 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-action">{pedido.numero_pedido}</span>
            <span className="text-[10px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">{pedido.sucursal}</span>
            {pedido.numero_recibo && (
              <span className="text-[10px] text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded">
                🧾 {pedido.numero_recibo}
              </span>
            )}
          </div>
          <p className="text-sm text-text-primary mt-1 truncate">{cliente}</p>
          <p className="text-[11px] text-text-muted mt-0.5">
            {totalItems} item{totalItems !== 1 ? 's' : ''}
            {recibidos > 0 && ` · ${recibidos}/${totalItems} recibidos`}
            {entregados > 0 && ` · ${entregados}/${totalItems} entregados`}
          </p>
        </div>
        <div className="text-right shrink-0">
          {pedido.monto_pagado != null && (
            <p className="text-sm font-bold text-green-400">{formatARS(pedido.monto_pagado)}</p>
          )}
          <p className="text-[10px] text-text-muted">
            {new Date(pedido.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
          </p>
        </div>
      </div>

      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {flags.map(fid => {
            const f = FLAGS_PEDIDO.find(x => x.id === fid)!
            return (
              <span key={fid} className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeColors[f.color]}`}>
                {f.emoji} {f.label}
              </span>
            )
          })}
        </div>
      )}

      {pedido.cancelado && (
        <div className="mt-2 text-[10px] text-red-400">
          ❌ Cancelado{pedido.motivo_cancelacion ? ` — ${pedido.motivo_cancelacion}` : ''}
        </div>
      )}

      {pedido.entregado_at && (
        <div className="mt-2 text-[10px] text-green-400">
          ✅ Entregado el {new Date(pedido.entregado_at).toLocaleDateString('es-AR')}
        </div>
      )}
    </button>
  )
}

// ============================================================
// Modal: Nuevo pedido
// ============================================================
function NuevoPedidoModal({ sucursal, onClose }: { sucursal: SucursalRepuestos; onClose: () => void }) {
  const [clienteId, setClienteId] = useState<string>(CLIENTE_MOSTRADOR_ID)
  const [busquedaRep, setBusquedaRep] = useState('')
  const [items, setItems] = useState<Array<{ producto_id: string; codigo: string; descripcion: string; cantidad: number }>>([])
  const [numeroRecibo, setNumeroRecibo] = useState('')
  const [montoPagado, setMontoPagado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [flags, setFlags] = useState({
    esperando_repuesto: false,
    esperando_garantia: false,
    esperando_siniestro: false,
    esperando_cliente: false,
    recibo_emitido: false,
  })

  const { data: clientes = [] } = useClientes()
  const { data: repuestos = [] } = useRepuestos(busquedaRep, sucursal)
  const crearPedido = useCrearPedido()

  const agregarItem = (rep: Repuesto) => {
    if (items.find(i => i.producto_id === rep.id)) {
      notify.error('Ese repuesto ya está en el pedido')
      return
    }
    setItems([...items, { producto_id: rep.id, codigo: rep.codigo_fiat, descripcion: rep.descripcion, cantidad: 1 }])
    setBusquedaRep('')
  }

  const handleSubmit = async () => {
    if (items.length === 0) return notify.error('Agregá al menos un repuesto')
    try {
      await crearPedido.mutateAsync({
        sucursal,
        cliente_id: clienteId,
        numero_recibo: numeroRecibo.trim() || null,
        monto_pagado: montoPagado ? Number(montoPagado) : null,
        observaciones: observaciones.trim() || null,
        ...flags,
        items: items.map(it => ({ producto_id: it.producto_id, cantidad: it.cantidad })),
      })
      notify.success('Pedido creado')
      onClose()
    } catch (err: any) {
      notify.error(err?.message || 'Error al crear pedido')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
      <div className="bg-bg-secondary rounded-t-2xl sm:rounded-xl border border-border w-full max-w-md max-h-[95vh] overflow-y-auto">
        <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-bg-secondary z-10">
          <div>
            <h3 className="font-bold text-text-primary">Nuevo pedido</h3>
            <p className="text-xs text-action mt-0.5">📍 {sucursal}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Cliente */}
          <div>
            <label className="block text-xs text-text-muted mb-1">Cliente</label>
            <select
              value={clienteId}
              onChange={e => setClienteId(e.target.value)}
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/30"
            >
              {clientes.length === 0 && (
                <option value={CLIENTE_MOSTRADOR_ID}>MOSTRADOR — Consumidor Final</option>
              )}
              {clientes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.cuit ? `· ${c.cuit}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Items */}
          <div>
            <label className="block text-xs text-text-muted mb-1">Repuestos del pedido *</label>

            {items.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {items.map((it, idx) => (
                  <div key={it.producto_id} className="flex items-center gap-2 bg-bg-primary border border-border rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-action">{it.codigo}</p>
                      <p className="text-xs text-text-secondary truncate">{it.descripcion}</p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={it.cantidad}
                      onChange={e => {
                        const next = [...items]
                        next[idx].cantidad = Math.max(1, parseInt(e.target.value) || 1)
                        setItems(next)
                      }}
                      className="w-14 px-2 py-1 bg-bg-tertiary border border-border rounded text-sm text-text-primary text-center focus:outline-none"
                    />
                    <button
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Buscar repuesto para agregar */}
            <input
              type="text"
              value={busquedaRep}
              onChange={e => setBusquedaRep(e.target.value)}
              placeholder="Buscar código o descripción para agregar..."
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/30"
            />
            {busquedaRep && repuestos.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {repuestos.slice(0, 8).map(rep => (
                  <button
                    key={rep.id}
                    onClick={() => agregarItem(rep)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-bg-tertiary cursor-pointer"
                  >
                    <span className="font-mono text-action">{rep.codigo_fiat}</span> · {rep.descripcion}
                    <span className="text-text-muted ml-1">(stock: {rep.stock_actual})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Flags */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Estado del pedido</label>
            <div className="space-y-1.5">
              {FLAGS_PEDIDO.map(f => (
                <label key={f.id} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={flags[f.id]}
                    onChange={e => setFlags({ ...flags, [f.id]: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span>{f.emoji} {f.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Recibo / monto */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">N° recibo</label>
              <input
                type="text"
                value={numeroRecibo}
                onChange={e => setNumeroRecibo(e.target.value)}
                placeholder="REC-001"
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Monto pagado</label>
              <input
                type="number"
                step="0.01"
                value={montoPagado}
                onChange={e => setMontoPagado(e.target.value)}
                placeholder="0"
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs text-text-muted mb-1">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Detalle, urgencia, etc."
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" fullWidth onClick={onClose}>Cancelar</Button>
            <Button fullWidth onClick={handleSubmit} loading={crearPedido.isPending}>
              Crear pedido
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Modal: Detalle de pedido
// ============================================================
function DetallePedidoModal({ pedido, onClose }: { pedido: PedidoRepuestoConItems; onClose: () => void }) {
  const [confirmandoCancel, setConfirmandoCancel] = useState(false)
  const [motivoCancel, setMotivoCancel] = useState('')

  const recibirItem = useRecibirItem()
  const actualizarFlags = useActualizarFlagsPedido()
  const entregarPedido = useEntregarPedido()
  const cancelarPedido = useCancelarPedido()

  const yaEntregado = !!pedido.entregado_at
  const yaCancelado = pedido.cancelado
  const cerrado = yaEntregado || yaCancelado

  const handleToggleFlag = async (flag: FlagPedido, value: boolean) => {
    try {
      await actualizarFlags.mutateAsync({ id: pedido.id, flags: { [flag]: value } })
    } catch (err: any) {
      notify.error(err?.message || 'Error al actualizar')
    }
  }

  const handleEntregar = async () => {
    try {
      const res = await entregarPedido.mutateAsync({ pedidoId: pedido.id })
      notify.success(`Pedido entregado: ${res.unidades_descontadas} unidades descontadas de ${res.sucursal}`)
      onClose()
    } catch (err: any) {
      notify.error(err?.message || 'Error al entregar pedido')
    }
  }

  const handleCancelar = async () => {
    if (!motivoCancel.trim()) return notify.error('Ingresá el motivo de cancelación')
    try {
      await cancelarPedido.mutateAsync({ pedidoId: pedido.id, motivo: motivoCancel.trim() })
      notify.success('Pedido cancelado')
      onClose()
    } catch (err: any) {
      notify.error(err?.message || 'Error al cancelar')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
      <div className="bg-bg-secondary rounded-t-2xl sm:rounded-xl border border-border w-full max-w-md max-h-[95vh] overflow-y-auto">
        <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-bg-secondary z-10">
          <div>
            <h3 className="font-bold text-text-primary">{pedido.numero_pedido}</h3>
            <p className="text-xs text-text-muted">
              {pedido.sucursal} · {pedido.cliente?.nombre ?? 'Sin cliente'}
            </p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {yaEntregado && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-300">
              ✅ Entregado el {new Date(pedido.entregado_at!).toLocaleDateString('es-AR')}
            </div>
          )}
          {yaCancelado && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
              ❌ Cancelado{pedido.motivo_cancelacion ? `: ${pedido.motivo_cancelacion}` : ''}
            </div>
          )}

          {/* Items */}
          <div>
            <h4 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-2">Repuestos</h4>
            <div className="space-y-1.5">
              {pedido.pedidos_repuestos_items?.map(it => (
                <div key={it.id} className="flex items-center gap-2 bg-bg-primary border border-border rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-primary truncate">
                      {it.cantidad}× <span className="font-mono text-action">{it.producto_id.slice(0, 8)}</span>
                    </p>
                    <div className="flex gap-2 mt-0.5 text-[10px] text-text-muted">
                      {it.recibido && <span className="text-green-400">✓ Recibido</span>}
                      {it.entregado && <span className="text-blue-400">✓ Entregado</span>}
                    </div>
                  </div>
                  {!cerrado && !it.entregado && (
                    <button
                      onClick={() => recibirItem.mutate({ itemId: it.id, pedidoId: pedido.id, recibido: !it.recibido })}
                      className={`text-[10px] px-2 py-1 rounded cursor-pointer ${
                        it.recibido
                          ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                          : 'bg-bg-tertiary text-text-secondary border border-border hover:border-green-500/40'
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Flags toggleables */}
          {!cerrado && (
            <div>
              <h4 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-2">Estado</h4>
              <div className="space-y-1.5">
                {FLAGS_PEDIDO.map(f => (
                  <label key={f.id} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pedido[f.id]}
                      onChange={e => handleToggleFlag(f.id, e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>{f.emoji} {f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Recibo / monto */}
          {(pedido.numero_recibo || pedido.monto_pagado) && (
            <div className="bg-bg-primary border border-border rounded-lg p-2 text-xs space-y-0.5">
              {pedido.numero_recibo && <p>🧾 Recibo: {pedido.numero_recibo}</p>}
              {pedido.monto_pagado != null && <p className="text-green-400">Pagado: {formatARS(pedido.monto_pagado)}</p>}
            </div>
          )}

          {/* Observaciones */}
          {pedido.observaciones && (
            <div>
              <h4 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-1">Observaciones</h4>
              <p className="text-xs text-text-secondary bg-bg-primary border border-border rounded-lg p-2">{pedido.observaciones}</p>
            </div>
          )}

          {/* Acciones de cierre */}
          {!cerrado && (
            <div className="space-y-2 pt-2 border-t border-border">
              <Button
                fullWidth
                onClick={handleEntregar}
                loading={entregarPedido.isPending}
              >
                ✅ Marcar como entregado (descuenta stock)
              </Button>

              {!confirmandoCancel ? (
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => setConfirmandoCancel(true)}
                  className="text-red-400 hover:bg-red-500/10"
                >
                  Cancelar pedido
                </Button>
              ) : (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Motivo de cancelación
                  </div>
                  <input
                    type="text"
                    value={motivoCancel}
                    onChange={e => setMotivoCancel(e.target.value)}
                    placeholder="Ej: cliente desistió"
                    className="w-full bg-bg-primary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                  />
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" fullWidth onClick={() => setConfirmandoCancel(false)}>Volver</Button>
                    <Button size="sm" fullWidth onClick={handleCancelar} loading={cancelarPedido.isPending} className="bg-red-600 hover:bg-red-700">
                      Confirmar cancelación
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
