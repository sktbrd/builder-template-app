'use client'

import { ArrowUpRight, Check, Copy, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useEnsName } from 'wagmi'

import { daoConfig } from '@/lib/dao.config'

export type TreasuryNft = {
  tokenId: number
  name: string
  image: string | null
  mintedAt: number
}

function resolveIpfs(uri: string): string {
  if (uri.startsWith('ipfs://'))
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
  return uri
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ── Gallery dialog ────────────────────────────────────────────────────────────

function NftGalleryDialog({
  nfts,
  count,
  onClose,
  onSelect,
}: {
  nfts: TreasuryNft[]
  count: number
  onClose: () => void
  onSelect: (nft: TreasuryNft) => void
}) {
  const [limit, setLimit] = useState(24)
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = loaderRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && limit < nfts.length) setLimit((l) => l + 24)
      },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [limit, nfts.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[16px] border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-bold">NFT Holdings</h2>
            <p className="text-[12.5px] text-muted-fg">
              {count} {daoConfig.name} tokens in treasury
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-fg hover:bg-surface-2 hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {nfts.slice(0, limit).map((nft) => (
              <button
                key={nft.tokenId}
                type="button"
                onClick={() => onSelect(nft)}
                className="aspect-square overflow-hidden rounded-[8px] border border-border bg-surface-2 transition-[transform,border-color] hover:-translate-y-px hover:border-border-strong"
              >
                {nft.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveIpfs(nft.image)}
                    alt={nft.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-fg">
                    #{nft.tokenId}
                  </div>
                )}
              </button>
            ))}
          </div>
          {limit < nfts.length && (
            <div ref={loaderRef} className="py-6 text-center text-[12.5px] text-muted-fg">
              Loading more…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Detail dialog ─────────────────────────────────────────────────────────────

function encodeTransferCalldata(from: string, to: string, tokenId: number): string {
  const padAddr = (a: string) => a.replace(/^0x/, '').toLowerCase().padStart(64, '0')
  const padNum = (n: number) => n.toString(16).padStart(64, '0')
  // safeTransferFrom(address,address,uint256) selector = 0x42842e0e
  return '0x42842e0e' + padAddr(from) + padAddr(to) + padNum(tokenId)
}

function NftDetailDialog({ nft, onClose }: { nft: TreasuryNft; onClose: () => void }) {
  const router = useRouter()
  const [recipient, setRecipient] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const isValid = /^0x[0-9a-fA-F]{40}$/.test(recipient)

  // Resolve ENS name for the recipient address (mainnet)
  const { data: recipientEns } = useEnsName({
    address: isValid ? (recipient as `0x${string}`) : undefined,
    chainId: 1,
  })

  const displayRecipient =
    recipientEns ?? (isValid ? `${recipient.slice(0, 6)}…${recipient.slice(-4)}` : '')

  const copy = () => {
    if (!isValid) return
    const data = encodeTransferCalldata(
      daoConfig.addresses.treasury,
      recipient,
      nft.tokenId
    )
    navigator.clipboard.writeText(data)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openProposal = () => {
    if (!isValid) return
    const tokenName = nft.name || `${daoConfig.name} #${nft.tokenId}`
    const title = `Send ${tokenName} to ${displayRecipient || recipient}`
    const description = buildProposalDescription(
      tokenName,
      recipient,
      displayRecipient,
      nft
    )

    const params = new URLSearchParams({
      title,
      description,
      tx_kind: 'nft',
      tx_contract: daoConfig.addresses.token,
      tx_token_id: String(nft.tokenId),
      tx_recipient: recipient,
    })
    router.push(`/proposals/new?${params.toString()}`)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-[16px] border border-border bg-surface shadow-2xl">
        {/* Image */}
        <div className="relative aspect-square w-full bg-surface-2">
          {nft.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveIpfs(nft.image)}
              alt={nft.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-fg">
              #{nft.tokenId}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Info */}
        <div className="px-5 py-4">
          <h2 className="text-[17px] font-bold">
            {nft.name || `${daoConfig.name} #${nft.tokenId}`}
          </h2>
          <div className="mt-1 flex gap-4 text-[12.5px] text-muted-fg">
            <span>Token #{nft.tokenId}</span>
            <span>Minted {fmtDate(nft.mintedAt)}</span>
          </div>

          {/* Send section */}
          <div className="mt-4 rounded-[10px] border border-border bg-surface-2 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
              Send via proposal
            </p>
            <input
              type="text"
              placeholder="Recipient address (0x…)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-[12.5px] outline-none placeholder:text-muted-fg/50 focus:border-accent"
            />
            {recipientEns && (
              <p className="mt-1 text-[11.5px] text-accent">{recipientEns}</p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={copy}
                disabled={!isValid}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] font-medium hover:bg-surface-3 disabled:opacity-40"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? 'Copied!' : 'Copy calldata'}
              </button>
              <button
                type="button"
                onClick={openProposal}
                disabled={!isValid}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'var(--accent-fg, #000)' }}
              >
                New proposal
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function buildProposalDescription(
  tokenName: string,
  recipientAddr: string,
  displayRecipient: string,
  nft: TreasuryNft
): string {
  const recipient = displayRecipient || recipientAddr
  const short = `${recipientAddr.slice(0, 6)}…${recipientAddr.slice(-4)}`
  return `## Summary

This proposal requests the transfer of **${tokenName}** — currently held in the ${daoConfig.name} treasury — to ${recipient} (\`${short}\`).

## Why

_Edit this section: explain why the DAO should send this token. Examples: a grant, a reward for a contributor, an auction prize, or a partnership._

## Details

| Field | Value |
|---|---|
| Token | ${tokenName} |
| Token ID | #${nft.tokenId} |
| Minted | ${fmtDate(nft.mintedAt)} |
| Recipient | \`${recipientAddr}\` |
| Action | \`safeTransferFrom(treasury, recipient, tokenId)\` |

## Transaction

The proposal encodes a single \`safeTransferFrom\` call on the ${daoConfig.name} token contract. No ETH is transferred. The transaction will fail if the treasury no longer holds token #${nft.tokenId} at execution time.
`
}

// ── Main export ───────────────────────────────────────────────────────────────

export function NftSection({ nfts, count }: { nfts: TreasuryNft[]; count: number }) {
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [selected, setSelected] = useState<TreasuryNft | null>(null)

  const openDetail = useCallback((nft: TreasuryNft) => {
    setGalleryOpen(false)
    setSelected(nft)
  }, [])

  const maxVisible = count > 8 ? 7 : 8

  return (
    <div className="rounded-[14px] border border-border bg-surface px-4 py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[13px] font-bold">NFT holdings</span>
        <span className="text-[12px] text-muted-fg">{count} in treasury</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {nfts.slice(0, maxVisible).map((nft) => (
          <button
            key={nft.tokenId}
            type="button"
            onClick={() => setSelected(nft)}
            className="aspect-square overflow-hidden rounded-[8px] border border-border bg-surface-2 transition-[transform,border-color] hover:-translate-y-px hover:border-border-strong"
          >
            {nft.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveIpfs(nft.image)}
                alt={nft.name}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-fg">
                #{nft.tokenId}
              </div>
            )}
          </button>
        ))}
        {count > 8 && (
          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            className="aspect-square flex flex-col items-center justify-center gap-1 rounded-[8px] border border-dashed border-border-strong bg-surface-2 font-semibold text-muted-fg transition-colors hover:bg-surface-3"
          >
            <span className="text-lg">+{count - 7}</span>
            <span className="text-[11px] font-normal">more</span>
          </button>
        )}
      </div>

      {galleryOpen && (
        <NftGalleryDialog
          nfts={nfts}
          count={count}
          onClose={() => setGalleryOpen(false)}
          onSelect={openDetail}
        />
      )}
      {selected && <NftDetailDialog nft={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
