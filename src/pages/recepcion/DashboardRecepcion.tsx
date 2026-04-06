import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Users, TrendingUp, MapPin, Car } from 'lucide-react'
import { useRecepcionesMes } from '../../hooks/useRecepciones'
import { Card } from '../../components/ui'
import type { Recepcion, AreaRecepcion, OrigenRecepcion } from '../../lib/types'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const AREA_LABELS: Record<AreaRecepcion, string> = {
  posventa: 'Posventa',
  administracion: 'Administración',
  ventas: 'Ventas',
}

const AREA_COLORS: Record<AreaRecepcion, string> = {
  posventa: 'bg-blue-500',
  administracion: 'bg-purple-500',
  ventas: 'bg-green-500',
}

const SUBAREA_LABELS: Record<string, string> = {
  repuestos: 'Repuestos',
  taller: 'Taller',
  siniestro: 'Siniestro',
  plan: 'Plan',
  convencional: 'Convencional',
  '0km': '0KM',
}

const ORIGEN_LABELS: Record<OrigenRecepcion, string> = {
  redes_sociales: 'Redes sociales',
  recomendacion: 'Recomendación',
  paso_por_puerta: 'Pasó por la puerta',
  llamada: 'Llamada',
  whatsapp: 'WhatsApp',
  web: 'Web',
  otro: 'Otro',
}

const ORIGEN_COLORS: Record<OrigenRecepcion, string> = {
  redes_sociales: 'bg-pink-500',
  recomendacion: 'bg-yellow-500',
  paso_por_puerta: 'bg-cyan-500',
  llamada: 'bg-orange-500',
  whatsapp: 'bg-green-500',
  web: 'bg-blue-500',
  otro: 'bg-gray-500',
}

function contarPor(items: Recepcion[], campo: keyof Recepcion): Record<string, number> {
  const conteo: Record<string, number> = {}
  for (const item of items) {
    const val = item[campo] as string
    if (val) conteo[val] = (conteo[val] || 0) + 1
  }
  return conteo
}

function BarHorizontal({ label, valor, total, color }: { label: string; valor: number; total: number; color: string }) {
  const pct = total > 0 ? (valor / total) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-primary font-medium">{valor} <span className="text-text-muted">({pct.toFixed(0)}%)</span></span>
      </div>
      <div className="h-3 bg-bg-tertiary rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function HorarioChart({ recepciones }: { recepciones: Recepcion[] }) {
  // Agrupar por hora
  const porHora: Record<number, number> = {}
  for (const r of recepciones) {
    const hora = new Date(r.created_at).getHours()
    porHora[hora] = (porHora[hora] || 0) + 1
  }

  const horas = Array.from({ length: 13 }, (_, i) => i + 7) // 7am a 19pm
  const max = Math.max(...horas.map(h => porHora[h] || 0), 1)

  return (
    <div className="flex items-end gap-1 h-32">
      {horas.map(h => {
        const val = porHora[h] || 0
        const height = max > 0 ? (val / max) * 100 : 0
        return (
          <div key={h} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-text-muted">{val || ''}</span>
            <div
              className={`w-full rounded-t ${val > 0 ? 'bg-action' : 'bg-bg-tertiary'}`}
              style={{ height: `${Math.max(height, 4)}%` }}
            />
            <span className="text-[10px] text-text-muted">{h}h</span>
          </div>
        )
      })}
    </div>
  )
}

export function DashboardRecepcion() {
  const now = new Date()
  const [anio, setAnio] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)

  const { data: recepciones = [], isLoading } = useRecepcionesMes(anio, mes)

  const prevMes = () => {
    if (mes === 1) { setMes(12); setAnio(a => a - 1) }
    else setMes(m => m - 1)
  }
  const nextMes = () => {
    if (mes === 12) { setMes(1); setAnio(a => a + 1) }
    else setMes(m => m + 1)
  }

  const total = recepciones.length
  const porArea = contarPor(recepciones, 'area')
  const porOrigen = contarPor(recepciones, 'origen')
  const porSubarea = contarPor(recepciones, 'subarea')

  // Modelos de interés (solo ventas)
  const ventasRecs = recepciones.filter(r => r.area === 'ventas')
  const porModelo: Record<string, number> = {}
  for (const r of ventasRecs) {
    if (r.modelo_interes) porModelo[r.modelo_interes] = (porModelo[r.modelo_interes] || 0) + 1
  }
  const modelosOrdenados = Object.entries(porModelo).sort((a, b) => b[1] - a[1])

  // Tasa de contacto
  const contactados = recepciones.filter(r => r.estado === 'contactado').length
  const tasaContacto = total > 0 ? ((contactados / total) * 100).toFixed(0) : '0'

  // Promedio diario
  const diasUnicos = new Set(recepciones.map(r => new Date(r.created_at).toDateString())).size
  const promedioDiario = diasUnicos > 0 ? (total / diasUnicos).toFixed(1) : '0'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/recepcion" className="text-text-muted hover:text-text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Reporte Recepción</h1>
            <p className="text-sm text-text-muted">Estadísticas mensuales para marketing</p>
          </div>
        </div>
      </div>

      {/* Selector de mes */}
      <Card className="p-3 flex items-center justify-between">
        <button onClick={prevMes} className="p-1 hover:bg-bg-tertiary rounded cursor-pointer">
          <ChevronLeft className="h-5 w-5 text-text-secondary" />
        </button>
        <span className="text-lg font-semibold text-text-primary">
          {MESES[mes - 1]} {anio}
        </span>
        <button onClick={nextMes} className="p-1 hover:bg-bg-tertiary rounded cursor-pointer">
          <ChevronRight className="h-5 w-5 text-text-secondary" />
        </button>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-4 h-20 animate-pulse bg-bg-tertiary">
              <div className="h-4 w-1/3 bg-bg-secondary rounded" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="p-3 text-center">
              <Users className="h-5 w-5 text-action mx-auto mb-1" />
              <p className="text-2xl font-bold text-text-primary">{total}</p>
              <p className="text-xs text-text-muted">Total visitas</p>
            </Card>
            <Card className="p-3 text-center">
              <TrendingUp className="h-5 w-5 text-green-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-text-primary">{promedioDiario}</p>
              <p className="text-xs text-text-muted">Promedio/día</p>
            </Card>
            <Card className="p-3 text-center">
              <MapPin className="h-5 w-5 text-purple-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-text-primary">{tasaContacto}%</p>
              <p className="text-xs text-text-muted">Contactados</p>
            </Card>
            <Card className="p-3 text-center">
              <Car className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-text-primary">{ventasRecs.length}</p>
              <p className="text-xs text-text-muted">Consultas ventas</p>
            </Card>
          </div>

          {/* Horarios pico */}
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold text-text-primary">Horarios de ingreso</h2>
            <HorarioChart recepciones={recepciones} />
          </Card>

          {/* Por área */}
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold text-text-primary">Por área</h2>
            {(['posventa', 'administracion', 'ventas'] as AreaRecepcion[]).map(area => (
              <BarHorizontal
                key={area}
                label={AREA_LABELS[area]}
                valor={porArea[area] || 0}
                total={total}
                color={AREA_COLORS[area]}
              />
            ))}
          </Card>

          {/* Por subárea */}
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold text-text-primary">Por subárea</h2>
            {Object.entries(porSubarea)
              .sort((a, b) => b[1] - a[1])
              .map(([sub, val]) => (
                <BarHorizontal
                  key={sub}
                  label={SUBAREA_LABELS[sub] || sub}
                  valor={val}
                  total={total}
                  color="bg-action"
                />
              ))}
          </Card>

          {/* Origen — Marketing */}
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold text-text-primary flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-pink-400" />
              Origen (Marketing)
            </h2>
            {Object.entries(porOrigen).length === 0 ? (
              <p className="text-sm text-text-muted">Sin datos de origen todavía</p>
            ) : (
              Object.entries(porOrigen)
                .sort((a, b) => b[1] - a[1])
                .map(([origen, val]) => (
                  <BarHorizontal
                    key={origen}
                    label={ORIGEN_LABELS[origen as OrigenRecepcion] || origen}
                    valor={val}
                    total={total}
                    color={ORIGEN_COLORS[origen as OrigenRecepcion] || 'bg-gray-500'}
                  />
                ))
            )}
          </Card>

          {/* Modelos consultados — solo ventas */}
          {modelosOrdenados.length > 0 && (
            <Card className="p-4 space-y-3">
              <h2 className="font-semibold text-text-primary flex items-center gap-2">
                <Car className="h-4 w-4 text-yellow-400" />
                Modelos más consultados (Ventas)
              </h2>
              {modelosOrdenados.map(([modelo, val]) => (
                <BarHorizontal
                  key={modelo}
                  label={modelo}
                  valor={val}
                  total={ventasRecs.length}
                  color="bg-yellow-500"
                />
              ))}
            </Card>
          )}

          {/* Tabla resumen por día */}
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold text-text-primary">Detalle por día</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="text-left py-2 px-2">Día</th>
                    <th className="text-center py-2 px-2">Total</th>
                    <th className="text-center py-2 px-2">Posventa</th>
                    <th className="text-center py-2 px-2">Admin</th>
                    <th className="text-center py-2 px-2">Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const porDia: Record<string, { total: number; posventa: number; administracion: number; ventas: number }> = {}
                    for (const r of recepciones) {
                      const dia = new Date(r.created_at).toLocaleDateString('es-AR', {
                        weekday: 'short',
                        day: 'numeric',
                      })
                      if (!porDia[dia]) porDia[dia] = { total: 0, posventa: 0, administracion: 0, ventas: 0 }
                      porDia[dia].total++
                      if (r.area === 'posventa') porDia[dia].posventa++
                      if (r.area === 'administracion') porDia[dia].administracion++
                      if (r.area === 'ventas') porDia[dia].ventas++
                    }
                    return Object.entries(porDia).map(([dia, stats]) => (
                      <tr key={dia} className="border-b border-border/50">
                        <td className="py-2 px-2 text-text-primary">{dia}</td>
                        <td className="py-2 px-2 text-center font-medium text-text-primary">{stats.total}</td>
                        <td className="py-2 px-2 text-center text-blue-400">{stats.posventa || '-'}</td>
                        <td className="py-2 px-2 text-center text-purple-400">{stats.administracion || '-'}</td>
                        <td className="py-2 px-2 text-center text-green-400">{stats.ventas || '-'}</td>
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
