import { NextResponse } from 'next/server'

import {
  assertPinataApiRequest,
  generateUploadJWT,
  PinataConfigError,
  PinataRequestError,
  PinataUpstreamError,
} from '@/lib/pinata'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    assertPinataApiRequest(req)
    const result = await generateUploadJWT()
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
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
    console.error('[api/pinata/generate-jwt]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
