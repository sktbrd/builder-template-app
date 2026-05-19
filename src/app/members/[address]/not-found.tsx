import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function MemberNotFound() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/members"
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          All members
        </Link>
      </div>
      <section className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
        <h1 className="font-display text-[clamp(28px,4vw,40px)] font-extrabold leading-[1.1] tracking-[-0.02em]">
          No DAO activity for this address
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-fg">
          This wallet holds no tokens, has never voted, and hasn&rsquo;t authored any
          proposals on this DAO. Double-check the address or browse the full members list.
        </p>
        <Link
          href="/members"
          className="mt-6 inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-surface-3"
        >
          Back to members
        </Link>
      </section>
    </div>
  )
}
