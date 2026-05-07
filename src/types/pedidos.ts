// ============================================================
// Tipos de pedidos de repuestos al cliente.
// Refleja migration 017_pedidos_repuestos.sql.
// ============================================================

import type { SucursalRepuestos } from './pricing'

/** Flags multi-paralelos. Pueden coexistir varios en true. */
export interface PedidoFlags {
  esperando_repuesto:  boolean
  esperando_garantia:  boolean
  esperando_siniestro: boolean
  esperando_cliente:   boolean
  recibo_emitido:      boolean
}

/** Identificadores de flags como string union para filtros y badges. */
export type FlagPedido = keyof PedidoFlags

export const FLAGS_PEDIDO: { id: FlagPedido; label: string; emoji: string; color: 'yellow' | 'green' | 'orange' | 'blue' | 'purple' }[] = [
  { id: 'esperando_repuesto',  label: 'Esperando repuesto',  emoji: '🟡', color: 'yellow' },
  { id: 'esperando_garantia',  label: 'Esperando garantía',  emoji: '🟢', color: 'green' },
  { id: 'esperando_siniestro', label: 'Esperando siniestro', emoji: '🟠', color: 'orange' },
  { id: 'esperando_cliente',   label: 'Esperando cliente',   emoji: '🔵', color: 'blue' },
  { id: 'recibo_emitido',      label: 'Recibo emitido',      emoji: '🧾', color: 'purple' },
]

export interface PedidoRepuesto extends PedidoFlags {
  id: string
  numero_pedido: string
  sucursal: SucursalRepuestos
  cliente_id: string | null

  garantia_id: string | null
  siniestro_id: string | null

  numero_recibo: string | null
  monto_pagado: number | null

  entregado_at: string | null
  entregado_por: string | null
  cancelado: boolean
  motivo_cancelacion: string | null

  observaciones: string | null

  created_at: string
  updated_at: string
  created_by: string | null
}

export interface PedidoRepuestoItem {
  id: string
  pedido_id: string
  producto_id: string
  cantidad: number
  precio_unitario_snapshot: number | null

  recibido: boolean
  recibido_at: string | null

  reserva_id: string | null

  entregado: boolean
  entregado_at: string | null

  observacion: string | null
  created_at: string
}

/** Pedido con sus items + relaciones expandidas (para listado y detalle). */
export interface PedidoRepuestoConItems extends PedidoRepuesto {
  pedidos_repuestos_items: PedidoRepuestoItem[]
  cliente?: { id: string; nombre: string; cuit: string | null } | null
}

/** Estado lógico derivado para mostrar en la UI. */
export type EstadoPedidoUI =
  | 'abierto'    // sin entregar y sin cancelar
  | 'entregado'
  | 'cancelado'

export function getEstadoPedido(p: Pick<PedidoRepuesto, 'entregado_at' | 'cancelado'>): EstadoPedidoUI {
  if (p.cancelado) return 'cancelado'
  if (p.entregado_at) return 'entregado'
  return 'abierto'
}

export function flagsActivos(p: PedidoFlags): FlagPedido[] {
  return FLAGS_PEDIDO
    .filter(f => p[f.id])
    .map(f => f.id)
}
