'use client'

import {
  ChevronDown,
  ChevronRight,
  Coins,
  FileImage,
  Send,
  Settings2,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'

import { WalletPill } from '@/components/dao/WalletPill'
import {
  type DecodedProposalTx,
  decodeProposalTx,
  PROPOSAL_TX_LABELS,
  type ProposalTxKind,
  type RawProposalTx,
} from '@/lib/proposal-tx-decoder'
import { cn, resolveIpfs } from '@/lib/utils'

type Props = {
  chainId: number
  /** Raw tx triplets from the subgraph, already parsed into bigint values. */
  transactions: RawProposalTx[]
  /** Lowercase DAO token address — used to know which send-NFT rows can use
   * server-side enriched artwork. */
  daoTokenAddress?: string
  /** image URL (ipfs:// or https://) for the DAO's own NFTs by tokenId. */
  nftImages?: Record<string, string>
}

const KIND_ICON: Record<ProposalTxKind, typeof Send> = {
  'send-eth': Send,
  'send-usdc': Coins,
  'send-tokens': Coins,
  'send-nfts': FileImage,
  droposal: Sparkles,
  custom: Settings2,
}

const KIND_ICON_CLASS: Record<ProposalTxKind, string> = {
  'send-eth': 'bg-accent/15 text-accent-strong',
  'send-usdc': 'bg-success/15 text-success',
  'send-tokens': 'bg-success/15 text-success',
  'send-nfts': 'bg-purple-500/15 text-purple-500',
  droposal: 'bg-warning/15 text-warning',
  custom: 'bg-muted-fg/15 text-muted-fg',
}

export function ProposalTransactionList({
  chainId,
  transactions,
  daoTokenAddress,
  nftImages,
}: Props) {
  if (transactions.length === 0) {
    return (
      <div className="text-sm text-muted-fg">(No transactions on this proposal.)</div>
    )
  }
  const daoTokenLc = daoTokenAddress?.toLowerCase()
  return (
    <ul className="flex flex-col gap-2.5">
      {transactions.map((rawTx, i) => {
        const decoded = decodeProposalTx(rawTx, chainId)
        let imageUrl: string | null = null
        if (
          decoded.type === 'send-nfts' &&
          decoded.tokenId != null &&
          daoTokenLc &&
          decoded.target.toLowerCase() === daoTokenLc
        ) {
          const rawImg = nftImages?.[decoded.tokenId.toString()]
          if (rawImg) imageUrl = resolveIpfs(rawImg)
        }
        return (
          <Row
            key={i}
            index={i}
            decoded={decoded}
            chainId={chainId}
            nftImageUrl={imageUrl}
          />
        )
      })}
    </ul>
  )
}

function Row({
  index,
  decoded,
  chainId,
  nftImageUrl,
}: {
  index: number
  decoded: DecodedProposalTx
  chainId: number
  nftImageUrl: string | null
}) {
  const [open, setOpen] = useState(false)
  const Icon = KIND_ICON[decoded.type]
  const iconClass = KIND_ICON_CLASS[decoded.type]
  const label = PROPOSAL_TX_LABELS[decoded.type]

  return (
    <li className="rounded-md border border-border bg-surface-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 rounded-md px-4 py-3 text-left hover:bg-surface-3"
      >
        {nftImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={nftImageUrl}
            alt={`NFT #${decoded.type === 'send-nfts' ? decoded.tokenId?.toString() : ''}`}
            className="mt-0.5 h-9 w-9 shrink-0 rounded-md border border-border bg-surface object-cover"
          />
        ) : (
          <span
            className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
              iconClass
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
              Tx {index + 1}
            </span>
            <span className="text-sm font-semibold text-fg">{label}</span>
          </div>
          <Summary decoded={decoded} chainId={chainId} />
        </div>
        <span className="mt-1 shrink-0 text-muted-fg">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 text-[12.5px]">
          {nftImageUrl && decoded.type === 'send-nfts' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={nftImageUrl}
              alt={`NFT #${decoded.tokenId?.toString() ?? ''}`}
              className="mb-3 h-32 w-32 rounded-md border border-border bg-surface object-cover"
            />
          )}
          <Details decoded={decoded} chainId={chainId} />
        </div>
      )}
    </li>
  )
}

function Summary({ decoded, chainId }: { decoded: DecodedProposalTx; chainId: number }) {
  if (decoded.type === 'send-eth') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        <span className="font-semibold text-fg">
          {trimDecimals(decoded.valueEth, 6)} ETH
        </span>
        <span className="text-muted-fg">to</span>
        <WalletPill address={decoded.target} link={false} size="xs" />
      </div>
    )
  }

  if (decoded.type === 'send-usdc' || decoded.type === 'send-tokens') {
    const symbol = decoded.tokenSymbol ?? 'tokens'
    const amountLabel = decoded.amountFormatted
      ? `${trimDecimals(decoded.amountFormatted, 6)} ${symbol}`
      : `(unknown amount) ${symbol}`
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        <span className="font-semibold text-fg">{amountLabel}</span>
        <span className="text-muted-fg">to</span>
        {decoded.recipient ? (
          <WalletPill address={decoded.recipient} link={false} size="xs" />
        ) : (
          <span className="italic text-muted-fg">(unknown recipient)</span>
        )}
        <span className="text-muted-fg">·</span>
        <WalletPill
          address={decoded.target}
          link={false}
          size="xs"
          showExplorer
          chainId={chainId}
        />
      </div>
    )
  }

  if (decoded.type === 'send-nfts') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        <span className="font-semibold text-fg">
          NFT #{decoded.tokenId?.toString() ?? '?'}
        </span>
        <span className="text-muted-fg">to</span>
        {decoded.to ? (
          <WalletPill address={decoded.to} link={false} size="xs" />
        ) : (
          <span className="italic text-muted-fg">(unknown recipient)</span>
        )}
        <span className="text-muted-fg">·</span>
        <WalletPill
          address={decoded.target}
          link={false}
          size="xs"
          showExplorer
          chainId={chainId}
        />
      </div>
    )
  }

  if (decoded.type === 'droposal') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        <span className="font-semibold text-fg">
          {decoded.name || '(unnamed edition)'}
        </span>
        {decoded.symbol && (
          <span className="font-mono text-muted-fg">${decoded.symbol}</span>
        )}
        <span className="text-muted-fg">·</span>
        <span className="text-fg">
          {decoded.editionSize === '0'
            ? 'open edition'
            : `${decoded.editionSize} editions`}
        </span>
        <span className="text-muted-fg">@</span>
        <span className="font-semibold text-fg">
          {trimDecimals(decoded.pricePerMintEth, 6)} ETH
        </span>
      </div>
    )
  }

  // custom
  return (
    <div className="flex flex-col gap-1 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-fg">Target</span>
        <WalletPill
          address={decoded.target}
          link={false}
          size="xs"
          showExplorer
          chainId={chainId}
        />
        {decoded.valueWei > BigInt(0) && (
          <>
            <span className="text-muted-fg">·</span>
            <span className="font-semibold text-fg">
              {trimDecimals(decoded.valueEth, 6)} ETH
            </span>
          </>
        )}
      </div>
      {decoded.calldata && decoded.calldata !== '0x' && (
        <div className="truncate font-mono text-[11px] text-muted-fg">
          {decoded.calldata.slice(0, 14)}…
        </div>
      )}
    </div>
  )
}

function Details({ decoded, chainId }: { decoded: DecodedProposalTx; chainId: number }) {
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr]">
      <DetailRow label="Target">
        <WalletPill
          address={decoded.target}
          link={false}
          size="xs"
          showExplorer
          chainId={chainId}
        />
      </DetailRow>

      {decoded.type === 'send-eth' && (
        <DetailRow label="Amount">{decoded.valueEth} ETH</DetailRow>
      )}

      {(decoded.type === 'send-usdc' || decoded.type === 'send-tokens') && (
        <>
          {decoded.recipient && (
            <DetailRow label="Recipient">
              <WalletPill address={decoded.recipient} link={false} size="xs" />
            </DetailRow>
          )}
          <DetailRow label="Amount">
            {decoded.amountFormatted
              ? `${decoded.amountFormatted} ${decoded.tokenSymbol ?? 'tokens'}`
              : decoded.amount
                ? `${decoded.amount.toString()} (raw, decimals unknown)`
                : '(could not decode)'}
          </DetailRow>
          {!decoded.tokenSymbol && (
            <DetailRow label="Token">
              <span className="italic text-muted-fg">
                Not in treasury allowlist — verify the address.
              </span>
            </DetailRow>
          )}
        </>
      )}

      {decoded.type === 'send-nfts' && (
        <>
          {decoded.from && (
            <DetailRow label="From">
              <WalletPill address={decoded.from} link={false} size="xs" />
            </DetailRow>
          )}
          {decoded.to && (
            <DetailRow label="To">
              <WalletPill address={decoded.to} link={false} size="xs" />
            </DetailRow>
          )}
          <DetailRow label="Token ID">
            <span className="font-mono">{decoded.tokenId?.toString() ?? '?'}</span>
          </DetailRow>
          <DetailRow label="Method">
            <span className="font-mono">
              {decoded.safe ? 'safeTransferFrom' : 'transferFrom'}
            </span>
          </DetailRow>
        </>
      )}

      {decoded.type === 'droposal' && (
        <>
          <DetailRow label="Name">{decoded.name || '—'}</DetailRow>
          <DetailRow label="Symbol">
            <span className="font-mono">${decoded.symbol || '—'}</span>
          </DetailRow>
          <DetailRow label="Edition size">
            {decoded.editionSize === '0' ? 'Open (no cap)' : decoded.editionSize}
          </DetailRow>
          <DetailRow label="Price per mint">{decoded.pricePerMintEth} ETH</DetailRow>
          <DetailRow label="Royalty">{(decoded.royaltyBps / 100).toFixed(2)}%</DetailRow>
          <DetailRow label="Funds recipient">
            <WalletPill address={decoded.fundsRecipient} link={false} size="xs" />
          </DetailRow>
          <DetailRow label="Default admin">
            <WalletPill address={decoded.defaultAdmin} link={false} size="xs" />
          </DetailRow>
          {decoded.saleStartUnix > 0 && (
            <DetailRow label="Sale window">
              {formatUnix(decoded.saleStartUnix)} → {formatUnix(decoded.saleEndUnix)}
            </DetailRow>
          )}
          {decoded.collectionDescription && (
            <DetailRow label="Description">
              <p className="whitespace-pre-wrap text-fg">
                {decoded.collectionDescription}
              </p>
            </DetailRow>
          )}
        </>
      )}

      {decoded.type === 'custom' && (
        <>
          <DetailRow label="Value">{decoded.valueEth} ETH</DetailRow>
          <DetailRow label="Calldata">
            {/* Long hex payloads can be 1500+ chars; cap the visible block so
                a single custom tx can't take over the page on mobile. */}
            <pre className="max-h-[20rem] overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-surface-2 p-2 font-mono text-[11.5px] leading-snug">
              {decoded.calldata}
            </pre>
          </DetailRow>
          <DetailRow label="Note">
            <span className="italic text-muted-fg">
              {customReasonLabel(decoded.reason)}
            </span>
          </DetailRow>
        </>
      )}
    </dl>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-fg">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}

function customReasonLabel(
  reason: 'no-calldata-but-value' | 'unknown-selector' | 'decode-failed'
) {
  if (reason === 'no-calldata-but-value') return 'Zero-value call with no calldata.'
  if (reason === 'unknown-selector') return 'Function selector not recognized.'
  return 'Calldata matched a known signature but failed to decode.'
}

function formatUnix(unix: number): string {
  if (!unix) return '—'
  try {
    return new Date(unix * 1000).toLocaleString()
  } catch {
    return String(unix)
  }
}

function trimDecimals(value: string, max: number): string {
  if (!value) return value
  if (!value.includes('.')) return value
  const [intPart, decPart] = value.split('.')
  const trimmed = decPart.slice(0, max).replace(/0+$/, '')
  return trimmed ? `${intPart}.${trimmed}` : intPart
}
