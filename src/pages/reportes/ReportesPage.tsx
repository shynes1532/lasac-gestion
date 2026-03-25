import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer, FileText, DollarSign, Building2, Car, ClipboardList } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { TIPO_LABEL, SUCURSALES_SELECT } from '../../lib/constants'
import { Button } from '../../components/ui/Button'

function fmt(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function diasDesde(fecha: string): number {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000)
}

type Reporte = 'cuenta' | 'operacion' | 'boletos' | 'saldos' | 'registro'

const TABS: { id: Reporte; label: string; icon: any }[] = [
  { id: 'boletos', label: 'Boletos mensuales', icon: Car },
  { id: 'saldos', label: 'Saldos pendientes', icon: DollarSign },
  { id: 'registro', label: 'Estado de registro', icon: Building2 },
  { id: 'operacion', label: 'Resumen operaciones', icon: ClipboardList },
  { id: 'cuenta', label: 'Estado de cuenta', icon: FileText },
]

export function ReportesPage() {
  const [tab, setTab] = useState<Reporte>('boletos')
  const [filtroSucursal, setFiltroSucursal] = useState<string>('todas')
  const [opSeleccionada, setOpSeleccionada] = useState<string>('')

  const ahora = new Date()
  const mesActual = ahora.getMonth()
  const anioActual = ahora.getFullYear()
  const nombreMes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][mesActual]

  const { data: ops } = useQuery({
    queryKey: ['reportes-ops', filtroSucursal],
    queryFn: async () => {
      let q = supabase
        .from('operaciones')
        .select(`
          *, unidades (modelo, vin_chasis, color, patente_nueva),
          contactos_calidad (fecha_entrega_confirmada, estado_calidad),
          pagos_saldo (id, monto, forma_pago, fecha, numero_recibo, observacion)
        `)
        .not('estado_actual', 'in', '("caida")')
        .order('created_at', { ascending: false })
      if (filtroSucursal !== 'todas') q = q.eq('sucursal', filtroSucursal)
      const { data } = await q
      return data || []
    },
  })

  const operaciones = ops || []
  const estesMes = (o: any) => {
    const d = new Date(o.created_at)
    return d.getMonth() === mesActual && d.getFullYear() === anioActual
  }

  function imprimir() {
    window.print()
  }

  const opDetalle = opSeleccionada ? operaciones.find(o => o.id === opSeleccionada) : null

  return (
    <div>
      {/* Header — se oculta al imprimir */}
      <div className="print:hidden flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Reportes</h1>
          <p className="text-sm text-text-secondary">Seleccioná un reporte y hacé click en Imprimir</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filtroSucursal} onChange={e => setFiltroSucursal(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-bg-secondary text-text-secondary">
            <option value="todas">Ambas sucursales</option>
            {SUCURSALES_SELECT.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <Button onClick={imprimir} size="sm">
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Tabs — se ocultan al imprimir */}
      <div className="print:hidden flex gap-1 mb-6 overflow-x-auto pb-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
              tab === t.id ? 'bg-action text-white' : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
            }`}>
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════ CONTENIDO IMPRIMIBLE ═══════════ */}
      <div className="print:p-0" id="reporte-contenido">

        {/* ─── BOLETOS MENSUALES ─── */}
        {tab === 'boletos' && (
          <div className="space-y-4">
            <div className="text-center mb-6 print:mb-4">
              <h2 className="text-lg font-bold">LIENDO AUTOMOTORES S.A. — FIAT</h2>
              <p className="text-sm text-text-muted">Boletos vendidos — {nombreMes} {anioActual}</p>
              {filtroSucursal !== 'todas' && <p className="text-sm text-text-muted">Sucursal: {filtroSucursal}</p>}
              <p className="text-xs text-text-muted mt-1">Generado: {ahora.toLocaleDateString('es-AR')} {ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>

            {['0km', 'usados', 'plan_ahorro'].map(tipo => {
              const opsTipo = operaciones.filter(o => o.tipo_operacion === tipo && estesMes(o))
              return (
                <div key={tipo} className="mb-6">
                  <h3 className="text-sm font-bold uppercase mb-2 border-b border-border pb-1">
                    {TIPO_LABEL[tipo as keyof typeof TIPO_LABEL] || tipo} ({opsTipo.length})
                  </h3>
                  {opsTipo.length === 0 ? (
                    <p className="text-xs text-text-muted italic">Sin operaciones este mes</p>
                  ) : (
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b-2 border-border">
                          <th className="text-left py-1.5 font-medium">Cliente</th>
                          <th className="text-left py-1.5 font-medium">Modelo</th>
                          <th className="text-left py-1.5 font-medium">VIN</th>
                          <th className="text-left py-1.5 font-medium">Sucursal</th>
                          <th className="text-left py-1.5 font-medium">Estado</th>
                          <th className="text-left py-1.5 font-medium">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {opsTipo.map(o => (
                          <tr key={o.id}>
                            <td className="py-1.5">{o.cliente_nombre || '—'}</td>
                            <td className="py-1.5">{(o.unidades as any)?.[0]?.modelo || o.unidades?.modelo || '—'}</td>
                            <td className="py-1.5 font-mono text-[10px]">{(o.unidades as any)?.[0]?.vin_chasis || o.unidades?.vin_chasis || '—'}</td>
                            <td className="py-1.5">{o.sucursal}</td>
                            <td className="py-1.5 capitalize">{o.estado_actual}</td>
                            <td className="py-1.5">{fmtDate(o.created_at?.split('T')[0])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}

            <div className="border-t-2 border-border pt-3 flex justify-between text-sm font-bold">
              <span>Total boletos del mes</span>
              <span>{operaciones.filter(estesMes).length}</span>
            </div>
          </div>
        )}

        {/* ─── SALDOS PENDIENTES ─── */}
        {tab === 'saldos' && (() => {
          const conSaldo = operaciones.filter(o => o.saldo_cliente && o.saldo_cliente > 0)
          return (
            <div>
              <div className="text-center mb-6 print:mb-4">
                <h2 className="text-lg font-bold">LIENDO AUTOMOTORES S.A. — FIAT</h2>
                <p className="text-sm text-text-muted">Saldos pendientes de clientes</p>
                <p className="text-xs text-text-muted mt-1">Generado: {ahora.toLocaleDateString('es-AR')} {ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="text-left py-1.5 font-medium">Cliente</th>
                    <th className="text-left py-1.5 font-medium">Tipo</th>
                    <th className="text-left py-1.5 font-medium">Sucursal</th>
                    <th className="text-right py-1.5 font-medium">Saldo total</th>
                    <th className="text-right py-1.5 font-medium">Pagado</th>
                    <th className="text-right py-1.5 font-medium">Pendiente</th>
                    <th className="text-center py-1.5 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {conSaldo.map(o => {
                    const pagos = (o.pagos_saldo as any[]) || []
                    const totalPagado = pagos.reduce((s: number, p: any) => s + Number(p.monto), 0)
                    const pendiente = o.saldo_cliente - totalPagado
                    const estado = pendiente <= 0 ? 'PAGADO' : pagos.length > 0 ? 'PARCIAL' : 'DEBE'
                    return (
                      <tr key={o.id}>
                        <td className="py-1.5 font-medium">{o.cliente_nombre || '—'}</td>
                        <td className="py-1.5">{TIPO_LABEL[o.tipo_operacion as keyof typeof TIPO_LABEL] || o.tipo_operacion}</td>
                        <td className="py-1.5">{o.sucursal}</td>
                        <td className="py-1.5 text-right">{fmt(o.saldo_cliente)}</td>
                        <td className="py-1.5 text-right">{fmt(totalPagado)}</td>
                        <td className="py-1.5 text-right font-semibold">{fmt(Math.max(0, pendiente))}</td>
                        <td className="py-1.5 text-center">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            estado === 'PAGADO' ? 'bg-green-100 text-green-700'
                            : estado === 'PARCIAL' ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                          }`}>{estado}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {conSaldo.length > 0 && (
                <div className="border-t-2 border-border pt-3 mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total saldos</span>
                    <span className="font-bold">{fmt(conSaldo.reduce((s, o) => s + (o.saldo_cliente || 0), 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total cobrado</span>
                    <span className="font-bold text-green-600">{fmt(conSaldo.reduce((s, o) => {
                      const pagos = (o.pagos_saldo as any[]) || []
                      return s + pagos.reduce((ss: number, p: any) => ss + Number(p.monto), 0)
                    }, 0))}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="font-bold">Total pendiente</span>
                    <span className="font-bold text-red-600">{fmt(conSaldo.reduce((s, o) => {
                      const pagos = (o.pagos_saldo as any[]) || []
                      const pagado = pagos.reduce((ss: number, p: any) => ss + Number(p.monto), 0)
                      return s + Math.max(0, (o.saldo_cliente || 0) - pagado)
                    }, 0))}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ─── ESTADO DE REGISTRO ─── */}
        {tab === 'registro' && (() => {
          const enGestoria = operaciones.filter(o => o.estado_actual === 'gestoria')
          return (
            <div>
              <div className="text-center mb-6 print:mb-4">
                <h2 className="text-lg font-bold">LIENDO AUTOMOTORES S.A. — FIAT</h2>
                <p className="text-sm text-text-muted">Estado de Registro — Trámites en gestoría</p>
                <p className="text-xs text-text-muted mt-1">Generado: {ahora.toLocaleDateString('es-AR')}</p>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-4 text-center">
                <div className="p-3 border rounded-lg">
                  <p className="text-2xl font-bold">{enGestoria.filter(o => !o.ingresado_registro).length}</p>
                  <p className="text-xs font-medium">No ingresados</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-2xl font-bold">{enGestoria.filter(o => o.ingresado_registro && !o.egresado_registro).length}</p>
                  <p className="text-xs font-medium">En registro</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-2xl font-bold">{enGestoria.filter(o => o.egresado_registro).length}</p>
                  <p className="text-xs font-medium">Salidas/Egresados</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{enGestoria.filter(o => o.ingresado_registro && !o.egresado_registro && o.fecha_ingreso_registro && diasDesde(o.fecha_ingreso_registro) > 4).length}</p>
                  <p className="text-xs font-medium">Demorados (+4d)</p>
                </div>
              </div>

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="text-left py-1.5 font-medium">Cliente</th>
                    <th className="text-left py-1.5 font-medium">Tipo</th>
                    <th className="text-left py-1.5 font-medium">Estado trámite</th>
                    <th className="text-left py-1.5 font-medium">O2</th>
                    <th className="text-left py-1.5 font-medium">Ingreso</th>
                    <th className="text-right py-1.5 font-medium">Días</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {enGestoria.map(o => {
                    const diasReg = o.fecha_ingreso_registro ? diasDesde(o.fecha_ingreso_registro) : null
                    const demorado = diasReg !== null && diasReg > 4
                    let estado = 'Preparando carpeta'
                    if (o.egresado_registro) estado = 'Egresado'
                    else if (o.ingresado_registro) estado = demorado ? 'En registro (DEMORADO)' : 'En registro'
                    else if (o.estado_paso3 === 'esperando_firma') estado = 'Esperando firma'
                    else if (o.estado_paso3 === 'o2_solicitado') estado = 'O2 solicitado'

                    return (
                      <tr key={o.id} className={demorado ? 'font-semibold' : ''}>
                        <td className="py-1.5">{o.cliente_nombre || '—'}</td>
                        <td className="py-1.5">{TIPO_LABEL[o.tipo_operacion as keyof typeof TIPO_LABEL] || o.tipo_operacion}</td>
                        <td className="py-1.5">{estado}</td>
                        <td className="py-1.5">{o.resultado_o2 === 'inhibido' ? 'INHIBIDO' : o.resultado_o2 === 'libre' ? 'Libre' : '—'}</td>
                        <td className="py-1.5">{o.fecha_ingreso_registro ? fmtDate(o.fecha_ingreso_registro) : '—'}</td>
                        <td className="py-1.5 text-right">{diasReg !== null ? `${diasReg}d` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })()}

        {/* ─── RESUMEN OPERACIONES ─── */}
        {tab === 'operacion' && (
          <div>
            <div className="text-center mb-6 print:mb-4">
              <h2 className="text-lg font-bold">LIENDO AUTOMOTORES S.A. — FIAT</h2>
              <p className="text-sm text-text-muted">Resumen de operaciones activas</p>
              <p className="text-xs text-text-muted mt-1">Generado: {ahora.toLocaleDateString('es-AR')}</p>
            </div>

            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-1.5 font-medium">ePOD</th>
                  <th className="text-left py-1.5 font-medium">Cliente</th>
                  <th className="text-left py-1.5 font-medium">Tipo</th>
                  <th className="text-left py-1.5 font-medium">Modelo</th>
                  <th className="text-left py-1.5 font-medium">Suc.</th>
                  <th className="text-left py-1.5 font-medium">Paso</th>
                  <th className="text-left py-1.5 font-medium">F.Compromiso</th>
                  <th className="text-left py-1.5 font-medium">Patente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {operaciones.filter(o => !['entregado','caida'].includes(o.estado_actual)).map(o => (
                  <tr key={o.id}>
                    <td className="py-1.5 font-mono">{o.nro_epod || '—'}</td>
                    <td className="py-1.5 font-medium">{o.cliente_nombre || '—'}</td>
                    <td className="py-1.5">{TIPO_LABEL[o.tipo_operacion as keyof typeof TIPO_LABEL] || o.tipo_operacion}</td>
                    <td className="py-1.5">{(o.unidades as any)?.[0]?.modelo || o.unidades?.modelo || '—'}</td>
                    <td className="py-1.5">{o.sucursal === 'Rio Grande' ? 'RG' : o.sucursal === 'Ushuaia' ? 'USH' : o.sucursal}</td>
                    <td className="py-1.5 capitalize">{o.estado_actual}</td>
                    <td className="py-1.5">{o.fecha_compromiso ? fmtDate(o.fecha_compromiso) : '—'}</td>
                    <td className="py-1.5 font-mono">{o.dominio_patente || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t-2 border-border pt-3 mt-3 text-sm font-bold flex justify-between">
              <span>Total activas</span>
              <span>{operaciones.filter(o => !['entregado','caida'].includes(o.estado_actual)).length}</span>
            </div>
          </div>
        )}

        {/* ─── ESTADO DE CUENTA (individual) ─── */}
        {tab === 'cuenta' && (
          <div>
            <div className="text-center mb-6 print:mb-4">
              <h2 className="text-lg font-bold">LIENDO AUTOMOTORES S.A. — FIAT</h2>
              <p className="text-sm text-text-muted">Estado de cuenta</p>
              <p className="text-xs text-text-muted mt-1">Generado: {ahora.toLocaleDateString('es-AR')}</p>
            </div>

            {/* Selector de operación — se oculta al imprimir */}
            <div className="print:hidden mb-6">
              <label className="text-xs text-text-muted block mb-1 font-medium">Seleccioná la operación:</label>
              <select
                value={opSeleccionada}
                onChange={e => setOpSeleccionada(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-bg-secondary text-text-primary"
              >
                <option value="">Seleccionar cliente...</option>
                {operaciones.filter(o => o.saldo_cliente && o.saldo_cliente > 0).map(o => (
                  <option key={o.id} value={o.id}>
                    {o.cliente_nombre} — {TIPO_LABEL[o.tipo_operacion as keyof typeof TIPO_LABEL]} — {fmt(o.saldo_cliente)}
                  </option>
                ))}
              </select>
            </div>

            {opDetalle && (() => {
              const pagos = ((opDetalle.pagos_saldo as any[]) || []).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
              const totalPagado = pagos.reduce((s: number, p: any) => s + Number(p.monto), 0)
              const pendiente = (opDetalle.saldo_cliente || 0) - totalPagado
              const unidad = Array.isArray(opDetalle.unidades) ? opDetalle.unidades[0] : opDetalle.unidades

              return (
                <div className="space-y-4">
                  {/* Datos del cliente y vehículo */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <p><strong>Cliente:</strong> {opDetalle.cliente_nombre}</p>
                      <p><strong>Teléfono:</strong> {opDetalle.cliente_telefono || '—'}</p>
                      <p><strong>N° ePOD:</strong> {opDetalle.nro_epod || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p><strong>Tipo:</strong> {TIPO_LABEL[opDetalle.tipo_operacion as keyof typeof TIPO_LABEL]}</p>
                      <p><strong>Modelo:</strong> {unidad?.modelo || '—'}</p>
                      <p><strong>VIN:</strong> {unidad?.vin_chasis || '—'}</p>
                      <p><strong>Sucursal:</strong> {opDetalle.sucursal}</p>
                    </div>
                  </div>

                  <hr />

                  {/* Detalle financiero */}
                  <div className="text-xs space-y-1">
                    {opDetalle.valor_unidad && <div className="flex justify-between"><span>Valor unidad</span><span>{fmt(opDetalle.valor_unidad)}</span></div>}
                    {opDetalle.valor_credito && <div className="flex justify-between"><span>Crédito aprobado</span><span>{fmt(opDetalle.valor_credito)}</span></div>}
                    {opDetalle.quebranto_monto && <div className="flex justify-between text-red-600"><span>Quebranto ({opDetalle.quebranto_porcentaje}%)</span><span>– {fmt(opDetalle.quebranto_monto)}</span></div>}
                    <div className="flex justify-between font-bold border-t pt-1 text-sm">
                      <span>Saldo total</span>
                      <span>{fmt(opDetalle.saldo_cliente || 0)}</span>
                    </div>
                  </div>

                  {/* Tabla de pagos */}
                  {pagos.length > 0 && (
                    <>
                      <h3 className="text-xs font-bold uppercase mt-4 mb-2">Pagos registrados</h3>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b-2 border-border">
                            <th className="text-left py-1.5 font-medium">N° Recibo</th>
                            <th className="text-left py-1.5 font-medium">Fecha</th>
                            <th className="text-left py-1.5 font-medium">Método</th>
                            <th className="text-left py-1.5 font-medium">Observación</th>
                            <th className="text-right py-1.5 font-medium">Monto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {pagos.map((p: any) => (
                            <tr key={p.id}>
                              <td className="py-1.5 font-mono">{p.numero_recibo || '—'}</td>
                              <td className="py-1.5">{fmtDate(p.fecha)}</td>
                              <td className="py-1.5 capitalize">{p.forma_pago}</td>
                              <td className="py-1.5 text-text-muted">{p.observacion || ''}</td>
                              <td className="py-1.5 text-right font-semibold">{fmt(Number(p.monto))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* Totales */}
                  <div className="border-t-2 border-border pt-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span>Total pagado</span><span className="font-bold text-green-600">{fmt(totalPagado)}</span></div>
                    <div className="flex justify-between text-lg"><span className="font-bold">SALDO RESTANTE</span><span className={`font-bold ${pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(Math.max(0, pendiente))}</span></div>
                  </div>

                  {opDetalle.fecha_cancelacion_total && (
                    <p className="text-xs text-text-muted">Fecha de cancelación total: {fmtDate(opDetalle.fecha_cancelacion_total)}</p>
                  )}

                  {/* Firma */}
                  <div className="mt-12 pt-8 border-t border-border grid grid-cols-2 gap-8 text-center text-xs text-text-muted">
                    <div>
                      <div className="border-b border-border mb-2 pb-8" />
                      Firma del cliente
                    </div>
                    <div>
                      <div className="border-b border-border mb-2 pb-8" />
                      Firma de la empresa
                    </div>
                  </div>
                </div>
              )
            })()}

            {!opDetalle && (
              <p className="text-center text-text-muted py-8">Seleccioná una operación para ver su estado de cuenta</p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
