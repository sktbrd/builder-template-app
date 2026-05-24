import { ImageResponse } from 'next/og'

import { daoConfig } from '@/lib/dao.config'
import { getTreasuryPageData } from '@/lib/dao-data'
import { OG_CONTENT_TYPE, OG_SIZE, ogColors, resolveIpfs, trimEth } from '@/lib/og-utils'

export const alt = `${daoConfig.name} Treasury`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const revalidate = 300

function chainName(id: number): string {
  return (
    { 1: 'Ethereum', 10: 'Optimism', 8453: 'Base', 7777777: 'Zora' }[id] ?? `Chain ${id}`
  )
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export default async function TreasuryOGImage() {
  const c = ogColors()
  const logoUrl = resolveIpfs(daoConfig.image)

  let treasuryEth = '0'
  let totalUsd = 0
  let tokenCount = 0

  try {
    const data = await getTreasuryPageData()
    treasuryEth = data.treasuryEth
    tokenCount = data.tokenHoldings.length
    const ethUsd = parseFloat(data.treasuryEth) * data.ethUsdPrice
    const tokensUsd = data.tokenHoldings.reduce((s, t) => {
      const sym = t.symbol.toUpperCase()
      const stable = ['USDC', 'USDT', 'DAI', 'FRAX', 'LUSD'].includes(sym)
      const weth = ['WETH', 'CBETH', 'STETH', 'RETH'].includes(sym)
      const human = Number(BigInt(t.balanceRaw)) / 10 ** t.decimals
      return s + (stable ? human : weth ? human * data.ethUsdPrice : 0)
    }, 0)
    totalUsd = ethUsd + tokensUsd
  } catch {
    /* fall through */
  }

  const hasUsd = totalUsd > 0

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
        {/* Left accent strip */}
        <div
          style={{
            display: 'flex',
            width: 8,
            height: '100%',
            background: c.accent,
            flexShrink: 0,
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            padding: '56px 64px',
          }}
        >
          {/* Header row */}
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
                width={44}
                height={44}
                style={{ borderRadius: 999 }}
                alt=""
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
                padding: '4px 14px',
                borderRadius: 999,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {chainName(daoConfig.chainId)}
            </div>
          </div>

          {/* Main content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              margin: 'auto 0',
            }}
          >
            <div
              style={{ display: 'flex', fontSize: 24, color: c.fgDim, fontWeight: 600 }}
            >
              Treasury
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: hasUsd ? 96 : 80,
                fontWeight: 800,
                lineHeight: 1.0,
                letterSpacing: '-0.025em',
                color: c.fg,
              }}
            >
              {hasUsd ? fmtUsd(totalUsd) : `${trimEth(treasuryEth)} ETH`}
            </div>
            {hasUsd && (
              <div style={{ display: 'flex', fontSize: 28, color: c.fgDim }}>
                {trimEth(treasuryEth)} ETH
                {tokenCount > 0
                  ? ` · ${tokenCount} ERC-20 asset${tokenCount > 1 ? 's' : ''}`
                  : ''}
              </div>
            )}
          </div>

          {/* Footer stat pills */}
          <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
            {[
              { label: 'ETH Balance', value: `${trimEth(treasuryEth)} ETH` },
              ...(hasUsd ? [{ label: 'Total Value', value: fmtUsd(totalUsd) }] : []),
              { label: 'Assets', value: `${1 + tokenCount}` },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: 12,
                  padding: '16px 24px',
                }}
              >
                <div style={{ display: 'flex', fontSize: 15, color: c.fgDim }}>
                  {stat.label}
                </div>
                <div style={{ display: 'flex', fontSize: 28, fontWeight: 700 }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  )
}
