import type { Metadata } from 'next'

import { ProposalCreateForm } from '@/components/dao/ProposalCreateForm'
import {
  getTreasuryNftHoldings,
  getTreasuryTokenHoldings,
  type TreasuryNft,
  type TreasuryTokenHolding,
} from '@/lib/dao-data'

export const metadata: Metadata = {
  title: 'New proposal',
}

export const revalidate = 60

export default async function NewProposalPage() {
  let treasuryNfts: TreasuryNft[] = []
  let treasuryTokens: TreasuryTokenHolding[] = []
  await Promise.all([
    getTreasuryNftHoldings()
      .then((v) => {
        treasuryNfts = v
      })
      .catch(() => {}),
    getTreasuryTokenHoldings()
      .then((v) => {
        treasuryTokens = v
      })
      .catch(() => {}),
  ])
  return (
    <ProposalCreateForm treasuryNfts={treasuryNfts} treasuryTokens={treasuryTokens} />
  )
}
