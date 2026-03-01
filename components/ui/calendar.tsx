'use client'

import * as React from 'react'
import { DayFlag, DayPicker, SelectionState, UI } from 'react-day-picker'

import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-1', className)}
      classNames={{
        [UI.Months]: 'flex flex-col sm:flex-row gap-3',
        [UI.Month]: 'space-y-3',
        [UI.MonthCaption]: 'relative flex h-8 items-center justify-center',
        [UI.CaptionLabel]: 'text-sm font-medium text-ivory',
        [UI.Nav]: 'absolute inset-x-0 top-0 flex h-8 items-center justify-between',
        [UI.PreviousMonthButton]: 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-ivory transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
        [UI.NextMonthButton]: 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-ivory transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
        [UI.MonthGrid]: 'w-full border-collapse',
        [UI.Weekdays]: 'grid grid-cols-7 gap-1',
        [UI.Weekday]: 'h-8 text-center text-xs font-medium text-muted-foreground',
        [UI.Weeks]: 'mt-1 space-y-1',
        [UI.Week]: 'grid grid-cols-7 gap-1',
        [UI.Day]: 'h-9 w-9 p-0 text-sm text-ivory',
        [UI.DayButton]: 'inline-flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:pointer-events-none disabled:opacity-30',
        [SelectionState.selected]: 'rounded-md bg-emerald-500 text-white hover:bg-emerald-500',
        [DayFlag.today]: 'font-semibold text-emerald-300',
        [DayFlag.outside]: 'text-white/35',
        [DayFlag.disabled]: 'text-white/20',
        ...classNames,
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
