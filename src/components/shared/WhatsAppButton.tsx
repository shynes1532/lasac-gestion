import { MessageCircle } from 'lucide-react'
import { generateWhatsAppLink } from '../../utils/whatsapp'

interface WhatsAppButtonProps {
  telefono: string
  mensaje?: string
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3 py-2 text-sm gap-2',
  lg: 'px-4 py-2.5 text-sm gap-2',
}

const iconSize = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

export function WhatsAppButton({
  telefono,
  mensaje = 'Hola! Te escribimos de Liendo Automotores.',
  label = 'WhatsApp',
  size = 'md',
  className = '',
}: WhatsAppButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const link = generateWhatsAppLink(telefono, mensaje)
    window.open(link, '_blank')
  }

  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center font-medium rounded-lg
        bg-success/10 text-success hover:bg-success/20
        transition-colors duration-200 cursor-pointer
        ${sizeStyles[size]}
        ${className}
      `}
    >
      <MessageCircle className={iconSize[size]} />
      {label}
    </button>
  )
}
