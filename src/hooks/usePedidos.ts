// ============================================================
// Hooks para pedidos de repuestos al cliente (migrations 017 + 018).
// Modelo:
//   tipo  (origen):     garantia | mostrador | siniestro
//   etapa (ciclo vida): comprado | en_viaje | en_stock | entregado | cancelado
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type {
  PedidoRepuesto,
  PedidoRepuestoConItems,
  PedidoRepuestoItem,
  TipoPedido,
  EtapaPedido,
} from '../types/pedidos'
import type { SucursalRepuestos } from '../types/pricing'

// ------------------------------------------------------------
// Listado de pedidos por sucursal con filtros
// ------------------------------------------------------------

export interface PedidosFiltro {
  sucursal?: SucursalRepuestos | 'Todas'
  tipo?: TipoPedido | 'Todos'
  etapa?: EtapaPedido | 'abiertas' | 'Todas'
  /** Búsqueda por numero_pedido o numero_recibo. */
  busqueda?: string
}

export function usePedidos(filtro: PedidosFiltro = {}) {
  return useQuery({
    queryKey: ['pedidos-repuestos', filtro],
    queryFn: async () => {
      let q = supabase
        .from('pedidos_repuestos')
        .select(`
          *,
          cliente:clientes ( id, nombre, cuit ),
          pedidos_repuestos_items ( * )
        `)
        .order('created_at', { ascending: false })

      if (filtro.sucursal && filtro.sucursal !== 'Todas') {
        q = q.eq('sucursal', filtro.sucursal)
      }

      if (filtro.tipo && filtro.tipo !== 'Todos') {
        q = q.eq('tipo', filtro.tipo)
      }

      const etapa = filtro.etapa ?? 'abiertas'
      if (etapa === 'abiertas') {
        q = q.not('etapa', 'in', '(entregado,cancelado)')
      } else if (etapa !== 'Todas') {
        q = q.eq('etapa', etapa)
      }

      if (filtro.busqueda && filtro.busqueda.trim()) {
        const s = filtro.busqueda.trim()
        q = q.or(`numero_pedido.ilike.%${s}%,numero_recibo.ilike.%${s}%`)
      }

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as PedidoRepuestoConItems[]
    },
    staleTime: 15_000,
  })
}

export function usePedido(id: string | null | undefined) {
  return useQuery({
    queryKey: ['pedido-repuesto', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos_repuestos')
        .select(`
          *,
          cliente:clientes ( id, nombre, cuit, condicion_iva, provincia ),
          pedidos_repuestos_items ( * )
        `)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as PedidoRepuestoConItems
    },
    enabled: !!id,
    staleTime: 15_000,
  })
}

// ------------------------------------------------------------
// Crear pedido (con items en el mismo flujo)
// ------------------------------------------------------------

interface CrearPedidoInput {
  sucursal: SucursalRepuestos
  cliente_id: string | null
  tipo: TipoPedido
  etapa?: EtapaPedido
  garantia_id?: string | null
  siniestro_id?: string | null
  numero_recibo?: string | null
  monto_pagado?: number | null
  recibo_emitido?: boolean
  observaciones?: string | null
  items: Array<{
    producto_id: string
    cantidad: number
    precio_unitario_snapshot?: number | null
    observacion?: string | null
  }>
}

export function useCrearPedido() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: CrearPedidoInput) => {
      if (input.items.length === 0) {
        throw new Error('El pedido debe tener al menos un repuesto')
      }

      const { data: pedido, error: pedErr } = await supabase
        .from('pedidos_repuestos')
        .insert({
          sucursal:      input.sucursal,
          cliente_id:    input.cliente_id,
          tipo:          input.tipo,
          etapa:         input.etapa ?? 'comprado',
          garantia_id:   input.garantia_id ?? null,
          siniestro_id:  input.siniestro_id ?? null,
          numero_recibo: input.numero_recibo ?? null,
          monto_pagado:  input.monto_pagado ?? null,
          recibo_emitido: input.recibo_emitido ?? false,
          observaciones: input.observaciones ?? null,
          created_by:    user?.id ?? null,
        })
        .select()
        .single()
      if (pedErr) throw pedErr

      const itemsPayload = input.items.map(it => ({
        pedido_id: (pedido as PedidoRepuesto).id,
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        precio_unitario_snapshot: it.precio_unitario_snapshot ?? null,
        observacion: it.observacion ?? null,
      }))

      const { error: itemsErr } = await supabase
        .from('pedidos_repuestos_items')
        .insert(itemsPayload)
      if (itemsErr) throw itemsErr

      return pedido as PedidoRepuesto
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-repuestos'] })
    },
  })
}

// ------------------------------------------------------------
// Actualizar tipo / etapa / recibo del pedido
// ------------------------------------------------------------

export function useActualizarPedido() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      id: string
      tipo?: TipoPedido
      etapa?: EtapaPedido
      numero_recibo?: string | null
      monto_pagado?: number | null
      recibo_emitido?: boolean
      observaciones?: string | null
    }) => {
      const payload: Record<string, unknown> = {}
      if (input.tipo            !== undefined) payload.tipo            = input.tipo
      if (input.etapa           !== undefined) payload.etapa           = input.etapa
      if (input.numero_recibo   !== undefined) payload.numero_recibo   = input.numero_recibo
      if (input.monto_pagado    !== undefined) payload.monto_pagado    = input.monto_pagado
      if (input.recibo_emitido  !== undefined) payload.recibo_emitido  = input.recibo_emitido
      if (input.observaciones   !== undefined) payload.observaciones   = input.observaciones

      const { error } = await supabase
        .from('pedidos_repuestos')
        .update(payload)
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-repuestos'] })
      queryClient.invalidateQueries({ queryKey: ['pedido-repuesto', vars.id] })
    },
  })
}

// ------------------------------------------------------------
// Marcar item como recibido
// ------------------------------------------------------------

export function useRecibirItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      itemId: string
      pedidoId: string
      recibido: boolean
    }) => {
      const { error } = await supabase
        .from('pedidos_repuestos_items')
        .update({
          recibido: input.recibido,
          recibido_at: input.recibido ? new Date().toISOString() : null,
        })
        .eq('id', input.itemId)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-repuestos'] })
      queryClient.invalidateQueries({ queryKey: ['pedido-repuesto', vars.pedidoId] })
    },
  })
}

// ------------------------------------------------------------
// Entregar pedido (descuenta stock + setea etapa='entregado'). RPC SQL.
// ------------------------------------------------------------

export function useEntregarPedido() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: { pedidoId: string }) => {
      const { data, error } = await supabase.rpc('entregar_pedido_repuestos', {
        p_pedido_id: input.pedidoId,
        p_usuario_id: user!.id,
      })
      if (error) throw error
      return data as { pedido_id: string; unidades_descontadas: number; sucursal: string; entregado_at: string }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-repuestos'] })
      queryClient.invalidateQueries({ queryKey: ['pedido-repuesto', vars.pedidoId] })
      queryClient.invalidateQueries({ queryKey: ['repuestos'] })
      queryClient.invalidateQueries({ queryKey: ['stock-disponible'] })
      queryClient.invalidateQueries({ queryKey: ['stock-disponible-agregado'] })
    },
  })
}

// ------------------------------------------------------------
// Cancelar pedido (etapa='cancelado' + motivo)
// ------------------------------------------------------------

export function useCancelarPedido() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { pedidoId: string; motivo: string }) => {
      const { error } = await supabase
        .from('pedidos_repuestos')
        .update({
          etapa: 'cancelado',
          motivo_cancelacion: input.motivo,
        })
        .eq('id', input.pedidoId)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-repuestos'] })
      queryClient.invalidateQueries({ queryKey: ['pedido-repuesto', vars.pedidoId] })
    },
  })
}

export type { PedidoRepuestoItem }
