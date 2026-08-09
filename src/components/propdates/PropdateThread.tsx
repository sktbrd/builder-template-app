'use client'

import { SWR_KEYS } from '@buildeross/constants/swrKeys'
import { awaitSubgraphSync, getPropDates, type PropDate } from '@buildeross/sdk/subgraph'
import { Plus, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import type { Hex } from 'viem'
import { zeroHash } from 'viem'

import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'

import { PropdateCard } from './PropdateCard'
import { PropdateForm } from './PropdateForm'

type Props = {
  proposalIdHash: Hex
}

export function PropdateThread({ proposalIdHash }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [replyingTo, setReplyingTo] = useState<PropDate | undefined>(undefined)

  const { data, mutate, isLoading } = useSWR(
    [SWR_KEYS.PROPDATES, daoConfig.addresses.token, daoConfig.chainId, proposalIdHash],
    ([, token, chainId, pid]) =>
      getPropDates(token as string, chainId as number, pid as string),
    { revalidateOnMount: true, refreshInterval: 15_000 }
  )

  const propdates = useMemo(() => data ?? [], [data])

  const topLevel = useMemo(
    () =>
      [...propdates]
        .filter((pd) => !pd.originalMessageId || pd.originalMessageId === zeroHash)
        .sort((a, b) => b.timeCreated - a.timeCreated),
    [propdates]
  )

  const repliesFor = useCallback(
    (pd: PropDate) =>
      propdates.filter(
        (r) => r.originalMessageId === pd.txid || r.originalMessageId === pd.id
      ),
    [propdates]
  )

  const onReplyClick = useCallback(
    (pd: PropDate) => {
      if (replyingTo?.id === pd.id) {
        setReplyingTo(undefined)
      } else {
        setReplyingTo(pd)
        setShowForm(false)
      }
    },
    [replyingTo]
  )

  const handlePosted = useCallback(
    (optimistic: PropDate, blockNumber: bigint) => {
      // Flash the new entry into the list immediately so it appears under the
      // form before "Posted ✓" auto-closes.
      mutate(
        (prev) => {
          const list = prev ?? []
          if (list.some((p) => p.txid === optimistic.txid)) return list
          return [...list, optimistic]
        },
        { revalidate: false }
      )
      // Background: wait for the subgraph to catch up to this block, then
      // revalidate so the optimistic entry is replaced by the canonical record.
      void (async () => {
        try {
          await awaitSubgraphSync(daoConfig.chainId, blockNumber)
        } catch (err) {
          console.error('[propdate] subgraph sync failed', err)
        }
        await mutate()
      })()
    },
    [mutate]
  )

  const closeAll = useCallback(() => {
    setShowForm(false)
    setReplyingTo(undefined)
  }, [])

  const empty = !isLoading && topLevel.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-[12.5px] text-muted-fg">
          {isLoading
            ? 'Loading…'
            : propdates.length === 0
              ? 'No updates posted yet.'
              : `${propdates.length} update${propdates.length === 1 ? '' : 's'} from contributors`}
        </div>
        <Button
          type="button"
          variant={showForm ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => {
            setShowForm((v) => !v)
            setReplyingTo(undefined)
          }}
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Post propdate
            </>
          )}
        </Button>
      </div>

      {showForm ? (
        <PropdateForm
          proposalIdHash={proposalIdHash}
          onPosted={handlePosted}
          onClose={closeAll}
        />
      ) : null}

      {empty ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-2 px-4 py-8 text-center text-sm text-muted-fg">
          No updates on this proposal yet.
        </div>
      ) : null}

      {isLoading && topLevel.length === 0 ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-border bg-surface-2"
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {topLevel.map((pd) => (
          <div key={pd.id} className="flex flex-col gap-3">
            <PropdateCard
              propdate={pd}
              replies={repliesFor(pd)}
              isReplying={replyingTo?.id === pd.id}
              onReplyClick={onReplyClick}
            />
            {replyingTo?.id === pd.id ? (
              <div className="ml-4 sm:ml-6">
                <PropdateForm
                  proposalIdHash={proposalIdHash}
                  replyTo={{
                    id: pd.id,
                    creator: pd.creator,
                    message: pd.message,
                  }}
                  onPosted={handlePosted}
                  onClose={closeAll}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
