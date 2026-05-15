import 'server-only'

import { PUBLIC_DEFAULT_CHAINS } from '@buildeross/constants/chains'
import { FeedEventType, getFeedData } from '@buildeross/sdk/subgraph'
import type { AddressType, CHAIN_ID, FeedResponse } from '@buildeross/types'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isAddress } from 'viem'

import { daoConfig } from '@/lib/dao.config'

const SUPPORTED_CHAIN_IDS: CHAIN_ID[] = PUBLIC_DEFAULT_CHAINS.map((c) => c.id)
const VALID_EVENT_TYPES = new Set(Object.values(FeedEventType))

const EMPTY_RESPONSE: FeedResponse = { items: [], hasMore: false, nextCursor: null }

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams

  const limitRaw = search.get('limit')
  let limit = 20
  if (limitRaw !== null) {
    const parsed = parseInt(limitRaw, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > 33) {
      return NextResponse.json(
        { error: 'limit must be between 1 and 33' },
        { status: 400 }
      )
    }
    limit = parsed
  }

  let cursor: number | undefined
  const cursorRaw = search.get('cursor')
  if (cursorRaw) {
    const parsed = Number(cursorRaw)
    if (isNaN(parsed) || parsed < 0) {
      return NextResponse.json(
        { error: 'cursor must be a valid positive number' },
        { status: 400 }
      )
    }
    cursor = parsed
  }

  // chainIds — defaults to the configured DAO's chain (template is single-DAO).
  let chainIds: CHAIN_ID[] = [daoConfig.chainId]
  const chainIdsRaw = search.get('chainIds')
  if (chainIdsRaw) {
    const ids = chainIdsRaw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map(Number)
    for (const id of ids) {
      if (isNaN(id) || !SUPPORTED_CHAIN_IDS.includes(id as CHAIN_ID)) {
        return NextResponse.json({ error: `Invalid chain ID: ${id}` }, { status: 400 })
      }
    }
    chainIds = ids as CHAIN_ID[]
  }

  // daos — defaults to the configured DAO's token address.
  let daos: AddressType[] = [daoConfig.addresses.token.toLowerCase() as AddressType]
  const daosRaw = search.get('daos')
  if (daosRaw) {
    const addrs = daosRaw
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)
    for (const a of addrs) {
      if (!isAddress(a, { strict: false })) {
        return NextResponse.json(
          { error: `Invalid DAO address: ${a}` },
          { status: 400 }
        )
      }
    }
    daos = addrs.map((a) => a.toLowerCase() as AddressType)
  }

  let actor: AddressType | undefined
  const actorRaw = search.get('actor')
  if (actorRaw) {
    if (!isAddress(actorRaw, { strict: false })) {
      return NextResponse.json(
        { error: 'Invalid actor address' },
        { status: 400 }
      )
    }
    actor = actorRaw.toLowerCase() as AddressType
  }

  let eventTypes: FeedEventType[] | undefined
  const eventTypesRaw = search.get('eventTypes')
  if (eventTypesRaw) {
    const types = eventTypesRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    for (const t of types) {
      if (!VALID_EVENT_TYPES.has(t as FeedEventType)) {
        return NextResponse.json(
          { error: `Invalid event type: ${t}` },
          { status: 400 }
        )
      }
    }
    eventTypes = types as FeedEventType[]
  }

  // Template is single-DAO per fork; query a single chain. If the caller asked
  // for multiple chains we fan out and merge by timestamp.
  const ttl = computeTtl({ daos, eventTypes, actor })

  try {
    let merged: FeedResponse
    if (chainIds.length === 1) {
      merged = await getFeedData({
        chainId: chainIds[0],
        limit,
        cursor,
        daos,
        eventTypes,
        actor,
      })
    } else {
      const perChainLimit = Math.min(Math.ceil(limit / chainIds.length) + 5, 33)
      const settled = await Promise.allSettled(
        chainIds.map((cid) =>
          getFeedData({
            chainId: cid,
            limit: perChainLimit,
            cursor,
            daos,
            eventTypes,
            actor,
          })
        )
      )
      merged = mergeFeedResponses(settled, limit)
    }

    return NextResponse.json(merged, {
      headers: {
        'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${Math.floor(ttl * 0.5)}`,
      },
    })
  } catch (err) {
    console.error('[api/feed] failed:', err)
    return NextResponse.json(EMPTY_RESPONSE, { status: 200 })
  }
}

function computeTtl(params: {
  daos?: AddressType[]
  eventTypes?: FeedEventType[]
  actor?: AddressType
}): number {
  if (params.actor) return 300
  if (params.eventTypes && params.eventTypes.length > 0) return 180
  if (params.daos && params.daos.length === 1) return 60
  return 60
}

function mergeFeedResponses(
  settled: PromiseSettledResult<FeedResponse>[],
  limit: number
): FeedResponse {
  const items = settled
    .flatMap((r) => (r.status === 'fulfilled' ? r.value.items : []))
    .sort((a, b) => b.timestamp - a.timestamp)
  const trimmed = items.slice(0, limit)
  const hasMore = items.length > limit
  if (!hasMore) return { items: trimmed, hasMore: false, nextCursor: null }
  const nextCursor = trimmed[trimmed.length - 1]?.timestamp ?? 0
  return { items: trimmed, hasMore: true, nextCursor }
}
