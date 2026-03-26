import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Phone, Mail, Clock, Plus, X, Calendar, Skull,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Ahorrista, GestionMora, TipoGestionMora, ResultadoGestionMora } from '../../lib/types'
import { ESTADOS_AHORRISTA, TIPOS_GESTION_MORA, RESULTADOS_GESTION_MORA, REGLAS_FIAT_PLAN } from '../../lib/constants'
import { Skeleton } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

function formatMoney(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

export function GestionMoraPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [showGestionModal, setShowGestionModal] = useState<Ahorrista | null>(null)
  const [tabActiva, setTabActiva] = useState<'riesgo' | 'morosos' | 'gestiones'>('riesgo')

  // Ahorristas con mora
  const { data: ahorristas, isLoading } = useQuery({
    queryKey: ['mora-ahorristas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ahorristas')
        .select('*')
        .gt('cuotas_impagas_total', 0)
        .eq('estado', 'activo')
        .order('cuotas_impagas_total', { ascending: false })
      if (error) throw error
      return (data ?? []) as Ahorrista[]
    },
  })

  // Historial de gestiones
  const { data: gestiones } = useQuery({
    queryKey: ['gestiones-mora'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gestiones_mora')
        .select('*, ahorrista:ahorristas(nombre_apellido, dni_cuil, vendedor_nombre)')
        .order('fecha_gestion', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as GestionMora[]
    },
  })

  const [formGestion, setFormGestion] = useState({
    tipo_gestion: 'llamada' as TipoGestionMora,
    resultado: 'sin_contacto' as ResultadoGestionMora,
    fecha_promesa: '',
    monto_prometido: '',
    observaciones: '',
  })

  const registrarGestion = useMutation({
    mutationFn: async (ahorrista: Ahorrista) => {
      const { error } = await supabase.from('gestiones_mora').insert({
        ahorrista_id: ahorrista.id,
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
      queryClient.invalidateQueries({ queryKey: ['mora-ahorristas'] })
      toast.success('Gestión registrada')
      setShowGestionModal(null)
      setFormGestion({ tipo_gestion: 'llamada', resultado: 'sin_contacto', fecha_promesa: '', monto_prometido: '', observaciones: '' })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const all = ahorristas ?? []
  const enRiesgo = all.filter(a => a.cuotas_impagas_total >= REGLAS_FIAT_PLAN.CUOTAS_RESCISION)
  const morosos = all.filter(a => a.cuotas_impagas_total > 0 && a.cuotas_impagas_total < REGLAS_FIAT_PLAN.CUOTAS_RESCISION)

  if (isLoading) return <Skeleton className="h-64" />

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle className="h-6 w-6 text-red-500" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Gestión de Mora</h1>
          <p className="text-sm text-text-secondary">
            3 cuotas impagas = rescisión del plan. Seguimiento crítico.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-bg-secondary border border-red-500/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Skull className="h-4 w-4 text-red-400" />
            <p className="text-xs text-red-400 uppercase tracking-wider font-semibold">Riesgo rescisión</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{enRiesgo.length}</p>
          <p className="text-xs text-text-muted">3+ cuotas impagas</p>
        </div>
        <div className="bg-bg-secondary border border-orange-500/30 rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Morosos (1-2 cuotas)</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{morosos.length}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Total en mora</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{all.length}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Gestiones hoy</p>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {(gestiones ?? []).filter(g => new Date(g.fecha_gestion).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-bg-secondary rounded-lg p-1 border border-border">
        {([
          { key: 'riesgo', label: `Riesgo rescisión (${enRiesgo.length})` },
          { key: 'morosos', label: `Morosos (${morosos.length})` },
          { key: 'gestiones', label: 'Historial gestiones' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setTabActiva(tab.key)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              tabActiva === tab.key ? 'bg-action text-white' : 'text-text-secondary hover:text-text-primary'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Listas */}
      {(tabActiva === 'riesgo' || tabActiva === 'morosos') && (
        <div className="space-y-3">
          {(tabActiva === 'riesgo' ? enRiesgo : morosos).length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-semibold">{tabActiva === 'riesgo' ? 'Sin casos en riesgo' : 'Sin morosos'}</p>
            </div>
          ) : (
            (tabActiva === 'riesgo' ? enRiesgo : morosos).map(a => (
              <div key={a.id} className={`bg-bg-secondary border rounded-xl p-4 ${
                a.cuotas_impagas_total >= 3 ? 'border-red-500/50' : 'border-orange-500/30'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-text-primary">{a.nombre_apellido}</p>
                      {a.cuotas_impagas_total >= 3 && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                          <Skull className="h-3 w-3" /> RESCISIÓN
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                        {a.cuotas_impagas_total} cuota{a.cuotas_impagas_total !== 1 ? 's' : ''} impaga{a.cuotas_impagas_total !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-text-muted flex-wrap">
                      <span>Sol: {a.numero_solicitud}</span>
                      <span>{a.vehiculo_modelo}</span>
                      <span>Plan {a.tipo_plan} ({a.codigo_plan})</span>
                      <span>{a.cuotas_pagas} pagas de {a.tipo_plan === 'H' ? '84' : '50'}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs">
                      <span className="text-text-muted">Vendedor: <span className="text-text-secondary font-medium">{a.vendedor_nombre || '—'}</span></span>
                      <span className="text-text-muted">Cuota: <span className="text-text-secondary font-medium">{formatMoney(a.cuota_pura)}</span></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${a.cuotas_impagas_total >= 3 ? 'text-red-500' : 'text-orange-400'}`}>
                      {a.cuotas_impagas_consecutivas}
                    </p>
                    <p className="text-xs text-text-muted">consecutivas</p>
                  </div>
                </div>

                {/* Barra de peligro */}
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex gap-1">
                    {[1, 2, 3].map(n => (
                      <div key={n} className={`w-8 h-2 rounded-full ${
                        n <= a.cuotas_impagas_total ? 'bg-red-500' : 'bg-bg-tertiary'
                      }`} />
                    ))}
                  </div>
                  <span className="text-xs text-text-muted">{a.cuotas_impagas_total}/3 para rescisión</span>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => setShowGestionModal(a)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-action/10 text-action rounded-lg text-xs font-medium hover:bg-action/20 transition-colors cursor-pointer">
                    <Plus className="h-3.5 w-3.5" /> Registrar gestión
                  </button>
                  {a.telefono && (
                    <a href={`https://wa.me/${a.telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-500 rounded-lg text-xs font-medium hover:bg-green-500/20 transition-colors">
                      <Phone className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  )}
                  {a.email && (
                    <a href={`mailto:${a.email}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition-colors">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </a>
                  )}
                </div>
              </div>
            ))
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
                      {(g.ahorrista as any)?.vendedor_nombre && (
                        <span>Vendedor: {(g.ahorrista as any).vendedor_nombre}</span>
                      )}
                    </div>
                    {g.observaciones && <p className="text-xs text-text-secondary mt-1">{g.observaciones}</p>}
                  </div>
                  {g.fecha_promesa && (
                    <div className="text-right text-xs">
                      <p className="text-text-muted">Promesa</p>
                      <p className="text-text-primary font-medium">{g.fecha_promesa}</p>
                      {g.monto_prometido && <p className="text-green-400">{formatMoney(g.monto_prometido)}</p>}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal registrar gestión */}
      {showGestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowGestionModal(null)} />
          <div className="relative bg-bg-secondary border border-border rounded-2xl p-6 w-full max-w-md mx-4">
            <button onClick={() => setShowGestionModal(null)} className="absolute top-4 right-4 text-text-muted hover:text-text-primary cursor-pointer">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-text-primary mb-1">Registrar gestión de mora</h2>
            <p className="text-sm text-text-secondary mb-1">{showGestionModal.nombre_apellido}</p>
            <p className="text-xs text-text-muted mb-4">
              {showGestionModal.cuotas_impagas_total} cuotas impagas — Vendedor: {showGestionModal.vendedor_nombre || '—'}
            </p>

            <form onSubmit={e => { e.preventDefault(); registrarGestion.mutate(showGestionModal) }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Tipo de gestión</label>
                  <select value={formGestion.tipo_gestion}
                    onChange={e => setFormGestion(f => ({ ...f, tipo_gestion: e.target.value as TipoGestionMora }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary cursor-pointer">
                    {TIPOS_GESTION_MORA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Resultado</label>
                  <select value={formGestion.resultado}
                    onChange={e => setFormGestion(f => ({ ...f, resultado: e.target.value as ResultadoGestionMora }))}
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary cursor-pointer">
                    {RESULTADOS_GESTION_MORA.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              {formGestion.resultado === 'promesa_pago' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Fecha promesa</label>
                    <input type="date" value={formGestion.fecha_promesa}
                      onChange={e => setFormGestion(f => ({ ...f, fecha_promesa: e.target.value }))}
                      className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Monto prometido ($)</label>
                    <input type="number" value={formGestion.monto_prometido}
                      onChange={e => setFormGestion(f => ({ ...f, monto_prometido: e.target.value }))}
                      className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-text-muted mb-1">Observaciones</label>
                <textarea value={formGestion.observaciones}
                  onChange={e => setFormGestion(f => ({ ...f, observaciones: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-action resize-none"
                  placeholder="Detalle de la gestión realizada..." />
              </div>

              <button type="submit" disabled={registrarGestion.isPending}
                className="w-full py-2.5 bg-action text-white rounded-lg text-sm font-medium hover:bg-action-hover transition-colors disabled:opacity-50 cursor-pointer">
                {registrarGestion.isPending ? 'Registrando...' : 'Registrar gestión'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
