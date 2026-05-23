'use client'

import { isAddress } from 'viem'

import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'
import {
  CUSTOM_LIKE_KINDS,
  tokenKey,
  type TokenMeta,
  type TokenMetaMap,
  TX_KIND_LABELS,
  type TxDraft,
  type TxDraftDroposal,
  type TxDraftNft,
  type TxDraftStream,
  validateDraft,
} from '@/lib/proposal-tx'
import { isHex } from '@/lib/proposal-validation'

type Props = {
  draft: TxDraft
  onChange: (next: TxDraft) => void
  onSave: () => void
  onCancel: () => void
  tokenMeta: TokenMetaMap
  saveLabel: string
}

export function DraftForm({ draft, onChange, onSave, onCancel, tokenMeta, saveLabel }: Props) {
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
          {draft.kind === 'delegate' && 'Delegate the treasury\'s voting power to the specified address.'}
          {draft.kind === 'pause_auction' && 'Pause or unpause the DAO auction house contract.'}
          {draft.kind === 'stream' && 'Create a continuous ERC-20 token stream via Sablier LockupLinear.'}
          {draft.kind === 'airdrop' && 'Deploy a Sablier merkle campaign for token airdrops. Provide the MerkleFactory contract address and encoded calldata.'}
          {draft.kind === 'milestone' && 'Schedule a series of token releases tied to project milestones. Provide the target contract and encoded calldata.'}
          {draft.kind === 'walletconnect' && 'Execute a transaction via WalletConnect. Provide the target contract address and encoded calldata.'}
          {draft.kind === 'pin_asset' && 'Propose pinning a token or NFT to the treasury display. Provide the registry contract and encoded calldata.'}
          {draft.kind === 'droposal' && 'Create a single-edition ERC721 drop via Zora NFT Creator.'}
          {draft.kind === 'add_artwork' && 'Add new artwork properties to the metadata renderer. Provide encoded calldata for addProperties().'}
          {draft.kind === 'replace_artwork' && 'Replace all artwork by calling deleteAndRecreateProperties() on the metadata renderer.'}
        </div>
      </div>

      {draft.kind === 'eth' && <EthFields draft={draft} onChange={onChange} />}
      {draft.kind === 'erc20' && (
        <Erc20Fields draft={draft} onChange={onChange} tokenMeta={tokenMeta} />
      )}
      {draft.kind === 'nft' && <NftFields draft={draft} onChange={onChange} />}
      {draft.kind === 'custom' && <CustomFields draft={draft} onChange={onChange} />}
      {draft.kind === 'mint_gov' && <MintGovFields draft={draft} onChange={onChange} />}
      {draft.kind === 'delegate' && <DelegateFields draft={draft} onChange={onChange} />}
      {draft.kind === 'pause_auction' && <PauseAuctionFields draft={draft} onChange={onChange} />}
      {draft.kind === 'droposal' && <DroposalFields draft={draft} onChange={onChange} />}
      {draft.kind === 'stream' && (
        <StreamFields draft={draft} onChange={onChange} tokenMeta={tokenMeta} />
      )}
      {CUSTOM_LIKE_KINDS.has(draft.kind) && (
        <CustomLikeFields
          draft={draft as Extract<TxDraft, { kind: 'airdrop' | 'milestone' | 'walletconnect' | 'pin_asset' | 'add_artwork' | 'replace_artwork' }>}
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
}: {
  draft: Extract<TxDraft, { kind: 'erc20' }>
  onChange: (next: TxDraft) => void
  tokenMeta: TokenMetaMap
}) {
  const meta: TokenMeta | undefined = isAddress(draft.token)
    ? tokenMeta[tokenKey(draft.token)]
    : undefined

  return (
    <div className="flex flex-col gap-3">
      {daoConfig.treasuryTokens.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
            Quick pick
          </span>
          {daoConfig.treasuryTokens.map((t) => {
            const active = tokenKey(t.address) === tokenKey(draft.token)
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
        <Field label={`Amount${meta?.symbol ? ` (${meta.symbol})` : ''}`}>
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
}: {
  draft: TxDraftNft
  onChange: (next: TxDraft) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_140px]">
        <Field label="NFT contract">
          <input
            type="text"
            value={draft.contract}
            onChange={(e) => onChange({ ...draft, contract: e.target.value })}
            placeholder="0x…"
            className={textInputClass(draft.contract.length > 0 && !isAddress(draft.contract))}
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
      </div>
      <div className="text-[12px] text-muted-fg">
        Transfers token #{draft.tokenId || '?'} from the treasury using{' '}
        <span className="font-mono">safeTransferFrom</span>.
      </div>
    </div>
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
  return (
    <div className="flex flex-col gap-3">
      <Field label="Delegate address">
        <input
          type="text"
          value={draft.delegatee}
          onChange={(e) => onChange({ ...draft, delegatee: e.target.value })}
          placeholder="0x…"
          className={textInputClass(draft.delegatee.length > 0 && !isAddress(draft.delegatee))}
        />
      </Field>
      <div className="text-[12px] text-muted-fg">
        Calls <span className="font-mono">delegate(address)</span> on the DAO token contract,
        delegating the treasury&apos;s voting power to the specified address.
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
}: {
  draft: TxDraftStream
  onChange: (next: TxDraft) => void
  tokenMeta: TokenMetaMap
}) {
  const meta: TokenMeta | undefined = isAddress(draft.token)
    ? tokenMeta[tokenKey(draft.token)]
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted-fg">
        Streams tokens linearly over time. You must also add a separate{' '}
        <strong>Send ERC-20</strong> transaction to first approve or transfer tokens to the Sablier
        contract.
      </div>
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

/** Shared form for all custom-like kinds (airdrop, milestone, etc.) */
function CustomLikeFields({
  draft,
  onChange,
}: {
  draft: Extract<TxDraft, { kind: 'airdrop' | 'milestone' | 'walletconnect' | 'pin_asset' | 'add_artwork' | 'replace_artwork' }>
  onChange: (next: TxDraft) => void
}) {
  const prefilledTarget =
    draft.kind === 'add_artwork' || draft.kind === 'replace_artwork'
      ? daoConfig.addresses.metadata
      : ''

  const target = draft.target || prefilledTarget

  const hints: Partial<Record<typeof draft.kind, string>> = {
    airdrop: 'Use the Sablier merkle campaign creator to generate calldata.',
    milestone: 'Encode your milestone schedule using the target contract ABI.',
    walletconnect: 'Connect the treasury wallet via WalletConnect and capture the transaction data.',
    pin_asset: 'Provide the registry contract that manages treasury display assets.',
    add_artwork: `Target is pre-filled with the metadata renderer. Encode addProperties() calldata.`,
    replace_artwork: `Target is pre-filled with the metadata renderer. Encode deleteAndRecreateProperties() calldata.`,
  }

  return (
    <div className="flex flex-col gap-3">
      {hints[draft.kind] && (
        <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted-fg">
          {hints[draft.kind]}
        </div>
      )}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
