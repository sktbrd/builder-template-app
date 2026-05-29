'use client'

import { isChainIdSupportedByCoining } from '@buildeross/utils'
import Link from 'next/link'

import { daoConfig } from '@/lib/dao.config'
import { isDroposalSupported } from '@/lib/proposal-tx'
import { cn } from '@/lib/utils'

type Props = {
  active: 'coins' | 'droposals'
}

type Tab = {
  key: 'coins' | 'droposals'
  label: string
  href: string
}

export function ContentTabs({ active }: Props) {
  const tabs: Tab[] = []
  if (isChainIdSupportedByCoining(daoConfig.chainId)) {
    tabs.push({ key: 'coins', label: 'Coins', href: '/coins?tab=coins' })
  }
  if (isDroposalSupported()) {
    tabs.push({ key: 'droposals', label: 'Droposals', href: '/coins?tab=droposals' })
  }

  // Nothing to switch between — the hub renders the not-supported card instead.
  if (tabs.length <= 1) return null

  return (
    <nav className="flex items-center gap-1 border-b border-border">
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              'relative px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'text-fg' : 'text-muted-fg hover:text-fg'
            )}
          >
            {tab.label}
            {isActive && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-sm bg-fg" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
