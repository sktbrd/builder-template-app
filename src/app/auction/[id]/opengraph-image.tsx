import { ImageResponse } from 'next/og'

import { daoConfig } from '@/lib/dao.config'
import { getAuctionPageData } from '@/lib/dao-data'
import { OG_CONTENT_TYPE, OG_SIZE, ogColors, resolveIpfs, trimEth } from '@/lib/og-utils'

export const alt = `${daoConfig.name} auction`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const revalidate = 60

type Params = Promise<{ id: string }>

export default async function AuctionOGImage({ params }: { params: Params }) {
  const { id } = await params
  const tokenId = parseInt(id, 10)
  const c = ogColors()
  const tokenLabel = daoConfig.name.split(' ')[0]
  const logoUrl = resolveIpfs(daoConfig.image)

  let topBidEth: string | null = null
  let bidderShort: string | null = null

  if (Number.isFinite(tokenId) && tokenId >= 0) {
    try {
      const data = await getAuctionPageData(tokenId)
      topBidEth = data.topBidEth
      bidderShort = data.bidderShort
    } catch {
      /* fall through with defaults */
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          height: '100%',
          width: '100%',
          background: c.bg,
          color: c.fg,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Left — accent block (skip remote artwork: nouns.build returns
            webp which Satori can't decode in the OG runtime). */}
        <div
          style={{
            display: 'flex',
            width: 630,
            height: '100%',
            background: `linear-gradient(135deg, ${c.accent} 0%, ${c.surface} 100%)`,
            alignItems: 'center',
            justifyContent: 'center',
            color: c.bg,
            fontSize: 200,
            fontWeight: 800,
            letterSpacing: '-0.02em',
          }}
        >
          #{tokenId}
        </div>

        {/* Right — info */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            height: '100%',
            flexDirection: 'column',
            padding: 60,
          }}
        >
          {/* DAO row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 'auto',
            }}
          >
            {logoUrl && (
              <img
                src={logoUrl}
                alt={daoConfig.name}
                width={40}
                height={40}
                style={{ borderRadius: 999 }}
              />
            )}
            <div
              style={{ display: 'flex', fontSize: 22, color: c.fgDim, fontWeight: 600 }}
            >
              {daoConfig.name}
            </div>
            <div
              style={{
                display: 'flex',
                marginLeft: 'auto',
                background: c.accent,
                color: c.bg,
                padding: '4px 12px',
                borderRadius: 999,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {chainName(daoConfig.chainId)}
            </div>
          </div>

          {/* Title block */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              margin: 'auto 0',
            }}
          >
            <div style={{ display: 'flex', fontSize: 22, color: c.fgDim }}>
              Live auction
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 80,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
              }}
            >
              {tokenLabel} #{tokenId}
            </div>
          </div>

          {/* Bid block */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '24px 28px',
              borderRadius: 16,
              background: c.surface,
              border: `1px solid ${c.border}`,
              marginTop: 'auto',
            }}
          >
            <div style={{ display: 'flex', fontSize: 18, color: c.fgDim }}>
              {topBidEth ? 'Top bid' : 'Status'}
            </div>
            <div style={{ display: 'flex', fontSize: 44, fontWeight: 800 }}>
              {topBidEth ? `${trimEth(topBidEth)} ETH` : 'No bids yet'}
            </div>
            {bidderShort && (
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'monospace',
                  fontSize: 18,
                  color: c.fgDim,
                  gap: 6,
                }}
              >
                <span>held by</span>
                <span>{bidderShort}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  )
}

function chainName(id: number): string {
  return (
    {
      1: 'Ethereum',
      10: 'Optimism',
      8453: 'Base',
      7777777: 'Zora',
    }[id] ?? `Chain ${id}`
  )
}
