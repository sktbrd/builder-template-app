/**
 * Shared constants + helpers for opengraph-image.tsx files.
 *
 * Next.js renders these in the Edge runtime via Satori, which supports a
 * limited subset of CSS. Stick to flexbox + inline styles. Everything that
 * touches theme tokens reads them from daoConfig so OG images re-skin
 * automatically when a fork swaps DAOs.
 */

import { daoConfig } from './dao.config'
import { resolveIpfs as resolveIpfsString } from './utils'

export const OG_SIZE = { width: 1200, height: 630 } as const
export const OG_CONTENT_TYPE = 'image/png'

/** Light + dark are out of scope for OG (they're a static crawler image). */
export function ogColors() {
  const accent = daoConfig.theme.accent
  return {
    bg: '#0b0b0c',
    surface: '#131316',
    surfaceMuted: '#1c1c20',
    border: '#26262b',
    fg: '#fafafa',
    fgDim: '#9a9aa2',
    accent,
    accentSoft: hexToRgba(accent, 0.18),
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  const expand =
    m.length === 3
      ? m
          .split('')
          .map((c) => c + c)
          .join('')
      : m
  const r = parseInt(expand.slice(0, 2), 16)
  const g = parseInt(expand.slice(2, 4), 16)
  const b = parseInt(expand.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function resolveIpfs(uri: string | null | undefined): string | null {
  if (!uri) return null
  return resolveIpfsString(uri)
}

export function trimEth(value: string, max = 4): string {
  if (!value || !value.includes('.')) return value
  const [intPart, decPart] = value.split('.')
  return `${intPart}.${decPart.slice(0, max).replace(/0+$/, '') || '0'}`
}
