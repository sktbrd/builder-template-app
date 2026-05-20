import { ImageResponse } from 'next/og'

import { daoConfig } from '@/lib/dao.config'
import { getProposalByNumber } from '@/lib/dao-data'
import { OG_CONTENT_TYPE, OG_SIZE, ogColors, resolveIpfs } from '@/lib/og-utils'

export const alt = `${daoConfig.name} proposal`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const revalidate = 60

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  pending: { bg: 'rgba(234,88,12,0.18)', fg: '#fb923c' },
  active: { bg: 'rgba(37,99,235,0.18)', fg: '#60a5fa' },
  succeeded: { bg: 'rgba(22,163,74,0.18)', fg: '#22c55e' },
  queued: { bg: 'rgba(37,99,235,0.12)', fg: '#93c5fd' },
  executed: { bg: 'rgba(22,163,74,0.22)', fg: '#22c55e' },
  defeated: { bg: 'rgba(220,38,38,0.18)', fg: '#f87171' },
  cancelled: { bg: 'rgba(120,120,128,0.20)', fg: '#a1a1aa' },
  expired: { bg: 'rgba(120,120,128,0.20)', fg: '#a1a1aa' },
  vetoed: { bg: 'rgba(220,38,38,0.18)', fg: '#f87171' },
}

type Params = Promise<{ id: string }>

export default async function ProposalOGImage({ params }: { params: Params }) {
  const { id } = await params
  const isValidProposalNumber = /^\d+$/.test(id)
  const proposalNumber = isValidProposalNumber ? parseInt(id, 10) : null
  const c = ogColors()
  const logoUrl = resolveIpfs(daoConfig.image)

  let title = proposalNumber === null ? 'Proposal' : `Proposal #${proposalNumber}`
  let proposer = ''
  let status: keyof typeof STATUS_COLORS = 'pending'
  let forVotes = 0
  let againstVotes = 0
  let abstainVotes = 0
  let quorum = 0

  if (proposalNumber !== null && Number.isFinite(proposalNumber) && proposalNumber >= 0) {
    try {
      const detail = await getProposalByNumber(proposalNumber)
      if (detail) {
        title = detail.summary.title
        proposer = detail.summary.proposer
        status = detail.summary.status
        forVotes = detail.summary.forVotes
        againstVotes = detail.summary.againstVotes
        abstainVotes = detail.summary.abstainVotes
        quorum = detail.summary.quorum
      }
    } catch {
      /* fall through with defaults */
    }
  }

  const total = Math.max(1, forVotes + againstVotes + abstainVotes)
  const forPct = (forVotes / total) * 100
  const againstPct = (againstVotes / total) * 100
  const abstainPct = (abstainVotes / total) * 100
  const quorumPct = Math.min(100, (quorum / total) * 100)
  const empty = forVotes + againstVotes + abstainVotes === 0
  const sStyle = STATUS_COLORS[status] ?? STATUS_COLORS.pending

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: `linear-gradient(180deg, ${c.bg} 0%, ${c.surface} 100%)`,
          color: c.fg,
          padding: 70,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {logoUrl && (
              <img
                src={logoUrl}
                alt={daoConfig.name}
                width={48}
                height={48}
                style={{ borderRadius: 999, border: `1px solid ${c.border}` }}
              />
            )}
            <div
              style={{ display: 'flex', fontSize: 24, fontWeight: 600, color: c.fgDim }}
            >
              {daoConfig.name}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              fontFamily: 'monospace',
              fontSize: 24,
              color: c.fgDim,
              padding: '6px 16px',
              border: `1px solid ${c.border}`,
              borderRadius: 999,
            }}
          >
            Prop {proposalNumber}
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            margin: 'auto 0',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                background: sStyle.bg,
                color: sStyle.fg,
                padding: '6px 14px',
                borderRadius: 999,
                fontSize: 18,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {status}
            </div>
            {proposer && (
              <div style={{ display: 'flex', fontSize: 18, color: c.fgDim, gap: 6 }}>
                <span>by</span>
                <span style={{ fontWeight: 600 }}>{shortAddr(proposer)}</span>
              </div>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              maxWidth: 1060,
            }}
          >
            {title}
          </div>
        </div>

        {/* Vote bar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginTop: 'auto',
          }}
        >
          <div
            style={{
              position: 'relative',
              height: 18,
              borderRadius: 999,
              background: c.surfaceMuted,
              display: 'flex',
              overflow: 'hidden',
            }}
          >
            {!empty && (
              <>
                <div
                  style={{ display: 'flex', width: `${forPct}%`, background: '#22c55e' }}
                />
                <div
                  style={{
                    display: 'flex',
                    width: `${againstPct}%`,
                    background: '#ef4444',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    width: `${abstainPct}%`,
                    background: '#a1a1aa',
                  }}
                />
                {quorum > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      position: 'absolute',
                      top: -2,
                      bottom: -2,
                      left: `${quorumPct}%`,
                      width: 3,
                      background: c.fg,
                    }}
                  />
                )}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 28, fontSize: 22, color: c.fgDim }}>
            <span>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>{forVotes}</span> For
            </span>
            <span>
              <span style={{ color: '#ef4444', fontWeight: 700 }}>{againstVotes}</span>{' '}
              Against
            </span>
            <span>
              <span style={{ color: '#a1a1aa', fontWeight: 700 }}>{abstainVotes}</span>{' '}
              Abstain
            </span>
            <span style={{ marginLeft: 'auto' }}>
              Quorum: <span style={{ color: c.fg, fontWeight: 700 }}>{quorum}</span>
            </span>
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  )
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
