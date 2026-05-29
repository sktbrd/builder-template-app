'use client'

import { useEffect, useState } from 'react'

// Live "Voting ends in Xd Yh" label for the active proposal header. The detail
// page is a server component, so the ticking clock has to live in a client
// island. Mirrors the countdown in ProposalActiveCard so the list card and the
// detail header agree.
function format(secs: number): string {
  if (secs <= 0) return 'Voting ended'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (d > 0) return `Voting ends in ${d}d ${h}h`
  if (h > 0) return `Voting ends in ${h}h ${m}m`
  return `Voting ends in ${m}m`
}

export function VoteCountdownLabel({ voteEnd }: { voteEnd: number }) {
  const [secs, setSecs] = useState(() =>
    voteEnd > 0 ? Math.max(0, voteEnd - Math.floor(Date.now() / 1000)) : 0
  )
  useEffect(() => {
    if (!voteEnd) return
    const id = setInterval(
      () => setSecs(Math.max(0, voteEnd - Math.floor(Date.now() / 1000))),
      60_000
    )
    return () => clearInterval(id)
  }, [voteEnd])

  if (!voteEnd) return null
  return <span className="text-[12.5px] text-muted-fg">{format(secs)}</span>
}
