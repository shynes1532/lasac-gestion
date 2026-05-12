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
  /** Si true, devuelve solo unidades marcadas como en oferta. */
  soloOfertas?: boolean
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
      if (filtros.soloOfertas) {
        q = q.eq('en_oferta', true)
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
  en_oferta?: boolean
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

/**
 * Solicitar transferencia: crea una fila en stock_transferencias con
 * estado='pendiente'. NO mueve el vehículo todavía — se mueve cuando
 * logística marca la transferencia como completada.
 */
export function useSolicitarTransferencia() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ stockId, sucursalDestino, motivo }: {
      stockId: string
      sucursalDestino: Sucursal
      motivo?: string
    }) => {
      const { data: vehiculo, error: getErr } = await supabase
        .from('stock_vehiculos')
        .select('sucursal')
        .eq('id', stockId)
        .single()
      if (getErr) throw getErr

      if (vehiculo.sucursal === sucursalDestino) {
        throw new Error('La sucursal de destino es la misma que la actual')
      }

      const { error: trErr } = await supabase
        .from('stock_transferencias')
        .insert({
          stock_id: stockId,
          sucursal_origen: vehiculo.sucursal,
          sucursal_destino: sucursalDestino,
          motivo: motivo || null,
          estado: 'pendiente',
          solicitado_por: user!.id,
        })
      if (trErr) throw trErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transferencias-pendientes'] })
      queryClient.invalidateQueries({ queryKey: ['stock-transferencias'] })
    },
  })
}

/**
 * Completar transferencia: marca como 'completada' y mueve el vehículo
 * a la sucursal destino. Es lo que ejecuta logística cuando el auto llega.
 */
export function useCompletarTransferencia() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (transferenciaId: string) => {
      const { data: t, error: getErr } = await supabase
        .from('stock_transferencias')
        .select('stock_id, sucursal_destino, estado')
        .eq('id', transferenciaId)
        .single()
      if (getErr) throw getErr
      if (t.estado === 'completada') throw new Error('Esta transferencia ya está completada')
      if (t.estado === 'cancelada')  throw new Error('Esta transferencia fue cancelada')

      const { error: upTrErr } = await supabase
        .from('stock_transferencias')
        .update({ estado: 'completada', fecha_completada: new Date().toISOString() })
        .eq('id', transferenciaId)
      if (upTrErr) throw upTrErr

      const { error: upVehErr } = await supabase
        .from('stock_vehiculos')
        .update({ sucursal: t.sucursal_destino })
        .eq('id', t.stock_id)
      if (upVehErr) throw upVehErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['stock-transferencias-pendientes'] })
      queryClient.invalidateQueries({ queryKey: ['stock-transferencias'] })
    },
  })
}

/**
 * Marcar la transferencia como 'en_transito' (salió de origen, no llegó aún).
 */
export function useMarcarEnTransito() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (transferenciaId: string) => {
      const { data, error } = await supabase
        .from('stock_transferencias')
        .update({ estado: 'en_transito' })
        .eq('id', transferenciaId)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('No se pudo actualizar (sin permisos o ID inválido)')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transferencias-pendientes'] })
    },
  })
}

export function useCancelarTransferencia() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (transferenciaId: string) => {
      const { data, error } = await supabase
        .from('stock_transferencias')
        .update({ estado: 'cancelada' })
        .eq('id', transferenciaId)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('No se pudo cancelar (sin permisos o ID inválido)')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transferencias-pendientes'] })
    },
  })
}

interface TransferenciaPendiente {
  id: string
  stock_id: string
  sucursal_origen: Sucursal
  sucursal_destino: Sucursal
  motivo: string | null
  estado: 'pendiente' | 'en_transito' | 'completada' | 'cancelada'
  created_at: string
  fecha_completada: string | null
  stock_vehiculos: {
    vin: string
    marca: string
    modelo: string
    version: string | null
    color: string | null
    patente: string | null
    titular_plan: string | null
  } | null
}

/**
 * Lista de transferencias activas (pendientes + en_transito).
 * Filtrable por sucursal y por estado.
 */
export function useTransferenciasPendientes(filtro: {
  sucursal?: Sucursal | 'todas'
  /** 'activas' (default) = pendiente+en_transito · 'pendiente' · 'en_transito' · 'completada' · 'todas' */
  estado?: 'activas' | 'pendiente' | 'en_transito' | 'completada' | 'todas'
} = {}) {
  const estado = filtro.estado ?? 'activas'

  return useQuery({
    queryKey: ['stock-transferencias-pendientes', filtro],
    queryFn: async () => {
      let q = supabase
        .from('stock_transferencias')
        .select(`
          *,
          stock_vehiculos ( vin, marca, modelo, version, color, patente, titular_plan )
        `)
        .order('created_at', { ascending: false })

      if (estado === 'activas') {
        q = q.in('estado', ['pendiente', 'en_transito'])
      } else if (estado !== 'todas') {
        q = q.eq('estado', estado)
      }

      if (filtro.sucursal && filtro.sucursal !== 'todas') {
        q = q.or(`sucursal_origen.eq.${filtro.sucursal},sucursal_destino.eq.${filtro.sucursal}`)
      }

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as TransferenciaPendiente[]
    },
  })
}

export type { TransferenciaPendiente }

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
