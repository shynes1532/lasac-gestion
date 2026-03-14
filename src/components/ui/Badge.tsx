interface BadgeProps {
  children: React.ReactNode
  color?: 'gray' | 'yellow' | 'green' | 'blue' | 'red' | 'orange' | 'purple'
  size?: 'sm' | 'md'
  className?: string
}

const colorStyles: Record<string, string> = {
  gray: 'bg-slate-700/50 text-slate-300 border-slate-600',
  yellow: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
  green: 'bg-green-900/30 text-green-400 border-green-700',
  blue: 'bg-blue-900/30 text-blue-400 border-blue-700',
  red: 'bg-red-900/30 text-red-400 border-red-700',
  orange: 'bg-orange-900/30 text-orange-400 border-orange-700',
  purple: 'bg-purple-900/30 text-purple-400 border-purple-700',
}

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}

export function Badge({ children, color = 'gray', size = 'sm', className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${colorStyles[color]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {children}
    </span>
  )
}

// Badge específico para estados del sistema
type EstadoGestoria = 'ingresado' | 'en_tramite' | 'listo' | 'egresado' | 'suspendido'
type EstadoAlistamiento = 'pendiente' | 'en_proceso' | 'observado' | 'aprobado' | 'rechazado'
type EstadoEntrega = 'pendiente' | 'programada' | 'entregada' | 'cerrada'
type EstadoActual = 'gestoria' | 'alistamiento' | 'entrega' | 'cerrada'

const estadoGestoriaColor: Record<EstadoGestoria, BadgeProps['color']> = {
  ingresado: 'gray',
  en_tramite: 'yellow',
  listo: 'green',
  egresado: 'blue',
  suspendido: 'red',
}

const estadoAlistamientoColor: Record<EstadoAlistamiento, BadgeProps['color']> = {
  pendiente: 'gray',
  en_proceso: 'yellow',
  observado: 'orange',
  aprobado: 'green',
  rechazado: 'red',
}

const estadoEntregaColor: Record<EstadoEntrega, BadgeProps['color']> = {
  pendiente: 'gray',
  programada: 'blue',
  entregada: 'green',
  cerrada: 'purple',
}

const estadoActualColor: Record<EstadoActual, BadgeProps['color']> = {
  gestoria: 'blue',
  alistamiento: 'yellow',
  entrega: 'orange',
  cerrada: 'green',
}

const estadoLabels: Record<string, string> = {
  ingresado: 'Ingresado',
  en_tramite: 'En trámite',
  listo: 'Listo',
  egresado: 'Egresado',
  suspendido: 'Suspendido',
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  observado: 'Observado',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  programada: 'Programada',
  entregada: 'Entregada',
  cerrada: 'Cerrada',
  gestoria: 'Gestoría',
  alistamiento: 'Alistamiento',
  entrega: 'Entrega',
}

interface EstadoBadgeProps {
  estado: string
  tipo?: 'gestoria' | 'alistamiento' | 'entrega' | 'actual'
  size?: 'sm' | 'md'
}

export function EstadoBadge({ estado, tipo = 'actual', size = 'sm' }: EstadoBadgeProps) {
  let color: BadgeProps['color'] = 'gray'

  switch (tipo) {
    case 'gestoria':
      color = estadoGestoriaColor[estado as EstadoGestoria] || 'gray'
      break
    case 'alistamiento':
      color = estadoAlistamientoColor[estado as EstadoAlistamiento] || 'gray'
      break
    case 'entrega':
      color = estadoEntregaColor[estado as EstadoEntrega] || 'gray'
      break
    case 'actual':
      color = estadoActualColor[estado as EstadoActual] || 'gray'
      break
  }

  return (
    <Badge color={color} size={size}>
      {estadoLabels[estado] || estado}
    </Badge>
  )
}
