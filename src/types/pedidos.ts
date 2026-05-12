// ============================================================
// Tipos de pedidos de repuestos al cliente.
// Refleja migrations 017+018:
//   tipo  (origen):     garantia | mostrador | siniestro
//   etapa (ciclo vida): comprado | en_viaje | en_stock | entregado | cancelado
// ============================================================

import type { SucursalRepuestos } from './pricing'

export type TipoPedido =
  | 'garantia'
  | 'mostrador'
  | 'siniestro'
  | 'transferencia_sucursal'
  | 'fiat_faltante'

export type EtapaPedido =
  | 'comprado'
  | 'en_viaje'
  | 'en_stock'
  | 'entregado'
  | 'cancelado'

export const TIPOS_PEDIDO: { id: TipoPedido; label: string; emoji: string; color: 'green' | 'gray' | 'orange' | 'blue' | 'purple' }[] = [
  { id: 'garantia',               label: 'Garantía',     emoji: '🟢', color: 'green' },
  { id: 'mostrador',              label: 'Mostrador',    emoji: '🛒', color: 'gray' },
  { id: 'siniestro',              label: 'Siniestro',    emoji: '🟠', color: 'orange' },
  { id: 'transferencia_sucursal', label: 'Transferencia',emoji: '🚚', color: 'blue' },
  { id: 'fiat_faltante',          label: 'Pedido a FIAT',emoji: '🏭', color: 'purple' },
]

export const ETAPAS_PEDIDO: { id: EtapaPedido; label: string; emoji: string; color: 'yellow' | 'blue' | 'purple' | 'green' | 'red' }[] = [
  { id: 'comprado',  label: 'Comprado',  emoji: '📝', color: 'yellow' },
  { id: 'en_viaje',  label: 'En viaje',  emoji: '🚚', color: 'blue' },
  { id: 'en_stock',  label: 'En stock',  emoji: '📦', color: 'purple' },
  { id: 'entregado', label: 'Entregado', emoji: '✅', color: 'green' },
  { id: 'cancelado', label: 'Cancelado', emoji: '❌', color: 'red' },
]

/** Etapa siguiente en el flujo lineal. Devuelve null si ya está cerrado. */
export function siguienteEtapa(actual: EtapaPedido): EtapaPedido | null {
  switch (actual) {
    case 'comprado':  return 'en_viaje'
    case 'en_viaje':  return 'en_stock'
    case 'en_stock':  return 'entregado'
    case 'entregado': return null
    case 'cancelado': return null
  }
}

export function esEtapaAbierta(e: EtapaPedido): boolean {
  return e !== 'entregado' && e !== 'cancelado'
}

export interface PedidoRepuesto {
  id: string
  numero_pedido: string
  sucursal: SucursalRepuestos
  cliente_id: string | null

  tipo: TipoPedido
  etapa: EtapaPedido

  /** Para transferencia_sucursal: sucursal de origen (sucursal = destino).
   *  En el resto de los tipos queda NULL. */
  sucursal_origen: SucursalRepuestos | null

  garantia_id: string | null
  siniestro_id: string | null

  numero_recibo: string | null
  monto_pagado: number | null
  recibo_emitido: boolean

  entregado_at: string | null
  entregado_por: string | null
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

export interface PedidoRepuestoConItems extends PedidoRepuesto {
  pedidos_repuestos_items: PedidoRepuestoItem[]
  cliente?: { id: string; nombre: string; cuit: string | null } | null
}
