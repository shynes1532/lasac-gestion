import { useQuery } from '@tanstack/react-query'
import { FileText, Wrench, Truck, AlertTriangle, TrendingUp, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Card, KPICard, Badge, Skeleton } from '../../components/ui'
import { useNavigate } from 'react-router-dom'

export function DashboardPage() {
  const { perfil } = useAuth()
  const navigate = useNavigate()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [opsRes, csiRes, pdiRes, entregasRes, notifRes] = await Promise.all([
        supabase.from('operaciones').select('id, estado_actual, sucursal, created_at', { count: 'exact' }).neq('estado_actual', 'cerrada'),
        supabase.from('encuestas_csi').select('promedio, p5_nps, alerta_activa, contacto_realizado'),
        supabase.from('alistamiento_pdi').select('id, aprobado, no_conformidades, created_at').is('aprobado', null),
        supabase.from('entregas').select('id, fecha_programada, acto_entregado_at').is('acto_entregado_at', null),
        supabase.from('notificaciones').select('id', { count: 'exact' }).eq('destinatario_id', perfil!.id).eq('leida', false),
      ])

      const ops = opsRes.data || []
      const csis = csiRes.data || []
      const pdis = pdiRes.data || []
      const entregas = entregasRes.data || []

      // CSI promedio
      const csiPromedio = csis.length > 0 ? csis.reduce((sum, c) => sum + (c.promedio || 0), 0) / csis.length : 0

      // NPS
      const promoters = csis.filter(c => c.p5_nps >= 9).length
      const detractors = csis.filter(c => c.p5_nps <= 6).length
      const nps = csis.length > 0 ? Math.round(((promoters - detractors) / csis.length) * 100) : 0

      // Alertas CSI sin contactar
      const alertasCSI = csis.filter(c => c.alerta_activa && !c.contacto_realizado).length

      // Distribución por módulo
      const enGestoria = ops.filter(o => o.estado_actual === 'gestoria').length
      const enAlistamiento = ops.filter(o => o.estado_actual === 'alistamiento').length
      const enEntrega = ops.filter(o => o.estado_actual === 'entrega').length

      // Entregas esta semana
      const today = new Date()
      const weekEnd = new Date(today)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const entregasSemana = entregas.filter(e => {
        const fecha = new Date(e.fecha_programada)
        return fecha >= today && fecha <= weekEnd
      }).length

      return {
        totalActivas: ops.length,
        enGestoria,
        enAlistamiento,
        enEntrega,
        csiPromedio: csiPromedio.toFixed(1),
        nps,
        pdiPendientes: pdis.length,
        entregasPendientes: entregas.length,
        entregasSemana,
        alertasCSI,
        notifNoLeidas: notifRes.count || 0,
      }
    },
    enabled: !!perfil,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    )
  }

  const s = stats!

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">
          Bienvenido, {perfil?.nombre_completo}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Operaciones activas"
          value={s.totalActivas}
          icon={<FileText className="h-5 w-5" />}
          status={s.totalActivas > 25 ? 'danger' : s.totalActivas > 15 ? 'warning' : 'ok'}
        />
        <KPICard
          title="CSI promedio"
          value={s.csiPromedio}
          subtitle="Objetivo: ≥ 4.5"
          icon={<TrendingUp className="h-5 w-5" />}
          status={parseFloat(s.csiPromedio) >= 4.5 ? 'ok' : parseFloat(s.csiPromedio) >= 4 ? 'warning' : 'danger'}
        />
        <KPICard
          title="NPS"
          value={s.nps}
          subtitle="Objetivo: ≥ 50"
          icon={<Users className="h-5 w-5" />}
          status={s.nps >= 50 ? 'ok' : s.nps >= 30 ? 'warning' : 'danger'}
        />
        <KPICard
          title="Entregas esta semana"
          value={s.entregasSemana}
          icon={<Truck className="h-5 w-5" />}
          status="ok"
        />
      </div>

      {/* Distribución por módulo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="cursor-pointer hover:border-border-light" onClick={() => navigate('/gestoria')}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-600/10">
              <FileText className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{s.enGestoria}</p>
              <p className="text-sm text-text-muted">En gestoría</p>
            </div>
          </div>
        </Card>
        <Card className="cursor-pointer hover:border-border-light" onClick={() => navigate('/alistamiento')}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-warning/10">
              <Wrench className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{s.enAlistamiento}</p>
              <p className="text-sm text-text-muted">En alistamiento</p>
            </div>
          </div>
        </Card>
        <Card className="cursor-pointer hover:border-border-light" onClick={() => navigate('/entrega')}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-orange-600/10">
              <Truck className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{s.enEntrega}</p>
              <p className="text-sm text-text-muted">En entrega</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alertas */}
      {(s.alertasCSI > 0 || s.pdiPendientes > 3) && (
        <Card className="border-l-4 border-l-danger mb-6">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-danger" />
            Alertas
          </h3>
          <div className="space-y-2">
            {s.alertasCSI > 0 && (
              <p className="text-sm text-text-secondary">
                <Badge color="red" size="sm" className="mr-2">CSI</Badge>
                {s.alertasCSI} encuesta(s) con calificación baja sin contactar
              </p>
            )}
            {s.pdiPendientes > 3 && (
              <p className="text-sm text-text-secondary">
                <Badge color="yellow" size="sm" className="mr-2">PDI</Badge>
                {s.pdiPendientes} unidades en cola de alistamiento
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Info rápida */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-3">PDI pendientes</h3>
          <p className="text-3xl font-bold text-text-primary">{s.pdiPendientes}</p>
          <p className="text-sm text-text-muted mt-1">unidades esperando inspección</p>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Entregas pendientes</h3>
          <p className="text-3xl font-bold text-text-primary">{s.entregasPendientes}</p>
          <p className="text-sm text-text-muted mt-1">entregas por realizar</p>
        </Card>
      </div>
    </div>
  )
}
