import 'server-only'

import { pinataOptions, type UploadType } from '@buildeross/ipfs-service'

// `@buildeross/ipfs-service` calls `/api/pinata/{generate-jwt,upload-url,pin-cid,pin-json}`
// from the browser. The four App Router route handlers under `src/app/api/pinata/`
// thinly wrap the helpers in this file. `PINATA_API_KEY` is the scoped JWT Pinata
// generates under "API Keys" — same value Gnars stashes as `PINATA_JWT`.

const PINATA_BASE_URL = 'https://api.pinata.cloud'
const PINATA_UPLOAD_URL = 'https://uploads.pinata.cloud'
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30

type RateBucket = { count: number; resetAt: number }
const rateBuckets = new Map<string, RateBucket>()

const UPLOAD_JWT_KEY_RESTRICTIONS = {
  keyName: 'Signed Upload JWT',
  maxUses: 1,
  permissions: {
    endpoints: {
      data: {
        pinList: false,
        userPinnedDataTotal: false,
      },
      pinning: {
        pinFileToIPFS: true,
        pinJSONToIPFS: false,
        pinJobs: false,
        unpin: false,
        userPinPolicy: false,
      },
    },
  },
} as const

function authHeaders() {
  const key = process.env.PINATA_API_KEY
  if (!key) {
    throw new PinataConfigError(
      'PINATA_API_KEY is not configured. Set it in .env.local — see README → Media uploads.'
    )
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  }
}

const DEFAULT_TIMEOUT_MS = 10_000

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  ms = DEFAULT_TIMEOUT_MS
) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(input, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(id)
  }
}

export class PinataConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PinataConfigError'
  }
}

export class PinataRequestError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'PinataRequestError'
    this.status = status
  }
}

export class PinataUpstreamError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PinataUpstreamError'
  }
}

export function assertPinataApiRequest(req: Request) {
  assertSameOrigin(req)
  assertRateLimit(req)
}

function assertSameOrigin(req: Request) {
  const origin = req.headers.get('origin')
  if (!origin) {
    throw new PinataRequestError('Missing Origin header', 403)
  }

  const expected = new URL(req.url)
  const actual = new URL(origin)
  if (actual.host !== expected.host || actual.protocol !== expected.protocol) {
    throw new PinataRequestError('Invalid Origin header', 403)
  }
}

function assertRateLimit(req: Request) {
  const now = Date.now()
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  const path = new URL(req.url).pathname
  const key = `${ip}:${path}`
  const bucket = rateBuckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return
  }

  bucket.count += 1
  if (bucket.count > RATE_LIMIT_MAX) {
    throw new PinataRequestError('Too many upload requests', 429)
  }
}

export async function pinJsonToIPFS(
  data: unknown
): Promise<{ cid: string; status: string }> {
  if (!data || typeof data !== 'object') {
    throw new PinataRequestError('Invalid or missing JSON data')
  }

  const serialized = JSON.stringify(data)
  if (serialized.length > 100_000) {
    throw new PinataRequestError('JSON payload is too large')
  }

  const pinRes = await fetchWithTimeout(`${PINATA_BASE_URL}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      pinataOptions: { cidVersion: 0 },
      pinataContent: data,
    }),
  })

  if (!pinRes.ok) {
    const errorText = await pinRes.text()
    console.error('[pinata] pinJSONToIPFS failed', errorText)
    throw new PinataUpstreamError('Failed to pin JSON to Pinata')
  }

  const json = await pinRes.json()
  const cid = json.IpfsHash
  if (!cid) throw new PinataUpstreamError('Missing CID in Pinata response')

  await pinCidToIPFS({ cid })

  return { cid, status: 'Pinned successfully' }
}

export async function pinCidToIPFS(options: {
  cid: string
  name?: string
  group_id?: string
}): Promise<{ status: string }> {
  const { cid, name, group_id } = options

  if (!cid) throw new PinataRequestError('CID is required')
  if (!/^[a-zA-Z0-9]+$/.test(cid) || cid.length > 100) {
    throw new PinataRequestError('Invalid CID')
  }
  if (name && name.length > 32) {
    throw new PinataRequestError('Name is too long (max 32 characters)')
  }

  const payload: { cid: string; name?: string; group_id?: string } = { cid }
  if (name) payload.name = name
  if (group_id) payload.group_id = group_id

  const res = await fetchWithTimeout(`${PINATA_BASE_URL}/v3/files/public/pin_by_cid`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error('[pinata] pin_by_cid failed', errorText)
    throw new PinataUpstreamError('Failed to pin CID via pin_by_cid')
  }

  return { status: 'CID pinned successfully' }
}

export async function generateUploadJWT(): Promise<{ JWT: string }> {
  const res = await fetchWithTimeout(`${PINATA_BASE_URL}/users/generateApiKey`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(UPLOAD_JWT_KEY_RESTRICTIONS),
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error('[pinata] generateApiKey failed', errorText)
    throw new PinataUpstreamError('Failed to generate upload JWT')
  }

  const json = await res.json()
  if (!json.JWT) throw new PinataUpstreamError('Missing JWT in Pinata response')
  return { JWT: json.JWT }
}

export async function createSignedUploadUrl(type: string): Promise<{ url: string }> {
  if (!type || !pinataOptions[type as UploadType]) {
    throw new PinataRequestError(
      `Invalid type, must be one of: ${Object.keys(pinataOptions).join(', ')}`
    )
  }

  const options = pinataOptions[type as UploadType]
  const payload = JSON.stringify({
    expires: 30,
    date: Math.floor(Date.now() / 1000),
    ...options,
  })

  const res = await fetchWithTimeout(`${PINATA_UPLOAD_URL}/v3/files/sign`, {
    method: 'POST',
    headers: authHeaders(),
    body: payload,
  })

  const json = await res.json()
  if (!json.data) {
    console.error('[pinata] sign url failed', json)
    throw new PinataUpstreamError('Failed to create signed upload URL')
  }

  return { url: json.data }
}
