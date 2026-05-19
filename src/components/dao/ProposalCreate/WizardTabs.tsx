'use client'

import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

export type WizardStep = 'details' | 'transactions' | 'preview'

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'preview', label: 'Preview' },
]

type Props = {
  current: WizardStep
  onChange: (next: WizardStep) => void
  unlocked: Record<WizardStep, boolean>
}

export function WizardTabs({ current, onChange, unlocked }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Proposal creation steps"
      className="flex w-full gap-1 rounded-lg border border-border bg-surface p-1"
    >
      {STEPS.map((step, i) => {
        const isCurrent = step.id === current
        const isUnlocked = unlocked[step.id]
        const isPast =
          STEPS.findIndex((s) => s.id === current) >
          STEPS.findIndex((s) => s.id === step.id)
        return (
          <button
            key={step.id}
            type="button"
            role="tab"
            aria-selected={isCurrent}
            disabled={!isUnlocked}
            onClick={() => onChange(step.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
              isCurrent && 'bg-surface-2 text-fg shadow-sm',
              !isCurrent &&
                isUnlocked &&
                'text-muted-fg hover:bg-surface-2 hover:text-fg',
              !isUnlocked && 'cursor-not-allowed text-muted-fg/50'
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                isCurrent || isPast
                  ? 'bg-accent text-accent-fg'
                  : 'bg-surface-3 text-muted-fg'
              )}
            >
              {isPast ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            {step.label}
          </button>
        )
      })}
    </div>
  )
}
