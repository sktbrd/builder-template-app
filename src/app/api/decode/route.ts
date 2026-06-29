import { type NextRequest, NextResponse } from 'next/server'
import { isHex } from 'viem'

import {
  BackendFailedError,
  decodeTransaction,
  InvalidRequestError,
  NotFoundError,
} from '@/lib/abi-decode'
import { daoConfig } from '@/lib/dao.config'

/**
 * Generic proposal-transaction decoder. Fetches the target contract's verified
 * ABI from Etherscan (server-side, secret key) and decodes the calldata. Used
 * as the fallback for txs whose selector the offline decoder doesn't recognize.
 *
 * Hardened to avoid becoming a free public Etherscan proxy:
 *  - POST only, same-site callers only (Sec-Fetch-Site);
 *  - chain restricted to this DAO's chain;
 *  - address + calldata validated before any upstream call.
 */

// Runs on Node (needs RPC via viem + the server-only Etherscan key); not edge.
export const runtime = 'nodejs'

function isCrossSite(req: NextRequest): boolean {
  // Browsers send Sec-Fetch-Site on fetch(); our own client calls are
  // same-origin. Absent header (older clients / server-to-server) is allowed.
  const site = req.headers.get('sec-fetch-site')
  return site === 'cross-site'
}

export async function POST(req: NextRequest) {
  if (isCrossSite(req)) {
    return NextResponse.json(
      { error: 'cross-site requests not allowed' },
      { status: 403 }
    )
  }

  let body: { contract?: unknown; calldata?: unknown; chain?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { contract, calldata } = body
  const chain = body.chain ?? daoConfig.chainId

  if (typeof contract !== 'string' || !contract) {
    return NextResponse.json({ error: 'missing contract' }, { status: 400 })
  }
  if (typeof calldata !== 'string' || !isHex(calldata, { strict: true })) {
    return NextResponse.json({ error: 'invalid calldata' }, { status: 400 })
  }
  if (calldata.length < 10) {
    return NextResponse.json({ error: 'calldata too short' }, { status: 400 })
  }

  const chainInt = typeof chain === 'number' ? chain : parseInt(String(chain), 10)
  // Proposal txs execute on the DAO's chain — refuse to decode anything else so
  // the route can't be used to fetch arbitrary ABIs on arbitrary chains.
  if (chainInt !== daoConfig.chainId) {
    return NextResponse.json({ error: 'chain not supported' }, { status: 400 })
  }

  try {
    const data = await decodeTransaction(chainInt, contract, calldata)
    return NextResponse.json(data, {
      headers: {
        // ABIs are immutable per address; let the CDN serve repeats.
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: 'abi not found' }, { status: 404 })
    }
    if (error instanceof InvalidRequestError) {
      return NextResponse.json({ error: 'invalid input' }, { status: 400 })
    }
    if (error instanceof BackendFailedError) {
      return NextResponse.json({ error: 'upstream failed' }, { status: 502 })
    }
    console.error('decode route failed:', error)
    return NextResponse.json({ error: 'decode failed' }, { status: 500 })
  }
}
