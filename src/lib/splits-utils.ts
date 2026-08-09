import { isAddress } from 'viem'

export interface SplitRecipient {
  address: string
  percentAllocation: number
}

export interface SplitValidationError {
  field: string
  message: string
}

export function validateSplitRecipients(
  recipients: SplitRecipient[]
): SplitValidationError[] {
  const errors: SplitValidationError[] = []

  if (recipients.length < 2) {
    errors.push({ field: 'recipients', message: 'Split must have at least 2 recipients' })
    return errors
  }
  if (recipients.length > 100) {
    errors.push({
      field: 'recipients',
      message: 'Split cannot have more than 100 recipients',
    })
  }

  recipients.forEach((r, i) => {
    if (!r.address) {
      errors.push({
        field: `recipients[${i}].address`,
        message: `Recipient ${i + 1}: address is required`,
      })
    } else if (!isAddress(r.address)) {
      errors.push({
        field: `recipients[${i}].address`,
        message: `Recipient ${i + 1}: invalid address`,
      })
    }
    if (r.percentAllocation <= 0) {
      errors.push({
        field: `recipients[${i}].percentAllocation`,
        message: `Recipient ${i + 1}: allocation must be > 0%`,
      })
    }
    if (r.percentAllocation > 100) {
      errors.push({
        field: `recipients[${i}].percentAllocation`,
        message: `Recipient ${i + 1}: allocation cannot exceed 100%`,
      })
    }
    const decimals = (r.percentAllocation.toString().split('.')[1] ?? '').length
    if (decimals > 4) {
      errors.push({
        field: `recipients[${i}].percentAllocation`,
        message: `Recipient ${i + 1}: max 4 decimal places`,
      })
    }
  })

  const addrs = recipients.map((r) => r.address.toLowerCase()).filter(Boolean)
  if (addrs.length !== new Set(addrs).size) {
    errors.push({
      field: 'recipients',
      message: 'Duplicate recipient addresses are not allowed',
    })
  }

  const total = recipients.reduce((s, r) => s + r.percentAllocation, 0)
  if (Math.abs(total - 100) > 0.0001) {
    errors.push({
      field: 'recipients',
      message: `Total must equal 100% (currently ${total.toFixed(4)}%)`,
    })
  }

  return errors
}

export function calculateRemainingPercentage(recipients: SplitRecipient[]): number {
  return Math.max(0, 100 - recipients.reduce((s, r) => s + (r.percentAllocation || 0), 0))
}

export function autoAdjustPercentages(recipients: SplitRecipient[]): SplitRecipient[] {
  if (recipients.length === 0) return []
  const base = Math.floor((100 / recipients.length) * 10000) / 10000
  const last = Math.round((100 - base * (recipients.length - 1)) * 10000) / 10000
  return recipients.map((r, i) => ({
    ...r,
    percentAllocation: i === recipients.length - 1 ? last : base,
  }))
}
