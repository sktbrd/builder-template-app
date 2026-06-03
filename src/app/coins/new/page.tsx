import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { CoinCreateForm } from '@/components/coins/CoinCreateForm'
import { assertCoinsEnabled } from '@/lib/coins-gate'
import { daoConfig } from '@/lib/dao.config'

export const metadata: Metadata = {
  title: 'Create coin',
  description: `Launch a Zora content coin backed by ${daoConfig.name}'s creator coin.`,
  alternates: { canonical: '/coins/new' },
}

export default function NewCoinPage() {
  assertCoinsEnabled()
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/coins"
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          All coins
        </Link>
      </div>
      <CoinCreateForm />
    </div>
  )
}
