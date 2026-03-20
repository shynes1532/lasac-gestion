import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase, supabaseAnon } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Notificacion } from '../lib/types'

export function useNotificaciones() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['notificaciones', user?.id],
    queryFn: async () => {
      const { data, error } = await supabaseAnon
        .from('notificaciones')
        .select('*')
        .eq('destinatario_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data as Notificacion[]
    },
    enabled: !!user,
  })

  // Suscribir a Realtime
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('notificaciones-user')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `destinatario_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notificaciones', user.id] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, queryClient])

  const noLeidas = query.data?.filter((n) => !n.leida).length || 0

  return { ...query, noLeidas }
}

export function useMarcarLeida() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] })
    },
  })
}

export function useMarcarTodasLeidas() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('destinatario_id', user!.id)
        .eq('leida', false)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] })
    },
  })
}
