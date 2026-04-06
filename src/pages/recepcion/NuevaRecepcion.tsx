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

export function NuevaRecepcion() {
  const navigate = useNavigate()
  const crearRecepcion = useCrearRecepcion()

  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    area: '',
    subarea: '',
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
        notas: form.notas || undefined,
      })
      notify.success('Cliente registrado')
      navigate('/recepcion')
    } catch (err: any) {
      notify.error(err?.message || 'Error al registrar')
    }
  }

  const subareasDisponibles = form.area ? SUBAREAS[form.area] || [] : []

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
