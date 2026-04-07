import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Phone, Check, MessageCircle, Clock, UserCheck, Send, BarChart3 } from 'lucide-react'
import { useRecepciones, useMarcarAtendido, useMarcarContactado } from '../../hooks/useRecepciones'
import { Button, Badge, Card, SearchInput, Select, EmptyState, notify } from '../../components/ui'
import type { Recepcion, AreaRecepcion } from '../../lib/types'
import { cleanPhone } from '../../utils/whatsapp'
import { useAuth } from '../../context/AuthContext'

const AREA_LABELS: Record<AreaRecepcion, string> = {
  posventa: 'Posventa',
  administracion: 'Administración',
  ventas: 'Ventas',
}

const SUBAREA_LABELS: Record<string, string> = {
  repuestos: 'Repuestos',
  taller: 'Taller',
  siniestro: 'Siniestro',
  plan: 'Plan',
  convencional: 'Convencional',
  '0km': '0KM',
}

const ESTADO_COLORS: Record<string, 'yellow' | 'green' | 'blue'> = {
  en_espera: 'yellow',
  atendido: 'green',
  contactado: 'blue',
}

const ESTADO_LABELS: Record<string, string> = {
  en_espera: 'En espera',
  atendido: 'Atendido',
  contactado: 'Contactado',
}

function getWhatsAppFollowUp(rec: Recepcion, agente: string): string {
  const nombre = rec.nombre.split(' ')[0]
  const primerNombreAgente = agente.split(' ')[0] || 'el equipo'
  const phone = cleanPhone(rec.telefono)
  const link = 'https://lasac-pwa.vercel.app/'
  const cierre = `\n\nTe dejamos nuestra plataforma donde podés consultar nuestros precios o comunicarte con nosotros: ${link}`

  let mensaje = ''

  if (rec.area === 'ventas') {
    mensaje = `Hola ${nombre}! 👋 Te escribe ${primerNombreAgente} del área de Calidad de Liendo Automotores. ¡Muchas gracias por tu visita el día de hoy! 🙌\n\nQueremos saber cómo fue tu experiencia: ¿el asesor te explicó todo lo que necesitabas? ¿Te quedó alguna duda o querés que nos comuniquemos de nuevo para ampliar información?${cierre}`
  } else if (rec.area === 'posventa') {
    mensaje = `Hola ${nombre}! 👋 Te escribe ${primerNombreAgente} del área de Calidad de Liendo Automotores. ¡Muchas gracias por tu visita el día de hoy! 🙌\n\n¿Pudiste solucionar lo que necesitabas? ¿Cómo fue el trato que recibiste? ¿Necesitás algo más de nuestra parte?${cierre}`
  } else {
    mensaje = `Hola ${nombre}! 👋 Te escribe ${primerNombreAgente} del área de Calidad de Liendo Automotores. ¡Muchas gracias por tu visita el día de hoy! 🙌\n\n¿Pudiste resolver tu trámite? ¿Cómo fue la atención que recibiste? Si necesitás algo más, no dudes en escribirnos.${cierre}`
  }

  return `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(mensaje)}`
}

function RecepcionCard({ rec }: { rec: Recepcion }) {
  const { perfil } = useAuth()
  const marcarAtendido = useMarcarAtendido()
  const marcarContactado = useMarcarContactado()

  const handleAtendido = async () => {
    try {
      await marcarAtendido.mutateAsync(rec.id)
      notify.success('Marcado como atendido')
    } catch {
      notify.error('Error al actualizar')
    }
  }

  const handleContactar = () => {
    marcarContactado.mutate(rec.id)
    window.open(getWhatsAppFollowUp(rec, perfil?.nombre_completo || ''), '_blank')
  }

  const horaIngreso = new Date(rec.created_at).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-text-primary">{rec.nombre}</h3>
          <a href={`tel:${rec.telefono}`} className="text-sm text-action flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" />
            {rec.telefono}
          </a>
        </div>
        <Badge color={ESTADO_COLORS[rec.estado] || 'yellow'}>
          {ESTADO_LABELS[rec.estado]}
        </Badge>
      </div>

      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Badge color="blue">{AREA_LABELS[rec.area]}</Badge>
        <span className="text-text-muted">→</span>
        <span>{SUBAREA_LABELS[rec.subarea]}</span>
        <span className="ml-auto flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {horaIngreso}
        </span>
      </div>

      {rec.notas && (
        <p className="text-sm text-text-muted bg-bg-tertiary rounded px-2 py-1">{rec.notas}</p>
      )}

      <div className="flex gap-2 pt-1">
        {rec.estado === 'en_espera' && (
          <Button
            size="sm"
            onClick={handleAtendido}
            loading={marcarAtendido.isPending}
          >
            <UserCheck className="h-4 w-4" />
            Atendido
          </Button>
        )}
        {(rec.estado === 'atendido') && (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleContactar}
            loading={marcarContactado.isPending}
          >
            <Send className="h-4 w-4" />
            Enviar seguimiento
          </Button>
        )}
        {rec.estado === 'contactado' && (
          <span className="text-xs text-text-muted flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-green-400" />
            Seguimiento enviado
          </span>
        )}
      </div>
    </Card>
  )
}

export function ListaRecepcion() {
  const today = new Date().toISOString().slice(0, 10)
  const [filtros, setFiltros] = useState({
    area: '',
    estado: '',
    fecha: today,
    busqueda: '',
  })

  const { data, isLoading } = useRecepciones(filtros)
  const recepciones = data?.data || []

  const enEspera = recepciones.filter(r => r.estado === 'en_espera').length
  const atendidos = recepciones.filter(r => r.estado === 'atendido').length
  const contactados = recepciones.filter(r => r.estado === 'contactado').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Recepción</h1>
          <p className="text-sm text-text-muted">Control de ingreso de clientes</p>
        </div>
        <div className="flex gap-2">
          <Link to="/recepcion/reporte">
            <Button variant="secondary">
              <BarChart3 className="h-4 w-4" />
              Reporte
            </Button>
          </Link>
          <Link to="/recepcion/nueva">
            <Button>
              <Plus className="h-4 w-4" />
              Nuevo ingreso
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-yellow-400">{enEspera}</p>
          <p className="text-xs text-text-muted">En espera</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{atendidos}</p>
          <p className="text-xs text-text-muted">Atendidos</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-blue-400">{contactados}</p>
          <p className="text-xs text-text-muted">Contactados</p>
        </Card>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SearchInput
          value={filtros.busqueda}
          onChange={(v) => setFiltros(prev => ({ ...prev, busqueda: v }))}
          placeholder="Buscar..."
        />
        <Select
          value={filtros.area}
          onChange={(e) => setFiltros(prev => ({ ...prev, area: e.target.value }))}
          options={[
            { label: 'Todas las áreas', value: '' },
            { label: 'Posventa', value: 'posventa' },
            { label: 'Administración', value: 'administracion' },
            { label: 'Ventas', value: 'ventas' },
          ]}
        />
        <Select
          value={filtros.estado}
          onChange={(e) => setFiltros(prev => ({ ...prev, estado: e.target.value }))}
          options={[
            { label: 'Todos los estados', value: '' },
            { label: 'En espera', value: 'en_espera' },
            { label: 'Atendido', value: 'atendido' },
            { label: 'Contactado', value: 'contactado' },
          ]}
        />
        <input
          type="date"
          value={filtros.fecha}
          onChange={(e) => setFiltros(prev => ({ ...prev, fecha: e.target.value }))}
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-4 h-28 animate-pulse bg-bg-tertiary">
              <div className="h-4 w-1/3 bg-bg-secondary rounded mb-2" />
              <div className="h-3 w-1/2 bg-bg-secondary rounded" />
            </Card>
          ))}
        </div>
      ) : recepciones.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="h-12 w-12" />}
          title="Sin ingresos"
          description="No hay clientes registrados para esta fecha"
        />
      ) : (
        <div className="space-y-3">
          {recepciones.map(rec => (
            <RecepcionCard key={rec.id} rec={rec} />
          ))}
        </div>
      )}
    </div>
  )
}
