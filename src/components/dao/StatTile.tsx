type Props = {
  icon?: React.ReactNode
  label: string
  value: React.ReactNode
  sub?: string
}

export function StatTile({ icon, label, value, sub }: Props) {
  return (
    <div className="flex items-center gap-3">
      {icon !== undefined && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/15 text-base font-bold text-accent-strong">
          {icon}
        </div>
      )}
      <div className="flex flex-col">
        <div className="text-[18px] font-bold leading-tight text-fg">{value}</div>
        <div className="mt-0.5 text-xs text-muted-fg">{label}</div>
        {sub && <div className="text-xs text-muted-fg">{sub}</div>}
      </div>
    </div>
  )
}
