import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Recepcion } from '../lib/types'

interface FiltrosRecepcion {
  area?: string
  estado?: string
  fecha?: string // YYYY-MM-DD
  busqueda?: string
}

export function useRecepciones(filtros: FiltrosRecepcion = {}) {
  const { perfil } = useAuth()

  return useQuery({
    queryKey: ['recepciones', filtros, perfil?.sucursal],
    queryFn: async () => {
      let query = supabase
        .from('recepciones')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (perfil?.sucursal && perfil.sucursal !== 'Ambas') {
        query = query.eq('sucursal', perfil.sucursal)
      }

      if (filtros.area) {
        query = query.eq('area', filtros.area)
      }
      if (filtros.estado) {
        query = query.eq('estado', filtros.estado)
      }
      if (filtros.fecha) {
        query = query.gte('created_at', `${filtros.fecha}T00:00:00`)
          .lte('created_at', `${filtros.fecha}T23:59:59`)
      }
      if (filtros.busqueda) {
        query = query.or(`nombre.ilike.%${filtros.busqueda}%,telefono.ilike.%${filtros.busqueda}%`)
      }

      const { data, error, count } = await query
      if (error) throw error
      return { data: data as Recepcion[], count: count || 0 }
    },
    enabled: !!perfil,
  })
}

// Hook para traer recepciones de un mes completo (para dashboard)
export function useRecepcionesMes(anio: number, mes: number) {
  const { perfil } = useAuth()

  const desde = `${anio}-${String(mes).padStart(2, '0')}-01T00:00:00`
  const ultimoDia = new Date(anio, mes, 0).getDate()
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-${ultimoDia}T23:59:59`

  return useQuery({
    queryKey: ['recepciones-mes', anio, mes, perfil?.sucursal],
    queryFn: async () => {
      let query = supabase
        .from('recepciones')
        .select('*')
        .gte('created_at', desde)
        .lte('created_at', hasta)
        .order('created_at', { ascending: false })

      if (perfil?.sucursal && perfil.sucursal !== 'Ambas') {
        query = query.eq('sucursal', perfil.sucursal)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Recepcion[]
    },
    enabled: !!perfil,
  })
}

interface NuevaRecepcionData {
  nombre: string
  telefono: string
  area: string
  subarea: string
  origen?: string
  modelo_interes?: string
  notas?: string
}

export function useCrearRecepcion() {
  const queryClient = useQueryClient()
  const { user, perfil } = useAuth()

  return useMutation({
    mutationFn: async (data: NuevaRecepcionData) => {
      const { data: rec, error } = await supabase
        .from('recepciones')
        .insert({
          ...data,
          created_by: user!.id,
          sucursal: perfil?.sucursal === 'Ambas' ? 'Ushuaia' : perfil?.sucursal,
          estado: 'en_espera',
        })
        .select()
        .single()

      if (error) throw error
      return rec as Recepcion
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recepciones'] })
      queryClient.invalidateQueries({ queryKey: ['recepciones-mes'] })
    },
  })
}

export function useMarcarAtendido() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recepciones')
        .update({ estado: 'atendido', atendido_por: user!.id })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recepciones'] })
    },
  })
}

export function useMarcarContactado() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recepciones')
        .update({ estado: 'contactado', contactado_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recepciones'] })
    },
  })
}
