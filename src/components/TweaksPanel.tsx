'use client'

import { Settings2, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

import { PRESETS } from '@/lib/presets'
import { useTweaks } from '@/lib/tweaks-context'

const FONT_OPTIONS = [
  {
    value: 'Geist',
    label: 'Geist',
    cssFamily: 'var(--font-geist), system-ui, sans-serif',
  },
  {
    value: 'Londrina Solid',
    label: 'Londrina Solid',
    cssFamily: '"Londrina Solid", "Geist", system-ui, sans-serif',
  },
  {
    value: 'IBM Plex Sans',
    label: 'IBM Plex Sans',
    cssFamily: '"IBM Plex Sans", "Geist", system-ui, sans-serif',
  },
  {
    value: 'Fraunces',
    label: 'Fraunces',
    cssFamily: '"Fraunces", "Geist", serif',
  },
]

function ensureFontLink() {
  if (typeof document === 'undefined') return
  if (document.getElementById('tweaks-fonts')) return
  const link = document.createElement('link')
  link.id = 'tweaks-fonts'
  link.rel = 'stylesheet'
  link.href =
    'https://fonts.googleapis.com/css2?family=Londrina+Solid:wght@400;900&family=IBM+Plex+Sans:wght@400;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,700;9..144,800&display=swap'
  document.head.appendChild(link)
}

export function TweaksPanel() {
  const [open, setOpen] = useState(false)
  const { tweaks, update } = useTweaks()
  const { resolvedTheme, setTheme } = useTheme()
  const [applyState, setApplyState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const applyToProd = async () => {
    setApplyState('saving')
    try {
      const res = await fetch('/api/dev/apply-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accent: tweaks.accent,
          radius: tweaks.radius,
          displayFont: tweaks.displayFont,
        }),
      })
      setApplyState(res.ok ? 'saved' : 'error')
    } catch {
      setApplyState('error')
    }
    setTimeout(() => setApplyState('idle'), 2500)
  }

  useEffect(() => {
    ensureFontLink()
  }, [])

  const applyPreset = (key: keyof typeof PRESETS) => {
    const p = PRESETS[key]
    if (!p) return
    update({
      preset: key,
      accent: p.theme.accent,
      radius: p.theme.radius,
      displayFont: p.theme.displayFont,
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-fg shadow-lg hover:bg-surface-2"
        aria-label="Open tweaks"
      >
        <Settings2 className="h-5 w-5" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[300px] rounded-lg border border-border bg-surface p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-fg">
          Tweaks
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted-fg hover:text-fg"
          aria-label="Close tweaks"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Section title="Identity">
        <Radio
          label="DAO preset"
          value={tweaks.preset}
          onChange={(v) => applyPreset(v as keyof typeof PRESETS)}
          options={Object.values(PRESETS).map((p) => ({
            value: p.key,
            label: p.label.replace(/ DAO$/, ''),
          }))}
        />
      </Section>

      <Section title="Theme">
        <Radio
          label="Mode"
          value={resolvedTheme === 'dark' ? 'dark' : 'light'}
          onChange={(v) => setTheme(v)}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <Field label="Accent">
          <input
            type="color"
            value={tweaks.accent}
            onChange={(e) => update({ accent: e.target.value })}
            className="h-7 w-12 cursor-pointer rounded border border-border bg-transparent"
          />
          <span className="ml-2 font-mono text-[12px] text-muted-fg">
            {tweaks.accent}
          </span>
        </Field>
        <Field label="Corner radius">
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={tweaks.radius}
            onChange={(e) => update({ radius: Number(e.target.value) })}
            className="flex-1 accent-accent"
          />
          <span className="ml-2 font-mono text-[12px] text-muted-fg">
            {tweaks.radius}px
          </span>
        </Field>
        <Field label="Display font">
          <select
            value={tweaks.displayFont}
            onChange={(e) => update({ displayFont: e.target.value })}
            className="h-8 flex-1 rounded-md border border-border bg-surface px-2 text-[13px] outline-none"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Proposals">
        <Toggle
          label="Thumbnails"
          checked={tweaks.showProposalThumbnails}
          onChange={(v) => update({ showProposalThumbnails: v })}
        />
      </Section>

      <button
        type="button"
        onClick={applyToProd}
        disabled={applyState === 'saving'}
        className="mt-1 w-full rounded-md px-3 py-2 text-[13px] font-semibold transition-colors disabled:opacity-60"
        style={{
          background:
            applyState === 'saved'
              ? '#16a34a'
              : applyState === 'error'
                ? '#dc2626'
                : 'var(--accent)',
          color: 'var(--accent-fg, #000)',
        }}
      >
        {applyState === 'saving'
          ? 'Saving…'
          : applyState === 'saved'
            ? '✓ Saved to dao.theme.json'
            : applyState === 'error'
              ? '✗ Error — check console'
              : 'Apply to prod'}
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 border-b border-border pb-3 last:mb-0 last:border-b-0 last:pb-0">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-fg">
        {title}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-[13px]">
      <span className="w-[110px] text-muted-fg">{label}</span>
      <div className="flex flex-1 items-center">{children}</div>
    </label>
  )
}

function Radio({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Field label={label}>
      <div className="flex flex-1 gap-1 rounded-md border border-border bg-surface-2 p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              value === opt.value
                ? 'flex-1 rounded-sm bg-surface px-2 py-1 text-[12px] font-semibold text-fg shadow-sm'
                : 'flex-1 rounded-sm px-2 py-1 text-[12px] font-medium text-muted-fg hover:text-fg'
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </Field>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <Field label={label}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-5 w-9 flex-shrink-0 rounded-full border border-border transition-colors"
        style={{ background: checked ? 'var(--accent)' : 'var(--surface-3)', borderColor: checked ? 'var(--accent)' : 'var(--border)' }}
      >
        <span
          className="absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </button>
    </Field>
  )
}
