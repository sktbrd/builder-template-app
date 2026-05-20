import { type NextRequest, NextResponse } from 'next/server'

import {
  assertPinataApiRequest,
  PinataConfigError,
  PinataRequestError,
  PinataUpstreamError,
  pinJsonToIPFS,
} from '@/lib/pinata'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    assertPinataApiRequest(req)
    const body = await req.json().catch(() => null)
    const result = await pinJsonToIPFS(body)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PinataConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    if (err instanceof PinataRequestError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof PinataUpstreamError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    console.error('[api/pinata/pin-json]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
