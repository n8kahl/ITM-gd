'use client'

import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DatePickerFieldProps {
  value: string | null
  placeholder: string
  ariaLabel: string
  disabled?: boolean
  className?: string
  onChange: (value: string | null) => void
}

function parseDateValue(value: string | null): Date | undefined {
  if (!value) return undefined
  const [yearRaw, monthRaw, dayRaw] = value.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined
  }
  return new Date(year, month - 1, day)
}

function toDateValue(value: Date | undefined): string | null {
  if (!value) return null
  return format(value, 'yyyy-MM-dd')
}

export function DatePickerField({
  value,
  placeholder,
  ariaLabel,
  disabled = false,
  className,
  onChange,
}: DatePickerFieldProps) {
  const selectedDate = parseDateValue(value)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="luxury-outline"
          size="sm"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            'h-10 w-full justify-start border-white/10 bg-black/20 px-3 text-sm font-normal text-ivory hover:bg-white/10',
            !selectedDate && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          {selectedDate ? format(selectedDate, 'MMM d, yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => onChange(toDateValue(date))}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
