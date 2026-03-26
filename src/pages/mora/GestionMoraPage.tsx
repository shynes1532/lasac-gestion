import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Phone, Clock, Plus, X, Calendar,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { CuotaAhorro, Ahorrista, GestionMora, TipoGestionMora, ResultadoGestionMora } from '../../lib/types'
import { ESTADOS_CUOTA, TIPOS_GESTION_MORA, RESULTADOS_GESTION_MORA } from '../../lib/constants'
import { Skeleton } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

function formatMoney(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

interface CuotaConAhorrista extends CuotaAhorro {
  ahorrista: Pick<Ahorrista, 'id' | 'nombre_apellido' | 'dni_cuil' | 'telefono'> & {
    grupo: { numero_grupo: string } | null
  }
}

export function GestionMoraPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [showGestionModal, setShowGestionModal] = useState<CuotaConAhorrista | null>(null)
  const [tabActiva, setTabActiva] = useState<'vencidas' | 'en_mora' | 'gestiones'>('vencidas')

  // Cuotas vencidas / en mora
  const { data: cuotasMora, isLoading } = useQuery({
    queryKey: ['cuotas-mora'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cuotas_ahorro')
        .select(`
          *,
          ahorrista:ahorristas!inner(id, nombre_apellido, dni_cuil, telefono,
            grupo:grupos_ahorro(numero_grupo)
          )
        `)
        .in('estado', ['vencida', 'en_mora'])
        .order('fecha_vencimiento', { ascending: true })

      if (error) throw error
      return (data ?? []) as CuotaConAhorrista[]
    },
  })

  // Historial de gestiones
  const { data: gestiones } = useQuery({
    queryKey: ['gestiones-mora'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gestiones_mora')
        .select(`
          *,
          ahorrista:ahorristas(nombre_apellido, dni_cuil)
        `)
        .order('fecha_gestion', { ascending: false })
        .limit(50)

      if (error) throw error
      return (data ?? []) as GestionMora[]
    },
  })

  // Form for new gestion
  const [formGestion, setFormGestion] = useState({
    tipo_gestion: 'llamada' as TipoGestionMora,
    resultado: 'sin_contacto' as ResultadoGestionMora,
    fecha_promesa: '',
    monto_prometido: '',
    observaciones: '',
  })

  const registrarGestion = useMutation({
    mutationFn: async (cuota: CuotaConAhorrista) => {
      const { error } = await supabase.from('gestiones_mora').insert({
        ahorrista_id: cuota.ahorrista.id,
        cuota_id: cuota.id,
        tipo_gestion: formGestion.tipo_gestion,
        resultado: formGestion.resultado,
        fecha_promesa: formGestion.fecha_promesa || null,
        monto_prometido: formGestion.monto_prometido ? parseFloat(formGestion.monto_prometido) : null,
        observaciones: formGestion.observaciones || null,
        gestionado_por: user?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestiones-mora'] })
      queryClient.invalidateQueries({ queryKey: ['cuotas-mora'] })
      toast.success('Gestion registrada')
      setShowGestionModal(null)
      setFormGestion({
        tipo_gestion: 'llamada', resultado: 'sin_contacto',
        fecha_promesa: '', monto_prometido: '', observaciones: '',
      })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const cuotas = cuotasMora ?? []
  const vencidas = cuotas.filter(c => c.estado === 'vencida')
  const enMora = cuotas.filter(c => c.estado === 'en_mora')
  const totalDeuda = cuotas.reduce((s, c) => s + (c.monto - c.monto_pagado), 0)
  const totalIntereses = cuotas.reduce((s, c) => s + c.interes_mora, 0)

  if (isLoading) return <Skeleton className="h-64" />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle className="h-6 w-6 text-red-500" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Gestion de Mora</h1>
          <p className="text-sm text-text-secondary">
            {cuotas.length} cuota{cuotas.length !== 1 ? 's' : ''} en situacion irregular
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Cuotas vencidas</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{vencidas.length}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">En mora</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{enMora.length}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Deuda total</p>
          <p className="text-xl font-bold text-text-primary mt-1">{formatMoney(totalDeuda)}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Intereses mora</p>
          <p className="text-xl font-bold text-red-400 mt-1">{formatMoney(totalIntereses)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-bg-secondary rounded-lg p-1 border border-border">
        {([
          { key: 'vencidas', label: `Vencidas (${vencidas.length})` },
          { key: 'en_mora', label: `En mora (${enMora.length})` },
          { key: 'gestiones', label: 'Historial gestiones' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setTabActiva(tab.key)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              tabActiva === tab.key
                ? 'bg-action text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cuotas list */}
      {(tabActiva === 'vencidas' || tabActiva === 'en_mora') && (
        <div className="space-y-3">
          {(tabActiva === 'vencidas' ? vencidas : enMora).length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-semibold">Sin cuotas {tabActiva === 'vencidas' ? 'vencidas' : 'en mora'}</p>
            </div>
          ) : (
            (tabActiva === 'vencidas' ? vencidas : enMora).map(c => {
              const estadoInfo = ESTADOS_CUOTA[c.estado]
              const pendiente = c.monto - c.monto_pagado
              return (
                <div
                  key={c.id}
                  className={`bg-bg-secondary border rounded-xl p-4 ${
                    c.estado === 'en_mora' ? 'border-red-500/40' : 'border-orange-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-text-primary">{c.ahorrista.nombre_apellido}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${estadoInfo.color}`}>
                          {estadoInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-text-muted">
                        <span>DNI: {c.ahorrista.dni_cuil}</span>
                        {c.ahorrista.grupo && <span>Grupo: {c.ahorrista.grupo.numero_grupo}</span>}
                        <span>Cuota #{c.numero_cuota}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Vence: {c.fecha_vencimiento}
                        </span>
                        {c.dias_mora > 0 && (
                          <span className="text-red-400 font-medium">{c.dias_mora} dias de mora</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-500">{formatMoney(pendiente)}</p>
                      <p className="text-xs text-text-muted">pendiente</p>
                      {c.interes_mora > 0 && (
                        <p className="text-xs text-red-400">+ {formatMoney(c.interes_mora)} intereses</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => setShowGestionModal(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-action/10 text-action rounded-lg text-xs font-medium hover:bg-action/20 transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Registrar gestion
                    </button>
                    {c.ahorrista.telefono && (
                      <a
                        href={`https://wa.me/${c.ahorrista.telefono.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-500 rounded-lg text-xs font-medium hover:bg-green-500/20 transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Historial gestiones */}
      {tabActiva === 'gestiones' && (
        <div className="space-y-3">
          {(gestiones ?? []).length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-semibold">Sin gestiones registradas</p>
            </div>
          ) : (
            (gestiones ?? []).map(g => (
              <div key={g.id} className="bg-bg-secondary border border-border rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {g.ahorrista?.nombre_apellido ?? 'Desconocido'}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                      <span className="capitalize">{g.tipo_gestion.replace('_', ' ')}</span>
                      <span className="capitalize">{g.resultado.replace('_', ' ')}</span>
                      <span>{new Date(g.fecha_gestion).toLocaleDateString('es-AR')}</span>
                    </div>
                    {g.observaciones && (
                      <p className="text-xs text-text-secondary mt-1">{g.observaciones}</p>
                    )}
                  </div>
                  {g.fecha_promesa && (
                    <div className="text-right text-xs">
                      <p className="text-text-muted">Promesa</p>
                      <p className="text-text-primary font-medium">{g.fecha_promesa}</p>
                      {g.monto_prometido && (
                        <p className="text-green-400">{formatMoney(g.monto_prometido)}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Gestion modal */}
      {showGestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowGestionModal(null)} />
          <div className="relative bg-bg-secondary border border-border rounded-2xl p-6 w-full max-w-md mx-4">
            <button onClick={() => setShowGestionModal(null)} className="absolute top-4 right-4 text-text-muted hover:text-text-primary cursor-pointer">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-text-primary mb-1">Registrar gestion de mora</h2>
            <p className="text-sm text-text-secondary mb-4">
              {showGestionModal.ahorrista.nombre_apellido} — Cuota #{showGestionModal.numero_cuota}
            </p>

            <form
              onSubmit={e => {
                e.preventDefault()
                registrarGestion.mutate(showGestionModal)
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Tipo de gestion</label>
                  <select
                    value={formGestion.tipo_gestion}
                    onChange={e => setFormGestion(f => ({ ...f, tipo_gestion: e.target.value as TipoGestionMora }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary cursor-pointer"
                  >
                    {TIPOS_GESTION_MORA.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Resultado</label>
                  <select
                    value={formGestion.resultado}
                    onChange={e => setFormGestion(f => ({ ...f, resultado: e.target.value as ResultadoGestionMora }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary cursor-pointer"
                  >
                    {RESULTADOS_GESTION_MORA.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {formGestion.resultado === 'promesa_pago' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Fecha promesa</label>
                    <input
                      type="date"
                      value={formGestion.fecha_promesa}
                      onChange={e => setFormGestion(f => ({ ...f, fecha_promesa: e.target.value }))}
                      className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Monto prometido ($)</label>
                    <input
                      type="number"
                      value={formGestion.monto_prometido}
                      onChange={e => setFormGestion(f => ({ ...f, monto_prometido: e.target.value }))}
                      className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-text-muted mb-1">Observaciones</label>
                <textarea
                  value={formGestion.observaciones}
                  onChange={e => setFormGestion(f => ({ ...f, observaciones: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action resize-none"
                  placeholder="Detalle de la gestion realizada..."
                />
              </div>

              <button
                type="submit"
                disabled={registrarGestion.isPending}
                className="w-full py-2.5 bg-action text-white rounded-lg text-sm font-medium hover:bg-action-hover transition-colors disabled:opacity-50 cursor-pointer"
              >
                {registrarGestion.isPending ? 'Registrando...' : 'Registrar gestion'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
