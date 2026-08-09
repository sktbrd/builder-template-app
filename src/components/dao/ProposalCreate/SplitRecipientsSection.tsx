'use client'

import { Plus, Trash2 } from 'lucide-react'
import { isAddress } from 'viem'

import { Button } from '@/components/ui/button'
import {
  autoAdjustPercentages,
  calculateRemainingPercentage,
  type SplitRecipient,
  validateSplitRecipients,
} from '@/lib/splits-utils'

type Props = {
  recipients: SplitRecipient[]
  distributorFeePercent: number
  onChange: (recipients: SplitRecipient[], distributorFeePercent: number) => void
}

export function SplitRecipientsSection({
  recipients,
  distributorFeePercent,
  onChange,
}: Props) {
  const errors = validateSplitRecipients(recipients)
  const total = recipients.reduce((s, r) => s + (r.percentAllocation || 0), 0)
  const remaining = calculateRemainingPercentage(recipients)
  const totalOk = Math.abs(total - 100) < 0.0001

  const update = (next: SplitRecipient[]) => onChange(next, distributorFeePercent)

  const addRecipient = () => {
    const next: SplitRecipient = {
      address: '',
      percentAllocation: remaining > 0 ? remaining : 10,
    }
    update([...recipients, next])
  }

  const removeRecipient = (i: number) => {
    update(autoAdjustPercentages(recipients.filter((_, idx) => idx !== i)))
  }

  const setAddress = (i: number, address: string) => {
    const next = [...recipients]
    next[i] = { ...next[i], address }
    update(next)
  }

  const setPercent = (i: number, pct: number) => {
    const clamped = Math.round(Math.max(0, Math.min(100, pct)) * 10000) / 10000
    const next = [...recipients]
    next[i] = { ...next[i], percentAllocation: clamped }
    update(next)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Allocation bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted-fg">Total allocated</span>
          <span
            className={
              totalOk
                ? 'font-semibold text-success'
                : total > 100
                  ? 'font-semibold text-warning'
                  : 'font-semibold text-yellow-500'
            }
          >
            {total.toFixed(2)}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full transition-all ${totalOk ? 'bg-success' : total > 100 ? 'bg-warning' : 'bg-yellow-500'}`}
            style={{ width: `${Math.min(total, 100)}%` }}
          />
        </div>
        {remaining > 0.01 && (
          <p className="text-[11px] text-muted-fg">{remaining.toFixed(2)}% unallocated</p>
        )}
      </div>

      {/* Recipients */}
      <div className="flex flex-col gap-2">
        {recipients.map((r, i) => (
          <div key={i} className="flex items-end gap-2">
            <label className="flex-1 block">
              <span className="block text-[12px] text-muted-fg mb-1">Address</span>
              <input
                type="text"
                value={r.address}
                onChange={(e) => setAddress(i, e.target.value)}
                placeholder="0x…"
                className={[
                  'w-full rounded-md border bg-surface px-3 py-2 font-mono text-xs outline-none',
                  r.address && !isAddress(r.address)
                    ? 'border-warning focus:border-warning'
                    : 'border-border focus:border-accent',
                ].join(' ')}
              />
            </label>
            <label className="w-28 block">
              <span className="block text-[12px] text-muted-fg mb-1">%</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={r.percentAllocation}
                onChange={(e) => setPercent(i, parseFloat(e.target.value) || 0)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-right font-semibold outline-none focus:border-accent"
              />
            </label>
            {recipients.length > 2 && (
              <button
                type="button"
                onClick={() => removeRecipient(i)}
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-fg hover:border-warning hover:text-warning"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={addRecipient}
          disabled={recipients.length >= 100}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add recipient
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => update(autoAdjustPercentages(recipients))}
        >
          Distribute evenly
        </Button>
      </div>

      {/* Validation errors */}
      {errors.length > 0 && (
        <ul className="list-disc pl-5 text-[12.5px] text-warning">
          {errors.map((e, i) => (
            <li key={i}>{e.message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
