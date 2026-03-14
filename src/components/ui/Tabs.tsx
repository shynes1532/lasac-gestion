import { useState } from 'react'

interface Tab {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  activeTab?: string
  onChange: (tabId: string) => void
  className?: string
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  const [active, setActive] = useState(activeTab || tabs[0]?.id)
  const current = activeTab ?? active

  const handleClick = (id: string) => {
    setActive(id)
    onChange(id)
  }

  return (
    <div className={`flex gap-1 overflow-x-auto border-b border-border ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleClick(tab.id)}
          className={`
            px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-200 cursor-pointer
            border-b-2 -mb-px
            ${current === tab.id
              ? 'border-action text-action'
              : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border'
            }
          `}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-bg-tertiary">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
