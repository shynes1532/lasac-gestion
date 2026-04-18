import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { StockVehiculo, TransferenciaStock, TipoStock, EstadoStock, Sucursal } from '../lib/types'

interface FiltrosStock {
  busqueda?: string
  tipo?: TipoStock | ''
  sucursal?: Sucursal | 'todas'
  estado?: EstadoStock | ''
  excluirBatea?: boolean
}

export function useStock(filtros: FiltrosStock = {}) {
  return useQuery({
    queryKey: ['stock', filtros],
    queryFn: async () => {
      let q = supabase
        .from('stock_vehiculos')
        .select('*, operacion:operaciones(id, numero_operacion, cliente_nombre)')
        .order('created_at', { ascending: false })

      if (filtros.tipo) {
        q = q.eq('tipo', filtros.tipo)
      }
      if (filtros.sucursal && filtros.sucursal !== 'todas') {
        q = q.eq('sucursal', filtros.sucursal)
      }
      if (filtros.estado) {
        q = q.eq('estado', filtros.estado)
      }
      if (filtros.excluirBatea) {
        q = q.neq('estado', 'batea')
      }
      if (filtros.busqueda) {
        const b = filtros.busqueda
        q = q.or(`vin.ilike.%${b}%,modelo.ilike.%${b}%,patente.ilike.%${b}%,titular_plan.ilike.%${b}%,color.ilike.%${b}%`)
      }

      const { data, error } = await q
      if (error) throw error
      return data as StockVehiculo[]
    },
  })
}

export function useTransferencias(stockId: string | null) {
  return useQuery({
    queryKey: ['stock-transferencias', stockId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_transferencias')
        .select('*')
        .eq('stock_id', stockId!)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as TransferenciaStock[]
    },
    enabled: !!stockId,
  })
}

interface CrearStockData {
  vin: string
  marca?: string
  modelo: string
  version?: string
  color?: string
  anio?: number
  tipo: TipoStock
  sucursal: Sucursal
  precio?: number
  kilometraje?: number
  grupo_orden?: string
  titular_plan?: string
  patente?: string
  observaciones?: string
}

export function useCrearStock() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (data: CrearStockData) => {
      const { data: item, error } = await supabase
        .from('stock_vehiculos')
        .insert({
          ...data,
          marca: data.marca || 'FIAT',
          created_by: user!.id,
        })
        .select()
        .single()

      if (error) throw error
      return item as StockVehiculo
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}

export function useActualizarStock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<StockVehiculo> & { id: string }) => {
      const { error } = await supabase
        .from('stock_vehiculos')
        .update(data)
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}

export function useTransferirStock() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ stockId, sucursalDestino, motivo }: {
      stockId: string
      sucursalDestino: Sucursal
      motivo?: string
    }) => {
      // Get current sucursal
      const { data: vehiculo, error: getErr } = await supabase
        .from('stock_vehiculos')
        .select('sucursal')
        .eq('id', stockId)
        .single()

      if (getErr) throw getErr

      // Insert transferencia
      const { error: trErr } = await supabase
        .from('stock_transferencias')
        .insert({
          stock_id: stockId,
          sucursal_origen: vehiculo.sucursal,
          sucursal_destino: sucursalDestino,
          motivo: motivo || null,
          realizado_por: user!.id,
        })

      if (trErr) throw trErr

      // Update sucursal
      const { error: upErr } = await supabase
        .from('stock_vehiculos')
        .update({ sucursal: sucursalDestino })
        .eq('id', stockId)

      if (upErr) throw upErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['stock-transferencias'] })
    },
  })
}

export function useEliminarStock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stock_vehiculos')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}
