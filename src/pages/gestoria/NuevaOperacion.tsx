import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { useCrearOperacion } from '../../hooks/useOperaciones'
import { Button, Input, Select, Textarea, Checkbox, Card, notify } from '../../components/ui'
import type { Sucursal, TipoOperacion } from '../../lib/types'

const MODELOS_FIAT = [
  'MOBI TREKKING 1.0', 'ARGO DRIVE 1.3L MT', 'ARGO DRIVE 1.3L CVT',
  'CRONOS LIKE 1.3 GSE MY26', 'CRONOS DRIVE 1.3 GSE PACK PLUS MY26',
  'CRONOS DRIVE 1.3L GSE CVT PACK PLUS MY26', 'CRONOS PRECISION 1.3 GSE CVT MY26',
  'PULSE DRIVE 1.3 MT5 MY26', 'PULSE DRIVE 1.3 CVT MY26',
  'PULSE AUDACE 1.0T CVT MY26', 'PULSE IMPETUS 1.0T CVT MY26',
  'PULSE ABARTH TURBO 270 AT6 MY26', 'FASTBACK TURBO 270 AT MY26',
  'FASTBACK ABARTH TURBO 270 AT6 MY26', '600 HYBRID 1.2 eDCT',
  'FIORINO ENDURANCE 1.3 FIREFLY', 'STRADA FREEDOM CS 1.3 MT',
  'STRADA FREEDOM 1.3 8V CD', 'STRADA VOLCANO 1.3 8V CD CVT',
  'STRADA RANCH T200 CD CVT', 'STRADA ULTRA T200 CD CVT',
  'TORO FREEDOM T270 AT6 4X2', 'TORO VOLCANO T270 AT6 4X2',
  'TORO VOLCANO TD350 AT9 4X4', 'TORO ULTRA TD350 AT9 4X4',
  'TORO FREEDOM 1.3T AT6 4X2', 'TORO VOLCANO 1.3T AT6 4X2',
  'TORO VOLCANO 2.2TD AT9 4X4',
  'TITANO ENDURANCE MT 4X2', 'TITANO ENDURANCE MT 4X4',
  'TITANO FREEDOM MT 4X4', 'TITANO FREEDOM PLUS AT 4X4', 'TITANO RANCH AT 4X4',
]

export function NuevaOperacion() {
  const navigate = useNavigate()
  const crearOperacion = useCrearOperacion()

  const [formData, setFormData] = useState({
    tipo_operacion: '0KM' as TipoOperacion,
    sucursal: 'Ushuaia' as Sucursal,
    fecha_egreso_estimada: '',
    observaciones: '',
    nombre_apellido: '',
    dni_cuil: '',
    domicilio: '',
    localidad: 'Ushuaia',
    telefono: '',
    email: '',
    es_empresa: false,
    razon_social: '',
    cuit_empresa: '',
    modelo: '',
    color: '',
    vin_chasis: '',
    patente_actual: '',
    anio: new Date().getFullYear(),
    kilometraje: 0,
  })

  const update = (field: string, value: string | number | boolean) =>
    setFormData(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Validaciones antes de enviar
    if (!formData.modelo) {
      notify.error('Seleccioná un modelo de vehículo')
      return
    }
    if (!formData.vin_chasis || formData.vin_chasis.length < 5) {
      notify.error('Ingresá un VIN/Chasis válido')
      return
    }
    if (!formData.nombre_apellido || formData.nombre_apellido.length < 3) {
      notify.error('Ingresá el nombre del titular (mínimo 3 caracteres)')
      return
    }
    if (!formData.telefono) {
      notify.error('Ingresá el teléfono del titular')
      return
    }

    try {
      const result = await crearOperacion.mutateAsync({
        operacion: {
          tipo_operacion: formData.tipo_operacion,
          sucursal: formData.sucursal,
        },
        titular: {
          nombre_apellido: formData.nombre_apellido,
          dni_cuil: formData.dni_cuil,
          domicilio: formData.domicilio || undefined,
          localidad: formData.localidad,
          telefono: formData.telefono,
          email: formData.email || undefined,
          es_empresa: formData.es_empresa,
          razon_social: formData.es_empresa ? formData.razon_social : undefined,
          cuit_empresa: formData.es_empresa ? formData.cuit_empresa : undefined,
        },
        unidad: {
          modelo: formData.modelo,
          color: formData.color,
          vin_chasis: formData.vin_chasis,
          patente_actual: formData.tipo_operacion === 'Usado' ? formData.patente_actual : undefined,
          anio: formData.anio,
          kilometraje: formData.tipo_operacion === 'Usado' ? formData.kilometraje : undefined,
        },
        gestoria: {
          fecha_egreso_estimada: formData.fecha_egreso_estimada || undefined,
          observaciones: formData.observaciones || undefined,
        },
      })
      notify.success('Operación creada correctamente')
      navigate(`/gestoria/${result.id}`)
    } catch (err: any) {
      console.error('Error al crear operación:', err)
      const msg = err?.message || 'Error desconocido al crear la operación'
      notify.error(msg)
    }
  }

  const esUsado = formData.tipo_operacion === 'Usado'

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/gestoria')}
          className="text-text-muted hover:text-text-primary cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-text-primary">Nueva Operación</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sección 1 - Datos del Trámite */}
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-text-primary">Datos del Trámite</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label="Tipo de operación"
              value={formData.tipo_operacion}
              onChange={(e) => update('tipo_operacion', e.target.value)}
              options={[
                { label: '0KM', value: '0KM' },
                { label: 'Plan de Ahorro', value: 'Plan de Ahorro' },
                { label: 'Usado', value: 'Usado' },
              ]}
            />
            <Select
              label="Sucursal"
              value={formData.sucursal}
              onChange={(e) => update('sucursal', e.target.value)}
              options={[
                { label: 'Ushuaia', value: 'Ushuaia' },
                { label: 'Río Grande', value: 'Rio Grande' },
              ]}
            />
          </div>
          <Input
            label="Fecha de egreso estimada"
            type="date"
            value={formData.fecha_egreso_estimada}
            onChange={(e) => update('fecha_egreso_estimada', e.target.value)}
          />
          <Textarea
            label="Observaciones"
            value={formData.observaciones}
            onChange={(e) => update('observaciones', e.target.value)}
            rows={3}
          />
        </Card>

        {/* Sección 2 - Datos del Titular */}
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-text-primary">Datos del Titular</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Nombre y apellido"
              value={formData.nombre_apellido}
              onChange={(e) => update('nombre_apellido', e.target.value)}
              required
              minLength={3}
            />
            <Input
              label="DNI / CUIL"
              value={formData.dni_cuil}
              onChange={(e) => update('dni_cuil', e.target.value)}
              required
            />
          </div>
          <Input
            label="Domicilio"
            value={formData.domicilio}
            onChange={(e) => update('domicilio', e.target.value)}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label="Localidad"
              value={formData.localidad}
              onChange={(e) => update('localidad', e.target.value)}
              options={[
                { label: 'Ushuaia', value: 'Ushuaia' },
                { label: 'Río Grande', value: 'Rio Grande' },
                { label: 'Otra', value: 'Otra' },
              ]}
            />
            <Input
              label="Teléfono"
              value={formData.telefono}
              onChange={(e) => update('telefono', e.target.value)}
              required
              placeholder="+5492901..."
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => update('email', e.target.value)}
          />
          <Checkbox
            label="Es empresa"
            checked={formData.es_empresa}
            onChange={(e) => update('es_empresa', (e.target as HTMLInputElement).checked)}
          />
          {formData.es_empresa && (
            <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 md:grid-cols-2">
              <Input
                label="Razón social"
                value={formData.razon_social}
                onChange={(e) => update('razon_social', e.target.value)}
              />
              <Input
                label="CUIT"
                value={formData.cuit_empresa}
                onChange={(e) => update('cuit_empresa', e.target.value)}
              />
            </div>
          )}
        </Card>

        {/* Sección 3 - Datos de la Unidad */}
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-text-primary">Datos de la Unidad</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label="Modelo"
              value={formData.modelo}
              onChange={(e) => update('modelo', e.target.value)}
              placeholder="Seleccionar modelo"
              options={MODELOS_FIAT.map(m => ({ label: m, value: m }))}
              required
            />
            <Input
              label="Color"
              value={formData.color}
              onChange={(e) => update('color', e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="VIN / Chasis"
              value={formData.vin_chasis}
              onChange={(e) => update('vin_chasis', e.target.value)}
              required
              maxLength={17}
            />
            <Input
              label="Año"
              type="number"
              value={String(formData.anio)}
              onChange={(e) => update('anio', Number(e.target.value))}
            />
          </div>
          {esUsado && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Patente actual"
                value={formData.patente_actual}
                onChange={(e) => update('patente_actual', e.target.value)}
              />
              <Input
                label="Kilometraje"
                type="number"
                value={String(formData.kilometraje)}
                onChange={(e) => update('kilometraje', Number(e.target.value))}
              />
            </div>
          )}
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={crearOperacion.isPending} size="lg">
            <Save className="h-4 w-4" />
            Guardar operación
          </Button>
        </div>
      </form>
    </div>
  )
}
