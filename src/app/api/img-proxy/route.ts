import type { NextRequest } from 'next/server'

// Same-origin proxy for images hosted on third-party CDNs that don't send
// CORS headers. Used by the AuctionHero's dominant-color sampler so the
// canvas isn't tainted on cross-origin reads. Restricted to https://… and
// `image/*` responses to keep it from being abused as a generic open proxy.

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('url')
  if (!target) return new Response('Missing ?url', { status: 400 })

  let url: URL
  try {
    url = new URL(target)
  } catch {
    return new Response('Invalid URL', { status: 400 })
  }
  if (url.protocol !== 'https:') {
    return new Response('Only https URLs allowed', { status: 400 })
  }

  try {
    const upstream = await fetch(url.toString(), {
      headers: { Accept: 'image/*' },
      // Edge cache the upstream response; the underlying image rarely changes.
      cache: 'force-cache',
    })
    if (!upstream.ok) {
      return new Response(`Upstream ${upstream.status}`, { status: upstream.status })
    }
    const contentType = upstream.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) {
      return new Response('Not an image', { status: 415 })
    }
    return new Response(upstream.body, {
      headers: {
        'content-type': contentType,
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=86400, s-maxage=86400, immutable',
      },
    })
  } catch {
    return new Response('Fetch failed', { status: 502 })
  }
}
