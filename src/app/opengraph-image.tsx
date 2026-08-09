import { ImageResponse } from 'next/og'

import { daoConfig } from '@/lib/dao.config'
import { OG_CONTENT_TYPE, OG_SIZE, ogColors, resolveIpfs } from '@/lib/og-utils'

export const alt = `${daoConfig.name} — ${daoConfig.tagline}`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const revalidate = 3600

export default async function DashboardOGImage() {
  const c = ogColors()
  const logoUrl = resolveIpfs(daoConfig.image)

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: `radial-gradient(60% 80% at 70% 30%, ${c.accentSoft} 0%, ${c.bg} 60%)`,
          color: c.fg,
          padding: 80,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            marginBottom: 'auto',
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={daoConfig.name}
              width={96}
              height={96}
              style={{ borderRadius: 999, border: `2px solid ${c.border}` }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                width: 96,
                height: 96,
                borderRadius: 999,
                background: c.accent,
              }}
            />
          )}
          <div
            style={{
              display: 'flex',
              fontSize: 32,
              fontWeight: 600,
              color: c.fgDim,
              letterSpacing: '-0.01em',
            }}
          >
            {daoConfig.name}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 96,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
              maxWidth: 920,
            }}
          >
            {daoConfig.tagline}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                display: 'flex',
                background: c.accent,
                color: c.bg,
                padding: '10px 18px',
                borderRadius: 999,
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              {chainName(daoConfig.chainId)}
            </div>
            <div style={{ display: 'flex', fontSize: 22, color: c.fgDim }}>
              {daoConfig.name} · Built with Builder
            </div>
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
