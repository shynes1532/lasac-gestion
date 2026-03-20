import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Car, FileText, CreditCard, AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react'
import { supabaseAnon } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { getSemaforoCompromiso } from '../../lib/types'
import type { TipoOperacion } from '../../lib/types'
import { COLORES_TIPO, SUCURSALES_SELECT } from '../../lib/constants'

// ─── KPI Card ────────────────────────────────────────────────
function KPI({ label, value, color, icon: Icon, onClick }: {
  label: string; value: number | string; color: string; icon: any; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-bg-secondary rounded-xl border border-border p-4 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-opacity-80 transition-all' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted font-medium uppercase tracking-wide">{label}</span>
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: color + '20' }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold text-text-primary">{value}</div>
    </div>
  )
}

// ─── Calendario mini ─────────────────────────────────────────
function Calendario({ entregas }: { entregas: any[] }) {
  const [mes, setMes] = useState(() => {
    const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }
  })

  const diasEnMes = new Date(mes.y, mes.m + 1, 0).getDate()
  const primerDia = new Date(mes.y, mes.m, 1).getDay()
  const navigate = useNavigate()

  const entregasPorDia: Record<number, any[]> = {}
  entregas.forEach(e => {
    const fecha = e.contactos_calidad?.[0]?.fecha_entrega_confirmada
    if (!fecha) return
    const d = new Date(fecha)
    if (d.getFullYear() === mes.y && d.getMonth() === mes.m) {
      const dia = d.getDate()
      if (!entregasPorDia[dia]) entregasPorDia[dia] = []
      entregasPorDia[dia].push(e)
    }
  })

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  return (
    <div className="bg-bg-secondary rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text-primary">Calendario de entregas</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setMes(p => { const d = new Date(p.y, p.m - 1); return { y: d.getFullYear(), m: d.getMonth() } })}
            className="p-1 rounded hover:bg-bg-tertiary text-text-muted cursor-pointer">‹</button>
          <span className="text-sm font-medium text-text-primary w-28 text-center">{meses[mes.m]} {mes.y}</span>
          <button onClick={() => setMes(p => { const d = new Date(p.y, p.m + 1); return { y: d.getFullYear(), m: d.getMonth() } })}
            className="p-1 rounded hover:bg-bg-tertiary text-text-muted cursor-pointer">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => (
          <div key={d} className="text-center text-xs text-text-muted py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {[...Array(primerDia)].map((_, i) => <div key={`e${i}`} />)}
        {[...Array(diasEnMes)].map((_, i) => {
          const dia = i + 1
          const ents = entregasPorDia[dia] || []
          const hoy = new Date()
          const esHoy = hoy.getDate() === dia && hoy.getMonth() === mes.m && hoy.getFullYear() === mes.y

          return (
            <div key={dia} className={`min-h-[52px] rounded-lg p-1 border ${esHoy ? 'border-action bg-action/5' : 'border-transparent hover:border-border'} transition-colors`}>
              <div className={`text-xs font-medium mb-1 text-center ${esHoy ? 'text-action' : 'text-text-secondary'}`}>{dia}</div>
              {ents.slice(0, 3).map(e => {
                const tipo = e.tipo_operacion as TipoOperacion
                const col = COLORES_TIPO[tipo] || COLORES_TIPO['0km']
                const semaforo = e.fecha_compromiso ? getSemaforoCompromiso(e.fecha_compromiso) : null
                const bgColor = semaforo === 'rojo' ? COLORES_TIPO['demorada'].bg : col.bg
                const textColor = semaforo === 'rojo' ? COLORES_TIPO['demorada'].text : col.text
                return (
                  <div key={e.id}
                    onClick={() => navigate(`/operaciones/${e.id}`)}
                    className="text-xs px-1 py-0.5 rounded mb-0.5 truncate cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: bgColor, color: textColor }}
                    title={`${e.cliente_nombre} — ${e.unidades?.[0]?.modelo || ''}`}>
                    {e.cliente_nombre?.split(' ')[0] || 'Cliente'}
                  </div>
                )
              })}
              {ents.length > 3 && <div className="text-xs text-text-muted text-center">+{ents.length - 3}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Dashboard principal ─────────────────────────────────────
export function DashboardPage() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [filtroSucursal, setFiltroSucursal] = useState<string>('todas')

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-v2', filtroSucursal],
    queryFn: async () => {
      let q = supabaseAnon
        .from('operaciones')
        .select(`
          id, tipo_operacion, estado_actual, estado_prenda, forma_pago,
          fecha_compromiso, dominio_patente, sucursal,
          cliente_nombre, cliente_telefono,
          unidades (modelo),
          contactos_calidad (fecha_entrega_confirmada, estado_calidad)
        `)
        .not('estado_actual', 'in', '("caida")')

      if (filtroSucursal !== 'todas') q = q.eq('sucursal', filtroSucursal)

      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="bg-bg-secondary rounded-xl border border-border p-4 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const ops = data || []

  // ── 7 KPIs ──
  const boletos0km = ops.filter(o => o.tipo_operacion === '0km' && o.estado_actual === 'cierre').length
  const usadosVendidos = ops.filter(o => o.tipo_operacion === 'usados').length
  const planPatentados = ops.filter(o => o.tipo_operacion === 'plan_ahorro' && o.dominio_patente).length
  const km0Patentados = ops.filter(o => o.tipo_operacion === '0km' && o.dominio_patente).length
  const activas = ops.filter(o => !['entregado','caida'].includes(o.estado_actual)).length
  const demoradas = ops.filter(o =>
    o.fecha_compromiso &&
    getSemaforoCompromiso(o.fecha_compromiso) === 'rojo' &&
    !['entregado','caida'].includes(o.estado_actual)
  ).length
  const prendasPendientes = ops.filter(o =>
    (o.forma_pago === 'financiado_banco' || o.tipo_operacion === 'plan_ahorro') &&
    o.estado_prenda === 'pendiente'
  ).length

  // Entregas para el calendario (estado calidad o entrega con fecha confirmada)
  const entregasCalendario = ops.filter(o =>
    ['calidad','entrega'].includes(o.estado_actual)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-secondary">Bienvenido, {perfil?.nombre_completo?.split(' ')[0]}</p>
        </div>
        <select value={filtroSucursal} onChange={e => setFiltroSucursal(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-bg-secondary text-text-secondary focus:outline-none">
          <option value="todas">Ambas sucursales</option>
          {SUCURSALES_SELECT.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* 7 KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Boletos 0KM" value={boletos0km} color="#185FA5" icon={FileText}
          onClick={() => navigate('/operaciones?tipo=0km&estado=cierre')} />
        <KPI label="Usados vendidos" value={usadosVendidos} color="#854F0B" icon={Car}
          onClick={() => navigate('/operaciones?tipo=usados')} />
        <KPI label="Plan patentados" value={planPatentados} color="#534AB7" icon={CheckCircle2}
          onClick={() => navigate('/operaciones?tipo=plan_ahorro')} />
        <KPI label="0KM patentados" value={km0Patentados} color="#0F6E56" icon={CheckCircle2}
          onClick={() => navigate('/operaciones?tipo=0km')} />
        <KPI label="Op. activas" value={activas} color="#475569" icon={TrendingUp}
          onClick={() => navigate('/operaciones')} />
        <KPI label="Demoradas 🔴" value={demoradas} color="#CC0000" icon={AlertTriangle}
          onClick={() => navigate('/operaciones')} />
        <KPI label="Prendas pendientes" value={prendasPendientes} color="#EF9F27" icon={CreditCard}
          onClick={() => navigate('/prendas')} />
        <KPI label="En calidad" value={ops.filter(o => o.estado_actual === 'calidad').length} color="#EA580C" icon={Clock}
          onClick={() => navigate('/calidad')} />
      </div>

      {/* Distribución por paso */}
      <div className="bg-bg-secondary rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Operaciones por paso</h2>
        <div className="space-y-2">
          {[
            { label: '1 — Cierre', key: 'cierre', color: '#0EA5E9' },
            { label: '2 — Documentación', key: 'documentacion', color: '#EAB308' },
            { label: '3 — Gestoría', key: 'gestoria', color: '#A855F7' },
            { label: '4 — PDI', key: 'alistamiento', color: '#3B82F6' },
            { label: '5 — Calidad', key: 'calidad', color: '#F97316' },
            { label: '6 — Entrega', key: 'entrega', color: '#F59E0B' },
          ].map(paso => {
            const count = ops.filter(o => o.estado_actual === paso.key).length
            const pct = activas > 0 ? (count / activas) * 100 : 0
            return (
              <div key={paso.key} className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/operaciones`)}>
                <span className="text-xs text-text-muted w-36 shrink-0">{paso.label}</span>
                <div className="flex-1 bg-bg-tertiary rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: paso.color }} />
                </div>
                <span className="text-xs font-semibold text-text-primary w-6 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Calendario */}
      <Calendario entregas={entregasCalendario} />
    </div>
  )
}
