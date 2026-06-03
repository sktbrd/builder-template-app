import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { DroposalDetail } from '@/components/coins/DroposalDetail'
import { assertCoinsEnabled } from '@/lib/coins-gate'
import { daoConfig } from '@/lib/dao.config'
import { getDroposalByNumber } from '@/lib/droposals'

export const revalidate = 30

type Params = Promise<{ id: string }>

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  const n = Number.parseInt(id, 10)
  if (Number.isNaN(n)) return { title: 'Droposal' }
  const data = await getDroposalByNumber(n)
  if (!data) return { title: 'Droposal' }
  return {
    title: `${data.name || data.title} ($${data.symbol})`,
    description:
      data.description ?? `Zora NFT edition deployed by ${daoConfig.name} governance.`,
    alternates: { canonical: `/droposals/${id}` },
  }
}

export default async function DroposalDetailPage({ params }: { params: Params }) {
  assertCoinsEnabled()
  const { id } = await params
  const n = Number.parseInt(id, 10)
  if (Number.isNaN(n)) notFound()

  const data = await getDroposalByNumber(n)
  if (!data) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/coins?tab=droposals"
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          All content
        </Link>
      </div>
      <DroposalDetail data={data} />
    </div>
  )
}
