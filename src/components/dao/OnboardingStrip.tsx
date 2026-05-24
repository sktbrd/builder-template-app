import { Info } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

type Props = {
  daoName: string
  tagline: string
}

export function OnboardingStrip({ daoName, tagline }: Props) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
        <div>
          <p className="text-sm font-semibold text-fg">{daoName}</p>
          <p className="mt-0.5 text-sm text-muted-fg">
            {tagline} Win a daily auction to join the community and participate in
            governance — bid, vote, or create proposals.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
        <Button asChild variant="secondary" size="sm" className="w-full sm:w-auto">
          <Link href="/proposals">View proposals</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="w-full sm:w-auto">
          <Link href="/about">Learn more</Link>
        </Button>
      </div>
    </section>
  )
}
