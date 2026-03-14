import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Operacion, Titular, Unidad, GestoriaTramite, OperacionCompleta } from '../lib/types'

interface FiltrosOperaciones {
  estado_gestoria?: string
  sucursal?: string
  tipo_operacion?: string
  busqueda?: string
  page?: number
  pageSize?: number
}

export function useOperaciones(filtros: FiltrosOperaciones = {}) {
  const { perfil } = useAuth()
  const { page = 1, pageSize = 20 } = filtros

  return useQuery({
    queryKey: ['operaciones', filtros, perfil?.sucursal],
    queryFn: async () => {
      let query = supabase
        .from('operaciones')
        .select(`
          *,
          titular:titulares(*),
          unidad:unidades(*),
          gestoria:gestoria_tramites(*),
          alistamiento:alistamiento_pdi(*),
          entrega:entregas(*)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)

      if (filtros.estado_gestoria) {
        query = query.eq('estado_gestoria', filtros.estado_gestoria)
      }
      if (filtros.sucursal) {
        query = query.eq('sucursal', filtros.sucursal)
      }
      if (filtros.tipo_operacion) {
        query = query.eq('tipo_operacion', filtros.tipo_operacion)
      }
      if (filtros.busqueda) {
        query = query.or(`numero_operacion.ilike.%${filtros.busqueda}%`)
      }

      const { data, error, count } = await query
      if (error) throw error
      return { data: data as OperacionCompleta[], count: count || 0 }
    },
    enabled: !!perfil,
  })
}

export function useOperacion(id: string | undefined) {
  return useQuery({
    queryKey: ['operacion', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operaciones')
        .select(`
          *,
          titular:titulares(*),
          unidad:unidades(*),
          gestoria:gestoria_tramites(*),
          alistamiento:alistamiento_pdi(*),
          entrega:entregas(*),
          encuesta:encuestas_csi(*)
        `)
        .eq('id', id!)
        .single()

      if (error) throw error
      return data as OperacionCompleta
    },
    enabled: !!id,
  })
}

interface NuevaOperacionData {
  operacion: Partial<Operacion>
  titular: Partial<Titular>
  unidad: Partial<Unidad>
  gestoria: Partial<GestoriaTramite>
}

export function useCrearOperacion() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (data: NuevaOperacionData) => {
      // Insert operacion
      const { data: op, error: opErr } = await supabase
        .from('operaciones')
        .insert({
          ...data.operacion,
          created_by: user!.id,
          estado_actual: 'gestoria',
          estado_gestoria: 'ingresado',
        })
        .select()
        .single()

      if (opErr) throw opErr

      // Insert titular, unidad, gestoria in parallel
      const [titularRes, unidadRes, gestoriaRes] = await Promise.all([
        supabase.from('titulares').insert({ ...data.titular, operacion_id: op.id }),
        supabase.from('unidades').insert({ ...data.unidad, operacion_id: op.id }),
        supabase.from('gestoria_tramites').insert({
          ...data.gestoria,
          operacion_id: op.id,
          gestor_responsable: user!.id,
        }),
      ])

      if (titularRes.error) throw titularRes.error
      if (unidadRes.error) throw unidadRes.error
      if (gestoriaRes.error) throw gestoriaRes.error

      return op as Operacion
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operaciones'] })
    },
  })
}

export function useActualizarEstadoGestoria() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ id, nuevoEstado, motivo }: { id: string; nuevoEstado: string; motivo?: string }) => {
      // Get current state
      const { data: current } = await supabase
        .from('operaciones')
        .select('estado_gestoria')
        .eq('id', id)
        .single()

      // Update estado
      const updates: Record<string, any> = { estado_gestoria: nuevoEstado }

      // If listo → update estado_actual to alistamiento
      if (nuevoEstado === 'listo') {
        updates.estado_actual = 'alistamiento'
      }

      const { error } = await supabase
        .from('operaciones')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      // Add to historial
      const { data: gestoria } = await supabase
        .from('gestoria_tramites')
        .select('historial_estados')
        .eq('operacion_id', id)
        .single()

      if (gestoria) {
        const historial = Array.isArray(gestoria.historial_estados) ? gestoria.historial_estados : []
        historial.push({
          estado_anterior: current?.estado_gestoria,
          estado_nuevo: nuevoEstado,
          fecha: new Date().toISOString(),
          usuario_id: user!.id,
          motivo: motivo || null,
        })

        await supabase
          .from('gestoria_tramites')
          .update({ historial_estados: historial })
          .eq('operacion_id', id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operaciones'] })
      queryClient.invalidateQueries({ queryKey: ['operacion'] })
    },
  })
}
