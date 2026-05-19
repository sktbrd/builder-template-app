'use client'

import { Markdown } from '@/components/Markdown'
import { type TokenMetaMap, type TxDraft } from '@/lib/proposal-tx'

import { SummaryCard } from './SummaryCard'

type Props = {
  title: string
  description: string
  drafts: TxDraft[]
  tokenMeta: TokenMetaMap
}

export function Review({ title, description, drafts, tokenMeta }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="text-base font-bold">Title</h3>
        <p className="mt-2 text-lg font-semibold text-fg">{title || '(empty)'}</p>
      </section>

      <section>
        <h3 className="text-base font-bold">Description</h3>
        <div className="mt-2 rounded-md border border-dashed border-border bg-surface-2 px-4 py-3">
          {description ? (
            <Markdown>{description}</Markdown>
          ) : (
            <div className="text-sm text-muted-fg">(empty)</div>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-base font-bold">
          Transactions{' '}
          <span className="ml-1 text-[12.5px] font-normal text-muted-fg">
            {drafts.length}
          </span>
        </h3>
        {drafts.length === 0 ? (
          <div className="mt-2 rounded-md border border-dashed border-border bg-surface-2 px-4 py-3 text-sm text-muted-fg">
            No transactions queued.
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {drafts.map((d, i) => (
              <li key={i}>
                <SummaryCard draft={d} index={i} tokenMeta={tokenMeta} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
