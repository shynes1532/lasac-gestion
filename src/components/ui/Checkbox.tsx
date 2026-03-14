import { type InputHTMLAttributes, forwardRef } from 'react'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = '', id, ...props }, ref) => {
    const checkboxId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <label htmlFor={checkboxId} className={`flex items-center gap-2 cursor-pointer ${className}`}>
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          className="h-4 w-4 rounded border-border bg-bg-input text-action
            focus:ring-2 focus:ring-action/50 cursor-pointer accent-action"
          {...props}
        />
        {label && <span className="text-sm text-text-secondary">{label}</span>}
      </label>
    )
  }
)

Checkbox.displayName = 'Checkbox'
