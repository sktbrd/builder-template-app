export type Tx = {
  target: string
  valueEth: string
  calldata: string
}

export function isHex(s: string): boolean {
  if (s === '0x' || s === '') return true
  return /^0x[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0
}

export function parseWriteError(err: unknown): string {
  if (!err) return 'Something went wrong.'
  const msg = err instanceof Error ? err.message : String(err)
  if (/User rejected|user rejected/i.test(msg)) return 'Transaction rejected.'
  if (/insufficient funds/i.test(msg)) return 'Insufficient funds for gas.'
  if (/below proposal threshold|propose below threshold/i.test(msg))
    return 'You are below the proposal threshold.'
  return msg.split('\n')[0]
}

/**
 * Builder subgraph protocol (`nouns-builder/apps/subgraph/src/governor.ts`):
 * the `description` arg to `governor.propose(...)` is a JSON object the
 * indexer parses out into separate `title` / `description` fields. The
 * fallback (anything that isn't valid JSON-with-`title`) gets split on
 * `&&` and otherwise dumps the whole string into `title`, leaving the
 * description empty — that's the bug this format avoids.
 *
 * Mirrors `apps/web/src/.../ReviewProposalForm.tsx`'s `JSON.stringify({...})`.
 */
export function composeDescription(title: string, body: string): string {
  return JSON.stringify({
    version: 1,
    title: title.trim(),
    description: body.trim(),
  })
}
