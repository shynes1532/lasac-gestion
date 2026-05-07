// ============================================================
// Hooks para la tabla `clientes` del módulo Repuestos.
// El cliente "MOSTRADOR" (uuid 0000...0001) viene del seed 015.
// ============================================================

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Cliente } from '../types/pricing'

export const CLIENTE_MOSTRADOR_ID = '00000000-0000-0000-0000-000000000001'

export function useClientes(busqueda?: string) {
  return useQuery({
    queryKey: ['clientes', busqueda ?? null],
    queryFn: async () => {
      let q = supabase
        .from('clientes')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true })

      if (busqueda && busqueda.trim().length > 0) {
        q = q.or(
          `nombre.ilike.%${busqueda}%,cuit.ilike.%${busqueda}%`,
        )
      }

      const { data, error } = await q
      if (error) throw error
      return data as Cliente[]
    },
    staleTime: 60_000,
  })
}

export function useCliente(id: string | null | undefined) {
  return useQuery({
    queryKey: ['cliente', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Cliente
    },
    enabled: !!id,
    staleTime: 60_000,
  })
}
