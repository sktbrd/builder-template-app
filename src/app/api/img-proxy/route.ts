import type { NextRequest } from 'next/server'

// Same-origin image proxy for the AuctionHero's dominant-color sampler: most
// DAO art hosts (IPFS gateways, Arweave, CDNs) don't send CORS headers, so a
// direct cross-origin canvas read would be tainted. This re-serves the bytes
// with `access-control-allow-origin: *`.
//
// It must NOT become an open SSRF / anonymizing proxy, so it is hardened to:
//  - https only, no embedded credentials;
//  - refuse hosts that point at loopback / private / link-local / reserved
//    ranges or cloud-metadata endpoints (SSRF);
//  - refuse redirects (a public host could otherwise 3xx to an internal one);
//  - only honor same-site callers (Sec-Fetch-Site / Origin), so other websites
//    can't use it as a generic proxy;
//  - require an `image/*` response and cap its size.

export const runtime = 'edge'

const MAX_BYTES = 15 * 1024 * 1024 // 15 MB

/**
 * Hosts that must never be fetched server-side (SSRF guard).
 *
 * Note: this inspects the literal host only. The edge runtime has no DNS
 * resolution API, so a public name that resolves to an internal IP (incl. DNS
 * rebinding) cannot be caught here — that residual is bounded by the https-only
 * + no-redirect + image/* + size-cap + same-site checks around the fetch.
 */
function isBlockedHost(hostname: string): boolean {
  const h = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '') // strip IPv6 brackets
    .replace(/\.+$/, '') // strip trailing dot(s): "localhost." / "10.0.0.1."

  if (h === 'localhost' || h.endsWith('.localhost')) return true
  if (h.endsWith('.local') || h.endsWith('.internal')) return true

  // Reject ANY IPv6 literal (contains ':' once brackets are stripped).
  // Legitimate image hosts are DNS names or public IPv4 — never IPv6 literals —
  // so blocking the whole class closes IPv4-mapped IPv6 (e.g.
  // ::ffff:169.254.169.254), loopback, ULA and link-local vectors at once.
  if (h.includes(':')) return true

  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const a = Number(v4[1])
    const b = Number(v4[2])
    if (a === 0 || a === 127) return true // this-host / loopback
    if (a === 10) return true // private
    if (a === 172 && b >= 16 && b <= 31) return true // private
    if (a === 192 && b === 168) return true // private
    if (a === 169 && b === 254) return true // link-local + cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a >= 224) return true // multicast / reserved
    return false
  }

  return false
}

/**
 * Block cross-site callers so this can't be used as an anonymizing proxy by
 * other websites. Browsers set `Sec-Fetch-Site` automatically and pages cannot
 * forge it; we fall back to comparing a same-origin `Origin` header.
 */
function isSameSite(req: NextRequest): boolean {
  const site = req.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin' || site === 'same-site' || site === 'none'
  const origin = req.headers.get('origin')
  if (!origin) return true // a non-CORS same-origin image GET sends no Origin
  try {
    return new URL(origin).host === req.nextUrl.host
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  if (!isSameSite(req)) return new Response('Forbidden', { status: 403 })

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
  if (url.username || url.password) {
    return new Response('Credentials not allowed', { status: 400 })
  }
  if (isBlockedHost(url.hostname)) {
    return new Response('Host not allowed', { status: 403 })
  }

  try {
    const upstream = await fetch(url.toString(), {
      headers: { Accept: 'image/*' },
      // Edge-cache the upstream response; the underlying image rarely changes.
      cache: 'force-cache',
      // A redirect could escape the host check (e.g. a public host 3xx-ing to an
      // internal one), so reject them outright. The hero tint degrades gracefully.
      redirect: 'error',
    })
    if (!upstream.ok) {
      return new Response(`Upstream ${upstream.status}`, { status: upstream.status })
    }
    const contentType = upstream.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) {
      return new Response('Not an image', { status: 415 })
    }
    const declaredLength = Number(upstream.headers.get('content-length') ?? '0')
    if (declaredLength > MAX_BYTES) {
      return new Response('Image too large', { status: 413 })
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
