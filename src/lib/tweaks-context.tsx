'use client'

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'

import { PRESETS } from './presets'

export const TWEAKS_STORAGE_KEY = 'tweaks.v1'

export type Tweaks = {
  preset: keyof typeof PRESETS
  accent: string
  radius: number
  displayFont: string
  showProposalThumbnails: boolean
}

export const TWEAKS_DEFAULTS: Tweaks = {
  preset: 'builder',
  accent: '#2563eb',
  radius: 12,
  displayFont: 'Geist',
  showProposalThumbnails: false,
}

export function loadTweaks(): Tweaks {
  if (typeof window === 'undefined') return TWEAKS_DEFAULTS
  try {
    const raw = window.localStorage.getItem(TWEAKS_STORAGE_KEY)
    if (!raw) return TWEAKS_DEFAULTS
    return { ...TWEAKS_DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return TWEAKS_DEFAULTS
  }
}

type TweaksCtx = {
  tweaks: Tweaks
  update: (patch: Partial<Tweaks>) => void
}

const TweaksContext = createContext<TweaksCtx>({
  tweaks: TWEAKS_DEFAULTS,
  update: () => {},
})

const FONT_OPTIONS: Record<string, string> = {
  Geist: 'var(--font-geist), system-ui, sans-serif',
  'Londrina Solid': '"Londrina Solid", "Geist", system-ui, sans-serif',
  'IBM Plex Sans': '"IBM Plex Sans", "Geist", system-ui, sans-serif',
  Fraunces: '"Fraunces", "Geist", serif',
}

export function TweaksProvider({ children }: { children: ReactNode }) {
  const [tweaks, setTweaks] = useState<Tweaks>(TWEAKS_DEFAULTS)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setTweaks(loadTweaks())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const root = document.documentElement
    root.style.setProperty('--accent', tweaks.accent)
    root.style.setProperty(
      '--accent-strong',
      `color-mix(in oklab, ${tweaks.accent} 80%, black)`
    )
    root.style.setProperty('--radius', `${tweaks.radius}px`)
    const fontFamily = FONT_OPTIONS[tweaks.displayFont] ?? 'var(--font-geist)'
    root.style.setProperty('--font-display-active', fontFamily)
    document.body.style.setProperty('--font-display-active', fontFamily)
    try {
      window.localStorage.setItem(TWEAKS_STORAGE_KEY, JSON.stringify(tweaks))
    } catch {}
  }, [tweaks, hydrated])

  const update = (patch: Partial<Tweaks>) => setTweaks((prev) => ({ ...prev, ...patch }))

  return (
    <TweaksContext.Provider value={{ tweaks, update }}>{children}</TweaksContext.Provider>
  )
}

export function useTweaks() {
  return useContext(TweaksContext)
}
