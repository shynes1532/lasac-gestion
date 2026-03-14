interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  hoverable?: boolean
}

export function Card({ children, className = '', onClick, hoverable }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-bg-card rounded-xl border border-border p-4
        ${hoverable || onClick ? 'hover:border-border-light cursor-pointer transition-colors duration-200' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  status?: 'ok' | 'warning' | 'danger'
}

const statusBorder: Record<string, string> = {
  ok: 'border-l-success',
  warning: 'border-l-warning',
  danger: 'border-l-danger',
}

export function KPICard({ title, value, subtitle, icon, status = 'ok' }: KPICardProps) {
  return (
    <div className={`bg-bg-card rounded-xl border border-border p-4 border-l-4 ${statusBorder[status]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-text-muted">{title}</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{value}</p>
          {subtitle && <p className="text-xs text-text-secondary mt-1">{subtitle}</p>}
        </div>
        {icon && <div className="text-text-muted">{icon}</div>}
      </div>
    </div>
  )
}
