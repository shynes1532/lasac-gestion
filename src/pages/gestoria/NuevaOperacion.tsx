import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Save } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { TIPOS_OPERACION, BANCOS, SUCURSALES_SELECT, CHECKLIST_DOC_0KM, CHECKLIST_PDI_TEMPLATE } from '../../lib/constants'
import type { TipoOperacion, FormaPago, BancoEntidad, Sucursal } from '../../lib/types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { notify } from '../../components/ui/Toast'

interface FormData {
  nro_epod: string
  sucursal: Sucursal | ''
  tipo_operacion: TipoOperacion | ''
  forma_pago: FormaPago | ''
  cliente_nombre: string
  cliente_telefono: string
  modelo_version: string
  vin_chasis: string
  color: string
  fecha_compromiso: string
  banco_entidad: BancoEntidad | ''
  nro_grupo_orden: string
  fecha_adjudicacion: string
  vendedor_id: string
  valor_unidad: string
  valor_credito: string
  quebranto_porcentaje: string
  forma_pago_saldo: '' | 'tarjeta' | 'transferencia' | 'efectivo'
  pago_inicial: string
}

const INITIAL_FORM: FormData = {
  nro_epod: '',
  sucursal: '',
  tipo_operacion: '',
  forma_pago: '',
  cliente_nombre: '',
  cliente_telefono: '',
  modelo_version: '',
  vin_chasis: '',
  color: '',
  fecha_compromiso: '',
  banco_entidad: '',
  nro_grupo_orden: '',
  fecha_adjudicacion: '',
  vendedor_id: '',
  valor_unidad: '',
  valor_credito: '',
  quebranto_porcentaje: '',
  forma_pago_saldo: '',
  pago_inicial: '',
}

function formatMoney(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

export function NuevaOperacion() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [form, setForm] = useState<FormData>({
    ...INITIAL_FORM,
    sucursal: perfil?.sucursal === 'Ushuaia' ? 'Ushuaia'
              : perfil?.sucursal === 'Rio Grande' ? 'Rio Grande'
              : '',
  })
  const [loading, setLoading] = useState(false)
  const [modelos, setModelos] = useState<{ value: string; label: string }[]>([])
  const [vendedores, setVendedores] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    supabase.from('modelos_fiat').select('nombre, categoria').eq('activo', true).order('categoria').then(({ data, error }) => {
      if (error) {
        console.error('Error cargando modelos:', error)
        return
      }
      if (data) setModelos(data.map(m => ({ value: m.nombre, label: `${m.nombre}` })))
    })

    supabase.from('usuarios').select('id, nombre_completo, rol').eq('activo', true).in('rol', ['director', 'asesor_ush', 'asesor_rg']).order('nombre_completo').then(({ data, error }) => {
      if (error) {
        console.error('Error cargando vendedores:', error)
        return
      }
      if (data) setVendedores(data.map(u => ({ value: u.id, label: u.nombre_completo })))
    })
  }, [])

  const set = (field: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const esPlan = form.tipo_operacion === 'plan_ahorro'
  const esFinanciado = form.forma_pago === 'financiado_banco' || esPlan
  const requierePrenda = esFinanciado
  const mostrarFinanciero = !esPlan && (form.tipo_operacion === '0km' || form.tipo_operacion === 'usados')

  // Cálculos financieros
  const valorUnidad = parseFloat(form.valor_unidad) || 0
  const valorCredito = parseFloat(form.valor_credito) || 0
  const quebrantoPct = parseFloat(form.quebranto_porcentaje) || 0
  const quebrantoMonto = valorCredito * (quebrantoPct / 100)
  const netoCredito = valorCredito - quebrantoMonto
  const saldoCliente = esFinanciado ? valorUnidad - netoCredito : valorUnidad
  const pagoInicial = parseFloat(form.pago_inicial) || 0
  const saldoRestante = saldoCliente - pagoInicial
  const clienteDebeSaldo = saldoCliente > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.nro_epod.trim()) return notify.error('El número ePOD es obligatorio')
    if (!form.sucursal) return notify.error('Seleccioná la sucursal')
    if (!form.tipo_operacion) return notify.error('Seleccioná el tipo de operación')
    if (!esPlan && !form.forma_pago) return notify.error('Seleccioná la forma de pago')
    if (!form.cliente_nombre.trim()) return notify.error('El nombre del cliente es obligatorio')
    if (!form.cliente_telefono.trim()) return notify.error('El teléfono es obligatorio')
    if (!form.modelo_version) return notify.error('Seleccioná el modelo')
    if (!form.vin_chasis.trim()) return notify.error('El VIN/chasis es obligatorio')
    if (!form.fecha_compromiso) return notify.error('La fecha de compromiso es obligatoria')
    if (esFinanciado && !esPlan && !form.banco_entidad) return notify.error('Seleccioná el banco')
    if (esPlan && !form.nro_grupo_orden.trim()) return notify.error('El N° de grupo/orden es obligatorio')
    if (esPlan && !form.fecha_adjudicacion) return notify.error('La fecha de adjudicación es obligatoria')
    if (!form.vendedor_id) return notify.error('Seleccioná el vendedor')

    setLoading(true)
    try {
      const { data: op, error: opErr } = await supabase
        .from('operaciones')
        .insert({
          sucursal: form.sucursal,
          tipo_operacion: form.tipo_operacion,
          forma_pago: esPlan ? 'plan_ahorro' : form.forma_pago,
          estado_actual: 'cierre',
          estado_paso1: 'creada',
          nro_epod: form.nro_epod.trim(),
          cliente_nombre: form.cliente_nombre.trim(),
          cliente_telefono: form.cliente_telefono.trim(),
          fecha_compromiso: form.fecha_compromiso,
          banco_entidad: esFinanciado && !esPlan ? form.banco_entidad || null : null,
          estado_prenda: requierePrenda ? 'pendiente' : null,
          nro_grupo_orden: esPlan ? form.nro_grupo_orden.trim() : null,
          fecha_adjudicacion: esPlan ? form.fecha_adjudicacion : null,
          asesor_id: form.vendedor_id,
          valor_unidad: mostrarFinanciero && valorUnidad ? valorUnidad : null,
          valor_credito: mostrarFinanciero && esFinanciado && valorCredito ? valorCredito : null,
          quebranto_porcentaje: mostrarFinanciero && esFinanciado && quebrantoPct ? quebrantoPct : null,
          quebranto_monto: mostrarFinanciero && esFinanciado && quebrantoMonto ? quebrantoMonto : null,
          saldo_cliente: mostrarFinanciero ? saldoCliente : null,
          forma_pago_saldo: mostrarFinanciero && form.forma_pago_saldo ? form.forma_pago_saldo : null,
          saldo_pagado: mostrarFinanciero ? !clienteDebeSaldo : null,
          created_by: perfil?.id,
          estado_gestoria: 'ingresado',
          estado_alistamiento: 'pendiente',
          estado_entrega: 'pendiente',
          historial_estados: [{
            paso: 'cierre',
            estado_anterior: null,
            estado_nuevo: 'creada',
            fecha: new Date().toISOString(),
            usuario_id: perfil?.id,
            motivo: null,
          }],
        })
        .select('id')
        .single()

      if (opErr) throw opErr

      await supabase.from('unidades').insert({
        operacion_id: op.id,
        marca: 'FIAT',
        modelo: form.modelo_version,
        color: form.color.trim() || null,
        vin_chasis: form.vin_chasis.trim().toUpperCase(),
      })

      await supabase.from('gestoria_tramites').insert({
        operacion_id: op.id,
        fecha_ingreso: new Date().toISOString().split('T')[0],
        checklist_doc: CHECKLIST_DOC_0KM,
        historial_estados: [],
      })

      await supabase.from('alistamiento_pdi').insert({
        operacion_id: op.id,
        checklist_pdi: { items: CHECKLIST_PDI_TEMPLATE },
        no_conformidades: [],
        fotos_evidencia: [],
      })

      await supabase.from('contactos_calidad').insert({
        operacion_id: op.id,
        estado_calidad: 'citar_2d',
      })

      // Registrar pago inicial si existe
      if (pagoInicial > 0 && pagoInicial <= saldoCliente && form.forma_pago_saldo) {
        await supabase.from('pagos_saldo').insert({
          operacion_id: op.id,
          monto: pagoInicial,
          forma_pago: form.forma_pago_saldo,
          fecha: new Date().toISOString().split('T')[0],
          observacion: 'Pago inicial al crear operación',
        })
        // Si pagó todo, marcar saldo_pagado
        if (pagoInicial >= saldoCliente) {
          await supabase.from('operaciones').update({ saldo_pagado: true }).eq('id', op.id)
        }
      }

      notify.success('Operación creada')
      navigate(`/operaciones/${op.id}`)
    } catch (err: any) {
      console.error('Error creando operación:', err)
      notify.error(err?.message || 'Error al crear la operación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-bg-secondary transition-colors cursor-pointer">
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Nueva operación</h1>
          <p className="text-sm text-text-secondary">Paso 1 — Cierre comercial</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* IDENTIFICACIÓN */}
        <section className="bg-bg-secondary rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Identificación</h2>
          <Input label="N° ePOD *" value={form.nro_epod} onChange={e => set('nro_epod', e.target.value)} placeholder="Ej: 2026-00123" />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Sucursal *"
              value={form.sucursal}
              onChange={e => set('sucursal', e.target.value as Sucursal)}
              options={[{ value: '', label: 'Seleccionar...' }, ...SUCURSALES_SELECT.map(s => ({ value: s.value, label: s.label }))]}
              disabled={perfil?.sucursal !== 'Ambas' && perfil?.rol !== 'director'}
            />
            <Select
              label="Tipo *"
              value={form.tipo_operacion}
              onChange={e => {
                const t = e.target.value as TipoOperacion
                set('tipo_operacion', t)
                if (t === 'plan_ahorro') set('forma_pago', 'plan_ahorro')
              }}
              options={[{ value: '', label: 'Seleccionar...' }, ...TIPOS_OPERACION.map(t => ({ value: t.value, label: t.label }))]}
            />
          </div>
          {!esPlan && (
            <Select
              label="Forma de pago *"
              value={form.forma_pago}
              onChange={e => set('forma_pago', e.target.value as FormaPago)}
              options={[{ value: '', label: 'Seleccionar...' }, { value: 'contado', label: 'Contado' }, { value: 'financiado_banco', label: 'Financiado por Banco' }]}
            />
          )}
          <Select
            label="Vendedor *"
            value={form.vendedor_id}
            onChange={e => set('vendedor_id', e.target.value)}
            options={[{ value: '', label: vendedores.length ? 'Seleccionar vendedor...' : 'Cargando...' }, ...vendedores]}
          />
        </section>

        {/* PLAN DE AHORRO */}
        {esPlan && (
          <section className="bg-violet-50 rounded-xl border-2 border-violet-300 p-5 space-y-4">
            <h2 className="text-xs font-semibold text-violet-700 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
              Plan de Ahorro
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Input label="N° Grupo / Orden *" value={form.nro_grupo_orden} onChange={e => set('nro_grupo_orden', e.target.value)} placeholder="Ej: GR-12345" />
              <Input label="Fecha de adjudicación *" type="date" value={form.fecha_adjudicacion} onChange={e => set('fecha_adjudicacion', e.target.value)} />
            </div>
          </section>
        )}

        {/* PRENDA */}
        {requierePrenda && (
          <section className="bg-yellow-50 rounded-xl border-2 border-yellow-400 p-5 space-y-3">
            <h2 className="text-xs font-semibold text-yellow-700 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              Prenda
            </h2>
            {!esPlan && (
              <Select
                label="Banco / Entidad *"
                value={form.banco_entidad}
                onChange={e => set('banco_entidad', e.target.value as BancoEntidad)}
                options={[{ value: '', label: 'Seleccionar banco...' }, ...BANCOS.map(b => ({ value: b, label: b }))]}
              />
            )}
            <p className="text-xs text-yellow-700">Se registrará como pendiente. El seguimiento continúa en el Paso 2.</p>
          </section>
        )}

        {/* FINANCIERO — solo 0km y usados */}
        {mostrarFinanciero && (
          <section className="bg-emerald-50 rounded-xl border-2 border-emerald-300 p-5 space-y-4">
            <h2 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Valores y financiación</h2>

            <Input
              label="Valor de la unidad *"
              type="number"
              value={form.valor_unidad}
              onChange={e => set('valor_unidad', e.target.value)}
              placeholder="Ej: 25000000"
            />

            {esFinanciado && (
              <>
                <Input
                  label="Valor del crédito"
                  type="number"
                  value={form.valor_credito}
                  onChange={e => set('valor_credito', e.target.value)}
                  placeholder="Monto aprobado por el banco"
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Quebranto / Otorgamiento %"
                    type="number"
                    value={form.quebranto_porcentaje}
                    onChange={e => set('quebranto_porcentaje', e.target.value)}
                    placeholder="Ej: 3.5"
                  />
                  <div className="flex flex-col justify-end">
                    <p className="text-xs text-text-muted mb-1">Descuento del crédito</p>
                    <p className="text-sm font-semibold text-emerald-700">
                      {quebrantoMonto > 0 ? formatMoney(quebrantoMonto) : '—'}
                    </p>
                  </div>
                </div>

                {valorCredito > 0 && (
                  <div className="bg-white rounded-lg border border-emerald-200 p-3 space-y-1">
                    <div className="flex justify-between text-xs text-text-secondary">
                      <span>Crédito aprobado</span>
                      <span>{formatMoney(valorCredito)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-red-500">
                      <span>– Quebranto ({quebrantoPct}%)</span>
                      <span>– {formatMoney(quebrantoMonto)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-text-primary border-t pt-1">
                      <span>Neto que recibe el cliente</span>
                      <span>{formatMoney(netoCredito)}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Saldo */}
            {valorUnidad > 0 && (
              <div className={`rounded-lg border-2 p-4 space-y-3 ${
                saldoRestante > 0 ? 'border-red-400 bg-red-50'
                : saldoRestante === 0 && pagoInicial > 0 ? 'border-green-400 bg-green-50'
                : clienteDebeSaldo ? 'border-red-400 bg-red-50'
                : 'border-green-400 bg-green-50'
              }`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-text-muted">Saldo del cliente</p>
                    <p className={`text-lg font-bold ${clienteDebeSaldo ? 'text-red-600' : 'text-green-600'}`}>
                      {formatMoney(saldoCliente)}
                    </p>
                  </div>
                  {saldoRestante <= 0 && pagoInicial > 0 ? (
                    <div className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                      PAGADO
                    </div>
                  ) : pagoInicial > 0 && saldoRestante > 0 ? (
                    <div className="flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-1 rounded-full">
                      <AlertTriangle className="h-3 w-3" />
                      PAGO PARCIAL
                    </div>
                  ) : clienteDebeSaldo ? (
                    <div className="flex items-center gap-1 bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
                      <AlertTriangle className="h-3 w-3" />
                      DEBE SALDO
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                      CUBIERTO
                    </div>
                  )}
                </div>

                {clienteDebeSaldo && (
                  <>
                    {/* Monto a pagar */}
                    <div>
                      <label className="text-xs text-text-muted block mb-1 font-medium">Monto a pagar ahora</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={form.pago_inicial}
                          onChange={e => set('pago_inicial', e.target.value)}
                          placeholder="0"
                          min="0"
                          max={saldoCliente}
                          className={`flex-1 text-sm border-2 rounded-lg px-3 py-2 bg-white text-gray-900 font-semibold placeholder-gray-400 ${
                            pagoInicial > saldoCliente ? 'border-red-500' : form.pago_inicial ? 'border-emerald-500' : 'border-gray-300'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => set('pago_inicial', String(Math.round(saldoCliente)))}
                          className="text-xs px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors whitespace-nowrap cursor-pointer font-medium"
                        >
                          Pagar todo
                        </button>
                      </div>
                      {pagoInicial > saldoCliente && (
                        <p className="text-xs text-red-600 mt-1">No puede superar {formatMoney(saldoCliente)}</p>
                      )}
                    </div>

                    {/* Forma de pago */}
                    <Select
                      label="¿Cómo paga?"
                      value={form.forma_pago_saldo}
                      onChange={e => set('forma_pago_saldo', e.target.value)}
                      options={[
                        { value: '', label: 'Seleccionar...' },
                        { value: 'transferencia', label: 'Transferencia bancaria' },
                        { value: 'efectivo', label: 'Efectivo' },
                        { value: 'tarjeta', label: 'Tarjeta' },
                      ]}
                    />

                    {/* Resumen */}
                    {pagoInicial > 0 && pagoInicial <= saldoCliente && (
                      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1">
                        <div className="flex justify-between text-xs text-text-secondary">
                          <span>Saldo total</span>
                          <span>{formatMoney(saldoCliente)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-green-600">
                          <span>– Pago inicial</span>
                          <span>– {formatMoney(pagoInicial)}</span>
                        </div>
                        <div className={`flex justify-between text-xs font-semibold border-t pt-1 ${saldoRestante > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          <span>Saldo restante</span>
                          <span>{formatMoney(Math.max(0, saldoRestante))}</span>
                        </div>
                        {saldoRestante > 0 && (
                          <p className="text-xs text-red-500 mt-1 italic">
                            El cliente queda debiendo {formatMoney(saldoRestante)}. Podrás registrar más pagos desde el detalle de la operación.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* CLIENTE */}
        <section className="bg-bg-secondary rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Cliente</h2>
          <Input label="Nombre completo *" value={form.cliente_nombre} onChange={e => set('cliente_nombre', e.target.value)} placeholder="Apellido, Nombre" />
          <Input label="Teléfono WhatsApp *" type="tel" value={form.cliente_telefono} onChange={e => set('cliente_telefono', e.target.value)} placeholder="+54 9 2964 000000" />
        </section>

        {/* VEHÍCULO */}
        <section className="bg-bg-secondary rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Vehículo</h2>
          <Select
            label="Modelo / Versión *"
            value={form.modelo_version}
            onChange={e => set('modelo_version', e.target.value)}
            options={[{ value: '', label: modelos.length ? 'Seleccionar modelo...' : 'Cargando...' }, ...modelos]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="VIN / Chasis *"
              value={form.vin_chasis}
              onChange={e => set('vin_chasis', e.target.value.toUpperCase())}
              placeholder="17 caracteres"
            />
            <Input label="Color" value={form.color} onChange={e => set('color', e.target.value)} placeholder="Ej: Rojo Rally" />
          </div>
        </section>

        {/* COMPROMISO */}
        <section className="bg-bg-secondary rounded-xl border border-border p-5 space-y-3">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Compromiso de entrega</h2>
          <Input
            label="Fecha de compromiso *"
            type="date"
            value={form.fecha_compromiso}
            onChange={e => set('fecha_compromiso', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
          <p className="text-xs text-text-muted">Esta fecha inicia el semáforo de control de la operación.</p>
        </section>

        <div className="flex gap-3 pb-8">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)} fullWidth>Cancelar</Button>
          <Button type="submit" loading={loading} fullWidth>
            <Save className="h-4 w-4 mr-1" /> Crear operación
          </Button>
        </div>
      </form>
    </div>
  )
}
