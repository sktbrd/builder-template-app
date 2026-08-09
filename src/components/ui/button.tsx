'use client'

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[filter,background,color,transform] active:translate-y-px disabled:pointer-events-none disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-fg hover:brightness-110 [text-shadow:0_0_0_currentColor]',
        secondary: 'bg-surface text-fg border border-border hover:bg-surface-2',
        ghost: 'bg-transparent text-fg hover:bg-surface-2',
        link: 'bg-transparent text-accent-strong hover:underline px-0 h-auto',
        destructive: 'bg-destructive text-white hover:brightness-110',
        outline: 'border border-border bg-transparent text-fg hover:bg-surface-2',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-[13px]',
        md: 'h-10 min-h-11 md:min-h-10 rounded-md px-[18px] text-sm',
        lg: 'h-12 rounded-md px-6 text-[15px]',
        icon: 'h-9 w-9 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { buttonVariants }
