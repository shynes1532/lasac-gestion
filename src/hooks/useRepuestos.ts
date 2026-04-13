import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Repuesto, RepuestoMovimiento } from '../lib/types'

export function useRepuestos(busqueda?: string) {
  const { perfil } = useAuth()

  return useQuery({
    queryKey: ['repuestos', busqueda, perfil?.sucursal],
    queryFn: async () => {
      let q = supabase
        .from('repuestos')
        .select('*')
        .eq('activo', true)
        .order('descripcion', { ascending: true })

      if (perfil?.sucursal && perfil.sucursal !== 'Ambas') {
        q = q.eq('sucursal', perfil.sucursal)
      }
      if (busqueda) {
        q = q.or(`codigo_fiat.ilike.%${busqueda}%,descripcion.ilike.%${busqueda}%`)
      }

      const { data, error } = await q
      if (error) throw error
      return data as Repuesto[]
    },
    enabled: !!perfil,
  })
}

export function useRepuestoPorCodigo(codigo: string | null) {
  const { perfil } = useAuth()

  return useQuery({
    queryKey: ['repuesto-codigo', codigo, perfil?.sucursal],
    queryFn: async () => {
      let q = supabase
        .from('repuestos')
        .select('*')
        .eq('codigo_fiat', codigo!)
        .eq('activo', true)

      if (perfil?.sucursal && perfil.sucursal !== 'Ambas') {
        q = q.eq('sucursal', perfil.sucursal)
      }

      const { data, error } = await q
      if (error) throw error
      return (data?.[0] as Repuesto) || null
    },
    enabled: !!codigo && !!perfil,
  })
}

export function useMovimientos(repuestoId: string | null) {
  return useQuery({
    queryKey: ['repuesto-movimientos', repuestoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('repuestos_movimientos')
        .select('*')
        .eq('repuesto_id', repuestoId!)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data as RepuestoMovimiento[]
    },
    enabled: !!repuestoId,
  })
}

interface CrearRepuestoData {
  codigo_fiat: string
  descripcion: string
  ubicacion?: string
  stock_actual?: number
  stock_minimo?: number
  precio_costo?: number
  precio_venta?: number
}

export function useCrearRepuesto() {
  const queryClient = useQueryClient()
  const { user, perfil } = useAuth()

  return useMutation({
    mutationFn: async (data: CrearRepuestoData) => {
      const { data: rep, error } = await supabase
        .from('repuestos')
        .insert({
          ...data,
          sucursal: perfil?.sucursal === 'Ambas' ? 'Ushuaia' : perfil?.sucursal,
          created_by: user!.id,
        })
        .select()
        .single()

      if (error) throw error
      return rep as Repuesto
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repuestos'] })
    },
  })
}

interface MovimientoData {
  repuesto_id: string
  tipo: 'ingreso' | 'egreso'
  cantidad: number
  motivo?: string
}

export function useRegistrarMovimiento() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (data: MovimientoData) => {
      // 1. Get current stock
      const { data: rep, error: repErr } = await supabase
        .from('repuestos')
        .select('stock_actual')
        .eq('id', data.repuesto_id)
        .single()

      if (repErr) throw repErr

      const stockAnterior = rep.stock_actual
      const stockPosterior = data.tipo === 'ingreso'
        ? stockAnterior + data.cantidad
        : stockAnterior - data.cantidad

      if (stockPosterior < 0) throw new Error('Stock insuficiente')

      // 2. Insert movimiento
      const { error: movErr } = await supabase
        .from('repuestos_movimientos')
        .insert({
          repuesto_id: data.repuesto_id,
          tipo: data.tipo,
          cantidad: data.cantidad,
          motivo: data.motivo || null,
          stock_anterior: stockAnterior,
          stock_posterior: stockPosterior,
          realizado_por: user!.id,
        })

      if (movErr) throw movErr

      // 3. Update stock
      const { error: upErr } = await supabase
        .from('repuestos')
        .update({ stock_actual: stockPosterior })
        .eq('id', data.repuesto_id)

      if (upErr) throw upErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repuestos'] })
      queryClient.invalidateQueries({ queryKey: ['repuesto-codigo'] })
      queryClient.invalidateQueries({ queryKey: ['repuesto-movimientos'] })
    },
  })
}
