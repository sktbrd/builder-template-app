'use client'

import { useState } from 'react'
import { isAddress } from 'viem'

import { TokenLogo } from '@/components/dao/TokenLogo'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'
import type { TreasuryNft, TreasuryTokenHolding } from '@/lib/dao-data'
import {
  type AirdropEntry,
  buildApprovalDraft,
  CUSTOM_LIKE_KINDS,
  isAirdropSupported,
  isEasSupported,
  isEscrowSupported,
  type MilestoneEntry,
  type PinAssetTokenType,
  tokenKey,
  type TokenMeta,
  type TokenMetaMap,
  TX_KIND_LABELS,
  type TxDraft,
  type TxDraftAirdrop,
  type TxDraftDroposal,
  type TxDraftMilestone,
  type TxDraftNft,
  type TxDraftPinAsset,
  type TxDraftStream,
  validateDraft,
  ZERO_ADDRESS,
} from '@/lib/proposal-tx'
import { isHex } from '@/lib/proposal-validation'

type Props = {
  draft: TxDraft
  onChange: (next: TxDraft) => void
  onSave: () => void
  onCancel: () => void
  tokenMeta: TokenMetaMap
  treasuryNfts?: TreasuryNft[]
  treasuryTokens?: TreasuryTokenHolding[]
  /** Push an additional draft into the queue without losing this one. */
  onAddRelatedDraft?: (extra: TxDraft) => void
  saveLabel: string
}

export function DraftForm({
  draft,
  onChange,
  onSave,
  onCancel,
  tokenMeta,
  treasuryNfts = [],
  treasuryTokens = [],
  onAddRelatedDraft,
  saveLabel,
}: Props) {
  const errors = validateDraft(draft, tokenMeta)
  const canSave = errors.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
          {TX_KIND_LABELS[draft.kind]}
        </div>
        <div className="mt-1 text-sm text-fg">
          {draft.kind === 'eth' && 'Transfer ETH from the treasury.'}
          {draft.kind === 'erc20' && 'Transfer an ERC-20 token from the treasury.'}
          {draft.kind === 'nft' && 'Transfer an ERC-721 NFT from the treasury.'}
          {draft.kind === 'custom' && 'Encode a raw contract call. You provide target, value, and calldata.'}
          {draft.kind === 'mint_gov' && 'Mint a governance NFT to the specified address using the DAO token contract.'}
          {draft.kind === 'delegate' &&
            'Nominate an escrow delegate via EAS attestation — the nominated address can manage milestone payments and token streams on behalf of the DAO.'}
          {draft.kind === 'pause_auction' && 'Pause or unpause the DAO auction house contract.'}
          {draft.kind === 'pin_asset' &&
            'Whitelist an ERC-20, ERC-721, or ERC-1155 contract for prominent display in the treasury (EAS attestation).'}
          {draft.kind === 'stream' && 'Create a continuous ERC-20 token stream via Sablier LockupLinear.'}
          {draft.kind === 'airdrop' && 'Bulk-send ETH or an ERC-20 to many recipients in one transaction via the Disperse contract.'}
          {draft.kind === 'milestone' && 'Deploy a SmartInvoice escrow with milestone-based releases — funds unlock as the client approves each milestone.'}
          {draft.kind === 'droposal' && 'Create a single-edition ERC721 drop via Zora NFT Creator.'}
          {draft.kind === 'add_artwork' && 'Add new artwork properties to the metadata renderer. Provide encoded calldata for addProperties().'}
          {draft.kind === 'replace_artwork' && 'Replace all artwork by calling deleteAndRecreateProperties() on the metadata renderer.'}
        </div>
      </div>

      {draft.kind === 'eth' && <EthFields draft={draft} onChange={onChange} />}
      {draft.kind === 'erc20' && (
        <Erc20Fields
          draft={draft}
          onChange={onChange}
          tokenMeta={tokenMeta}
          treasuryTokens={treasuryTokens}
        />
      )}
      {draft.kind === 'nft' && (
        <NftFields draft={draft} onChange={onChange} treasuryNfts={treasuryNfts} />
      )}
      {draft.kind === 'custom' && <CustomFields draft={draft} onChange={onChange} />}
      {draft.kind === 'mint_gov' && <MintGovFields draft={draft} onChange={onChange} />}
      {draft.kind === 'delegate' && <DelegateFields draft={draft} onChange={onChange} />}
      {draft.kind === 'pause_auction' && <PauseAuctionFields draft={draft} onChange={onChange} />}
      {draft.kind === 'pin_asset' && <PinAssetFields draft={draft} onChange={onChange} />}
      {draft.kind === 'milestone' && (
        <MilestoneFields
          draft={draft}
          onChange={onChange}
          tokenMeta={tokenMeta}
          treasuryTokens={treasuryTokens}
          onAddRelatedDraft={onAddRelatedDraft}
        />
      )}
      {draft.kind === 'airdrop' && (
        <AirdropFields
          draft={draft}
          onChange={onChange}
          tokenMeta={tokenMeta}
          treasuryTokens={treasuryTokens}
          onAddRelatedDraft={onAddRelatedDraft}
        />
      )}
      {draft.kind === 'walletconnect' && (
        <WalletConnectFields
          draft={draft as Extract<TxDraft, { kind: 'walletconnect' }>}
          onChange={onChange}
        />
      )}
      {draft.kind === 'droposal' && <DroposalFields draft={draft} onChange={onChange} />}
      {draft.kind === 'stream' && (
        <StreamFields
          draft={draft}
          onChange={onChange}
          tokenMeta={tokenMeta}
          onAddRelatedDraft={onAddRelatedDraft}
        />
      )}
      {CUSTOM_LIKE_KINDS.has(draft.kind) && (
        <CustomLikeFields
          draft={draft as Extract<TxDraft, { kind: 'add_artwork' | 'replace_artwork' }>}
          onChange={onChange}
        />
      )}

      {errors.length > 0 && (
        <ul className="list-disc pl-5 text-[12.5px] text-warning">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button onClick={onSave} disabled={!canSave} type="button">
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}

function EthFields({
  draft,
  onChange,
}: {
  draft: Extract<TxDraft, { kind: 'eth' }>
  onChange: (next: TxDraft) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px]">
      <Field label="Recipient">
        <input
          type="text"
          value={draft.recipient}
          onChange={(e) => onChange({ ...draft, recipient: e.target.value })}
          placeholder="0x…"
          className={textInputClass(draft.recipient.length > 0 && !isAddress(draft.recipient))}
        />
      </Field>
      <Field label="Amount (ETH)">
        <input
          type="text"
          inputMode="decimal"
          value={draft.valueEth}
          onChange={(e) => onChange({ ...draft, valueEth: e.target.value })}
          placeholder="0"
          className={textInputClass(false)}
        />
      </Field>
    </div>
  )
}

function Erc20Fields({
  draft,
  onChange,
  tokenMeta,
  treasuryTokens,
}: {
  draft: Extract<TxDraft, { kind: 'erc20' }>
  onChange: (next: TxDraft) => void
  tokenMeta: TokenMetaMap
  treasuryTokens: TreasuryTokenHolding[]
}) {
  const meta: TokenMeta | undefined = isAddress(draft.token)
    ? tokenMeta[tokenKey(draft.token)]
    : undefined

  // Merge configured tokens with live treasury holdings — treasury balances
  // take precedence and surface tokens not in the static config too.
  const holdingsByAddr = new Map(treasuryTokens.map((h) => [tokenKey(h.address), h]))
  const pickRow = (() => {
    const seen = new Set<string>()
    const rows: Array<{
      symbol: string
      address: string
      balance?: string
    }> = []
    for (const h of treasuryTokens) {
      const k = tokenKey(h.address)
      if (seen.has(k)) continue
      seen.add(k)
      rows.push({ symbol: h.symbol, address: h.address, balance: h.balance })
    }
    for (const t of daoConfig.treasuryTokens) {
      const k = tokenKey(t.address)
      if (seen.has(k)) continue
      seen.add(k)
      rows.push({ symbol: t.symbol, address: t.address })
    }
    return rows
  })()

  const selectedHolding = isAddress(draft.token)
    ? holdingsByAddr.get(tokenKey(draft.token))
    : undefined

  const setMax = () => {
    if (selectedHolding) onChange({ ...draft, amount: selectedHolding.balance })
  }

  return (
    <div className="flex flex-col gap-3">
      {pickRow.length > 0 && (
        <Field label={`Treasury tokens (${pickRow.length})`}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {pickRow.map((t) => {
              const active =
                isAddress(draft.token) && tokenKey(t.address) === tokenKey(draft.token)
              return (
                <button
                  key={t.address}
                  type="button"
                  onClick={() => onChange({ ...draft, token: t.address })}
                  className={
                    'flex items-center gap-2 rounded-md border bg-surface px-2.5 py-2 text-left transition-[border-color,transform] hover:-translate-y-px ' +
                    (active
                      ? 'border-accent ring-2 ring-accent/40'
                      : 'border-border hover:border-border-strong')
                  }
                >
                  <TokenLogo
                    address={t.address}
                    symbol={t.symbol}
                    chainId={daoConfig.chainId}
                    size={28}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-fg">{t.symbol}</span>
                    <span className="truncate font-mono text-[11px] text-muted-fg">
                      {t.balance ?? '—'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </Field>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_160px]">
        <Field label="Token address">
          <input
            type="text"
            value={draft.token}
            onChange={(e) => onChange({ ...draft, token: e.target.value })}
            placeholder="0x…"
            className={textInputClass(draft.token.length > 0 && !isAddress(draft.token))}
          />
        </Field>
        <Field label="Recipient">
          <input
            type="text"
            value={draft.recipient}
            onChange={(e) => onChange({ ...draft, recipient: e.target.value })}
            placeholder="0x…"
            className={textInputClass(draft.recipient.length > 0 && !isAddress(draft.recipient))}
          />
        </Field>
        <Field
          label={
            <span className="flex items-center justify-between gap-2">
              <span>Amount{meta?.symbol ? ` (${meta.symbol})` : ''}</span>
              {selectedHolding && (
                <button
                  type="button"
                  onClick={setMax}
                  className="text-[10px] font-semibold uppercase tracking-wider text-accent-strong hover:underline"
                >
                  Max
                </button>
              )}
            </span>
          }
        >
          <input
            type="text"
            inputMode="decimal"
            value={draft.amount}
            onChange={(e) => onChange({ ...draft, amount: e.target.value })}
            placeholder="0"
            className={textInputClass(false)}
          />
        </Field>
      </div>
      {isAddress(draft.token) && (
        <div className="text-[12px] text-muted-fg">
          {meta ? (
            <>
              Token: <span className="text-fg">{meta.symbol ?? '—'}</span> · {meta.decimals} decimals
              {selectedHolding && (
                <>
                  {' · Treasury balance: '}
                  <span className="font-mono text-fg">
                    {selectedHolding.balance} {selectedHolding.symbol}
                  </span>
                </>
              )}
            </>
          ) : (
            <>Reading token metadata…</>
          )}
        </div>
      )}
    </div>
  )
}

function NftFields({
  draft,
  onChange,
  treasuryNfts,
}: {
  draft: TxDraftNft
  onChange: (next: TxDraft) => void
  treasuryNfts: TreasuryNft[]
}) {
  const daoToken = daoConfig.addresses.token
  const isDaoToken =
    isAddress(draft.contract) && draft.contract.toLowerCase() === daoToken.toLowerCase()

  const collections = [
    { symbol: `${daoConfig.name} token`, address: daoToken },
    ...daoConfig.treasuryNftCollections,
  ]

  const onPickCollection = (address: string) => {
    if (
      isAddress(draft.contract) &&
      draft.contract.toLowerCase() !== address.toLowerCase()
    ) {
      onChange({ ...draft, contract: address, tokenId: '' })
    } else {
      onChange({ ...draft, contract: address })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {collections.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
            Quick pick
          </span>
          {collections.map((c) => {
            const active =
              isAddress(draft.contract) &&
              draft.contract.toLowerCase() === c.address.toLowerCase()
            return (
              <button
                key={c.address}
                type="button"
                onClick={() => onPickCollection(c.address)}
                className={
                  active
                    ? 'rounded-full border border-accent bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent-strong'
                    : 'rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted-fg hover:text-fg'
                }
              >
                {c.symbol}
              </button>
            )
          })}
        </div>
      )}

      <Field label="NFT contract">
        <input
          type="text"
          value={draft.contract}
          onChange={(e) => onChange({ ...draft, contract: e.target.value })}
          placeholder="0x…"
          className={textInputClass(draft.contract.length > 0 && !isAddress(draft.contract))}
        />
      </Field>

      {isDaoToken && treasuryNfts.length > 0 ? (
        <TreasuryNftPicker
          nfts={treasuryNfts}
          selectedTokenId={draft.tokenId}
          onSelect={(tokenId) => onChange({ ...draft, tokenId: String(tokenId) })}
        />
      ) : (
        <Field label="Token ID">
          <input
            type="text"
            inputMode="numeric"
            value={draft.tokenId}
            onChange={(e) => onChange({ ...draft, tokenId: e.target.value.replace(/\D/g, '') })}
            placeholder="0"
            className={textInputClass(false)}
          />
        </Field>
      )}

      <Field label="Recipient">
        <input
          type="text"
          value={draft.recipient}
          onChange={(e) => onChange({ ...draft, recipient: e.target.value })}
          placeholder="0x…"
          className={textInputClass(draft.recipient.length > 0 && !isAddress(draft.recipient))}
        />
      </Field>

      <div className="text-[12px] text-muted-fg">
        Transfers token #{draft.tokenId || '?'} from the treasury using{' '}
        <span className="font-mono">safeTransferFrom</span>.
      </div>
    </div>
  )
}

function TreasuryNftPicker({
  nfts,
  selectedTokenId,
  onSelect,
}: {
  nfts: TreasuryNft[]
  selectedTokenId: string
  onSelect: (tokenId: number) => void
}) {
  return (
    <Field label={`Treasury NFTs (${nfts.length})`}>
      <div className="grid max-h-[280px] grid-cols-3 gap-2 overflow-y-auto rounded-md border border-border bg-surface-2 p-2 sm:grid-cols-4 md:grid-cols-5">
        {nfts.map((nft) => {
          const isSelected = String(nft.tokenId) === selectedTokenId
          const src = nft.image
            ? nft.image.startsWith('ipfs://')
              ? `https://gateway.pinata.cloud/ipfs/${nft.image.slice(7)}`
              : nft.image
            : null
          return (
            <button
              key={nft.tokenId}
              type="button"
              onClick={() => onSelect(nft.tokenId)}
              className={
                'group relative aspect-square overflow-hidden rounded-md border bg-surface transition-[border-color,transform] hover:-translate-y-px ' +
                (isSelected
                  ? 'border-accent ring-2 ring-accent/40'
                  : 'border-border hover:border-border-strong')
              }
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={nft.name || `#${nft.tokenId}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-fg">
                  #{nft.tokenId}
                </div>
              )}
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                #{nft.tokenId}
              </span>
            </button>
          )
        })}
      </div>
    </Field>
  )
}

function CustomFields({
  draft,
  onChange,
}: {
  draft: Extract<TxDraft, { kind: 'custom' }>
  onChange: (next: TxDraft) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px]">
        <Field label="Target address">
          <input
            type="text"
            value={draft.target}
            onChange={(e) => onChange({ ...draft, target: e.target.value })}
            placeholder="0x…"
            className={textInputClass(draft.target.length > 0 && !isAddress(draft.target))}
          />
        </Field>
        <Field label="Value (ETH)">
          <input
            type="text"
            inputMode="decimal"
            value={draft.valueEth}
            onChange={(e) => onChange({ ...draft, valueEth: e.target.value })}
            placeholder="0"
            className={textInputClass(false)}
          />
        </Field>
      </div>
      <Field label="Calldata (hex)">
        <input
          type="text"
          value={draft.calldata}
          onChange={(e) => onChange({ ...draft, calldata: e.target.value })}
          placeholder="0x"
          className={textInputClass(!!draft.calldata && !isHex(draft.calldata))}
        />
      </Field>
    </div>
  )
}

function MintGovFields({
  draft,
  onChange,
}: {
  draft: Extract<TxDraft, { kind: 'mint_gov' }>
  onChange: (next: TxDraft) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Recipient address">
        <input
          type="text"
          value={draft.recipient}
          onChange={(e) => onChange({ ...draft, recipient: e.target.value })}
          placeholder="0x…"
          className={textInputClass(draft.recipient.length > 0 && !isAddress(draft.recipient))}
        />
      </Field>
      <div className="text-[12px] text-muted-fg">
        Calls <span className="font-mono">mintTo(address)</span> on the DAO token contract. The next
        sequential token ID is minted to the recipient.
      </div>
    </div>
  )
}

function DelegateFields({
  draft,
  onChange,
}: {
  draft: Extract<TxDraft, { kind: 'delegate' }>
  onChange: (next: TxDraft) => void
}) {
  const easOk = isEasSupported()
  return (
    <div className="flex flex-col gap-3">
      {!easOk && (
        <div className="rounded-md border border-warning bg-warning/10 px-3 py-2 text-[12px] text-warning">
          EAS isn&apos;t deployed on this chain — escrow delegate nominations are unavailable.
          Switch to a supported chain (Ethereum, Optimism, Base, Sepolia) or use a Custom
          Transaction.
        </div>
      )}
      <Field label="Escrow delegate address">
        <input
          type="text"
          value={draft.delegatee}
          onChange={(e) => onChange({ ...draft, delegatee: e.target.value })}
          placeholder="0x…"
          className={textInputClass(draft.delegatee.length > 0 && !isAddress(draft.delegatee))}
        />
      </Field>
      <div className="text-[12px] text-muted-fg">
        Writes an EAS attestation pointing at the DAO token contract. The nominated address
        will be authorized to manage escrows and token streams on behalf of the DAO.
      </div>
    </div>
  )
}

function PinAssetFields({
  draft,
  onChange,
}: {
  draft: TxDraftPinAsset
  onChange: (next: TxDraft) => void
}) {
  const easOk = isEasSupported()
  const showTokenId =
    (draft.tokenType === 'erc721' || draft.tokenType === 'erc1155') && !draft.isCollection

  const setTokenType = (tokenType: PinAssetTokenType) => {
    if (tokenType === 'erc20') {
      onChange({ ...draft, tokenType, isCollection: true, tokenId: '' })
    } else {
      onChange({ ...draft, tokenType })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {!easOk && (
        <div className="rounded-md border border-warning bg-warning/10 px-3 py-2 text-[12px] text-warning">
          EAS isn&apos;t deployed on this chain — treasury asset pinning is unavailable. Switch
          to a supported chain (Ethereum, Optimism, Base, Sepolia) or use a Custom Transaction.
        </div>
      )}

      <Field label="Asset type">
        <div className="flex items-center gap-1 rounded-full border border-border bg-surface-2 p-0.5">
          {(['erc20', 'erc721', 'erc1155'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTokenType(t)}
              className={
                draft.tokenType === t
                  ? 'rounded-full bg-fg px-3 py-1 text-[12px] font-semibold text-bg'
                  : 'rounded-full px-3 py-1 text-[12px] font-medium text-muted-fg hover:text-fg'
              }
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Contract address">
        <input
          type="text"
          value={draft.contract}
          onChange={(e) => onChange({ ...draft, contract: e.target.value })}
          placeholder="0x…"
          className={textInputClass(draft.contract.length > 0 && !isAddress(draft.contract))}
        />
      </Field>

      {draft.tokenType !== 'erc20' && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={draft.isCollection}
            onClick={() => onChange({ ...draft, isCollection: !draft.isCollection })}
            className="relative h-5 w-9 flex-shrink-0 rounded-full border transition-colors"
            style={{
              background: draft.isCollection ? 'var(--accent)' : 'var(--surface-3)',
              borderColor: draft.isCollection ? 'var(--accent)' : 'var(--border)',
            }}
          >
            <span
              className="absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
              style={{ transform: draft.isCollection ? 'translateX(18px)' : 'translateX(2px)' }}
            />
          </button>
          <span className="text-[12.5px] text-muted-fg">
            Pin the entire collection (instead of a single token)
          </span>
        </div>
      )}

      {showTokenId && (
        <Field label="Token ID">
          <input
            type="text"
            inputMode="numeric"
            value={draft.tokenId}
            onChange={(e) => onChange({ ...draft, tokenId: e.target.value.replace(/\D/g, '') })}
            placeholder="0"
            className={textInputClass(false)}
          />
        </Field>
      )}

      <div className="text-[12px] text-muted-fg">
        Writes an EAS attestation with a Builder treasury-pin schema. Surfaces the asset in
        treasury views that recognize the schema.
      </div>
    </div>
  )
}

function PauseAuctionFields({
  draft,
  onChange,
}: {
  draft: Extract<TxDraft, { kind: 'pause_auction' }>
  onChange: (next: TxDraft) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Action">
        <div className="flex gap-2">
          {(['pause', 'unpause'] as const).map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onChange({ ...draft, action })}
              className={
                draft.action === action
                  ? 'rounded-full border border-accent bg-accent/10 px-3 py-1.5 text-[12px] font-semibold text-accent-strong'
                  : 'rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-muted-fg hover:text-fg'
              }
            >
              {action === 'pause' ? 'Pause auctions' : 'Unpause auctions'}
            </button>
          ))}
        </div>
      </Field>
      <div className="text-[12px] text-muted-fg">
        Calls <span className="font-mono">{draft.action}()</span> on the DAO auction house contract.
        {draft.action === 'pause'
          ? ' New bids will be blocked until unpaused.'
          : ' Resumes the auction house.'}
      </div>
    </div>
  )
}

/**
 * Shown on milestone/stream/airdrop forms for ERC-20 token flows — pushes
 * a paired `approve(spender, amount)` draft to the queue so the proposer
 * doesn't have to build it by hand.
 */
function ApprovalQueueButton({
  draft,
  tokenMeta,
  onAddRelatedDraft,
}: {
  draft: TxDraft
  tokenMeta: TokenMetaMap
  onAddRelatedDraft?: (extra: TxDraft) => void
}) {
  const approval = buildApprovalDraft(draft, tokenMeta)
  if (!approval || !onAddRelatedDraft) return null
  return (
    <button
      type="button"
      onClick={() => onAddRelatedDraft(approval)}
      className="self-start rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-[12px] font-semibold text-accent-strong hover:bg-accent/20"
    >
      + Queue ERC-20 approval for this draft
    </button>
  )
}

function AirdropFields({
  draft,
  onChange,
  tokenMeta,
  treasuryTokens,
  onAddRelatedDraft,
}: {
  draft: TxDraftAirdrop
  onChange: (next: TxDraft) => void
  tokenMeta: TokenMetaMap
  treasuryTokens: TreasuryTokenHolding[]
  onAddRelatedDraft?: (extra: TxDraft) => void
}) {
  const supported = isAirdropSupported()
  const isNative =
    isAddress(draft.token) && draft.token.toLowerCase() === ZERO_ADDRESS
  const tokenSymbol = isNative
    ? 'ETH'
    : isAddress(draft.token)
      ? (tokenMeta[tokenKey(draft.token)]?.symbol ??
        treasuryTokens.find((t) => tokenKey(t.address) === tokenKey(draft.token))?.symbol ??
        '')
      : ''

  const setRecipient = (i: number, patch: Partial<AirdropEntry>) =>
    onChange({
      ...draft,
      recipients: draft.recipients.map((r, j) => (i === j ? { ...r, ...patch } : r)),
    })
  const addRecipient = () =>
    onChange({
      ...draft,
      recipients: [...draft.recipients, { recipient: '', amount: '' }],
    })
  const removeRecipient = (i: number) => {
    if (draft.recipients.length <= 1) return
    onChange({ ...draft, recipients: draft.recipients.filter((_, j) => j !== i) })
  }
  const pasteCsv = (raw: string) => {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return
    const parsed: AirdropEntry[] = lines.map((line) => {
      const [addr, amt] = line.split(/[,\s]+/)
      return { recipient: addr ?? '', amount: amt ?? '' }
    })
    onChange({ ...draft, recipients: parsed })
  }

  const total = draft.recipients.reduce((acc, r) => {
    const n = Number(r.amount)
    return Number.isFinite(n) ? acc + n : acc
  }, 0)

  return (
    <div className="flex flex-col gap-3">
      {!supported && (
        <div className="rounded-md border border-warning bg-warning/10 px-3 py-2 text-[12px] text-warning">
          The Disperse contract isn&apos;t configured for this chain. Switch to a supported
          chain (Ethereum, Optimism, Polygon, Arbitrum, Base) or use a Custom Transaction.
        </div>
      )}
      <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted-fg">
        Uses the Disperse contract to fan-out funds in a single tx. For ERC-20 tokens you also
        need an <span className="font-mono">approve()</span> tx to the Disperse address — use
        the button below once token + amounts are set.
      </div>
      <ApprovalQueueButton
        draft={draft}
        tokenMeta={tokenMeta}
        onAddRelatedDraft={onAddRelatedDraft}
      />

      {/* Token picker */}
      <Field label="Token">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ ...draft, token: ZERO_ADDRESS })}
            className={
              isNative
                ? 'rounded-full border border-accent bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent-strong'
                : 'rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted-fg hover:text-fg'
            }
          >
            ETH
          </button>
          {treasuryTokens.map((t) => {
            const active =
              !isNative &&
              isAddress(draft.token) &&
              tokenKey(t.address) === tokenKey(draft.token)
            return (
              <button
                key={t.address}
                type="button"
                onClick={() => onChange({ ...draft, token: t.address })}
                className={
                  active
                    ? 'inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent-strong'
                    : 'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted-fg hover:text-fg'
                }
              >
                <span>{t.symbol}</span>
                <span className="font-mono text-[10px] opacity-70">{t.balance}</span>
              </button>
            )
          })}
        </div>
      </Field>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[12.5px] text-muted-fg">
            Recipients ({draft.recipients.length}){tokenSymbol &&
              ` · total ${total.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${tokenSymbol}`}
          </span>
          <button
            type="button"
            onClick={addRecipient}
            className="text-[11px] font-semibold uppercase tracking-wider text-accent-strong hover:underline"
          >
            + Add recipient
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {draft.recipients.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-1.5 sm:grid-cols-[1fr_160px_auto]"
            >
              <input
                type="text"
                value={r.recipient}
                onChange={(e) => setRecipient(i, { recipient: e.target.value })}
                placeholder="0x…"
                className={textInputClass(
                  r.recipient.length > 0 && !isAddress(r.recipient)
                )}
              />
              <input
                type="text"
                inputMode="decimal"
                value={r.amount}
                onChange={(e) => setRecipient(i, { amount: e.target.value })}
                placeholder={`Amount${tokenSymbol ? ` (${tokenSymbol})` : ''}`}
                className={textInputClass(false)}
              />
              {draft.recipients.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRecipient(i)}
                  aria-label="Remove recipient"
                  className="rounded-md border border-border bg-surface px-2 py-1.5 text-[11px] text-muted-fg hover:text-fg sm:self-stretch"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Field label="Paste CSV (address,amount per line)">
        <textarea
          onChange={(e) => pasteCsv(e.target.value)}
          placeholder="0x123…, 100&#10;0xabc…, 50"
          rows={3}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent resize-none"
        />
      </Field>
    </div>
  )
}

function MilestoneFields({
  draft,
  onChange,
  tokenMeta,
  treasuryTokens,
  onAddRelatedDraft,
}: {
  draft: TxDraftMilestone
  onChange: (next: TxDraft) => void
  tokenMeta: TokenMetaMap
  treasuryTokens: TreasuryTokenHolding[]
  onAddRelatedDraft?: (extra: TxDraft) => void
}) {
  const escrowOk = isEscrowSupported()
  const isNative =
    isAddress(draft.token) && draft.token.toLowerCase() === ZERO_ADDRESS
  const tokenSymbol = isNative
    ? 'ETH'
    : isAddress(draft.token)
      ? (tokenMeta[tokenKey(draft.token)]?.symbol ??
        treasuryTokens.find((t) => tokenKey(t.address) === tokenKey(draft.token))?.symbol ??
        '')
      : ''

  const setMilestone = (i: number, patch: Partial<MilestoneEntry>) => {
    onChange({
      ...draft,
      milestones: draft.milestones.map((m, j) => (i === j ? { ...m, ...patch } : m)),
    })
  }
  const addMilestone = () => {
    const last = draft.milestones[draft.milestones.length - 1]
    const lastDate = last?.endDate ? new Date(last.endDate) : new Date()
    const next = new Date(lastDate)
    next.setDate(next.getDate() + 14)
    onChange({
      ...draft,
      milestones: [
        ...draft.milestones,
        {
          amount: '',
          title: '',
          description: '',
          endDate: next.toISOString().slice(0, 10),
        },
      ],
    })
  }
  const removeMilestone = (i: number) => {
    if (draft.milestones.length <= 1) return
    onChange({ ...draft, milestones: draft.milestones.filter((_, j) => j !== i) })
  }

  return (
    <div className="flex flex-col gap-3">
      {!escrowOk && (
        <div className="rounded-md border border-warning bg-warning/10 px-3 py-2 text-[12px] text-warning">
          EscrowBundler isn&apos;t deployed on this chain — milestone payments are unavailable.
          Switch to a supported chain (Ethereum, Optimism, Base, Zora) or use a Custom
          Transaction.
        </div>
      )}
      <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted-fg">
        Deploys a SmartInvoice escrow. For ERC-20 tokens you also need an{' '}
        <span className="font-mono">approve()</span> tx to the EscrowBundler — use the button
        below once token + amounts are set. Native ETH is forwarded automatically.
      </div>
      <ApprovalQueueButton
        draft={draft}
        tokenMeta={tokenMeta}
        onAddRelatedDraft={onAddRelatedDraft}
      />

      {/* Token picker */}
      <Field label="Token">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ ...draft, token: ZERO_ADDRESS })}
            className={
              isNative
                ? 'rounded-full border border-accent bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent-strong'
                : 'rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted-fg hover:text-fg'
            }
          >
            ETH
          </button>
          {treasuryTokens.map((t) => {
            const active =
              !isNative &&
              isAddress(draft.token) &&
              tokenKey(t.address) === tokenKey(draft.token)
            return (
              <button
                key={t.address}
                type="button"
                onClick={() => onChange({ ...draft, token: t.address })}
                className={
                  active
                    ? 'inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent-strong'
                    : 'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted-fg hover:text-fg'
                }
              >
                <span>{t.symbol}</span>
                <span className="font-mono text-[10px] opacity-70">{t.balance}</span>
              </button>
            )
          })}
        </div>
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Recipient (provider)">
          <input
            type="text"
            value={draft.recipient}
            onChange={(e) => onChange({ ...draft, recipient: e.target.value })}
            placeholder="0x… (who gets paid)"
            className={textInputClass(
              draft.recipient.length > 0 && !isAddress(draft.recipient)
            )}
          />
        </Field>
        <Field label="Client (release controller)">
          <input
            type="text"
            value={draft.client}
            onChange={(e) => onChange({ ...draft, client: e.target.value })}
            placeholder="0x… (DAO multisig or treasury)"
            className={textInputClass(draft.client.length > 0 && !isAddress(draft.client))}
          />
        </Field>
      </div>

      <Field label="Safety valve date (≥30 days after last milestone)">
        <input
          type="date"
          value={draft.safetyValveDate}
          onChange={(e) => onChange({ ...draft, safetyValveDate: e.target.value })}
          className={textInputClass(false)}
        />
      </Field>

      {/* Milestones */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[12.5px] text-muted-fg">
            Milestones ({draft.milestones.length})
          </span>
          <button
            type="button"
            onClick={addMilestone}
            className="text-[11px] font-semibold uppercase tracking-wider text-accent-strong hover:underline"
          >
            + Add milestone
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {draft.milestones.map((m, i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-surface-2 p-3 text-[12.5px]"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-fg">Milestone {i + 1}</span>
                {draft.milestones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMilestone(i)}
                    aria-label="Remove milestone"
                    className="text-muted-fg hover:text-fg"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_140px]">
                <input
                  type="text"
                  value={m.title}
                  onChange={(e) => setMilestone(i, { title: e.target.value })}
                  placeholder="Title"
                  className={textInputClass(false)}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={m.amount}
                  onChange={(e) => setMilestone(i, { amount: e.target.value })}
                  placeholder={`Amount${tokenSymbol ? ` (${tokenSymbol})` : ''}`}
                  className={textInputClass(false)}
                />
                <input
                  type="date"
                  value={m.endDate}
                  onChange={(e) => setMilestone(i, { endDate: e.target.value })}
                  className={textInputClass(false)}
                />
              </div>
              <textarea
                value={m.description}
                onChange={(e) => setMilestone(i, { description: e.target.value })}
                placeholder="Description (optional, off-chain only)"
                rows={2}
                className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-accent resize-none"
              />
            </div>
          ))}
        </div>
      </div>

      <MilestoneMetadataUpload draft={draft} onChange={onChange} />
    </div>
  )
}

function MilestoneMetadataUpload({
  draft,
  onChange,
}: {
  draft: TxDraftMilestone
  onChange: (next: TxDraft) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async () => {
    setError(null)
    setUploading(true)
    try {
      const payload = {
        title: draft.milestones[0]?.title || 'Milestone proposal',
        description: 'SmartInvoice escrow milestones',
        endDate: draft.milestones.reduce(
          (max, m) =>
            m.endDate ? Math.max(max, Math.floor(new Date(m.endDate).getTime() / 1000)) : max,
          0
        ),
        milestones: draft.milestones.map((m, i) => ({
          id: `m-${i}`,
          title: m.title,
          description: m.description,
          endDate: m.endDate
            ? Math.floor(new Date(m.endDate).getTime() / 1000)
            : 0,
          createdAt: Math.floor(Date.now() / 1000),
        })),
        createdAt: Math.floor(Date.now() / 1000),
      }
      const { uploadJson } = await import('@buildeross/ipfs-service')
      const result = await uploadJson(payload)
      const cid =
        typeof result === 'string'
          ? result
          : ((result as { cid?: string }).cid ?? (result as { uri?: string }).uri ?? '')
      if (!cid) throw new Error('Upload returned no CID')
      const clean = cid.replace(/^ipfs:\/\//, '')
      onChange({ ...draft, ipfsCid: clean })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'IPFS upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5 text-[12px]">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-semibold text-fg">SmartInvoice metadata</span>
        {draft.ipfsCid ? (
          <span className="font-mono text-[10.5px] text-success">
            ipfs://{draft.ipfsCid.slice(0, 8)}…{draft.ipfsCid.slice(-6)}
          </span>
        ) : (
          <span className="text-[11px] text-muted-fg">not uploaded</span>
        )}
      </div>
      <p className="mb-2 text-muted-fg">
        Optional. Uploads milestone titles, descriptions, and dates as JSON so the
        SmartInvoice UI can show them off-chain. Without this the escrow still executes
        — only the off-chain display loses context.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={upload}
          disabled={uploading}
          className="rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-[12px] font-semibold text-accent-strong hover:bg-accent/20 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : draft.ipfsCid ? 'Re-upload metadata' : 'Upload metadata to IPFS'}
        </button>
        {draft.ipfsCid && (
          <button
            type="button"
            onClick={() => onChange({ ...draft, ipfsCid: undefined })}
            className="text-[11px] text-muted-fg hover:text-fg"
          >
            Clear
          </button>
        )}
      </div>
      {error && <div className="mt-2 text-[11px] text-warning">{error}</div>}
    </div>
  )
}

function WalletConnectFields({
  draft,
  onChange,
}: {
  draft: Extract<TxDraft, { kind: 'walletconnect' }>
  onChange: (next: TxDraft) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-border bg-surface-2 px-3 py-3 text-[12.5px]">
        <div className="mb-2 font-semibold text-fg">How to capture a WalletConnect transaction</div>
        <ol className="ml-5 list-decimal space-y-1 text-muted-fg">
          <li>
            Open the dApp you want to interact with and choose <strong>Connect Wallet</strong> →{' '}
            <strong>WalletConnect</strong>.
          </li>
          <li>
            Pair using a wallet that lets you see and copy raw transaction data before signing
            (Safe, Frame, Rabby, or MetaMask).
          </li>
          <li>
            Trigger the action in the dApp — when your wallet prompts to sign, copy{' '}
            <span className="font-mono">to</span>, <span className="font-mono">value</span>, and{' '}
            <span className="font-mono">data</span>.
          </li>
          <li>
            Cancel the wallet prompt (so your personal wallet doesn&apos;t send it) and paste the
            values below — the proposal will execute the same call from the treasury.
          </li>
        </ol>
        <div className="mt-2 text-[11.5px] text-muted-fg">
          For complex dApp flows, the{' '}
          <a
            href="https://app.safe.global/apps/open?appUrl=https%3A%2F%2Fapps-portal.safe.global%2Ftx-builder"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-strong hover:underline"
          >
            Safe Transaction Builder
          </a>{' '}
          can record a sequence of calls and export the raw data.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px]">
        <Field label="Target address (to)">
          <input
            type="text"
            value={draft.target}
            onChange={(e) => onChange({ ...draft, target: e.target.value })}
            placeholder="0x…"
            className={textInputClass(draft.target.length > 0 && !isAddress(draft.target))}
          />
        </Field>
        <Field label="Value (ETH)">
          <input
            type="text"
            inputMode="decimal"
            value={draft.valueEth}
            onChange={(e) => onChange({ ...draft, valueEth: e.target.value })}
            placeholder="0"
            className={textInputClass(false)}
          />
        </Field>
      </div>
      <Field label="Calldata (data)">
        <textarea
          value={draft.calldata}
          onChange={(e) => onChange({ ...draft, calldata: e.target.value })}
          placeholder="0x"
          rows={3}
          className={
            'w-full rounded-md border bg-surface px-3 py-2 font-mono text-xs outline-none resize-none ' +
            (draft.calldata && !isHex(draft.calldata)
              ? 'border-warning focus:border-warning'
              : 'border-border focus:border-accent')
          }
        />
      </Field>
    </div>
  )
}

function DroposalFields({
  draft,
  onChange,
}: {
  draft: TxDraftDroposal
  onChange: (next: TxDraft) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Zora NFT Creator contract">
        <input
          type="text"
          value={draft.zoraNftCreator}
          onChange={(e) => onChange({ ...draft, zoraNftCreator: e.target.value })}
          placeholder="0x…"
          className={textInputClass(draft.zoraNftCreator.length > 0 && !isAddress(draft.zoraNftCreator))}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
        <Field label="Edition name">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="My Edition"
            className={textInputClass(false)}
          />
        </Field>
        <Field label="Symbol">
          <input
            type="text"
            value={draft.symbol}
            onChange={(e) => onChange({ ...draft, symbol: e.target.value.toUpperCase() })}
            placeholder="MYEDN"
            className={textInputClass(false)}
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          placeholder="Edition description…"
          rows={3}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent resize-none"
        />
      </Field>
      <Field label="Image URI (IPFS or HTTPS)">
        <input
          type="text"
          value={draft.imageUri}
          onChange={(e) => onChange({ ...draft, imageUri: e.target.value })}
          placeholder="ipfs://… or https://…"
          className={textInputClass(false)}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Mint price (ETH)">
          <input
            type="text"
            inputMode="decimal"
            value={draft.priceEth}
            onChange={(e) => onChange({ ...draft, priceEth: e.target.value })}
            placeholder="0"
            className={textInputClass(false)}
          />
        </Field>
        <Field label="Edition size (blank = open)">
          <input
            type="text"
            inputMode="numeric"
            value={draft.editionSize}
            onChange={(e) => onChange({ ...draft, editionSize: e.target.value.replace(/\D/g, '') })}
            placeholder="Unlimited"
            className={textInputClass(false)}
          />
        </Field>
        <Field label="Mint limit / wallet (blank = none)">
          <input
            type="text"
            inputMode="numeric"
            value={draft.mintLimitPerAddress}
            onChange={(e) =>
              onChange({ ...draft, mintLimitPerAddress: e.target.value.replace(/\D/g, '') })
            }
            placeholder="No limit"
            className={textInputClass(false)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Sale start (blank = immediately)">
          <input
            type="datetime-local"
            value={draft.saleStart}
            onChange={(e) => onChange({ ...draft, saleStart: e.target.value })}
            className={textInputClass(false)}
          />
        </Field>
        <Field label="Sale end (blank = no end)">
          <input
            type="datetime-local"
            value={draft.saleEnd}
            onChange={(e) => onChange({ ...draft, saleEnd: e.target.value })}
            className={textInputClass(false)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
        <Field label="Funds recipient">
          <input
            type="text"
            value={draft.fundsRecipient}
            onChange={(e) => onChange({ ...draft, fundsRecipient: e.target.value })}
            placeholder="0x… (who receives mint proceeds)"
            className={textInputClass(
              draft.fundsRecipient.length > 0 && !isAddress(draft.fundsRecipient)
            )}
          />
        </Field>
        <Field label="Royalty % (0–10)">
          <input
            type="text"
            inputMode="decimal"
            value={draft.royaltyPercent}
            onChange={(e) => onChange({ ...draft, royaltyPercent: e.target.value })}
            placeholder="5"
            className={textInputClass(false)}
          />
        </Field>
      </div>
      <Field label="Default admin (blank = treasury)">
        <input
          type="text"
          value={draft.defaultAdmin}
          onChange={(e) => onChange({ ...draft, defaultAdmin: e.target.value })}
          placeholder="0x… (defaults to treasury)"
          className={textInputClass(
            draft.defaultAdmin.length > 0 && !isAddress(draft.defaultAdmin)
          )}
        />
      </Field>
    </div>
  )
}

function StreamFields({
  draft,
  onChange,
  tokenMeta,
  onAddRelatedDraft,
}: {
  draft: TxDraftStream
  onChange: (next: TxDraft) => void
  tokenMeta: TokenMetaMap
  onAddRelatedDraft?: (extra: TxDraft) => void
}) {
  const meta: TokenMeta | undefined = isAddress(draft.token)
    ? tokenMeta[tokenKey(draft.token)]
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted-fg">
        Streams tokens linearly over time. You also need an{' '}
        <span className="font-mono">approve()</span> tx to the Sablier contract — use the
        button below once token + total amount are set.
      </div>
      <ApprovalQueueButton
        draft={draft}
        tokenMeta={tokenMeta}
        onAddRelatedDraft={onAddRelatedDraft}
      />
      <Field label="Sablier LockupLinear contract">
        <input
          type="text"
          value={draft.sablierLL}
          onChange={(e) => onChange({ ...draft, sablierLL: e.target.value })}
          placeholder="0x…"
          className={textInputClass(draft.sablierLL.length > 0 && !isAddress(draft.sablierLL))}
        />
      </Field>
      {daoConfig.treasuryTokens.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
            Quick pick
          </span>
          {daoConfig.treasuryTokens.map((t) => {
            const active = isAddress(draft.token) && tokenKey(t.address) === tokenKey(draft.token)
            return (
              <button
                key={t.address}
                type="button"
                onClick={() => onChange({ ...draft, token: t.address })}
                className={
                  active
                    ? 'rounded-full border border-accent bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent-strong'
                    : 'rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted-fg hover:text-fg'
                }
              >
                {t.symbol}
              </button>
            )
          })}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Token address">
          <input
            type="text"
            value={draft.token}
            onChange={(e) => onChange({ ...draft, token: e.target.value })}
            placeholder="0x…"
            className={textInputClass(draft.token.length > 0 && !isAddress(draft.token))}
          />
        </Field>
        <Field label="Recipient">
          <input
            type="text"
            value={draft.recipient}
            onChange={(e) => onChange({ ...draft, recipient: e.target.value })}
            placeholder="0x…"
            className={textInputClass(draft.recipient.length > 0 && !isAddress(draft.recipient))}
          />
        </Field>
      </div>
      {isAddress(draft.token) && (
        <div className="text-[12px] text-muted-fg">
          {meta ? (
            <>
              Token: <span className="text-fg">{meta.symbol ?? '—'}</span> · {meta.decimals} decimals
            </>
          ) : (
            <>Reading token metadata…</>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={`Total amount${meta?.symbol ? ` (${meta.symbol})` : ''}`}>
          <input
            type="text"
            inputMode="decimal"
            value={draft.totalAmount}
            onChange={(e) => onChange({ ...draft, totalAmount: e.target.value })}
            placeholder="1000"
            className={textInputClass(false)}
          />
        </Field>
        <Field label="Duration (days)">
          <input
            type="text"
            inputMode="decimal"
            value={draft.durationDays}
            onChange={(e) => onChange({ ...draft, durationDays: e.target.value })}
            placeholder="365"
            className={textInputClass(false)}
          />
        </Field>
        <Field label="Cliff (days, blank = none)">
          <input
            type="text"
            inputMode="decimal"
            value={draft.cliffDays}
            onChange={(e) => onChange({ ...draft, cliffDays: e.target.value })}
            placeholder="30"
            className={textInputClass(false)}
          />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={draft.cancelable}
          onClick={() => onChange({ ...draft, cancelable: !draft.cancelable })}
          className="relative h-5 w-9 flex-shrink-0 rounded-full border transition-colors"
          style={{
            background: draft.cancelable ? 'var(--accent)' : 'var(--surface-3)',
            borderColor: draft.cancelable ? 'var(--accent)' : 'var(--border)',
          }}
        >
          <span
            className="absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
            style={{ transform: draft.cancelable ? 'translateX(18px)' : 'translateX(2px)' }}
          />
        </button>
        <span className="text-[12.5px] text-muted-fg">
          Cancelable — sender can cancel the stream and reclaim unvested tokens
        </span>
      </div>
    </div>
  )
}

const NOUNS_BUILD_CHAIN_SLUG: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
  8453: 'base',
  7777777: 'zora',
  11155111: 'sepolia',
  84532: 'base-sepolia',
}

function nounsBuildProposalUrl(chainId: number, token: string): string | null {
  const slug = NOUNS_BUILD_CHAIN_SLUG[chainId]
  if (!slug) return null
  return `https://nouns.build/dao/${slug}/${token}/proposal/create`
}

/** Shared form for add_artwork + replace_artwork — calldata-only with a link-out. */
function CustomLikeFields({
  draft,
  onChange,
}: {
  draft: Extract<TxDraft, { kind: 'add_artwork' | 'replace_artwork' }>
  onChange: (next: TxDraft) => void
}) {
  const target = draft.target || daoConfig.addresses.metadata
  const fnName =
    draft.kind === 'add_artwork' ? 'addProperties' : 'deleteAndRecreateProperties'
  const nounsUrl = nounsBuildProposalUrl(daoConfig.chainId, daoConfig.addresses.token)

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-border bg-surface-2 px-3 py-3 text-[12.5px]">
        <div className="mb-2 font-semibold text-fg">
          Artwork updates require a layer pipeline
        </div>
        <p className="text-muted-fg">
          {draft.kind === 'add_artwork'
            ? 'Adding new traits or variants needs the full layer folder uploaded to IPFS in the expected '
            : 'Replacing artwork needs the full layer folder uploaded to IPFS in the expected '}
          <span className="font-mono">collection / trait / variant</span> structure, batched into
          calls to <span className="font-mono">{fnName}()</span> on the metadata renderer
          (max 500 items per tx).
        </p>
        <p className="mt-2 text-muted-fg">
          The cleanest way to generate this calldata today is to use nouns.build&apos;s artwork
          tools{nounsUrl ? ', then paste the resulting target + calldata back here.' : '.'}
        </p>
        {nounsUrl && (
          <a
            href={nounsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-strong hover:underline"
          >
            Open this DAO on nouns.build →
          </a>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px]">
        <Field label="Target address">
          <input
            type="text"
            value={target}
            onChange={(e) => onChange({ ...draft, target: e.target.value })}
            placeholder="0x…"
            className={textInputClass(target.length > 0 && !isAddress(target))}
          />
        </Field>
        <Field label="Value (ETH)">
          <input
            type="text"
            inputMode="decimal"
            value={draft.valueEth}
            onChange={(e) => onChange({ ...draft, valueEth: e.target.value })}
            placeholder="0"
            className={textInputClass(false)}
          />
        </Field>
      </div>
      <Field label="Calldata (hex)">
        <input
          type="text"
          value={draft.calldata}
          onChange={(e) => onChange({ ...draft, calldata: e.target.value })}
          placeholder="0x"
          className={textInputClass(!!draft.calldata && !isHex(draft.calldata))}
        />
      </Field>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-[12.5px] text-muted-fg">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function textInputClass(error: boolean): string {
  return [
    'w-full rounded-md border bg-surface px-3 py-2 font-mono text-xs outline-none',
    error ? 'border-warning focus:border-warning' : 'border-border focus:border-accent',
  ].join(' ')
}
