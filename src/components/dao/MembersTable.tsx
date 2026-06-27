'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ActiveBadge } from '@/components/dao/ActiveBadge'
import { WalletPill } from '@/components/dao/WalletPill'
import { Button } from '@/components/ui/button'

export type MembersTableRow = {
  ens: string | null
  /** Truncated address, displayed in the table cell. */
  addr: string
  /** Full 0x address, used to link to /members/[address]. */
  addrFull: string
  votes: number
  pct: number
  joined: string
  active: boolean
}

type Props = {
  members: MembersTableRow[]
  totalMembers: number
  activeMembers: number
}

export function MembersTable({ members, totalMembers, activeMembers }: Props) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const ql = q.toLowerCase()
    const matched = members.filter((m) =>
      ((m.ens ?? '') + m.addr + m.addrFull).toLowerCase().includes(ql)
    )
    // Active members first so they read at a glance. Array.sort is stable, so
    // the incoming token-count order is preserved within each group.
    return matched.sort((a, b) => Number(b.active) - Number(a.active))
  }, [members, q])

  const exportCsv = () => {
    const header = ['ens', 'address', 'votes', 'vote_pct', 'joined', 'active']
    const rows = filtered.map((m) => [
      m.ens ?? '',
      m.addrFull,
      m.votes,
      m.pct,
      m.joined,
      m.active ? 'true' : 'false',
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'members.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:flex-wrap sm:items-start">
        <div>
          <h1 className="font-display text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
            Members
          </h1>
          <p className="mt-1 text-muted-fg">
            {totalMembers.toLocaleString('en-US')} members · {activeMembers} active in
            last 5 proposals
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:cap-nudge sm:flex-row sm:items-center">
          <div className="flex min-h-11 w-full items-center rounded-md border border-border bg-surface px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 sm:w-auto sm:min-w-[260px] lg:min-w-[420px]">
            <Search className="h-4 w-4 text-muted-fg" />
            <input
              type="text"
              placeholder="Search…"
              aria-label="Search members"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="ml-2 flex-1 border-0 bg-transparent py-2.5 text-sm outline-none"
            />
          </div>
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Mobile: card list (<md) */}
      <ul className="grid gap-3 md:hidden">
        {filtered.map((m) => (
          <li key={m.addrFull} className="rounded-xl border border-border bg-surface p-4">
            <WalletPill address={m.addrFull} ens={m.ens} showAvatar size="md" />
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-fg">
              <span>
                <strong className="font-semibold text-fg">{m.votes}</strong> votes
              </span>
              <span>{m.pct}%</span>
              <span>Joined {m.joined}</span>
              <ActiveBadge active={m.active} />
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="rounded-xl border border-border bg-surface px-6 py-12 text-center text-muted-fg">
            No members match your search.
          </li>
        )}
      </ul>

      {/* Desktop: table (md+) */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th>Delegate</Th>
              <Th>Votes</Th>
              <Th>Vote %</Th>
              <Th>Joined</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.addrFull} className="hover:bg-surface-2">
                <Td>
                  <WalletPill address={m.addrFull} ens={m.ens} showAvatar size="md" />
                </Td>
                <Td>
                  <strong className="font-semibold">{m.votes}</strong>
                </Td>
                <Td>{m.pct}%</Td>
                <Td muted>{m.joined}</Td>
                <Td>
                  <ActiveBadge active={m.active} />
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-fg">
                  No members match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="border-b border-border px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-fg">
      {children}
    </th>
  )
}

function Td({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td
      className={`border-b border-border px-5 py-3.5 last:border-b-0 ${muted ? 'text-muted-fg' : ''}`}
    >
      {children}
    </td>
  )
}
