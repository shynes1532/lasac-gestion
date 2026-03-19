import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Save } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { TIPOS_OPERACION, FORMAS_PAGO, BANCOS, SUCURSALES_SELECT, CHECKLIST_DOC_0KM, CHECKLIST_PDI_TEMPLATE } from '../../lib/constants'
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

  useEffect(() => {
    supabase.from('modelos_fiat').select('nombre, categoria').eq('activo', true).order('categoria').then(({ data }) => {
      if (data) setModelos(data.map(m => ({ value: m.nombre, label: `${m.nombre}` })))
    })
  }, [])

  const set = (field: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const esPlan = form.tipo_operacion === 'plan_ahorro'
  const esFinanciado = form.forma_pago === 'financiado_banco' || esPlan
  const requierePrenda = esFinanciado

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
          asesor_id: perfil?.id,
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
