import { type NextRequest, NextResponse } from 'next/server'

import {
  assertPinataApiRequest,
  PinataConfigError,
  PinataRequestError,
  PinataUpstreamError,
  pinCidToIPFS,
} from '@/lib/pinata'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    assertPinataApiRequest(req)
    const body = (await req.json().catch(() => ({}))) as {
      cid?: string
      name?: string
      group_id?: string
    }
    const result = await pinCidToIPFS({
      cid: body.cid ?? '',
      name: body.name,
      group_id: body.group_id,
    })
    return NextResponse.json({ text: result.status })
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
    console.error('[api/pinata/pin-cid]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
