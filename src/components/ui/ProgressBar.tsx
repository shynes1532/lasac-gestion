interface ProgressBarProps {
  value: number
  max: number
  label?: string
  showPercentage?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ProgressBar({ value, max, label, showPercentage = true, size = 'md', className = '' }: ProgressBarProps) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0
  const barColor = percentage >= 100 ? 'bg-success' : percentage >= 50 ? 'bg-warning' : 'bg-action'
  const heightClass = size === 'sm' ? 'h-1.5' : 'h-2.5'

  return (
    <div className={className}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-sm text-text-secondary">{label}</span>}
          {showPercentage && <span className="text-sm font-medium text-text-primary">{value}/{max} ({percentage}%)</span>}
        </div>
      )}
      <div className={`w-full ${heightClass} bg-bg-tertiary rounded-full overflow-hidden`}>
        <div
          className={`${heightClass} ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  )
}
