import { Auction_OrderBy, OrderDirection, SubgraphSDK } from '@buildeross/sdk/subgraph'
import { redirect } from 'next/navigation'

import { daoConfig } from '@/lib/dao.config'

export const revalidate = 30

/**
 * Resolve "the current auction" for this DAO by tokenId and redirect.
 * Used by the Header nav link so it always points to the live auction
 * regardless of fork.
 *
 * Note: `redirect()` works by throwing a NEXT_REDIRECT — keep it outside the
 * try/catch.
 */
export default async function LatestAuctionRedirect() {
  const tokenAddressLc = daoConfig.addresses.token.toLowerCase() as `0x${string}`

  let tokenId: number | null = null
  try {
    const resp = await SubgraphSDK.connect(daoConfig.chainId).findAuctions({
      where: { dao: tokenAddressLc },
      orderBy: Auction_OrderBy.EndTime,
      orderDirection: OrderDirection.Desc,
      first: 1,
    })
    const auction = resp.auctions[0]
    if (auction) tokenId = Number(auction.token.tokenId)
  } catch (e) {
    console.error('[auction/latest] failed to resolve current auction:', e)
  }

  redirect(tokenId !== null ? `/auction/${tokenId}` : '/auction/0')
}
