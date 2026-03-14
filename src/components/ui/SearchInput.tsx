import { useState, useEffect, useCallback } from 'react'
import { Search, X } from 'lucide-react'

interface SearchInputProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
  className?: string
}

export function SearchInput({ value: externalValue, onChange, placeholder = 'Buscar...', debounceMs = 300, className = '' }: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(externalValue || '')

  useEffect(() => {
    if (externalValue !== undefined) setInternalValue(externalValue)
  }, [externalValue])

  const debouncedOnChange = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>
      return (val: string) => {
        clearTimeout(timer)
        timer = setTimeout(() => onChange(val), debounceMs)
      }
    })(),
    [onChange, debounceMs]
  )

  const handleChange = (val: string) => {
    setInternalValue(val)
    debouncedOnChange(val)
  }

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
      <input
        type="text"
        value={internalValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-bg-input border border-border pl-10 pr-10 py-2.5
          text-text-primary placeholder:text-text-muted
          focus:outline-none focus:ring-2 focus:ring-action/50 focus:border-action
          transition-colors duration-200"
      />
      {internalValue && (
        <button
          onClick={() => handleChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
