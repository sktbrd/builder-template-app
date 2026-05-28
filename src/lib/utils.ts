import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function resolveIpfs(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
  }
  return uri
}

/** "0xabc…1234" — short address for compact UI. */
export function shortAddress(addr: string | null | undefined): string {
  if (!addr || addr.length < 10) return addr ?? ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** Short ETH display: "1234.5" → "1.2K", "12.456" → "12.5", "0.123" → "0.12" */
export function formatEth(eth: string): string {
  const n = parseFloat(eth)
  if (isNaN(n)) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  if (n >= 100) return Math.round(n).toString()
  if (n >= 10) return n.toFixed(1).replace(/\.0$/, '')
  return n.toFixed(2).replace(/\.?0+$/, '') || '0'
}
