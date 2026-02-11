'use client'

import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface PrivacyToggleProps {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

export function PrivacyToggle({
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: PrivacyToggleProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg px-4 py-3',
        'border border-white/5 bg-white/[0.02] transition-colors',
        disabled && 'opacity-50'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#F5F5F0]">{label}</p>
        {description && (
          <p className="text-xs text-[#9A9A9A] mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  )
}
