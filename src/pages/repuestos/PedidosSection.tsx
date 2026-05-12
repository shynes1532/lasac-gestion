// ============================================================
// Sección "Pedidos" del módulo Repuestos.
// Modelo:
//   tipo  (origen):     garantia | mostrador | siniestro
//   etapa (ciclo vida): comprado | en_viaje | en_stock | entregado | cancelado
// ============================================================

import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, X, Search, Trash2, Check, AlertTriangle, ArrowRight, UserPlus } from 'lucide-react'
import { Button, EmptyState, notify } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import {
  usePedidos,
  useCrearPedido,
  useActualizarPedido,
  useRecibirItem,
  useEntregarPedido,
  useCancelarPedido,
} from '../../hooks/usePedidos'
import { useClientes, CLIENTE_MOSTRADOR_ID } from '../../hooks/useClientes'
import { useRepuestos } from '../../hooks/useRepuestos'
import {
  TIPOS_PEDIDO,
  ETAPAS_PEDIDO,
  siguienteEtapa,
  esEtapaAbierta,
  type TipoPedido,
  type EtapaPedido,
  type PedidoRepuestoConItems,
} from '../../types/pedidos'
import type { SucursalRepuestos } from '../../types/pricing'
import type { Repuesto } from '../../lib/types'
import { formatARS } from '../../lib/pricing'

const TIPO_BADGE_COLOR: Record<string, string> = {
  green:  'bg-green-500/20 text-green-300 border-green-500/40',
  gray:   'bg-bg-tertiary text-text-secondary border-border',
  orange: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
}
const ETAPA_BADGE_COLOR: Record<string, string> = {
  yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  blue:   'bg-blue-500/20 text-blue-300 border-blue-500/40',
  purple: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  green:  'bg-green-500/20 text-green-300 border-green-500/40',
  red:    'bg-red-500/20 text-red-300 border-red-500/40',
}

interface PedidosSectionProps {
  sucursal: SucursalRepuestos | 'Todas'
}

// ============================================================
// Componente principal
// ============================================================

export function PedidosSection({ sucursal }: PedidosSectionProps) {
  const [tipoFiltro, setTipoFiltro] = useState<TipoPedido | 'Todos'>('Todos')
  const [etapaFiltro, setEtapaFiltro] = useState<EtapaPedido | 'abiertas' | 'Todas'>('abiertas')
  const [busqueda, setBusqueda] = useState('')
  const [showNuevo, setShowNuevo] = useState(false)
  const [pedidoSel, setPedidoSel] = useState<PedidoRepuestoConItems | null>(null)

  const { data: pedidos = [], isLoading } = usePedidos({
    sucursal,
    tipo: tipoFiltro,
    etapa: etapaFiltro,
    busqueda: busqueda || undefined,
  })

  // Conteos para los chips (solo aplican el filtro de sucursal + etapa, sin tipoFiltro)
  const { data: pedidosTodos = [] } = usePedidos({ sucursal, etapa: etapaFiltro })
  const conteosTipo = useMemo(() => {
    const acc: Record<TipoPedido | 'Todos', number> = {
      Todos: pedidosTodos.length,
      garantia: 0, mostrador: 0, siniestro: 0,
    }
    pedidosTodos.forEach(p => { acc[p.tipo]++ })
    return acc
  }, [pedidosTodos])

  return (
    <div className="space-y-3">
      {/* Header con botón nuevo pedido */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted">
          {pedidosTodos.length} pedido{pedidosTodos.length !== 1 ? 's' : ''}
        </span>
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

      {/* Chips: tipo de pedido */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">Tipo</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTipoFiltro('Todos')}
            className={`text-[11px] px-2 py-1 rounded border cursor-pointer
              ${tipoFiltro === 'Todos' ? 'bg-action text-white border-action' : 'bg-bg-tertiary text-text-secondary border-border'}`}
          >
            Todos ({conteosTipo.Todos})
          </button>
          {TIPOS_PEDIDO.map(t => (
            <button
              key={t.id}
              onClick={() => setTipoFiltro(tipoFiltro === t.id ? 'Todos' : t.id)}
              className={`text-[11px] px-2 py-1 rounded border cursor-pointer
                ${tipoFiltro === t.id ? 'bg-action text-white border-action' : 'bg-bg-tertiary text-text-secondary border-border'}`}
            >
              {t.emoji} {t.label} ({conteosTipo[t.id]})
            </button>
          ))}
        </div>
      </div>

      {/* Chips: etapa */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">Etapa</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setEtapaFiltro('abiertas')}
            className={`text-[11px] px-2 py-1 rounded border cursor-pointer
              ${etapaFiltro === 'abiertas' ? 'bg-action text-white border-action' : 'bg-bg-tertiary text-text-secondary border-border'}`}
          >
            Abiertas
          </button>
          {ETAPAS_PEDIDO.map(e => (
            <button
              key={e.id}
              onClick={() => setEtapaFiltro(etapaFiltro === e.id ? 'abiertas' : e.id)}
              className={`text-[11px] px-2 py-1 rounded border cursor-pointer
                ${etapaFiltro === e.id ? 'bg-action text-white border-action' : 'bg-bg-tertiary text-text-secondary border-border'}`}
            >
              {e.emoji} {e.label}
            </button>
          ))}
          <button
            onClick={() => setEtapaFiltro('Todas')}
            className={`text-[11px] px-2 py-1 rounded border cursor-pointer
              ${etapaFiltro === 'Todas' ? 'bg-action text-white border-action' : 'bg-bg-tertiary text-text-secondary border-border'}`}
          >
            Todas
          </button>
        </div>
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
          description={busqueda || tipoFiltro !== 'Todos' ? 'Ningún pedido coincide con el filtro' : 'Cargá el primer pedido con "Nuevo pedido"'}
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
  const tipo  = TIPOS_PEDIDO.find(t => t.id === pedido.tipo)!
  const etapa = ETAPAS_PEDIDO.find(e => e.id === pedido.etapa)!
  const totalItems = pedido.pedidos_repuestos_items?.length ?? 0
  const recibidos  = pedido.pedidos_repuestos_items?.filter(i => i.recibido).length ?? 0
  const entregados = pedido.pedidos_repuestos_items?.filter(i => i.entregado).length ?? 0
  const cliente = pedido.cliente?.nombre ?? 'Sin cliente'

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-bg-secondary rounded-xl border border-border p-3 hover:border-action/40 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-action">{pedido.numero_pedido}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${TIPO_BADGE_COLOR[tipo.color]}`}>
              {tipo.emoji} {tipo.label}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ETAPA_BADGE_COLOR[etapa.color]}`}>
              {etapa.emoji} {etapa.label}
            </span>
            <span className="text-[10px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">{pedido.sucursal}</span>
          </div>
          <p className="text-sm text-text-primary mt-1 truncate">{cliente}</p>
          <p className="text-[11px] text-text-muted mt-0.5">
            {totalItems} item{totalItems !== 1 ? 's' : ''}
            {recibidos > 0 && ` · ${recibidos}/${totalItems} recibidos`}
            {entregados > 0 && ` · ${entregados}/${totalItems} entregados`}
            {pedido.numero_recibo && ` · 🧾 ${pedido.numero_recibo}`}
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

      {pedido.etapa === 'cancelado' && pedido.motivo_cancelacion && (
        <div className="mt-2 text-[10px] text-red-400">
          ❌ Cancelado — {pedido.motivo_cancelacion}
        </div>
      )}
    </button>
  )
}

// ============================================================
// Modal: Nuevo pedido
// ============================================================
function NuevoPedidoModal({ sucursal, onClose }: { sucursal: SucursalRepuestos; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [clienteId, setClienteId] = useState<string>(CLIENTE_MOSTRADOR_ID)
  const [tipo, setTipo] = useState<TipoPedido>('mostrador')
  const [etapa, setEtapa] = useState<EtapaPedido>('comprado')
  const [busquedaRep, setBusquedaRep] = useState('')
  const [items, setItems] = useState<Array<{ producto_id: string; codigo: string; descripcion: string; cantidad: number }>>([])
  const [numeroRecibo, setNumeroRecibo] = useState('')
  const [montoPagado, setMontoPagado] = useState('')
  const [reciboEmitido, setReciboEmitido] = useState(false)
  const [observaciones, setObservaciones] = useState('')

  // Mini-form para crear cliente nuevo inline
  const [showAltaCli, setShowAltaCli] = useState(false)
  const [creandoCli, setCreandoCli] = useState(false)
  const [nuevoCli, setNuevoCli] = useState({
    nombre: '',
    cuit: '',
    condicion_iva: 'CF' as 'CF' | 'RI' | 'MT' | 'EX' | 'RNI',
    provincia: 'TDF',
    telefono: '',
    email: '',
  })

  const { data: clientes = [] } = useClientes()
  const { data: repuestos = [] } = useRepuestos(busquedaRep, sucursal)
  const crearPedido = useCrearPedido()

  const handleCrearCliente = async () => {
    if (!nuevoCli.nombre.trim()) return notify.error('El nombre es obligatorio')
    setCreandoCli(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          nombre: nuevoCli.nombre.trim(),
          cuit: nuevoCli.cuit.trim() || null,
          condicion_iva: nuevoCli.condicion_iva,
          provincia: nuevoCli.provincia.trim() || 'TDF',
          telefono: nuevoCli.telefono.trim() || null,
          email: nuevoCli.email.trim() || null,
          activo: true,
        })
        .select('id')
        .single()
      if (error) throw error

      await queryClient.invalidateQueries({ queryKey: ['clientes'] })
      setClienteId((data as { id: string }).id)
      setShowAltaCli(false)
      setNuevoCli({ nombre: '', cuit: '', condicion_iva: 'CF', provincia: 'TDF', telefono: '', email: '' })
      notify.success('Cliente creado')
    } catch (err: any) {
      notify.error(err?.message || 'Error al crear cliente')
    } finally {
      setCreandoCli(false)
    }
  }

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
        tipo,
        etapa,
        numero_recibo: numeroRecibo.trim() || null,
        monto_pagado: montoPagado ? Number(montoPagado) : null,
        recibo_emitido: reciboEmitido,
        observaciones: observaciones.trim() || null,
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
          {/* Tipo */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Tipo de pedido *</label>
            <div className="grid grid-cols-3 gap-1.5">
              {TIPOS_PEDIDO.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTipo(t.id)}
                  className={`text-xs px-2 py-2 rounded-lg border transition-colors cursor-pointer
                    ${tipo === t.id ? 'bg-action text-white border-action' : 'bg-bg-primary text-text-secondary border-border hover:border-action/40'}`}
                >
                  <div>{t.emoji}</div>
                  <div className="mt-0.5">{t.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Etapa inicial */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Etapa inicial</label>
            <select
              value={etapa}
              onChange={e => setEtapa(e.target.value as EtapaPedido)}
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-action/30"
            >
              {ETAPAS_PEDIDO.filter(e => e.id !== 'cancelado').map(e => (
                <option key={e.id} value={e.id}>{e.emoji} {e.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-text-muted mt-0.5">
              Marcá según corresponda. La mayoría arranca en "Comprado".
            </p>
          </div>

          {/* Cliente */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-text-muted">Cliente</label>
              <button
                type="button"
                onClick={() => setShowAltaCli(!showAltaCli)}
                className="text-[11px] text-action hover:text-action/80 flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="h-3 w-3" />
                {showAltaCli ? 'Cancelar' : 'Nuevo cliente'}
              </button>
            </div>

            {!showAltaCli ? (
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
            ) : (
              <div className="bg-bg-primary border border-action/30 rounded-lg p-3 space-y-2">
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Nombre o razón social *</label>
                  <input
                    type="text"
                    value={nuevoCli.nombre}
                    onChange={e => setNuevoCli({ ...nuevoCli, nombre: e.target.value })}
                    placeholder="Ej: García Juan / Taller Mecánico SRL"
                    className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-action/40"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-text-muted mb-1">CUIT / DNI</label>
                    <input
                      type="text"
                      value={nuevoCli.cuit}
                      onChange={e => setNuevoCli({ ...nuevoCli, cuit: e.target.value })}
                      placeholder="20-12345678-3"
                      className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-text-muted mb-1">Condición IVA</label>
                    <select
                      value={nuevoCli.condicion_iva}
                      onChange={e => setNuevoCli({ ...nuevoCli, condicion_iva: e.target.value as typeof nuevoCli.condicion_iva })}
                      className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none"
                    >
                      <option value="CF">CF — Consumidor Final</option>
                      <option value="RI">RI — Resp. Inscripto</option>
                      <option value="MT">MT — Monotributo</option>
                      <option value="EX">EX — Exento</option>
                      <option value="RNI">RNI — Resp. No Inscripto</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-text-muted mb-1">Provincia</label>
                    <input
                      type="text"
                      value={nuevoCli.provincia}
                      onChange={e => setNuevoCli({ ...nuevoCli, provincia: e.target.value })}
                      className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-text-muted mb-1">Teléfono</label>
                    <input
                      type="text"
                      value={nuevoCli.telefono}
                      onChange={e => setNuevoCli({ ...nuevoCli, telefono: e.target.value })}
                      className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Email</label>
                  <input
                    type="email"
                    value={nuevoCli.email}
                    onChange={e => setNuevoCli({ ...nuevoCli, email: e.target.value })}
                    className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none"
                  />
                </div>
                <Button size="sm" fullWidth onClick={handleCrearCliente} loading={creandoCli}>
                  <UserPlus className="h-3.5 w-3.5" />
                  Crear y usar
                </Button>
              </div>
            )}
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

          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={reciboEmitido}
              onChange={e => setReciboEmitido(e.target.checked)}
              className="w-4 h-4"
            />
            🧾 Recibo emitido (cliente ya pagó)
          </label>

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
// Modal: Detalle del pedido
// ============================================================
function DetallePedidoModal({ pedido, onClose }: { pedido: PedidoRepuestoConItems; onClose: () => void }) {
  const [confirmandoCancel, setConfirmandoCancel] = useState(false)
  const [motivoCancel, setMotivoCancel] = useState('')

  const recibirItem = useRecibirItem()
  const actualizarPedido = useActualizarPedido()
  const entregarPedido = useEntregarPedido()
  const cancelarPedido = useCancelarPedido()

  const tipo  = TIPOS_PEDIDO.find(t => t.id === pedido.tipo)!
  const etapa = ETAPAS_PEDIDO.find(e => e.id === pedido.etapa)!
  const cerrado = !esEtapaAbierta(pedido.etapa)
  const proxima = siguienteEtapa(pedido.etapa)

  const handleAvanzarEtapa = async (siguiente: EtapaPedido) => {
    // Si la siguiente etapa es 'entregado', usamos la RPC que descuenta stock
    if (siguiente === 'entregado') {
      try {
        const res = await entregarPedido.mutateAsync({ pedidoId: pedido.id })
        notify.success(`Pedido entregado: ${res.unidades_descontadas} unidades descontadas de ${res.sucursal}`)
        onClose()
      } catch (err: any) {
        notify.error(err?.message || 'Error al entregar pedido')
      }
      return
    }
    try {
      await actualizarPedido.mutateAsync({ id: pedido.id, etapa: siguiente })
      notify.success(`Etapa actualizada a "${ETAPAS_PEDIDO.find(e => e.id === siguiente)?.label}"`)
    } catch (err: any) {
      notify.error(err?.message || 'Error al cambiar etapa')
    }
  }

  const handleCambiarTipo = async (t: TipoPedido) => {
    try {
      await actualizarPedido.mutateAsync({ id: pedido.id, tipo: t })
    } catch (err: any) {
      notify.error(err?.message || 'Error al cambiar tipo')
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
          {/* Estado actual destacado */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-bg-primary border border-border rounded-lg p-2.5">
              <p className="text-[10px] uppercase text-text-muted font-semibold">Tipo</p>
              <p className={`text-sm font-bold mt-0.5`}>
                {tipo.emoji} {tipo.label}
              </p>
            </div>
            <div className="bg-bg-primary border border-border rounded-lg p-2.5">
              <p className="text-[10px] uppercase text-text-muted font-semibold">Etapa</p>
              <p className={`text-sm font-bold mt-0.5`}>
                {etapa.emoji} {etapa.label}
              </p>
            </div>
          </div>

          {pedido.entregado_at && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 text-xs text-green-300">
              ✅ Entregado el {new Date(pedido.entregado_at).toLocaleDateString('es-AR')}
            </div>
          )}
          {pedido.etapa === 'cancelado' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-xs text-red-300">
              ❌ Cancelado{pedido.motivo_cancelacion ? `: ${pedido.motivo_cancelacion}` : ''}
            </div>
          )}

          {/* Cambiar tipo (solo si está abierto) */}
          {!cerrado && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1.5">Cambiar tipo</label>
              <div className="grid grid-cols-3 gap-1.5">
                {TIPOS_PEDIDO.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleCambiarTipo(t.id)}
                    className={`text-xs px-2 py-1.5 rounded border transition-colors cursor-pointer
                      ${pedido.tipo === t.id ? 'bg-action text-white border-action' : 'bg-bg-primary text-text-secondary border-border hover:border-action/40'}`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-2">Repuestos</h4>
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

          {/* Recibo / monto */}
          {(pedido.numero_recibo || pedido.monto_pagado || pedido.recibo_emitido) && (
            <div className="bg-bg-primary border border-border rounded-lg p-2 text-xs space-y-0.5">
              {pedido.recibo_emitido && <p className="text-purple-300">🧾 Recibo emitido</p>}
              {pedido.numero_recibo && <p>N° {pedido.numero_recibo}</p>}
              {pedido.monto_pagado != null && <p className="text-green-400">Pagado: {formatARS(pedido.monto_pagado)}</p>}
            </div>
          )}

          {/* Observaciones */}
          {pedido.observaciones && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">Observaciones</h4>
              <p className="text-xs text-text-secondary bg-bg-primary border border-border rounded-lg p-2">{pedido.observaciones}</p>
            </div>
          )}

          {/* Acciones */}
          {!cerrado && (
            <div className="space-y-2 pt-2 border-t border-border">
              {proxima && (
                <Button
                  fullWidth
                  onClick={() => handleAvanzarEtapa(proxima)}
                  loading={actualizarPedido.isPending || entregarPedido.isPending}
                >
                  <ArrowRight className="h-4 w-4" />
                  {proxima === 'entregado'
                    ? '✅ Marcar como entregado (descuenta stock)'
                    : `Pasar a "${ETAPAS_PEDIDO.find(e => e.id === proxima)?.label}"`}
                </Button>
              )}

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
