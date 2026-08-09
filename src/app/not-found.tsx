import Link from 'next/link'

import { DaoAvatar } from '@/components/DaoAvatar'
import { daoConfig } from '@/lib/dao.config'

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
      <DaoAvatar
        image={daoConfig.image}
        alt={daoConfig.name}
        fallbackColor={daoConfig.theme.accent}
        size={56}
      />
      <div>
        <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">
          404
        </p>
        <h1 className="font-display text-[clamp(36px,5vw,56px)] font-extrabold leading-tight tracking-tight">
          Page not found
        </h1>
        <p className="mt-2 max-w-sm text-muted-fg">
          This page doesn&apos;t exist or was moved. Head back to the {daoConfig.name}{' '}
          community hub.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ background: 'var(--accent)', color: 'var(--accent-fg, #fff)' }}
      >
        Back to dashboard
      </Link>
    </div>
  )
}
