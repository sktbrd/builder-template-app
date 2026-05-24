import { NextResponse } from 'next/server'

import { daoConfig } from '@/lib/dao.config'

// Alchemy network slugs per chain
const ALCHEMY_NETWORK: Record<number, string> = {
  1: 'eth-mainnet',
  10: 'opt-mainnet',
  8453: 'base-mainnet',
  7777777: 'zora-mainnet',
}

// Cache at the edge for 5 minutes (Vercel / Cloudflare)
export const revalidate = 300

type AlchemyTransfer = {
  blockNum: string
  hash: string
  from: string
  to: string | null
  value: number | null
  asset: string | null
  category: string
  metadata: { blockTimestamp?: string }
  rawContract?: { value?: string; decimal?: string }
}

type Transfer = {
  hash: string
  dir: 'in' | 'out'
  from: string
  to: string
  asset: string
  amount: string
  amountNum: number
  timestamp: number
  blockNum: number
}

async function fetchTransfers(
  apiKey: string,
  network: string,
  treasury: string,
  direction: 'in' | 'out',
  pageKey?: string
): Promise<{ transfers: AlchemyTransfer[]; pageKey?: string }> {
  const body = {
    id: 1,
    jsonrpc: '2.0',
    method: 'alchemy_getAssetTransfers',
    params: [
      {
        ...(direction === 'in' ? { toAddress: treasury } : { fromAddress: treasury }),
        category: ['external', 'erc20', 'erc721', 'erc1155'],
        withMetadata: true,
        excludeZeroValue: true,
        maxCount: '0x64', // 100 per page
        order: 'desc',
        ...(pageKey ? { pageKey } : {}),
      },
    ],
  }

  const res = await fetch(`https://${network}.g.alchemy.com/v2/${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    next: { revalidate: 300 },
  })

  if (!res.ok) throw new Error(`Alchemy ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error.message ?? 'Alchemy error')
  return {
    transfers: json.result?.transfers ?? [],
    pageKey: json.result?.pageKey,
  }
}

// Heuristic spam filter: airdropped phishing tokens that smuggle URLs or
// promo phrases into the token symbol field. Real ERC-20 symbols are short
// and alphanumeric, so anything with a domain, marketing language, or
// special punctuation is almost certainly hostile dust.
function isSpamAsset(asset: string | null): boolean {
  if (!asset) return false
  const s = asset.toLowerCase()
  if (
    /https?:\/\/|www\.|t\.me|telegram|\.com|\.me|\.io|\.xyz|\.net|\.org|\.app|\.gift|\.fund|\.live|\.site|\.link|\.bond|\.finance/.test(
      s
    )
  )
    return true
  if (/claim|airdrop|reward|visit|bonus|gift|winner|voucher|promo/.test(s)) return true
  if (/[*!?@#$%^&()\[\]{}<>]/.test(asset)) return true
  if (asset.length > 20) return true
  return false
}

function formatAmount(t: AlchemyTransfer): { amount: string; amountNum: number } {
  if (t.value !== null && t.value !== undefined) {
    const n = t.value
    return {
      amountNum: n,
      amount:
        n < 0.0001
          ? n.toExponential(2)
          : n.toLocaleString('en-US', { maximumFractionDigits: 4 }),
    }
  }
  // ERC-721/1155 — no value, show count
  return { amountNum: 1, amount: '1' }
}

export async function GET(req: Request) {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'No Alchemy API key configured' }, { status: 503 })
  }

  const network = ALCHEMY_NETWORK[daoConfig.chainId]
  if (!network) {
    return NextResponse.json(
      { error: `Unsupported chainId ${daoConfig.chainId}` },
      { status: 400 }
    )
  }

  const { searchParams } = new URL(req.url)
  const pageKey = searchParams.get('pageKey') ?? undefined
  const dir = (searchParams.get('dir') ?? 'all') as 'in' | 'out' | 'all'

  const treasury = daoConfig.addresses.treasury.toLowerCase()

  try {
    const fetches: Promise<{ transfers: AlchemyTransfer[]; pageKey?: string }>[] = []

    if (dir === 'in' || dir === 'all')
      fetches.push(fetchTransfers(apiKey, network, treasury, 'in', pageKey))
    if (dir === 'out' || dir === 'all')
      fetches.push(fetchTransfers(apiKey, network, treasury, 'out', pageKey))

    const results = await Promise.all(fetches)

    const rawIn = dir === 'out' ? [] : (results[0]?.transfers ?? [])
    const rawOut = dir === 'in' ? [] : (results[dir === 'all' ? 1 : 0]?.transfers ?? [])
    const nextPageKeyIn = dir === 'out' ? undefined : results[0]?.pageKey
    const nextPageKeyOut =
      dir === 'in' ? undefined : results[dir === 'all' ? 1 : 0]?.pageKey

    const normalize = (list: AlchemyTransfer[], direction: 'in' | 'out'): Transfer[] =>
      list
        .filter((t) => !isSpamAsset(t.asset))
        .map((t) => {
          const { amount, amountNum } = formatAmount(t)
          const ts = t.metadata.blockTimestamp
            ? Math.floor(new Date(t.metadata.blockTimestamp).getTime() / 1000)
            : 0
          return {
            hash: t.hash,
            dir: direction,
            from: t.from,
            to: t.to ?? '',
            asset: t.asset ?? 'ETH',
            amount,
            amountNum,
            timestamp: ts,
            blockNum: parseInt(t.blockNum, 16),
          }
        })

    const all: Transfer[] = [...normalize(rawIn, 'in'), ...normalize(rawOut, 'out')].sort(
      (a, b) => b.timestamp - a.timestamp
    )

    return NextResponse.json({
      transfers: all,
      nextPageKeyIn,
      nextPageKeyOut,
    })
  } catch (err) {
    console.error('[treasury/transfers]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
