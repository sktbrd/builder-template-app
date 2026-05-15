'use client'

import { type PropDate } from '@buildeross/sdk/subgraph'
import { formatTimeAgo } from '@buildeross/utils'

import { ActorIdentity } from '@/components/feed/ActorIdentity'
import { Markdown } from '@/components/Markdown'

export function PropdateReply({ reply }: { reply: PropDate }) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      <div className="pt-1">
        <ActorIdentity address={reply.creator} size={24} />
      </div>
      <div className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-3 pt-2 pb-1">
        <div className="text-[11.5px] font-medium text-muted-fg">
          {formatTimeAgo(reply.timeCreated)}
        </div>
        {reply.message ? (
          <div className="text-sm">
            <Markdown>{reply.message}</Markdown>
          </div>
        ) : null}
      </div>
    </div>
  )
}
