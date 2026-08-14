'use client'

import { type PropDate } from '@buildeross/sdk/subgraph'
import { formatTimeAgo } from '@buildeross/utils'
import { ChevronRight } from 'lucide-react'
import { useCallback, useId, useMemo, useState } from 'react'

import { ActorIdentity } from '@/components/feed/ActorIdentity'
import { Markdown } from '@/components/Markdown'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { PropdateReply } from './PropdateReply'

type Props = {
  propdate: PropDate
  replies?: PropDate[]
  isReplying: boolean
  onReplyClick: (propdate: PropDate) => void
  /** The newest update opens expanded; older ones start collapsed. */
  defaultExpanded?: boolean
}

export function PropdateCard({
  propdate,
  replies = [],
  isReplying,
  onReplyClick,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const bodyId = useId()

  const repliesSorted = useMemo(
    () => [...replies].sort((a, b) => a.timeCreated - b.timeCreated),
    [replies]
  )

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      // Collapsing the card that owns the open reply form would leave that form
      // stranded below a closed card — PropdateThread renders it as a sibling.
      if (prev && isReplying) onReplyClick(propdate)
      return !prev
    })
  }, [isReplying, onReplyClick, propdate])

  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={bodyId}
        className="flex items-center justify-between gap-2 px-4 py-4 text-left sm:px-6"
      >
        <div className="flex min-w-0 items-center gap-2">
          <ChevronRight
            aria-hidden
            className={cn(
              'h-4 w-4 shrink-0 text-muted-fg transition-transform',
              expanded && 'rotate-90'
            )}
          />
          <ActorIdentity address={propdate.creator} size={28} />
          <span className="shrink-0 text-[12.5px] text-muted-fg whitespace-nowrap">
            · {formatTimeAgo(propdate.timeCreated)}
          </span>
        </div>
        {repliesSorted.length > 0 && (
          <span className="shrink-0 text-[12.5px] text-muted-fg whitespace-nowrap">
            {repliesSorted.length} {repliesSorted.length === 1 ? 'reply' : 'replies'}
          </span>
        )}
      </button>

      <div
        id={bodyId}
        hidden={!expanded}
        className="flex flex-col gap-4 px-4 pb-5 sm:px-6"
      >
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
    </div>
  )
}
