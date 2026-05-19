'use client'

import { isAddress } from 'viem'

import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'
import {
  tokenKey,
  type TokenMeta,
  type TokenMetaMap,
  TX_KIND_LABELS,
  type TxDraft,
  validateDraft,
} from '@/lib/proposal-tx'
import { isHex } from '@/lib/proposal-validation'

type Props = {
  draft: TxDraft
  onChange: (next: TxDraft) => void
  onSave: () => void
  onCancel: () => void
  tokenMeta: TokenMetaMap
  /** Submit-button label (e.g. "Save", "Add to queue"). */
  saveLabel: string
}

export function DraftForm({
  draft,
  onChange,
  onSave,
  onCancel,
  tokenMeta,
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
          {draft.kind === 'custom' &&
            'Encode a raw contract call. You provide target, value, and calldata.'}
        </div>
      </div>

      {draft.kind === 'eth' && <EthFields draft={draft} onChange={onChange} />}
      {draft.kind === 'erc20' && (
        <Erc20Fields draft={draft} onChange={onChange} tokenMeta={tokenMeta} />
      )}
      {draft.kind === 'custom' && <CustomFields draft={draft} onChange={onChange} />}

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
          className={textInputClass(
            draft.recipient.length > 0 && !isAddress(draft.recipient)
          )}
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
            className={textInputClass(
              draft.recipient.length > 0 && !isAddress(draft.recipient)
            )}
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
              Token: <span className="text-fg">{meta.symbol ?? '—'}</span> ·{' '}
              {meta.decimals} decimals
            </>
          ) : (
            <>Reading token metadata…</>
          )}
        </div>
      )}
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
            className={textInputClass(
              draft.target.length > 0 && !isAddress(draft.target)
            )}
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
