import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { useCrearRecepcion } from '../../hooks/useRecepciones'
import { Button, Input, Select, Textarea, Card, notify } from '../../components/ui'

const SUBAREAS: Record<string, { label: string; value: string }[]> = {
  posventa: [
    { label: 'Repuestos', value: 'repuestos' },
    { label: 'Taller', value: 'taller' },
    { label: 'Siniestro', value: 'siniestro' },
  ],
  administracion: [
    { label: 'Plan', value: 'plan' },
    { label: 'Convencional', value: 'convencional' },
  ],
  ventas: [
    { label: 'Plan', value: 'plan' },
    { label: '0KM', value: '0km' },
  ],
}

const ORIGENES = [
  { label: 'Seleccionar...', value: '' },
  { label: 'Redes sociales', value: 'redes_sociales' },
  { label: 'Recomendación', value: 'recomendacion' },
  { label: 'Pasó por la puerta', value: 'paso_por_puerta' },
  { label: 'Llamada telefónica', value: 'llamada' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Web / Internet', value: 'web' },
  { label: 'Otro', value: 'otro' },
]

const MODELOS_FIAT = [
  'MOBI TREKKING 1.0', 'ARGO DRIVE 1.3L MT', 'ARGO DRIVE 1.3L CVT',
  'CRONOS LIKE 1.3 GSE', 'CRONOS DRIVE 1.3 GSE', 'CRONOS PRECISION 1.3 GSE CVT',
  'PULSE DRIVE 1.3 MT5', 'PULSE DRIVE 1.3 CVT', 'PULSE AUDACE 1.0T CVT',
  'PULSE IMPETUS 1.0T CVT', 'PULSE ABARTH TURBO 270',
  'FASTBACK TURBO 270 AT', 'FASTBACK ABARTH TURBO 270',
  '600 HYBRID 1.2 eDCT',
  'FIORINO ENDURANCE 1.3',
  'STRADA FREEDOM CS 1.3', 'STRADA FREEDOM CD 1.3', 'STRADA VOLCANO CD CVT',
  'STRADA RANCH T200 CD CVT', 'STRADA ULTRA T200 CD CVT',
  'TORO FREEDOM T270 4X2', 'TORO VOLCANO T270 4X2', 'TORO VOLCANO TD350 4X4', 'TORO ULTRA TD350 4X4',
  'TITANO ENDURANCE MT', 'TITANO FREEDOM MT 4X4', 'TITANO FREEDOM PLUS AT', 'TITANO RANCH AT 4X4',
]

export function NuevaRecepcion() {
  const navigate = useNavigate()
  const crearRecepcion = useCrearRecepcion()

  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    area: '',
    subarea: '',
    origen: '',
    modelo_interes: '',
    notas: '',
  })

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleAreaChange = (area: string) => {
    const subareas = SUBAREAS[area]
    setForm(prev => ({
      ...prev,
      area,
      subarea: subareas?.[0]?.value || '',
      modelo_interes: '',
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await crearRecepcion.mutateAsync({
        nombre: form.nombre,
        telefono: form.telefono,
        area: form.area,
        subarea: form.subarea,
        origen: form.origen || undefined,
        modelo_interes: form.area === 'ventas' && form.modelo_interes ? form.modelo_interes : undefined,
        notas: form.notas || undefined,
      })
      notify.success('Cliente registrado')
      navigate('/recepcion')
    } catch (err: any) {
      notify.error(err?.message || 'Error al registrar')
    }
  }

  const subareasDisponibles = form.area ? SUBAREAS[form.area] || [] : []
  const esVentas = form.area === 'ventas'

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/recepcion')}
          className="text-text-muted hover:text-text-primary cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-text-primary">Nuevo Ingreso</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-4 p-5">
          <Input
            label="Nombre"
            value={form.nombre}
            onChange={(e) => update('nombre', e.target.value)}
            required
            placeholder="Nombre del cliente"
            autoFocus
          />

          <Input
            label="Teléfono"
            value={form.telefono}
            onChange={(e) => update('telefono', e.target.value)}
            required
            placeholder="+5492901..."
          />

          <Select
            label="¿Cómo nos conoció?"
            value={form.origen}
            onChange={(e) => update('origen', e.target.value)}
            options={ORIGENES}
          />

          <Select
            label="Área"
            value={form.area}
            onChange={(e) => handleAreaChange(e.target.value)}
            placeholder="Seleccionar área"
            options={[
              { label: 'Seleccionar área', value: '' },
              { label: 'Posventa', value: 'posventa' },
              { label: 'Administración', value: 'administracion' },
              { label: 'Ventas', value: 'ventas' },
            ]}
            required
          />

          {subareasDisponibles.length > 0 && (
            <Select
              label="Subárea"
              value={form.subarea}
              onChange={(e) => update('subarea', e.target.value)}
              options={subareasDisponibles}
              required
            />
          )}

          {esVentas && (
            <Select
              label="Modelo de interés"
              value={form.modelo_interes}
              onChange={(e) => update('modelo_interes', e.target.value)}
              options={[
                { label: 'Sin especificar', value: '' },
                ...MODELOS_FIAT.map(m => ({ label: m, value: m })),
              ]}
            />
          )}

          <Textarea
            label="Notas (opcional)"
            value={form.notas}
            onChange={(e) => update('notas', e.target.value)}
            rows={2}
            placeholder="Motivo de la visita, observaciones..."
          />
        </Card>

        <div className="flex justify-end mt-4">
          <Button type="submit" loading={crearRecepcion.isPending} size="lg">
            <Save className="h-4 w-4" />
            Registrar ingreso
          </Button>
        </div>
      </form>
    </div>
  )
}
