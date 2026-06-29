import type { DecodedTransactionData } from '@buildeross/types'
import { useQuery } from '@tanstack/react-query'

/**
 * Client hook: decode a proposal transaction whose selector the offline decoder
 * didn't recognize, by calling our same-origin /api/decode (Etherscan ABI +
 * viem). Returns null on any failure so callers fall back to the raw card.
 */

async function fetchDecoded(
  chainId: number,
  target: string,
  calldata: string
): Promise<DecodedTransactionData | null> {
  const res = await fetch('/api/decode', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contract: target, calldata, chain: chainId }),
  })
  if (!res.ok) return null
  return (await res.json()) as DecodedTransactionData
}

export function useDecodedTx(params: {
  chainId: number
  target: string
  calldata: string
  enabled: boolean
}) {
  const { chainId, target, calldata, enabled } = params
  return useQuery({
    queryKey: ['decode-tx', chainId, target.toLowerCase(), calldata],
    queryFn: () => fetchDecoded(chainId, target, calldata),
    enabled,
    // A given (chain, address, calldata) always decodes to the same thing.
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  })
}
