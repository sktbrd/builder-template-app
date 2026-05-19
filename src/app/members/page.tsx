import type { Metadata } from 'next'

import { MembersTable } from '@/components/dao/MembersTable'
import { getMembersPageData } from '@/lib/dao-data'

export const metadata: Metadata = {
  title: 'Members',
}

export const revalidate = 120

export default async function MembersPage() {
  const data = await getMembersPageData()
  return (
    <MembersTable
      members={data.members.map((m) => ({
        ens: m.ens,
        addr: m.addrShort,
        addrFull: m.addr,
        votes: m.votes,
        pct: m.pct,
        joined: m.joined,
        active: m.active,
      }))}
      totalMembers={data.totalMembers}
      activeMembers={data.activeMembers}
    />
  )
}
