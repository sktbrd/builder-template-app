import Link from 'next/link'

import { daoConfig } from '@/lib/dao.config'

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  8453: 'Base',
  7777777: 'Zora',
}

export function Footer() {
  const chainName = CHAIN_NAMES[daoConfig.chainId] ?? `Chain ${daoConfig.chainId}`
  return (
    <footer className="border-t border-border text-[13px] text-muted-fg">
      <div className="mx-auto max-w-[1180px] px-6 py-6 text-center">
        {daoConfig.name} · {chainName} ·{' '}
        <Link href="/about" className="text-inherit hover:underline">
          Built with Builder
        </Link>
      </div>
    </footer>
  )
}
