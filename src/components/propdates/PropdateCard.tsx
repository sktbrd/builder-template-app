'use client'

import { type PropDate } from '@buildeross/sdk/subgraph'
import { formatTimeAgo } from '@buildeross/utils'
import { useMemo } from 'react'

import { ActorIdentity } from '@/components/feed/ActorIdentity'
import { Markdown } from '@/components/Markdown'
import { Button } from '@/components/ui/button'

import { PropdateReply } from './PropdateReply'

type Props = {
  propdate: PropDate
  replies?: PropDate[]
  isReplying: boolean
  onReplyClick: (propdate: PropDate) => void
}

export function PropdateCard({
  propdate,
  replies = [],
  isReplying,
  onReplyClick,
}: Props) {
  const repliesSorted = useMemo(
    () => [...replies].sort((a, b) => a.timeCreated - b.timeCreated),
    [replies]
  )

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface px-4 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ActorIdentity address={propdate.creator} size={28} />
          <span className="shrink-0 text-[12.5px] text-muted-fg whitespace-nowrap">
            · {formatTimeAgo(propdate.timeCreated)}
          </span>
        </div>
      </div>

      {propdate.message ? (
        <div className="rounded-md bg-surface-2 px-4 pt-3 pb-1">
          <Markdown>{propdate.message}</Markdown>
        </div>
      ) : null}

      {repliesSorted.length > 0 ? (
        <div className="ml-2 border-l-2 border-border pl-4">
          {repliesSorted.map((r) => (
            <PropdateReply key={r.id} reply={r} />
          ))}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          variant={isReplying ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => onReplyClick(propdate)}
        >
          {isReplying ? 'Cancel reply' : 'Reply'}
        </Button>
      </div>
    </div>
  )
}
