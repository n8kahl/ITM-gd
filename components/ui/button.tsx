import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium font-sans transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:scale-[0.97] active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'btn-noise bg-primary text-primary-foreground border border-white/10 hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(16,185,129,0.18)]',
        destructive:
          'bg-destructive text-white border border-white/10 hover:bg-destructive/90 hover:-translate-y-0.5 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border border-[rgba(232,228,217,0.25)] bg-transparent text-[#E8E4D9] hover:bg-[rgba(232,228,217,0.05)] hover:border-[rgba(232,228,217,0.40)] hover:-translate-y-0.5',
        secondary:
          'bg-secondary text-secondary-foreground border border-white/10 hover:bg-secondary/80 hover:-translate-y-0.5',
        ghost:
          'hover:bg-[rgba(255,255,255,0.05)] hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
        // Luxury variants
        luxury:
          'btn-noise bg-primary text-primary-foreground border border-white/10 hover:bg-[#059669] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(16,185,129,0.2)]',
        'luxury-outline':
          'border border-[rgba(232,228,217,0.25)] bg-transparent text-[#E8E4D9] hover:bg-[rgba(232,228,217,0.05)] hover:border-[rgba(232,228,217,0.40)] hover:-translate-y-0.5',
        'luxury-glass':
          'bg-[rgba(255,255,255,0.03)] backdrop-blur-[40px] border border-[rgba(255,255,255,0.10)] text-[#F5F5F0] hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.15)] hover:-translate-y-0.5',
        'luxury-champagne':
          'bg-[#E8E4D9] text-[#0A0A0B] border border-[rgba(232,228,217,0.25)] hover:bg-[#F5F3ED] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(232,228,217,0.15)]',
      },
      size: {
        default: 'h-10 px-5 py-2.5 has-[>svg]:px-4',
        sm: 'h-9 rounded-md gap-1.5 px-4 has-[>svg]:px-3',
        lg: 'h-12 rounded-md px-8 has-[>svg]:px-5 text-base tracking-wide',
        xl: 'h-14 rounded-md px-10 has-[>svg]:px-6 text-base tracking-wide',
        icon: 'size-10',
        'icon-sm': 'size-9',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
