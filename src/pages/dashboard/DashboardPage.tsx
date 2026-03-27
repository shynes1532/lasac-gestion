import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Car, FileText, CreditCard, AlertTriangle, CheckCircle2, Clock, TrendingUp, Building2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { getSemaforoCompromiso } from '../../lib/types'
import type { TipoOperacion } from '../../lib/types'
import { COLORES_TIPO, SUCURSALES_SELECT } from '../../lib/constants'

// ─── KPI Card ────────────────────────────────────────────────
function KPI({ label, value, color, icon: Icon, sub, onClick }: {
  label: string; value: number | string; color: string; icon: any; sub?: string; onClick?: () => void
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
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
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
    const fechaConfirmada = Array.isArray(e.contactos_calidad)
      ? e.contactos_calidad[0]?.fecha_entrega_confirmada
      : e.contactos_calidad?.fecha_entrega_confirmada
    const fecha = fechaConfirmada || e.fecha_compromiso
    if (!fecha) return
    const d = new Date(fecha + 'T12:00:00')
    if (d.getFullYear() === mes.y && d.getMonth() === mes.m) {
      const dia = d.getDate()
      if (!entregasPorDia[dia]) entregasPorDia[dia] = []
      entregasPorDia[dia].push({ ...e, _fechaUsada: fechaConfirmada ? 'confirmada' : 'compromiso' })
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

// ─── Helper: días entre fechas ───────────────────────────────
function diasDesde(fecha: string): number {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000)
}

// ─── Dashboard principal ─────────────────────────────────────
export function DashboardPage() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [filtroSucursal, setFiltroSucursal] = useState<string>('todas')

  const ahora = new Date()
  const mesActual = ahora.getMonth()
  const anioActual = ahora.getFullYear()
  const nombreMes = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][mesActual]

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-v2', filtroSucursal],
    queryFn: async () => {
      let q = supabase
        .from('operaciones')
        .select(`
          id, tipo_operacion, estado_actual, estado_prenda, forma_pago,
          fecha_compromiso, dominio_patente, sucursal, created_at,
          cliente_nombre, cliente_telefono,
          ingresado_registro, egresado_registro, fecha_ingreso_registro,
          estado_paso3, resultado_o2,
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
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-bg-secondary rounded-xl border border-border p-4 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-3" />
        <h2 className="text-lg font-semibold text-text-primary">Error al cargar el dashboard</h2>
        <p className="text-sm text-text-muted mt-1">No se pudieron obtener los datos. Intentá recargar la página.</p>
      </div>
    )
  }

  const ops = data || []
  const activas = ops.filter(o => !['entregado','caida'].includes(o.estado_actual))

  // ── Filtro mensual: operaciones creadas este mes ──
  const estesMes = (o: any) => {
    const d = new Date(o.created_at)
    return d.getMonth() === mesActual && d.getFullYear() === anioActual
  }

  // ── KPIs mensuales ──
  const boletos0kmMes = ops.filter(o => o.tipo_operacion === '0km' && estesMes(o)).length
  const usadosMes = ops.filter(o => o.tipo_operacion === 'usados' && estesMes(o)).length
  const planMes = ops.filter(o => o.tipo_operacion === 'plan_ahorro' && estesMes(o)).length

  // ── KPIs generales ──
  const demoradas = ops.filter(o =>
    o.fecha_compromiso &&
    getSemaforoCompromiso(o.fecha_compromiso) === 'rojo' &&
    !['entregado','caida'].includes(o.estado_actual)
  ).length
  const prendasPendientes = ops.filter(o =>
    (o.forma_pago === 'financiado_banco' || o.tipo_operacion === 'plan_ahorro') &&
    o.estado_prenda === 'pendiente'
  ).length

  // ── Registro / Gestoría — todas las ops activas (no solo paso gestoria) ──
  const opsActivas = ops.filter(o => !['entregado','caida'].includes(o.estado_actual))
  const noIngresadosRegistro = opsActivas.filter(o => !o.ingresado_registro && !o.egresado_registro)
  const enRegistro = opsActivas.filter(o => o.ingresado_registro && !o.egresado_registro)
  const demoradosRegistro = enRegistro.filter(o =>
    o.fecha_ingreso_registro && diasDesde(o.fecha_ingreso_registro) > 4
  )
  const egresadosRegistro = opsActivas.filter(o => o.egresado_registro)

  // Entregas para calendario
  const entregasCalendario = ops.filter(o =>
    o.fecha_compromiso || (o.contactos_calidad as any)?.[0]?.fecha_entrega_confirmada
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

      {/* ── BOLETOS MENSUALES ── */}
      <div>
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
          Boletos vendidos — {nombreMes} {anioActual}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <KPI label="0KM" value={boletos0kmMes} color="#185FA5" icon={FileText}
            sub={`este mes`}
            onClick={() => navigate('/operaciones?tipo=0km')} />
          <KPI label="Usados" value={usadosMes} color="#854F0B" icon={Car}
            sub={`este mes`}
            onClick={() => navigate('/operaciones?tipo=usados')} />
          <KPI label="Plan Ahorro" value={planMes} color="#534AB7" icon={CheckCircle2}
            sub={`este mes`}
            onClick={() => navigate('/operaciones?tipo=plan_ahorro')} />
        </div>
      </div>

      {/* ── KPIs GENERALES ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Op. activas" value={activas.length} color="#475569" icon={TrendingUp}
          onClick={() => navigate('/operaciones')} />
        <KPI label="Demoradas" value={demoradas} color="#CC0000" icon={AlertTriangle}
          onClick={() => navigate('/operaciones')} />
        <KPI label="Prendas pend." value={prendasPendientes} color="#EF9F27" icon={CreditCard}
          onClick={() => navigate('/prendas')} />
        <KPI label="En calidad" value={ops.filter(o => o.estado_actual === 'calidad').length} color="#EA580C" icon={Clock}
          onClick={() => navigate('/calidad')} />
      </div>

      {/* ── REGISTRO / GESTORÍA ── */}
      <div className="bg-bg-secondary rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-4 w-4 text-purple-500" />
          <h2 className="text-sm font-bold text-text-primary">Estado de Registro</h2>
          <span className="text-xs text-text-muted">({opsActivas.length} operaciones activas)</span>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-2xl font-bold text-yellow-700">{noIngresadosRegistro.length}</p>
            <p className="text-xs text-yellow-600 font-medium">No ingresados</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-2xl font-bold text-blue-700">{enRegistro.length}</p>
            <p className="text-xs text-blue-600 font-medium">En registro</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-2xl font-bold text-green-700">{egresadosRegistro.length}</p>
            <p className="text-xs text-green-600 font-medium">Salidas / Egresados</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-2xl font-bold text-red-700">{demoradosRegistro.length}</p>
            <p className="text-xs text-red-600 font-medium">Demorados (+4 días)</p>
          </div>
        </div>

        {/* Lista detallada de trámites en gestoría */}
        {opsActivas.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-bg-tertiary text-text-muted">
                  <th className="text-left px-3 py-2 font-medium">Cliente</th>
                  <th className="text-left px-3 py-2 font-medium">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium">Paso</th>
                  <th className="text-left px-3 py-2 font-medium">Estado registro</th>
                  <th className="text-left px-3 py-2 font-medium">O2</th>
                  <th className="text-right px-3 py-2 font-medium">Días en reg.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {opsActivas.map(o => {
                  const diasEnReg = o.fecha_ingreso_registro ? diasDesde(o.fecha_ingreso_registro) : null
                  const demorado = diasEnReg !== null && diasEnReg > 4

                  let estadoLabel = 'Preparando carpeta'
                  let estadoColor = 'text-text-muted'
                  if (o.egresado_registro) {
                    estadoLabel = 'Egresado / Patentado'
                    estadoColor = 'text-green-600'
                  } else if (o.ingresado_registro) {
                    estadoLabel = 'En registro'
                    estadoColor = demorado ? 'text-red-600 font-semibold' : 'text-blue-600'
                  } else if (o.estado_paso3 === 'esperando_firma') {
                    estadoLabel = 'Esperando firma'
                    estadoColor = 'text-yellow-600'
                  } else if (o.estado_paso3 === 'o2_solicitado') {
                    estadoLabel = 'O2 solicitado'
                    estadoColor = 'text-orange-600'
                  }

                  return (
                    <tr key={o.id}
                      onClick={() => navigate(`/operaciones/${o.id}`)}
                      className="hover:bg-bg-secondary/50 cursor-pointer"
                    >
                      <td className="px-3 py-2 font-medium text-text-primary">
                        {o.cliente_nombre || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          o.tipo_operacion === '0km' ? 'bg-blue-100 text-blue-800' :
                          o.tipo_operacion === 'usados' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-violet-100 text-violet-800'
                        }`}>
                          {o.tipo_operacion === '0km' ? '0KM' : o.tipo_operacion === 'usados' ? 'Usado' : 'Plan'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-text-muted capitalize">{o.estado_actual}</td>
                      <td className={`px-3 py-2 ${estadoColor}`}>
                        {estadoLabel}
                        {demorado && <span className="ml-1 text-red-500">⚠</span>}
                      </td>
                      <td className="px-3 py-2">
                        {o.resultado_o2 === 'inhibido' ? (
                          <span className="text-red-600 font-semibold">Inhibido</span>
                        ) : o.resultado_o2 === 'libre' ? (
                          <span className="text-green-600">Libre</span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {diasEnReg !== null ? (
                          <span className={demorado ? 'text-red-600 font-bold' : 'text-text-primary'}>
                            {diasEnReg}d
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
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
            const pct = activas.length > 0 ? (count / activas.length) * 100 : 0
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
