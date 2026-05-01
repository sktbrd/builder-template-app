import type { ActivityType } from '@/lib/mockData'

const DOT: Record<ActivityType, string> = {
  bid: 'bg-accent',
  vote: 'bg-success',
  prop: 'bg-warning',
}

type Item = {
  type: ActivityType
  who: string
  what: string
  time: string
}

export function ActivityFeed({ items }: { items: Item[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((a, i) => (
        <li
          key={i}
          className="grid grid-cols-[12px_1fr] items-start gap-3 text-sm"
        >
          <span className={`mt-2 h-2 w-2 rounded-full ${DOT[a.type]}`} />
          <div>
            <div>
              <strong className="font-semibold">{a.who}</strong>{' '}
              <span className="text-muted-fg">{a.what}</span>
            </div>
            <div className="text-[12.5px] text-muted-fg">{a.time}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}
