import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useRealtimeOperaciones() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('operaciones-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'operaciones' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['operaciones'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

export function useRealtimeTable(table: string, queryKey: string[]) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          queryClient.invalidateQueries({ queryKey })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, queryKey, queryClient])
}
